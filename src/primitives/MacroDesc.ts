/**
 * @file MacroDesc.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Macro descriptor holding the FCD source of a library component
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

export class MacroDesc {
    name: string;
    key: string;
    description: string;
    category: string;
    library: string;
    filename: string;
    level: number = 0;

    constructor(key: string, name: string, description: string,
        category: string, library: string, filename: string) {
        this.key = key;
        this.name = name;
        this.description = description;
        this.category = category;
        this.library = library;
        this.filename = filename;
    }

    toString(): string {
        switch (this.level) {
            case 1: return this.category.trim();
            case 2: return this.library.trim();
            default: return this.name.trim();
        }
    }
}
