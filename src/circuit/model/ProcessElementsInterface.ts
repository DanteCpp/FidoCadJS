import type { GraphicPrimitive } from '../../primitives/GraphicPrimitive.js';

export interface ProcessElementsInterface {
    doAction(g: GraphicPrimitive): void;
}
