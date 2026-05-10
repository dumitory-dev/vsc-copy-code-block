import * as fs from 'fs';
import * as path from 'path';
import hljs from 'highlight.js';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import type { ScreenshotTheme, SyntaxPalette } from './theme';

const FONT_SIZE = 14;
const LINE_HEIGHT = Math.round(FONT_SIZE * 1.5);
const CHAR_WIDTH = FONT_SIZE * 0.6;
const HEADER_HEIGHT = 32;
const HEADER_FONT_SIZE = 12;
const PADDING_X = 16;
const PADDING_Y = 12;
const LINE_NUMBER_GAP = 14;
const PIXEL_RATIO = 2;
const TAB_WIDTH = 4;
const FONT_FAMILY = 'monospace';

let wasmReady: Promise<void> | null = null;

function ensureWasmInitialized(): Promise<void> {
    if (!wasmReady) {
        const wasmPath = path.join(__dirname, 'resvg.wasm');
        const wasmBuffer = fs.readFileSync(wasmPath);
        wasmReady = initWasm(wasmBuffer);
    }
    return wasmReady;
}

type LoadedFonts = { buffers: Uint8Array[]; family: string };

let cachedFonts: LoadedFonts | null = null;

function loadMonospaceFonts(): LoadedFonts {
    if (cachedFonts) {
        return cachedFonts;
    }

    type Candidate = { paths: string[]; family: string };
    const candidates: Candidate[] = [];

    if (process.platform === 'win32') {
        const winDir = process.env.WINDIR || 'C:\\Windows';
        const fontsDir = path.join(winDir, 'Fonts');
        candidates.push(
            { paths: [path.join(fontsDir, 'consola.ttf')], family: 'Consolas' },
            { paths: [path.join(fontsDir, 'cour.ttf')], family: 'Courier New' },
        );
    } else if (process.platform === 'darwin') {
        candidates.push(
            { paths: ['/System/Library/Fonts/Menlo.ttc', '/Library/Fonts/Menlo.ttc'], family: 'Menlo' },
            { paths: ['/System/Library/Fonts/Monaco.ttf'], family: 'Monaco' },
            { paths: ['/Library/Fonts/Courier New.ttf', '/System/Library/Fonts/Courier New.ttf'], family: 'Courier New' },
        );
    } else {
        candidates.push(
            { paths: ['/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', '/usr/share/fonts/TTF/DejaVuSansMono.ttf'], family: 'DejaVu Sans Mono' },
            { paths: ['/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf', '/usr/share/fonts/liberation/LiberationMono-Regular.ttf'], family: 'Liberation Mono' },
        );
    }

    const buffers: Uint8Array[] = [];
    let resolvedFamily = '';

    for (const { paths, family } of candidates) {
        for (const fontPath of paths) {
            try {
                const buffer = fs.readFileSync(fontPath);
                buffers.push(new Uint8Array(buffer));
                if (!resolvedFamily) {
                    resolvedFamily = family;
                }
                break;
            } catch {
                // try next path / candidate
            }
        }
    }

    if (!resolvedFamily) {
        throw new Error('Could not locate a system monospace font for screenshot rendering.');
    }

    cachedFonts = { buffers, family: resolvedFamily };
    return cachedFonts;
}

type Token = { text: string; color: string };

export async function renderCodeToPngDataUrl(
    code: string,
    fileName: string,
    startLine: number,
    languageId: string,
    theme: ScreenshotTheme,
): Promise<string> {
    await ensureWasmInitialized();
    const fonts = loadMonospaceFonts();

    const expandedCode = code.replace(/\t/g, ' '.repeat(TAB_WIDTH));
    const rawLines = expandedCode.split('\n');
    const tokenLines = tokenizeLines(rawLines, languageId, theme);

    const lineCount = rawLines.length;
    const lineNumbers = rawLines.map((_, i) => String(startLine + i));
    const maxLineNumberDigits = lineNumbers[lineNumbers.length - 1]?.length ?? 1;
    const lineNumberColumnWidth = maxLineNumberDigits * CHAR_WIDTH;

    const longestLineChars = rawLines.reduce((max, line) => Math.max(max, line.length), 0);
    const codeColumnWidth = longestLineChars * CHAR_WIDTH;

    const innerWidth = lineNumberColumnWidth + LINE_NUMBER_GAP + codeColumnWidth;
    const totalWidth = Math.ceil(PADDING_X * 2 + innerWidth);
    const totalHeight = Math.ceil(HEADER_HEIGHT + PADDING_Y * 2 + lineCount * LINE_HEIGHT);

    const svg = buildSvg({
        tokenLines,
        lineNumbers,
        fileName,
        theme,
        totalWidth,
        totalHeight,
        lineNumberColumnWidth,
    });

    const resvg = new Resvg(svg, {
        fitTo: { mode: 'zoom', value: PIXEL_RATIO },
        font: {
            fontBuffers: fonts.buffers,
            defaultFontFamily: fonts.family,
            monospaceFamily: fonts.family,
        },
    });
    const png = resvg.render().asPng();
    return `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
}

function tokenizeLines(lines: string[], languageId: string, theme: ScreenshotTheme): Token[][] {
    const fallback: Token[][] = lines.map((line) => [{ text: line, color: theme.codeText }]);

    if (!languageId || !hljs.getLanguage(languageId)) {
        return fallback;
    }

    let html: string;
    try {
        html = hljs.highlight(lines.join('\n'), { language: languageId, ignoreIllegals: true }).value;
    } catch {
        return fallback;
    }

    const flatTokens = parseHljsHtml(html, theme.palette, theme.codeText);
    return splitTokensByLines(flatTokens, lines.length, theme.codeText);
}

function parseHljsHtml(html: string, palette: SyntaxPalette, defaultColor: string): Token[] {
    const tokens: Token[] = [];
    const stack: string[][] = [];
    let i = 0;

    while (i < html.length) {
        const ch = html[i];
        if (ch === '<') {
            const closeIdx = html.indexOf('>', i);
            if (closeIdx === -1) {
                break;
            }
            const tag = html.slice(i + 1, closeIdx);
            if (tag.startsWith('/')) {
                stack.pop();
            } else if (tag.startsWith('span')) {
                const classMatch = tag.match(/class="([^"]+)"/);
                const classes = classMatch ? classMatch[1].split(/\s+/) : [];
                stack.push(classes);
            }
            i = closeIdx + 1;
            continue;
        }

        const nextLt = html.indexOf('<', i);
        const end = nextLt === -1 ? html.length : nextLt;
        const raw = html.slice(i, end);
        i = end;
        if (!raw) {
            continue;
        }
        const text = decodeHtmlEntities(raw);
        const color = pickColor(stack, palette, defaultColor);
        tokens.push({ text, color });
    }

    return tokens;
}

const HLJS_CLASS_TO_PALETTE: Record<string, keyof SyntaxPalette> = {
    'hljs-keyword': 'keyword',
    'hljs-built_in': 'builtin',
    'hljs-type': 'type',
    'hljs-literal': 'literal',
    'hljs-number': 'number',
    'hljs-regexp': 'string',
    'hljs-string': 'string',
    'hljs-subst': 'variable',
    'hljs-symbol': 'literal',
    'hljs-class': 'type',
    'hljs-function': 'function',
    'hljs-title': 'title',
    'hljs-title.function_': 'function',
    'hljs-title.class_': 'type',
    'hljs-params': 'variable',
    'hljs-comment': 'comment',
    'hljs-doctag': 'comment',
    'hljs-meta': 'meta',
    'hljs-meta-keyword': 'keyword',
    'hljs-meta-string': 'string',
    'hljs-section': 'title',
    'hljs-tag': 'tag',
    'hljs-name': 'tag',
    'hljs-attr': 'attribute',
    'hljs-attribute': 'attribute',
    'hljs-variable': 'variable',
    'hljs-template-variable': 'variable',
    'hljs-bullet': 'operator',
    'hljs-code': 'string',
    'hljs-emphasis': 'string',
    'hljs-strong': 'keyword',
    'hljs-formula': 'literal',
    'hljs-quote': 'comment',
    'hljs-link': 'string',
    'hljs-selector-tag': 'tag',
    'hljs-selector-id': 'attribute',
    'hljs-selector-class': 'type',
    'hljs-selector-attr': 'attribute',
    'hljs-selector-pseudo': 'function',
    'hljs-property': 'attribute',
    'hljs-addition': 'string',
    'hljs-deletion': 'keyword',
    'hljs-operator': 'operator',
    'hljs-punctuation': 'operator',
};

function pickColor(stack: string[][], palette: SyntaxPalette, defaultColor: string): string {
    for (let i = stack.length - 1; i >= 0; i--) {
        for (const cls of stack[i]) {
            const key = HLJS_CLASS_TO_PALETTE[cls];
            if (key) {
                return palette[key];
            }
        }
    }
    return defaultColor;
}

function splitTokensByLines(tokens: Token[], expectedLines: number, defaultColor: string): Token[][] {
    const result: Token[][] = [[]];

    for (const token of tokens) {
        const parts = token.text.split('\n');
        for (let i = 0; i < parts.length; i++) {
            if (i > 0) {
                result.push([]);
            }
            const segment = parts[i];
            if (segment.length > 0) {
                result[result.length - 1].push({ text: segment, color: token.color });
            }
        }
    }

    while (result.length < expectedLines) {
        result.push([]);
    }

    return result.map((line) => (line.length === 0 ? [{ text: '', color: defaultColor }] : line));
}

function decodeHtmlEntities(value: string): string {
    return value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&');
}

function escapeXmlText(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeXmlAttr(value: string): string {
    return escapeXmlText(value).replace(/"/g, '&quot;');
}

type SvgBuildArgs = {
    tokenLines: Token[][];
    lineNumbers: string[];
    fileName: string;
    theme: ScreenshotTheme;
    totalWidth: number;
    totalHeight: number;
    lineNumberColumnWidth: number;
};

function buildSvg(args: SvgBuildArgs): string {
    const { tokenLines, lineNumbers, fileName, theme, totalWidth, totalHeight, lineNumberColumnWidth } = args;

    const codeStartX = PADDING_X + lineNumberColumnWidth + LINE_NUMBER_GAP;
    const codeStartY = HEADER_HEIGHT + PADDING_Y;
    const baselineOffset = Math.round(FONT_SIZE * 0.8);
    const headerBaseline = Math.round(HEADER_HEIGHT / 2 + HEADER_FONT_SIZE * 0.35);

    const lineNumberSvg = lineNumbers
        .map((label, i) => {
            const y = codeStartY + i * LINE_HEIGHT + baselineOffset;
            const x = PADDING_X + lineNumberColumnWidth;
            return `<text x="${x}" y="${y}" text-anchor="end" fill="${theme.lineNumber}" font-family="${escapeXmlAttr(FONT_FAMILY)}" font-size="${FONT_SIZE}" xml:space="preserve">${escapeXmlText(label)}</text>`;
        })
        .join('');

    const codeSvg = tokenLines
        .map((tokens, i) => {
            const y = codeStartY + i * LINE_HEIGHT + baselineOffset;
            const tspans = tokens
                .map((token) => {
                    const text = escapeXmlText(token.text);
                    return `<tspan fill="${token.color}" xml:space="preserve">${text}</tspan>`;
                })
                .join('');
            return `<text x="${codeStartX}" y="${y}" font-family="${escapeXmlAttr(FONT_FAMILY)}" font-size="${FONT_SIZE}" xml:space="preserve">${tspans}</text>`;
        })
        .join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">
<rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="${theme.background}"/>
<rect x="0" y="0" width="${totalWidth}" height="${HEADER_HEIGHT}" fill="${theme.headerBackground}"/>
<rect x="0" y="${HEADER_HEIGHT - 1}" width="${totalWidth}" height="1" fill="${theme.border}"/>
<rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="none" stroke="${theme.border}" stroke-width="1"/>
<text x="${PADDING_X}" y="${headerBaseline}" fill="${theme.headerText}" font-family="${escapeXmlAttr(FONT_FAMILY)}" font-size="${HEADER_FONT_SIZE}" xml:space="preserve">${escapeXmlText(fileName)}</text>
${lineNumberSvg}
${codeSvg}
</svg>`;
}
