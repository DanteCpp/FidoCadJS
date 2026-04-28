/**
 * @file LibraryModel.ts
 * @author Dante Loi
 * @date 2026-04-27
 * @brief Central model for managing component libraries with full CRUD support.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * Port of fidocadj.librarymodel.LibraryModel (Kohta Ozaki, Davide Bucci, 2014-2023).
 * Browser adaptation: user libraries are persisted to localStorage instead of files.
 */

import type { DrawingModel } from '../circuit/model/DrawingModel.js';
import { MacroDesc } from '../primitives/MacroDesc.js';
import { Library } from './Library.js';
import { Category } from './Category.js';
import { LibUtils } from './LibUtils.js';
import { UserLibraryStorage } from './UserLibraryStorage.js';
import type { LibraryListener } from './event/LibraryListener.js';
import { AddEvent } from './event/AddEvent.js';
import { RemoveEvent } from './event/RemoveEvent.js';
import { RenameEvent } from './event/RenameEvent.js';
import { KeyChangeEvent } from './event/KeyChangeEvent.js';

// ── Exception classes ────────────────────────────────────────────────────────

export class LibraryException extends Error {
    constructor(message: string) { super(message); this.name = 'LibraryException'; }
}

export class IllegalLibraryAccessException extends LibraryException {
    constructor(message: string) { super(message); this.name = 'IllegalLibraryAccessException'; }
}

export class IllegalNameException extends LibraryException {
    constructor(message: string) { super(message); this.name = 'IllegalNameException'; }
}

export class IllegalKeyException extends LibraryException {
    constructor(message: string) { super(message); this.name = 'IllegalKeyException'; }
}

export class LibraryModel {
    private readonly listeners: LibraryListener[] = [];
    private readonly drawingModel: DrawingModel;
    private readonly libraries: Library[] = [];
    private masterLibrary!: Map<string, MacroDesc>;

    constructor(drawingModel: DrawingModel) {
        this.drawingModel = drawingModel;
        this.updateLibraries();
    }

    // ── Listener management ────────────────────────────────────────────────────

    addLibraryListener(listener: LibraryListener): void {
        this.listeners.push(listener);
    }

    removeLibraryListener(listener: LibraryListener): void {
        const idx = this.listeners.indexOf(listener);
        if (idx >= 0) this.listeners.splice(idx, 1);
    }

    // ── Accessors ─────────────────────────────────────────────────────────────

    getAllLibraries(): Library[] { return this.libraries; }

    getAllMacros(): Map<string, MacroDesc> { return this.masterLibrary; }

    getDrawingModel(): DrawingModel { return this.drawingModel; }

    // ── Static helpers ────────────────────────────────────────────────────────

    static getPlainMacroKey(macro: MacroDesc): string {
        const parts = macro.key.split('.');
        return parts.length > 1 ? parts[1]! : parts[0]!;
    }

    static createRandomMacroKey(): string {
        return Math.random().toString(36).slice(2, 10);
    }

    static createMacroKey(filename: string, key: string): string {
        return `${filename}.${key}`.toLowerCase();
    }

    // ── Remove operations ─────────────────────────────────────────────────────

    remove(target: Library | Category | MacroDesc): void {
        if (target instanceof Library) {
            if (target.isStdLib()) throw new IllegalLibraryAccessException("A standard library can't be removed.");
            const idx = this.libraries.indexOf(target);
            if (idx >= 0) this.libraries.splice(idx, 1);
            this.synchronizeMasterLibrary();
            UserLibraryStorage.deleteUserLibrary(target.getFilename());
            this.fireRemoved(null, target);
        } else if (target instanceof Category) {
            const parentLib = target.getParentLibrary();
            if (parentLib.isStdLib()) throw new IllegalLibraryAccessException("A category in a standard library can't be removed.");
            parentLib.removeCategory(target);
            this.synchronizeMasterLibrary();
            this.save();
            this.fireRemoved(parentLib, target);
        } else {
            const category = this.getParentNode(target) as Category | null;
            if (!category) throw new IllegalLibraryAccessException("Macro has no parent category.");
            if (category.getParentLibrary().isStdLib()) throw new IllegalLibraryAccessException("A macro in a standard library can't be removed.");
            category.removeMacro(target);
            this.synchronizeMasterLibrary();
            this.save();
            this.fireRemoved(category, target);
        }
    }

    // ── Rename operations ─────────────────────────────────────────────────────

    rename(target: Library | Category | MacroDesc, newName: string): void {
        if (!newName || newName.trim().length === 0) throw new IllegalNameException('Name must not be empty.');

        if (target instanceof Library) {
            if (target.isStdLib()) throw new IllegalLibraryAccessException("A standard library can't be renamed.");
            const oldName = target.getName();
            target.setName(newName);
            this.synchronizeMacros(target);
            this.synchronizeMasterLibrary();
            this.save();
            this.fireRenamed(null, target, oldName);
        } else if (target instanceof Category) {
            if (target.getParentLibrary().isStdLib()) throw new IllegalLibraryAccessException("A category in a standard library can't be renamed.");
            const oldName = target.getName();
            target.setName(newName);
            this.synchronizeMacros(target.getParentLibrary());
            this.synchronizeMasterLibrary();
            this.save();
            this.fireRenamed(target.getParentLibrary(), target, oldName);
        } else {
            if (this.isStdLib(target)) throw new IllegalLibraryAccessException("A macro in a standard library can't be renamed.");
            const oldName = target.name;
            target.name = newName;
            this.save();
            this.fireRenamed(this.getParentNode(target), target, oldName);
        }
    }

    // ── Key change ────────────────────────────────────────────────────────────

    changeKey(macro: MacroDesc, newKey: string): void {
        if (!newKey || newKey.trim().length === 0) throw new IllegalKeyException('Key must not be empty.');
        if (LibUtils.checkKeyInvalidChars(newKey)) throw new IllegalKeyException('Key must not contain spaces, dots, or ].');
        if (this.isStdLib(macro)) throw new IllegalLibraryAccessException("A macro in a standard library can't have its key changed.");

        const category = this.getParentNode(macro) as Category | null;
        if (!category) throw new IllegalLibraryAccessException('Macro has no parent category.');

        const newFullKey = LibraryModel.createMacroKey(macro.filename, newKey);
        if (LibUtils.checkKeyDuplicate(this.masterLibrary, macro.filename, newFullKey)) {
            throw new IllegalKeyException('New key already exists in the library.');
        }

        const oldKey = LibraryModel.getPlainMacroKey(macro);
        macro.key = newFullKey;
        this.save();
        this.fireKeyChanged(category, macro, oldKey);
    }

    // ── Copy operations ───────────────────────────────────────────────────────

    copy(source: MacroDesc | Category, dest: Category | Library): void {
        if (source instanceof MacroDesc && dest instanceof Category) {
            const newMacro = this.copyMacro(source, dest);
            this.synchronizeMacros(dest.getParentLibrary());
            this.synchronizeMasterLibrary();
            this.save();
            this.fireAdded(dest, newMacro);
        } else if (source instanceof Category && dest instanceof Library) {
            const newCategory = new Category(source.getName(), dest, false);
            for (const macro of source.getAllMacros()) {
                this.copyMacro(macro, newCategory);
            }
            dest.addCategory(newCategory);
            this.synchronizeMacros(dest);
            this.synchronizeMasterLibrary();
            this.save();
            this.fireAdded(dest, newCategory);
        }
    }

    private copyMacro(macro: MacroDesc, destCategory: Category): MacroDesc {
        const newMacro = this.cloneMacro(macro);
        let newPlainKey = LibraryModel.createRandomMacroKey();
        let retries = 20;
        while (destCategory.getParentLibrary().containsMacroKey(newPlainKey) && retries > 0) {
            newPlainKey = LibraryModel.createRandomMacroKey();
            retries--;
        }
        if (retries <= 0) throw new LibraryException('Key generation failed.');
        newMacro.key = LibraryModel.createMacroKey(destCategory.getParentLibrary().getFilename(), newPlainKey);
        destCategory.addMacro(newMacro);
        return newMacro;
    }

    // ── Add new macro ─────────────────────────────────────────────────────────

    addNewMacro(macro: MacroDesc): void {
        this.masterLibrary.set(macro.key, macro);
        this.forceUpdate();
        this.save();
    }

    // ── Save / sync ───────────────────────────────────────────────────────────

    save(): void {
        const saved = new Set<string>();
        for (const library of this.libraries) {
            if (library.isStdLib()) continue;
            const fn = library.getFilename();
            if (saved.has(fn)) continue;
            saved.add(fn);
            try {
                UserLibraryStorage.saveUserLibrary(fn, this.masterLibrary, library.getName().trim());
            } catch (e) {
                console.error(`Error saving library "${fn}":`, e);
            }
        }
    }

    forceUpdate(): void {
        this.updateLibraries();
        this.fireChanged();
    }

    getParentNode(node: unknown): unknown {
        for (const lib of this.getAllLibraries()) {
            if (node === lib) return null;
            for (const cat of lib.getAllCategories()) {
                if (node === cat) return lib;
                for (const macro of cat.getAllMacros()) {
                    if (node === macro) return cat;
                }
            }
        }
        return null;
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
                library = new Library(md.library, md.filename, LibUtils.isStdLib(md));
                tmpMap.set(mapKey, library);
                this.libraries.push(library);
            }

            let category = library.getCategory(md.category);
            if (!category) {
                const isHidden = md.category === 'hidden';
                category = new Category(md.category, library, isHidden);
                library.addCategory(category);
            }
            category.addMacro(md);
        }
    }

    private synchronizeMasterLibrary(): void {
        this.masterLibrary.clear();
        for (const library of this.libraries) {
            for (const category of library.getAllCategories()) {
                for (const macro of category.getAllMacros()) {
                    this.masterLibrary.set(macro.key, macro);
                }
            }
        }
    }

    private synchronizeMacros(library: Library): void {
        if (library.isStdLib()) return;
        for (const category of library.getAllCategories()) {
            for (const macro of category.getAllMacros()) {
                macro.category = category.getName();
                macro.library = library.getName();
                macro.filename = library.getFilename();
                const plainKey = LibraryModel.getPlainMacroKey(macro);
                macro.key = LibraryModel.createMacroKey(library.getFilename(), plainKey);
            }
        }
    }

    private isStdLib(macro: MacroDesc): boolean {
        for (const lib of this.getAllLibraries()) {
            if (lib.isStdLib()) {
                for (const cat of lib.getAllCategories()) {
                    for (const m of cat.getAllMacros()) {
                        if (macro === m) return true;
                    }
                }
            }
        }
        return false;
    }

    private cloneMacro(macro: MacroDesc): MacroDesc {
        return new MacroDesc(macro.key, macro.name, macro.description,
            macro.category, macro.library, macro.filename);
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
