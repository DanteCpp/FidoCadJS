export interface TextRenderer {
    getStringWidth(s: string): number;
    drawString(str: string, x: number, y: number): void;
}
