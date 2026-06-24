import type { GraphicPrimitive } from '../../primitives/GraphicPrimitive.js';

export interface ElementProcessor {
    doAction(g: GraphicPrimitive): void;
}
