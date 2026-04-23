export interface ColorInterface {
    white(): ColorInterface;
    gray(): ColorInterface;
    green(): ColorInterface;
    red(): ColorInterface;
    black(): ColorInterface;
    getGreen(): number;
    getRed(): number;
    getBlue(): number;
    getRGB(): number;
    setRGB(rgb: number): void;
}
