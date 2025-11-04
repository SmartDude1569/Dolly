import { existsSync, statSync } from "node:fs";
import { basename, extname, isAbsolute, relative } from "node:path";
import { Command } from "commander";

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

const filePath = options.file ?? args.at(-1);
const songName = options.song;

if (!filePath && !songName) {
    program.help();
}

if (!filePath) {
    console.error("Error: No file path provided");
    process.exit(1);
}

if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

if (!isSupportedAudioFile(filePath)) {
    const extension = extname(filePath);
    const extensionLabel = extension ? extension.slice(1) : "unknown";
    console.error(`Unsupported audio format: ${filePath} (${extensionLabel})`);
    console.error(`\nSupported audio formats: ${supportedList}\n`);
    process.exit(1);
}