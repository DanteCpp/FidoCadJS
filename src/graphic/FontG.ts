/**
 * @file FontG.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Font descriptor type
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

export class FontG {
    fontFamily: string;

    constructor(name: string) {
        this.fontFamily = name;
    }

    getFamily(): string {
        return this.fontFamily;
    }
}
