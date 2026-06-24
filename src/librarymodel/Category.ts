import type { MacroDesc } from '../primitives/MacroDesc.js';
import type { Library } from './Library.js';

function plainKey(macro: MacroDesc): string {
    const parts = macro.key.split('.');
    return parts.length > 1 ? parts[1] : parts[0];
}

export class Category {
    private name: string;
    private parentLibrary: Library;
    private macros: MacroDesc[];
    private hidden: boolean;

    constructor(name: string, parentLibrary: Library, isHidden: boolean) {
        this.name = name;
        this.parentLibrary = parentLibrary;
        this.hidden = isHidden;
        this.macros = [];
    }

    getName(): string {
        return this.name;
    }
    setName(name: string): void {
        this.name = name;
    }

    getParentLibrary(): Library {
        return this.parentLibrary;
    }

    addMacro(macro: MacroDesc): void {
        this.macros.push(macro);
    }

    removeMacro(macro: MacroDesc): void {
        const idx = this.macros.indexOf(macro);
        if (idx >= 0) this.macros.splice(idx, 1);
    }

    getAllMacros(): MacroDesc[] {
        return this.macros;
    }

    isHidden(): boolean {
        return this.hidden;
    }

    containsMacroKey(key: string): boolean {
        return this.macros.some((m) => plainKey(m) === key);
    }
}
