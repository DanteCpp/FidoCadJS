/**
 * @file MacroPicker.ts
 * @author Dante Loi
 * @date 2026-04-23
 * @brief HTML-based component library tree browser for macro selection.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * Browser port of fidocadj.macropicker.MacroTree (Swing). Renders a collapsible
 * tree: Library → Category → Macro. Clicking a macro fires onMacroSelected.
 */

import type { LibraryModel } from '../librarymodel/LibraryModel.js';
import type { Library } from '../librarymodel/Library.js';
import type { Category } from '../librarymodel/Category.js';
import type { MacroDesc } from '../primitives/MacroDesc.js';

export class MacroPicker {
    readonly element: HTMLElement;
    onMacroSelected: ((macroKey: string, macroName: string) => void) | null = null;

    private treeContainer: HTMLElement;
    private searchInput: HTMLInputElement;
    private selectedRow: HTMLElement | null = null;
    private filterText: string = '';

    constructor() {
        this.element = document.createElement('div');
        this.element.style.cssText =
            'display: flex; flex-direction: column; height: 100%; overflow: hidden; ' +
            'background: #f8f8f8; border-left: 1px solid #ccc; font-family: sans-serif; font-size: 12px;';

        // Header
        const header = document.createElement('div');
        header.textContent = 'Components';
        header.style.cssText =
            'padding: 8px 10px; font-weight: bold; font-size: 13px; ' +
            'border-bottom: 1px solid #ddd; background: #f0f0f0; flex-shrink: 0;';
        this.element.appendChild(header);

        // Search box
        this.searchInput = document.createElement('input');
        this.searchInput.type = 'search';
        this.searchInput.placeholder = 'Search components...';
        this.searchInput.style.cssText =
            'margin: 6px 8px; padding: 5px 8px; font-size: 12px; ' +
            'border: 1px solid #ccc; border-radius: 3px; outline: none; flex-shrink: 0;';
        this.searchInput.addEventListener('input', () => {
            this.filterText = this.searchInput.value.toLowerCase().trim();
            this.applyFilter();
        });
        this.element.appendChild(this.searchInput);

        // Tree container
        this.treeContainer = document.createElement('div');
        this.treeContainer.style.cssText =
            'flex: 1; overflow-y: auto; padding-bottom: 8px;';
        this.element.appendChild(this.treeContainer);
    }

    refresh(libraryModel: LibraryModel): void {
        this.treeContainer.innerHTML = '';
        this.selectedRow = null;
        this.filterText = this.searchInput.value.toLowerCase().trim();

        const libs = libraryModel.getAllLibraries();
        libs.forEach((lib, idx) => {
            if (lib.isHidden()) return;
            const libSection = this.buildLibrarySection(lib, idx === 0);
            this.treeContainer.appendChild(libSection);
        });
    }

    setFilter(text: string): void {
        this.searchInput.value = text;
        this.filterText = text.toLowerCase().trim();
        this.applyFilter();
    }

    // ── Private builders ──────────────────────────────────────────────────────

    private buildLibrarySection(lib: Library, expanded: boolean): HTMLElement {
        const section = document.createElement('div');

        const header = this.buildCollapseHeader(lib.getName(), 0, expanded);
        section.appendChild(header);

        const body = document.createElement('div');
        body.style.display = expanded ? 'block' : 'none';
        header.addEventListener('click', () => {
            const open = body.style.display !== 'none';
            body.style.display = open ? 'none' : 'block';
            this.setArrow(header, !open);
        });

        for (const cat of lib.getAllCategories()) {
            if (cat.isHidden()) continue;
            body.appendChild(this.buildCategorySection(cat));
        }

        section.appendChild(body);
        return section;
    }

    private buildCategorySection(cat: Category): HTMLElement {
        const section = document.createElement('div');
        const header = this.buildCollapseHeader(cat.getName(), 1, false);
        section.appendChild(header);

        const body = document.createElement('div');
        body.style.display = 'none';
        header.addEventListener('click', () => {
            const open = body.style.display !== 'none';
            body.style.display = open ? 'none' : 'block';
            this.setArrow(header, !open);
        });

        for (const macro of cat.getAllMacros()) {
            body.appendChild(this.buildMacroRow(macro));
        }

        section.appendChild(body);
        return section;
    }

    private buildMacroRow(macro: MacroDesc): HTMLElement {
        const row = document.createElement('div');
        row.style.cssText =
            'padding: 4px 6px 4px 32px; cursor: pointer; color: #222; ' +
            'display: flex; justify-content: space-between; align-items: center; ' +
            'border-radius: 2px; margin: 0 4px;';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = macro.name;
        nameSpan.style.cssText = 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';

        const keySpan = document.createElement('span');
        keySpan.textContent = macro.key.split('.').pop() ?? macro.key;
        keySpan.style.cssText =
            'font-family: monospace; font-size: 10px; color: #888; margin-left: 6px; flex-shrink: 0;';

        row.appendChild(nameSpan);
        row.appendChild(keySpan);

        row.addEventListener('mouseenter', () => {
            if (row !== this.selectedRow) row.style.background = '#e8eef6';
        });
        row.addEventListener('mouseleave', () => {
            if (row !== this.selectedRow) row.style.background = '';
        });
        row.addEventListener('click', () => {
            if (this.selectedRow) {
                this.selectedRow.style.background = '';
                this.selectedRow.style.fontWeight = '';
            }
            this.selectedRow = row;
            row.style.background = '#c8daf4';
            row.style.fontWeight = 'bold';
            this.onMacroSelected?.(macro.key, macro.name);
        });

        return row;
    }

    private buildCollapseHeader(label: string, depth: number, expanded: boolean): HTMLElement {
        const header = document.createElement('div');
        const indent = depth === 0 ? 6 : 18;
        const bgColor = depth === 0 ? '#e4e4e4' : '#ececec';
        header.style.cssText =
            `padding: 5px 6px 5px ${indent}px; cursor: pointer; user-select: none; ` +
            `background: ${bgColor}; font-weight: ${depth === 0 ? 'bold' : 'normal'}; ` +
            `border-bottom: 1px solid #ddd; display: flex; align-items: center; gap: 4px; color: #333;`;

        const arrow = document.createElement('span');
        arrow.textContent = expanded ? '▾' : '▸';
        arrow.style.cssText = 'font-size: 10px; flex-shrink: 0;';
        header.appendChild(arrow);

        const text = document.createElement('span');
        text.textContent = label;
        text.style.cssText = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
        header.appendChild(text);

        return header;
    }

    private setArrow(header: HTMLElement, expanded: boolean): void {
        const arrow = header.querySelector('span') as HTMLElement;
        if (arrow) arrow.textContent = expanded ? '▾' : '▸';
    }

    // ── Filtering ─────────────────────────────────────────────────────────────

    private applyFilter(): void {
        if (!this.filterText) {
            this.clearFilter();
            return;
        }

        const words = this.filterText.split(/\s+/).filter(Boolean);

        // Walk all library sections
        for (const libSection of this.treeContainer.children) {
            const libHeader = libSection.children[0] as HTMLElement;
            const libBody = libSection.children[1] as HTMLElement;
            const libLabel = libHeader.querySelector('span:last-child')?.textContent?.toLowerCase() ?? '';

            let libHasMatch = false;

            for (const catSection of libBody.children) {
                const catHeader = catSection.children[0] as HTMLElement;
                const catBody = catSection.children[1] as HTMLElement;
                const catLabel = catHeader.querySelector('span:last-child')?.textContent?.toLowerCase() ?? '';

                let catHasMatch = false;

                for (const macroRow of catBody.children) {
                    const rowEl = macroRow as HTMLElement;
                    const nameEl = rowEl.querySelector('span:first-child');
                    const keyEl = rowEl.querySelector('span:last-child');
                    const macroText = `${nameEl?.textContent ?? ''} ${keyEl?.textContent ?? ''} ${catLabel} ${libLabel}`.toLowerCase();
                    const matches = words.every(w => macroText.includes(w));
                    rowEl.style.display = matches ? '' : 'none';
                    if (matches) catHasMatch = true;
                }

                catSection.setAttribute('style', catHasMatch ? 'display:block' : 'display:none');
                if (catHasMatch) {
                    catBody.style.display = 'block';
                    this.setArrow(catHeader, true);
                    libHasMatch = true;
                }
            }

            libSection.setAttribute('style', libHasMatch ? 'display:block' : 'display:none');
            if (libHasMatch) {
                libBody.style.display = 'block';
                this.setArrow(libHeader, true);
            }
        }
    }

    private clearFilter(): void {
        for (const libSection of this.treeContainer.children) {
            (libSection as HTMLElement).style.display = '';
            const libBody = libSection.children[1] as HTMLElement;
            if (!libBody) continue;

            for (const catSection of libBody.children) {
                (catSection as HTMLElement).removeAttribute('style');
                const catBody = catSection.children[1] as HTMLElement;
                if (catBody) {
                    for (const row of catBody.children) {
                        (row as HTMLElement).style.display = '';
                    }
                }
            }
        }
    }
}
