import { SCREENSHOT_THEMES, type ScreenshotTheme } from './theme';

export type PickerMessage = { type: 'select'; themeId: string; scope: 'user' | 'workspace' };

export function isPickerMessage(message: unknown): message is PickerMessage {
    if (!message || typeof message !== 'object') {
        return false;
    }

    const candidate = message as { type?: unknown; themeId?: unknown; scope?: unknown };
    return (
        candidate.type === 'select' &&
        typeof candidate.themeId === 'string' &&
        (candidate.scope === 'user' || candidate.scope === 'workspace')
    );
}

export function buildThemePickerHtml(currentThemeId: string, hasWorkspace: boolean): string {
    const cards = Object.entries(SCREENSHOT_THEMES)
        .map(([id, theme]) => renderThemeCard(id, theme, id === currentThemeId))
        .join('\n');

    const workspaceButton = hasWorkspace
        ? `<button type="button" class="scope-btn" data-scope="workspace">Workspace Settings</button>`
        : `<button type="button" class="scope-btn" data-scope="workspace" disabled title="No workspace open">Workspace Settings</button>`;

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      margin: 0;
      padding: 24px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    h1 {
      margin: 0 0 6px;
      font-size: 20px;
      font-weight: 600;
    }
    .subtitle {
      margin: 0 0 20px;
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
    }
    .scope {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 20px;
      padding: 12px 14px;
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-widget-border, var(--vscode-editorWidget-border, transparent));
      border-radius: 4px;
    }
    .scope-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-right: 4px;
    }
    .scope-btn {
      padding: 4px 12px;
      font-size: 12px;
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 3px;
      background: transparent;
      color: var(--vscode-foreground);
      cursor: pointer;
      font-family: inherit;
    }
    .scope-btn:hover:not(:disabled) {
      background: var(--vscode-toolbar-hoverBackground);
    }
    .scope-btn.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: var(--vscode-button-background);
    }
    .scope-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 14px;
    }
    .card {
      position: relative;
      display: block;
      cursor: pointer;
      border: 2px solid transparent;
      border-radius: 6px;
      padding: 10px;
      background: var(--vscode-editorWidget-background);
      transition: border-color 0.15s, transform 0.05s;
    }
    .card:hover {
      border-color: var(--vscode-focusBorder);
    }
    .card:active {
      transform: scale(0.99);
    }
    .card.selected {
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 1px var(--vscode-focusBorder);
    }
    .card input[type="radio"] {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .radio-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid var(--vscode-input-border, var(--vscode-foreground));
      flex-shrink: 0;
      position: relative;
    }
    .card.selected .radio-dot {
      border-color: var(--vscode-focusBorder);
    }
    .card.selected .radio-dot::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--vscode-focusBorder);
    }
    .name-block {
      flex: 1;
      margin-left: 10px;
    }
    .name {
      font-size: 13px;
      font-weight: 600;
      line-height: 1.2;
    }
    .desc {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
      line-height: 1.3;
    }
    .saved-tag {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 8px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      opacity: 0;
      transition: opacity 0.2s;
    }
    .card.just-saved .saved-tag {
      opacity: 1;
    }
    .preview {
      border: 1px solid var(--preview-border);
      border-radius: 3px;
      overflow: hidden;
      font-family: Consolas, "Courier New", monospace;
    }
    .preview-header {
      padding: 4px 8px;
      font-size: 10px;
      border-bottom: 1px solid var(--preview-border);
    }
    .preview-code {
      display: grid;
      grid-template-columns: auto 1fr;
      column-gap: 10px;
      padding: 6px 10px;
      font-size: 11px;
      line-height: 1.5;
    }
    .preview-ln { text-align: right; }
    .swatches {
      display: flex;
      gap: 4px;
      margin-top: 8px;
    }
    .swatch {
      width: 14px;
      height: 14px;
      border-radius: 3px;
      border: 1px solid var(--vscode-widget-border, transparent);
    }
  </style>
</head>
<body>
  <h1>Choose Screenshot Theme</h1>
  <p class="subtitle">Pick a color palette for generated code screenshots. Selection saves automatically.</p>

  <div class="scope">
    <span class="scope-label">Save to:</span>
    <button type="button" class="scope-btn active" data-scope="user">User Settings</button>
    ${workspaceButton}
  </div>

  <div class="grid">
${cards}
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let scope = 'user';

    document.querySelectorAll('.scope-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        document.querySelectorAll('.scope-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        scope = btn.dataset.scope;
      });
    });

    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', () => {
        const themeId = card.dataset.themeId;
        document.querySelectorAll('.card').forEach(c => c.classList.remove('selected', 'just-saved'));
        card.classList.add('selected');
        vscode.postMessage({ type: 'select', themeId, scope });
      });
    });

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg && msg.type === 'saved') {
        const card = document.querySelector('.card[data-theme-id="' + msg.themeId + '"]');
        if (!card) return;
        card.classList.add('just-saved');
        setTimeout(() => card.classList.remove('just-saved'), 1500);
      }
    });
  </script>
</body>
</html>`;
}

function renderThemeCard(id: string, theme: ScreenshotTheme, isCurrent: boolean): string {
    const selectedClass = isCurrent ? ' selected' : '';
    const checked = isCurrent ? ' checked' : '';

    return `    <div class="card${selectedClass}" data-theme-id="${id}" style="--preview-border: ${theme.border};">
      <input type="radio" name="theme" value="${id}"${checked} />
      <div class="card-head">
        <div class="radio-dot"></div>
        <div class="name-block">
          <div class="name">${escapeHtml(theme.label)}</div>
          <div class="desc">${escapeHtml(theme.description)}</div>
        </div>
        <span class="saved-tag">Saved ✓</span>
      </div>
      <div class="preview" style="background: ${theme.background};">
        <div class="preview-header" style="background: ${theme.headerBackground}; color: ${theme.headerText};">example.ts</div>
        <div class="preview-code">
          <span class="preview-ln" style="color: ${theme.lineNumber};">1</span>
          <span style="color: ${theme.codeText};">function hello() {</span>
          <span class="preview-ln" style="color: ${theme.lineNumber};">2</span>
          <span style="color: ${theme.codeText};">  return "hi";</span>
          <span class="preview-ln" style="color: ${theme.lineNumber};">3</span>
          <span style="color: ${theme.codeText};">}</span>
        </div>
      </div>
      <div class="swatches">
        <div class="swatch" style="background: ${theme.background};" title="Background"></div>
        <div class="swatch" style="background: ${theme.headerBackground};" title="Header"></div>
        <div class="swatch" style="background: ${theme.codeText};" title="Code text"></div>
        <div class="swatch" style="background: ${theme.lineNumber};" title="Line numbers"></div>
        <div class="swatch" style="background: ${theme.border};" title="Border"></div>
      </div>
    </div>`;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
