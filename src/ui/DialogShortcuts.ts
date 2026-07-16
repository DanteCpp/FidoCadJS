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
            { keys: ['Ctrl', 'X'], description: 'Cut selection' },
            { keys: ['Ctrl', 'C'], description: 'Copy selection' },
            { keys: ['Ctrl', 'V'], description: 'Paste' },
            { keys: ['Ctrl', 'D'], description: 'Duplicate selection' },
            { keys: ['Ctrl', 'I'], description: 'Copy as image' },
            { keys: ['Ctrl', 'A'], description: 'Select all' },
            { keys: ['Delete'], description: 'Delete selection' },
        ],
    },
    {
        title: 'Tools',
        items: [
            { keys: ['A'], description: 'Selection tool' },
            { keys: ['L'], description: 'Line' },
            { keys: ['T'], description: 'Text' },
            { keys: ['B'], description: 'Bézier curve' },
            { keys: ['P'], description: 'Polygon' },
            { keys: ['O'], description: 'Complex curve' },
            { keys: ['E'], description: 'Ellipse' },
            { keys: ['G'], description: 'Rectangle' },
            { keys: ['C'], description: 'Connection' },
            { keys: ['I'], description: 'PCB track' },
            { keys: ['Z'], description: 'PCB pad' },
        ],
    },
    {
        title: 'Transform selection',
        items: [
            { keys: ['M'], description: 'Move' },
            { keys: ['R'], description: 'Rotate' },
            { keys: ['S'], description: 'Mirror' },
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
            { keys: ['Space'], description: 'Fit drawing to view' },
        ],
    },
    {
        title: 'General',
        items: [{ keys: ['Esc'], description: 'Deselect / cancel current action' }],
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
        if (e.key === 'Escape') {
            e.stopPropagation();
            cleanup();
        }
    };
    const cleanup = () => {
        document.removeEventListener('keydown', onKey, true);
        if (overlay.parentNode) document.body.removeChild(overlay);
    };

    closeBtn.addEventListener('click', cleanup);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup();
    });
    // Capture phase so Escape closes the dialog before the editor's global
    // keydown handler treats it as a "switch to Selection tool" shortcut.
    document.addEventListener('keydown', onKey, true);
}
