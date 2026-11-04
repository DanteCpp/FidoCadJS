import { getString } from '../i18n/i18n.js';

/** One shortcut row: the key combo(s) and what it does. */
interface Shortcut {
    keys: string[];
    description: string;
}

/** A titled group of related shortcuts. */
interface ShortcutGroup {
    title: string;
    items: Shortcut[];
}

/**
 * The full FidoCadJS keyboard map. Kept in sync with KeyboardController
 * (single-key tools, transforms, arrowheads, clipboard) and MenuBar (file/edit
 * accelerators). Modifiers are shown as `Ctrl`/`Alt` on every platform: the
 * browser reserves most ⌘ combos on macOS (⌘N, ⌘S, ⌘W, …), so the app's
 * bindings fire on the Ctrl key there too.
 */
const SHORTCUT_GROUPS: ShortcutGroup[] = [
    {
        title: 'File',
        items: [
            { keys: ['Ctrl', 'N'], description: 'New circuit' },
            { keys: ['Ctrl', 'O'], description: 'Open file' },
            { keys: ['Ctrl', 'S'], description: 'Save' },
            { keys: ['Ctrl', 'Enter'], description: 'Save and keep browser tab open' },
            { keys: ['Ctrl', 'W'], description: 'Close browser tab (browser shortcut)' },
            { keys: ['Shift', 'I'], description: 'Attach background image' },
            { keys: ['Ctrl', 'Shift', 'S'], description: 'Save as…' },
            { keys: ['Ctrl', 'E'], description: 'Export' },
            { keys: ['Ctrl', 'P'], description: 'Print' },
            { keys: ['Ctrl', 'G'], description: 'Show circuit code' },
        ],
    },
    {
        title: 'Edit',
        items: [
            { keys: ['Ctrl', 'Z'], description: 'Undo' },
            { keys: ['Ctrl', 'Y'], description: 'Redo' },
            { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' },
            { keys: ['Ctrl', 'X'], description: 'Cut selection' },
            { keys: ['Ctrl', 'C'], description: 'Copy selection' },
            { keys: ['Ctrl', 'V'], description: 'Paste' },
            { keys: ['Ctrl', 'D'], description: 'Duplicate selection' },
            { keys: ['Ctrl', 'I'], description: 'Copy as image' },
            { keys: ['Ctrl', 'A'], description: 'Select all' },
            { keys: ['Delete / Backspace'], description: 'Delete selection' },
            { keys: ['P / F2'], description: 'Selection properties' },
            { keys: ['[ / ]'], description: 'Previous / next layer, also moves selection' },
        ],
    },
    {
        title: 'Tools',
        items: [
            { keys: ['S / A'], description: 'Selection tool' },
            { keys: ['L'], description: 'Line' },
            { keys: ['T'], description: 'Text' },
            { keys: ['Shift', 'B'], description: 'Bézier curve' },
            { keys: ['Shift', 'P'], description: 'Polygon' },
            { keys: ['O'], description: 'Complex curve' },
            { keys: ['E'], description: 'Ellipse' },
            { keys: ['B'], description: 'Rectangle' },
            { keys: ['J / C'], description: 'Connection' },
            { keys: ['Shift', 'T'], description: 'PCB track' },
            { keys: ['Z'], description: 'PCB pad' },
        ],
    },
    {
        title: 'Transform selection',
        items: [
            { keys: ['Shift', 'M'], description: 'Move' },
            { keys: ['R'], description: 'Rotate (also the component being placed)' },
            { keys: ['M'], description: 'Mirror (also the component being placed)' },
            { keys: ['←/→/↑/↓'], description: 'Nudge by one grid step' },
            { keys: ['Alt', '←/→/↑/↓'], description: 'Nudge by one unit' },
            { keys: ['Shift', 'S'], description: 'Toggle start arrowhead' },
            { keys: ['Shift', 'E'], description: 'Toggle end arrowhead' },
        ],
    },
    {
        title: 'View',
        items: [
            { keys: ['+'], description: 'Zoom in' },
            { keys: ['−'], description: 'Zoom out' },
            { keys: ['0 / Space / Home'], description: 'Fit drawing to view' },
            { keys: ['G'], description: 'Toggle grid' },
            { keys: ['Shift', 'G'], description: 'Toggle snap to grid' },
            { keys: ['F'], description: 'Toggle filled rectangles and ellipses' },
            { keys: ['I'], description: 'Show / hide coordinate info' },
            { keys: ['Ctrl', 'B'], description: 'Show / hide symbol library' },
        ],
    },
    {
        title: 'General',
        items: [
            { keys: ['K'], description: 'Search keyboard shortcuts' },
            { keys: ['Enter'], description: 'Finish current line / place pasted drawing' },
            { keys: ['Esc'], description: 'Finish line / deselect / cancel current action' },
        ],
    },
];

/** Build a styled <kbd> element for one key cap. */
function keyCap(label: string): HTMLElement {
    const kbd = document.createElement('kbd');
    kbd.textContent = label;
    kbd.style.cssText =
        'display: inline-block; padding: 2px 7px; margin: 0 2px; ' +
        'font-family: monospace; font-size: 11px; line-height: 1.4; color: #333; ' +
        'background: #f6f6f6; border: 1px solid #ccc; border-bottom-width: 2px; ' +
        'border-radius: 4px; white-space: nowrap;';
    return kbd;
}

/**
 * Show the keyboard-shortcut cheatsheet as a modal overlay.
 */
export function showShortcutsDialog(): void {
    if (document.querySelector('[data-testid="shortcuts-dialog"]')) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overlay = document.createElement('div');
    overlay.setAttribute('data-testid', 'shortcuts-dialog');
    overlay.style.cssText =
        'position: fixed; inset: 0; background: rgba(0,0,0,0.35); ' +
        'z-index: 10000; display: flex; align-items: center; justify-content: center;';

    const box = document.createElement('div');
    box.style.cssText =
        'background: white; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.25); ' +
        'padding: 24px 28px; width: min(680px, 92vw); max-height: 84vh; overflow-y: auto; ' +
        'font-family: sans-serif; font-size: 13px; color: #333;';

    const title = document.createElement('h2');
    title.textContent = getString('Shortcuts_title');
    title.style.cssText = 'margin: 0 0 16px; font-size: 18px; font-weight: 700;';
    box.appendChild(title);

    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Search shortcuts';
    search.setAttribute('aria-label', 'Search shortcuts');
    search.style.cssText = 'width:100%; box-sizing:border-box; padding:8px; margin-bottom:12px;';
    box.appendChild(search);

    // Two-column masonry-ish layout: groups flow into columns.
    const grid = document.createElement('div');
    grid.style.cssText =
        'display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); ' +
        'gap: 8px 24px; align-items: start;';

    for (const group of SHORTCUT_GROUPS) {
        const section = document.createElement('section');
        section.style.cssText = 'break-inside: avoid; margin-bottom: 8px;';

        const heading = document.createElement('h3');
        heading.textContent = group.title;
        heading.style.cssText =
            'margin: 0 0 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; ' +
            'letter-spacing: 0.05em; color: #888; border-bottom: 1px solid #eee; padding-bottom: 3px;';
        section.appendChild(heading);

        for (const item of group.items) {
            const row = document.createElement('div');
            row.dataset.shortcut = `${item.keys.join(' ')} ${item.description}`.toLowerCase();
            row.style.cssText =
                'display: flex; align-items: baseline; justify-content: space-between; ' +
                'gap: 12px; padding: 3px 0;';

            const desc = document.createElement('span');
            desc.textContent = item.description;
            desc.style.cssText = 'color: #444; flex: 1;';

            const keys = document.createElement('span');
            keys.style.cssText = 'white-space: nowrap; flex-shrink: 0;';
            item.keys.forEach((k, i) => {
                if (i > 0) {
                    const plus = document.createElement('span');
                    plus.textContent = '+';
                    plus.style.cssText = 'color: #aaa; font-size: 11px;';
                    keys.appendChild(plus);
                }
                keys.appendChild(keyCap(k));
            });

            row.appendChild(desc);
            row.appendChild(keys);
            section.appendChild(row);
        }

        grid.appendChild(section);
    }
    search.addEventListener('input', () => {
        const query = search.value.trim().toLowerCase();
        for (const section of grid.querySelectorAll('section')) {
            const groupMatches = section
                .querySelector('h3')!
                .textContent!.toLowerCase()
                .includes(query);
            let visible = false;
            for (const row of section.querySelectorAll<HTMLElement>('[data-shortcut]')) {
                const matches = groupMatches || row.dataset.shortcut!.includes(query);
                row.style.display = matches ? 'flex' : 'none';
                visible ||= matches;
            }
            section.hidden = !visible;
        }
    });
    box.appendChild(grid);

    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top: 20px; text-align: right;';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = getString('Close');
    closeBtn.style.cssText =
        'padding: 8px 24px; border: 1px solid #ccc; border-radius: 4px; ' +
        'background: #f0f0f0; cursor: pointer; font-size: 13px;';
    footer.appendChild(closeBtn);
    box.appendChild(footer);

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const onKey = (e: KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
            e.preventDefault();
            cleanup();
        }
    };
    const cleanup = () => {
        document.removeEventListener('keydown', onKey, true);
        if (overlay.parentNode) document.body.removeChild(overlay);
        previousFocus?.focus();
    };

    closeBtn.addEventListener('click', cleanup);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup();
    });
    // Capture phase so Escape closes the dialog before the editor's global
    // keydown handler treats it as a "switch to Selection tool" shortcut.
    document.addEventListener('keydown', onKey, true);
    search.focus();
}
