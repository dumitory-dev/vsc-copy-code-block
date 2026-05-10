export function makeCodeBlock(
    code: string,
    filePath: string,
    startLine: number,
): string {
    const lineNumberedCode = addLineNumbers(code, startLine);
    return [`path: ${filePath}`, lineNumberedCode].join('\n');
}

function addLineNumbers(code: string, startLine: number): string {
    const normalizedCode = normalizeLineEndings(code);
    const codeLines = normalizedCode.split('\n');
    const maxLineNumber = startLine + codeLines.length - 1;
    const maxPadding = maxLineNumber.toString().length;

    return codeLines
        .map((line, index) => {
            const lineNumber = startLine + index;
            const paddedLineNumber = lineNumber.toString().padStart(maxPadding, ' ');
            return `${paddedLineNumber}: ${line}`;
        })
        .join('\n');
}

const extensionToMarkdownLanguage: Record<string, string> = {
    cjs: 'javascript',
    cpp: 'cpp',
    cs: 'csharp',
    css: 'css',
    go: 'go',
    htm: 'html',
    html: 'html',
    java: 'java',
    js: 'javascript',
    json: 'json',
    jsx: 'jsx',
    md: 'markdown',
    mjs: 'javascript',
    php: 'php',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    sh: 'bash',
    sql: 'sql',
    svg: 'svg',
    ts: 'typescript',
    tsx: 'tsx',
    txt: 'text',
    vue: 'vue',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
};

export function getMarkdownLanguage(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();

    if (!extension || extension === filePath.toLowerCase()) {
        return '';
    }

    return extensionToMarkdownLanguage[extension] ?? '';
}

export function makeMarkdownCodeBlock(
    code: string,
    filePath: string,
    startLine: number,
): string {
    const language = getMarkdownLanguage(filePath);
    const openingFence = language ? `\`\`\`${language}` : '```';
    const lineNumberedCode = addLineNumbers(code, startLine);

    return [`path: ${filePath}`, openingFence, lineNumberedCode, '```'].join('\n');
}

function normalizeLineEndings(value: string): string {
    return value.replace(/\r\n?/g, '\n');
}
