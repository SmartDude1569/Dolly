import { existsSync, mkdirSync, statSync } from "node:fs";
import { basename, extname, isAbsolute, join, relative } from "node:path";
import { Command } from "commander";
import * as dotenv from "dotenv";
import ffmpeg from "fluent-ffmpeg";
import { separateStems } from "./audioshake.js";
import { uploadFileTemporary } from "./upload.js";

dotenv.config();

// TODO: clean up this main file

const formatScriptPath = (scriptPath: string) => {
    if (!scriptPath) {
        return scriptPath;
    }

    if (isAbsolute(scriptPath)) {
        const relativePath = relative(process.cwd(), scriptPath);
        if (relativePath && !relativePath.startsWith("..")) {
            return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
        }
    }

    return scriptPath;
};

const deriveInvocationCommand = () => {
    const npmScript = process.env.npm_lifecycle_script;
    if (npmScript) {
        return npmScript;
    }

    const scriptPath = process.argv[1];
    const formattedScriptPath = scriptPath ? formatScriptPath(scriptPath) : undefined;
    const execPath = process.execPath ?? process.argv[0] ?? "";
    const execArgs = process.execArgv ?? [];
    const envCommand = process.env._;

    if (envCommand) {
        if (formattedScriptPath && envCommand.includes(formattedScriptPath)) {
            return envCommand;
        }

        if (formattedScriptPath && /ts-node(?:$|[^a-z])/i.test(envCommand)) {
            return `ts-node ${formattedScriptPath}`;
        }

        if (!formattedScriptPath && envCommand !== execPath) {
            return envCommand;
        }
    }

    if (scriptPath && formattedScriptPath) {
        try {
            if (existsSync(scriptPath)) {
                const stats = statSync(scriptPath);
                if ((stats.mode & 0o111) !== 0) {
                    return formattedScriptPath;
                }
            }
        } catch {
            // Ignore filesystem errors when probing for executable scripts.
        }
    }

    const execName = execPath ? basename(execPath) : "";
    const parts = [
        execName || execPath,
        ...execArgs,
        formattedScriptPath,
    ].filter(Boolean);

    if (parts.length > 0) {
        return parts.join(" ");
    }

    return formattedScriptPath ?? "node";
};

const SUPPORTED_AUDIO_EXTENSIONS = new Set([
    ".mp3",
    ".wav",
    ".flac",
    ".aac",
    ".ogg",
    ".m4a",
    ".wma",
    ".aiff",
    ".alac",
    ".opus",
]);

const isSupportedAudioFile = (filePath: string) => {
    const extension = extname(filePath).toLowerCase();
    return SUPPORTED_AUDIO_EXTENSIONS.has(extension);
};

const convertToWav = (inputPath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const inputBasename = basename(inputPath, extname(inputPath));
        const outputDir = join(process.cwd(), "converted");

        // Create converted directory if it doesn't exist
        if (!existsSync(outputDir)) {
            mkdirSync(outputDir, { recursive: true });
        }

        const outputPath = join(outputDir, `${inputBasename}.wav`);

        console.log(`Converting ${basename(inputPath)} to 24-bit WAV...`);

        ffmpeg(inputPath)
            .audioCodec("pcm_s24le") // 24-bit PCM, little-endian
            .audioChannels(2) // Stereo
            .audioFrequency(44100) // 44.1kHz sample rate
            .format("wav")
            .on("start", (commandLine) => {
                console.log(`Running: ${commandLine}`);
            })
            .on("progress", (progress) => {
                if (progress.percent) {
                    process.stdout.write(`\rProgress: ${progress.percent.toFixed(1)}%`);
                }
            })
            .on("end", () => {
                console.log(`\nConversion complete: ${outputPath}`);
                resolve(outputPath);
            })
            .on("error", (err) => {
                console.error(`\nConversion failed: ${err.message}`);
                reject(err);
            })
            .save(outputPath);
    });
};

const supportedList = Array.from(SUPPORTED_AUDIO_EXTENSIONS).join(", ");

const program = new Command();

program
    .name(deriveInvocationCommand())
    .description("An automated level creation tool for Guitar/Clone Hero.")
    .option("-f, --file <path>", "path to audio file")
    .option("-s, --song <name>", "song to search")
    .argument("[file]", "audio file path (alternative to --file)")
    .addHelpText("after", `\nSupported audio formats: ${supportedList}`)
    .showHelpAfterError()
    .parse(process.argv);

const options = program.opts<{ file?: string; song?: string }>();
const args = program.args;

let filePath = options.file ?? args.at(-1);
const songName = options.song;

if (!filePath && !songName) {
    program.help();
}

if (filePath && !existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

if (filePath && !isSupportedAudioFile(filePath)) {
    const extension = extname(filePath);
    const extensionLabel = extension ? extension.slice(1) : "unknown";
    console.error(`Unsupported audio format: ${filePath} (${extensionLabel})`);
    console.error(`\nSupported audio formats: ${supportedList}\n`);
    process.exit(1);
}

if (!filePath) {
    // TODO: search youtube for song, download, etc
    filePath = "./downloaded/song.mp3";
}

// Convert the audio file to 24-bit WAV
let wavPath: string;
try {
    wavPath = await convertToWav(filePath);
    console.log(`\nReady to process: ${wavPath}`);
} catch (error) {
    console.error("Failed to convert audio file");
    if (error instanceof Error) {
        console.error(error.message);
    }
    process.exit(1);
}

// Upload the converted file to temporary hosting to get a URL for AudioShake
let audioUrl: string;
try {
    audioUrl = await uploadFileTemporary(wavPath);

    // AudioShake requires HTTPS URLs - validate and upgrade if needed
    if (audioUrl.startsWith('http://')) {
        console.log('Upgrading HTTP URL to HTTPS for AudioShake compatibility...');
        audioUrl = audioUrl.replace('http://', 'https://');
    }

    if (!audioUrl.startsWith('https://')) {
        throw new Error('Invalid URL format - AudioShake requires HTTPS URLs');
    }

    console.log(`Audio URL: ${audioUrl}`);
} catch (error) {
    console.error("Failed to upload audio file");
    if (error instanceof Error) {
        console.error(error.message);
    }
    process.exit(1);
}

const AUDIOSHAKE_API_KEY = process.env.AUDIOSHAKE_API_KEY!;

if (!AUDIOSHAKE_API_KEY) {
    console.error(":(");
    process.exit(1);
}

// Perform stem separation
try {
    const stems = await separateStems(audioUrl, AUDIOSHAKE_API_KEY);

    // Print download URLs for each stem
    for (const stem of stems) {
        console.log(`\n${stem.model}:`);
        for (const [format, url] of Object.entries(stem.urls)) {
            console.log(`  ${format}: ${url}`);
        }
    }

    // TODO: Download stems and use them for chart generation
    // - Vocals stem could be analyzed for lyrics/vocal patterns
    // - Instrumental stem could be analyzed for guitar/bass/drums
} catch (error) {
    console.error('AudioShake API error:');
    if (error instanceof Error) {
        console.error(error.message);
    }
    process.exit(1);
}