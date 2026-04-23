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
