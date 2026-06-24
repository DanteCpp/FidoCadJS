export interface Color {
    white(): Color;
    gray(): Color;
    green(): Color;
    red(): Color;
    black(): Color;
    getGreen(): number;
    getRed(): number;
    getBlue(): number;
    getRGB(): number;
    setRGB(rgb: number): void;
}
