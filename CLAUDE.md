# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dolly is a CLI tool for automated level creation for Guitar Hero/Clone Hero. It accepts audio files as input, converts them to 24-bit WAV format, and will generate chart files for the rhythm game.

**Dependencies**: Requires ffmpeg to be installed on the system for audio conversion.

## Development Commands

### Build
```bash
npx tsc
```
Compiles TypeScript from `src/` to `dist/` with source maps and declaration files.

### Run (Development)
```bash
node --loader ts-node/esm src/index.ts [options]
```
Or use tsx/ts-node to run TypeScript directly during development.

### Run (After Build)
```bash
node dist/index.js [options]
```

## TypeScript Configuration

The project uses strict TypeScript settings with:
- **Module system**: ESNext with `nodenext` module resolution
- **Strict mode enabled** with additional strictness:
  - `noUncheckedIndexedAccess`: true
  - `exactOptionalPropertyTypes`: true
  - `noUnusedLocals` and `noUnusedParameters`: true
- **Output**: `dist/` directory with source maps and declarations
- **Isolated modules**: Each file must be independently compilable

## Architecture

### CLI Entry Point (src/index.ts)

The main entry point uses Commander.js for CLI argument parsing with two input methods:
1. File path via `-f, --file <path>` option or positional argument
2. Song name via `-s, --song <name>` option (search functionality - not yet implemented)

**Supported Audio Formats**: .mp3, .wav, .flac, .aac, .ogg, .m4a, .wma, .aiff, .alac, .opus

### Key Utilities

**deriveInvocationCommand()**: Automatically determines how the script was invoked (npm script, direct execution, ts-node, etc.) to provide accurate help text. Checks multiple sources:
- `npm_lifecycle_script` environment variable
- Process arguments and execution path
- File permissions for executable scripts

**formatScriptPath()**: Converts absolute paths to relative paths from cwd when displaying in help/errors.

**isSupportedAudioFile()**: Validates file extensions against the supported audio format list.

**convertToWav()**: Converts input audio files to 24-bit WAV format using ffmpeg:
- Output format: 24-bit PCM (pcm_s24le), stereo, 44.1kHz
- Creates a `converted/` directory for output files
- Provides real-time progress feedback during conversion
- Returns a Promise that resolves with the output file path

## Code Patterns

- Use ES modules (`import`/`export`) - the project has `"type": "module"` in package.json
- Commander.js is used for CLI - follow its patterns for adding new commands/options
- Audio conversion uses fluent-ffmpeg wrapper (requires ffmpeg installed on system)
- Top-level await is supported for async operations in the main flow
- Error handling exits with status code 1 and descriptive console.error messages
- File system operations use Node's built-in `fs` and `path` modules
- Converted audio files are stored in `converted/` directory at the project root
