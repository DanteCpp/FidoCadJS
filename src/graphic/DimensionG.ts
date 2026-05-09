/**
 * @file DimensionG.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief 2D dimension type (width × height)
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

export class DimensionG {
    width: number;
    height: number;

    constructor(width = 0, height = 0) {
        this.width = width;
        this.height = height;
    }
}
