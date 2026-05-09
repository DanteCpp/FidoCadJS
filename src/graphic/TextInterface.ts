/**
 * @file TextInterface.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Text rendering interface
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

export interface TextInterface {
    getFontSize(): number;
    setFontSize(size: number): void;
    getStringWidth(s: string): number;
    drawString(str: string, x: number, y: number): void;
}
