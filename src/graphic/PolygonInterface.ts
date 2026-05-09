/**
 * @file PolygonInterface.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Polygon drawing interface
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

export interface PolygonInterface {
    addPoint(x: number, y: number): void;
    getNpoints(): number;
    reset(): void;
    getXpoints(): number[];
    getYpoints(): number[];
    contains(x: number, y: number): boolean;
}
