export interface TextInterface {
    getFontSize(): number;
    setFontSize(size: number): void;
    getStringWidth(s: string): number;
    drawString(str: string, x: number, y: number): void;
}
