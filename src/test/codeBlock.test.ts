import * as assert from 'assert';
import { getMarkdownLanguage, makeCodeBlock, makeMarkdownCodeBlock } from '../codeBlock';

suite('makeCodeBlock', () => {
    test('single line includes path header and line number', () => {
        const result = makeCodeBlock('const x = 1;', 'src/app.ts', 5);
        assert.strictEqual(result, 'path: src/app.ts\n5: const x = 1;');
    });

    test('multi-line code has correct line numbers', () => {
        const code = 'line one\nline two\nline three';
        const result = makeCodeBlock(code, 'src/index.ts', 1);
        const expected = [
            'path: src/index.ts',
            '1: line one',
            '2: line two',
            '3: line three',
        ].join('\n');
        assert.strictEqual(result, expected);
    });

    test('line numbers are right-padded when crossing digit boundaries', () => {
        const lines = Array.from({ length: 3 }, (_, i) => `line ${i}`);
        const code = lines.join('\n');
        const result = makeCodeBlock(code, 'file.ts', 9);
        const expected = [
            'path: file.ts',
            ' 9: line 0',
            '10: line 1',
            '11: line 2',
        ].join('\n');
        assert.strictEqual(result, expected);
    });

    test('handles empty lines within code', () => {
        const code = 'first\n\nlast';
        const result = makeCodeBlock(code, 'test.ts', 1);
        const expected = [
            'path: test.ts',
            '1: first',
            '2: ',
            '3: last',
        ].join('\n');
        assert.strictEqual(result, expected);
    });

    test('preserves indentation in code', () => {
        const code = 'function foo() {\n    return 1;\n}';
        const result = makeCodeBlock(code, 'src/utils.ts', 10);
        const expected = [
            'path: src/utils.ts',
            '10: function foo() {',
            '11:     return 1;',
            '12: }',
        ].join('\n');
        assert.strictEqual(result, expected);
    });
});


suite('makeMarkdownCodeBlock', () => {
    test('uses language from file extension when available', () => {
        const result = makeMarkdownCodeBlock('const x = 1;', 'src/app.ts');
        const expected = [
            'path: src/app.ts',
            '```typescript',
            'const x = 1;',
            '```',
        ].join('\n');
        assert.strictEqual(result, expected);
    });

    test('uses plain fence when extension has no known markdown language', () => {
        const result = makeMarkdownCodeBlock('raw content', 'notes.customext');
        const expected = [
            'path: notes.customext',
            '```',
            'raw content',
            '```',
        ].join('\n');
        assert.strictEqual(result, expected);
    });

    test('returns empty language for files without extension', () => {
        assert.strictEqual(getMarkdownLanguage('Dockerfile'), '');
    });
});
