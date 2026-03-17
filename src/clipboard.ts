export function appendToClipboard(existingClipboard: string, nextSnippet: string): string {
    return existingClipboard
        ? [existingClipboard, nextSnippet].join('\n\n')
        : nextSnippet;
}
