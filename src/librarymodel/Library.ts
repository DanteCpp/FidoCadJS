/**
 * @file Library.ts
 * @author Dante Loi
 * @date 2026-04-23
 * @brief Represents a single component library (.fcl file).
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * Port of fidocadj.librarymodel.Library (Kohta Ozaki, 2014).
 */

import type { Category } from './Category.js';

export class Library {
    private libraryName: string;
    private readonly filename: string;
    private readonly isStd: boolean;
    private readonly categories: Category[];

    constructor(libraryName: string, filename: string, isStd: boolean) {
        this.libraryName = libraryName;
        this.filename = filename;
        this.isStd = isStd;
        this.categories = [];
    }

    getName(): string { return this.libraryName; }
    setName(name: string): void { this.libraryName = name; }

    getFilename(): string { return this.filename; }

    getAllCategories(): Category[] { return this.categories; }

    getCategory(name: string): Category | null {
        return this.categories.find(c => c.getName() === name) ?? null;
    }

    addCategory(category: Category): void { this.categories.push(category); }

    removeCategory(category: Category): void {
        const idx = this.categories.indexOf(category);
        if (idx >= 0) this.categories.splice(idx, 1);
    }

    isStdLib(): boolean { return this.isStd; }

    isHidden(): boolean { return false; }

    static isValidName(_name: string): boolean { return true; }

    containsMacroKey(key: string): boolean {
        return this.categories.some(c => c.containsMacroKey(key));
    }

    toString(): string { return this.libraryName; }
}
