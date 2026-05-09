/**
 * @file ColorInterface.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Colour abstraction interface
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

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
