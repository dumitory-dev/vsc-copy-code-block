# Code Block Copier

[![CI](https://github.com/dumitory-dev/vsc-copy-code-block/actions/workflows/ci.yml/badge.svg)](https://github.com/dumitory-dev/vsc-copy-code-block/actions/workflows/ci.yml)
[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/dumitory-dev.vsc-code-block-copier)](https://marketplace.visualstudio.com/items?itemName=dumitory-dev.vsc-code-block-copier)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Copy clean, shareable code snippets from VS Code with file metadata, stable formatting, and optional Markdown fences.

This extension is built for documentation, code review discussions, bug reports, and any workflow where raw copy/paste is not enough.

## Table of Contents

- [Why Use It](#why-use-it)
- [Features](#features)
- [Installation](#installation)
- [Commands](#commands)
- [How It Works](#how-it-works)
- [Output Examples](#output-examples)
- [Development](#development)
- [Contributing](#contributing)
- [Authors](#authors)
- [License](#license)

## Why Use It

When sharing code, context matters. Code Block Copier includes:

- Path context (`path: ...`) so readers know where the snippet came from
- Accurate line numbering for quick discussion and review references
- Preserved indentation and whitespace
- Clipboard append mode for collecting multiple snippets in one paste
- Markdown fences with language auto-detection for docs and issue trackers

## Features

- Line-numbered code blocks with proper left-padding alignment
- Relative file path header
- Full-file fallback when no selection is made
- Append mode to combine snippets with a blank-line separator
- Markdown mode with language inference from file extension
- Editor context-menu integration

## Installation

### From Marketplace

1. Open VS Code.
2. Go to the Extensions view (`Ctrl+Shift+X`).
3. Search for `Code Block Copier`.
4. Select the extension and click Install.

Direct link: [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=dumitory-dev.vsc-code-block-copier)

### From Source

```bash
git clone https://github.com/dumitory-dev/vsc-copy-code-block.git
cd vsc-copy-code-block
npm install
```

## Commands

All commands are available from the Command Palette and the editor context menu.

| Command Palette Title | Command ID | Description |
| --- | --- | --- |
| `Code Block Copier: Copy Code Block` | `vsc-code-block-copier.copyCodeBlock` | Copy snippet with `path:` header and line numbers |
| `Code Block Copier: Copy Code Block (Append)` | `vsc-code-block-copier.copyCodeBlockAppend` | Same as above, appended to current clipboard |
| `Code Block Copier: Copy Code Block (Markdown)` | `vsc-code-block-copier.copyCodeBlockMarkdown` | Copy as fenced Markdown block |
| `Code Block Copier: Copy Code Block (Markdown, Append)` | `vsc-code-block-copier.copyCodeBlockMarkdownAppend` | Markdown output appended to clipboard |

## How It Works

1. Select code in an active editor, or leave selection empty to copy the full file.
2. Run one of the copy commands.
3. The extension writes formatted output to your clipboard.

Behavior details:

- If no editor is active, the extension shows an error message.
- In line-number mode, start line reflects the original selection line.
- In append mode, snippets are separated by one blank line.
- Success notification includes the number of copied lines.

## Output Examples

### Line Number Mode

```text
path: src/example/file.ts
1: function greet(name: string): string {
2:     return `Hello, ${name}!`;
3: }
4:
5: console.log(greet("World"));
```

Line numbers are right-aligned when digits increase:

```text
path: src/app.ts
 98: const config = loadConfig();
 99: validateConfig(config);
100: startApp(config);
```

### Markdown Mode

~~~text
path: src/data/user.json
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "age": 25
}
```
~~~

If the file extension is unknown, the extension uses plain triple backticks without a language tag.

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
| --- | --- |
| `npm run compile` | Type-check, lint, and build |
| `npm run compile:types` | Type-check only (`tsc --noEmit`) |
| `npm run compile:lint` | Lint source files |
| `npm run compile:build` | Bundle extension with esbuild |
| `npm run watch` | Watch and rebuild during development |
| `npm run package` | Production package build |
| `npm run test:unit` | Unit tests |
| `npm test` | Full test suite |

### Project Structure

```text
src/
  clipboard.ts          # Clipboard append helper
  codeBlock.ts          # Formatting and markdown language mapping
  extension.ts          # Command registration and execution
  test/
    clipboard.test.ts
    codeBlock.test.ts
    extension.test.ts
```

## Contributing

Issues and pull requests are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Run tests and lint locally.
4. Open a pull request with a clear summary and examples.

## Authors

- [dumitory-dev](https://github.com/dumitory-dev)
- [Pomidorry](https://github.com/Pomidorry)

## License

[MIT](LICENSE)
