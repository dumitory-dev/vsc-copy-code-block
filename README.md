# Code Block Copier

[![CI](https://github.com/dumitory-dev/vsc-copy-code-block/actions/workflows/ci.yml/badge.svg)](https://github.com/dumitory-dev/vsc-copy-code-block/actions/workflows/ci.yml)
[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/dumitory-dev.vsc-code-block-copier)](https://marketplace.visualstudio.com/items?itemName=dumitory-dev.vsc-code-block-copier)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A VS Code extension that lets you copy code blocks with line numbers, file paths, and preserved formatting — perfect for documentation, code reviews, and sharing.

## Features

- **Line Numbers**: Automatically adds padded line numbers matching the source file
- **File Path**: Includes the relative file path as a header
- **Preserved Formatting**: Keeps original indentation and whitespace

## Installation

1. Open VS Code
2. Go to Extensions view (`Ctrl+Shift+X`)
3. Search for **"Code Block Copier"**
4. Click **Install**

Or install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=dumitory-dev.vsc-code-block-copier).

## Usage

1. Select the code you want to copy
2. Open the Command Palette (`F1` or `Ctrl+Shift+P`)
3. Run **"Code Block Copier: Copy Code Block"**
4. Paste anywhere — the formatted block is in your clipboard

## Example Output

When you copy code, it will look like this:

```
path: src/example/file.ts
1: function greet(name: string): string {
2:     return `Hello, ${name}!`;
3: }
4: 
5: console.log(greet("World"));
```

Line numbers are right-aligned when they cross digit boundaries:

```
path: src/app.ts
 98: const config = loadConfig();
 99: validateConfig(config);
100: startApp(config);
```

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [npm](https://www.npmjs.com/)

### Setup

```bash
git clone https://github.com/dumitory-dev/vsc-copy-code-block.git
cd vsc-copy-code-block
npm install
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run compile` | Type-check, lint, and build |
| `npm run compile:types` | Type-check only (`tsc --noEmit`) |
| `npm run compile:lint` | Lint with ESLint |
| `npm run compile:build` | Build with esbuild |
| `npm run watch` | Watch mode for development |
| `npm run package` | Production build (type-check + minified bundle) |
| `npm run test:unit` | Run unit tests |
| `npm test` | Run all tests (unit + integration) |

### Project Structure

```
src/
├── codeBlock.ts          # Pure formatting logic (makeCodeBlock)
├── extension.ts          # VS Code extension activation & command registration
└── test/
    ├── codeBlock.test.ts # Unit tests for formatting logic
    └── extension.test.ts # Integration tests (run in VS Code)
```

## License

[MIT](LICENSE)
