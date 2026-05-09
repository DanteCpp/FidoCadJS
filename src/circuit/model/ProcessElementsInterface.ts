/**
 * @file ProcessElementsInterface.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Interface for element processing visitors
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import type { GraphicPrimitive } from '../../primitives/GraphicPrimitive.js';

export interface ProcessElementsInterface {
    doAction(g: GraphicPrimitive): void;
}
