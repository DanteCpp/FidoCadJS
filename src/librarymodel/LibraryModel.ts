/**
 * @file LibraryModel.ts
 * @author Dante Loi
 * @date 2026-04-23
 * @brief Central model for managing component libraries and their hierarchy.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * Port of fidocadj.librarymodel.LibraryModel (Kohta Ozaki, Davide Bucci, 2014-2023).
 * Browser adaptation: file I/O and undo support are omitted; all loaded libraries
 * are treated as standard (read-only) since the browser cannot write .fcl files.
 */

import type { DrawingModel } from '../circuit/model/DrawingModel.js';
import type { MacroDesc } from '../primitives/MacroDesc.js';
import { Library } from './Library.js';
import { Category } from './Category.js';
import type { LibraryListener } from './event/LibraryListener.js';
import { AddEvent } from './event/AddEvent.js';
import { RemoveEvent } from './event/RemoveEvent.js';
import { RenameEvent } from './event/RenameEvent.js';
import { KeyChangeEvent } from './event/KeyChangeEvent.js';

const STD_FILENAMES = new Set(['', 'FCDstdlib', 'PCB', 'elettrotecnica', 'EY_Libraries', 'IHRAM']);

export class LibraryModel {
    private readonly listeners: LibraryListener[] = [];
    private readonly drawingModel: DrawingModel;
    private readonly libraries: Library[] = [];
    private masterLibrary!: Map<string, MacroDesc>;

    constructor(drawingModel: DrawingModel) {
        this.drawingModel = drawingModel;
        this.updateLibraries();
    }

    addLibraryListener(listener: LibraryListener): void {
        this.listeners.push(listener);
    }

    removeLibraryListener(listener: LibraryListener): void {
        const idx = this.listeners.indexOf(listener);
        if (idx >= 0) this.listeners.splice(idx, 1);
    }

    getAllLibraries(): Library[] { return this.libraries; }

    getAllMacros(): Map<string, MacroDesc> { return this.masterLibrary; }

    forceUpdate(): void {
        this.updateLibraries();
        this.fireChanged();
    }

    // ── Static helpers ────────────────────────────────────────────────────────

    static getPlainMacroKey(macro: MacroDesc): string {
        const parts = macro.key.split('.');
        return parts.length > 1 ? parts[1] : parts[0];
    }

    static createRandomMacroKey(): string {
        return Math.random().toString(36).slice(2, 10);
    }

    static createMacroKey(filename: string, key: string): string {
        return `${filename}.${key}`.toLowerCase();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private updateLibraries(): void {
        this.libraries.length = 0;
        this.masterLibrary = this.drawingModel.getLibrary();

        const tmpMap = new Map<string, Library>();

        for (const md of this.masterLibrary.values()) {
            md.name = md.name.trim();
            const mapKey = `${md.filename}/${md.library}`;

            let library = tmpMap.get(mapKey);
            if (!library) {
                library = new Library(md.library, md.filename, this.isStdFile(md.filename));
                tmpMap.set(mapKey, library);
                this.libraries.push(library);
            }

            let category = library.getCategory(md.category);
            if (!category) {
                category = new Category(md.category, library, md.category === 'hidden');
                library.addCategory(category);
            }
            category.addMacro(md);
        }
    }

    private isStdFile(filename: string): boolean {
        return STD_FILENAMES.has(filename);
    }

    // ── Event firing ─────────────────────────────────────────────────────────

    private fireChanged(): void {
        for (const l of this.listeners) l.libraryLoaded();
    }

    fireAdded(parentNode: unknown, addedNode: unknown): void {
        const e = new AddEvent(parentNode, addedNode);
        for (const l of this.listeners) l.libraryNodeAdded(e);
    }

    fireRemoved(parentNode: unknown, removedNode: unknown): void {
        const e = new RemoveEvent(parentNode, removedNode);
        for (const l of this.listeners) l.libraryNodeRemoved(e);
    }

    fireRenamed(parentNode: unknown, renamedNode: unknown, oldName: string): void {
        const e = new RenameEvent(parentNode, renamedNode, oldName);
        for (const l of this.listeners) l.libraryNodeRenamed(e);
    }

    fireKeyChanged(parentNode: unknown, changedNode: unknown, oldKey: string): void {
        const e = new KeyChangeEvent(parentNode, changedNode, oldKey);
        for (const l of this.listeners) l.libraryNodeKeyChanged(e);
    }
}
