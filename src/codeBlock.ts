export function makeCodeBlock(
    code: string,
    filePath: string,
    startLine: number,
): string {
    const codeLines = code.split('\n');
    const maxLineNumber = startLine + codeLines.length - 1;
    const maxPadding = maxLineNumber.toString().length;

    const lineNumberedCode = codeLines.map((line, index) => {
        const lineNumber = startLine + index;
        const paddedLineNumber = lineNumber.toString().padStart(maxPadding, ' ');
        return `${paddedLineNumber}: ${line}`;
    });

    return [`path: ${filePath}`, lineNumberedCode.join('\n')].join('\n');
}
