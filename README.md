# Code Block Copier

A VS Code extension that lets you copy code blocks with line numbers, file paths, and preserved formatting.

## Features

- **Line Numbers**: Automatically adds line numbers to the beginning of each line
- **File Path**: Includes the original file path in copied code

## Installation

1. Open VS Code
2. Go to Extensions view (Ctrl+Shift+X)
3. Search for "Code Block Copier"
4. Click Install

## How to Use

1. Select the code you want to copy
2. Press F1 and select "Code Block Copier: Copy Code Block"
3. Paste anywhere you need it


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

## License

MIT License

---

**Enjoy coding and sharing!**