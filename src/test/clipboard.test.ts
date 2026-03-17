import * as assert from 'assert';
import { appendToClipboard } from '../clipboard';

suite('appendToClipboard', () => {
    test('appends new snippet at the end when clipboard has content', () => {
        const result = appendToClipboard('first block', 'second block');
        assert.strictEqual(result, 'first block\n\nsecond block');
    });

    test('returns new snippet when clipboard is empty', () => {
        const result = appendToClipboard('', 'only block');
        assert.strictEqual(result, 'only block');
    });
});
