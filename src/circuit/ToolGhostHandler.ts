import type { GraphicPrimitive } from '../primitives/GraphicPrimitive.js';
import type { ElementsEdtActions } from './controllers/ElementsEdtActions.js';
import type { DrawingModel } from './model/DrawingModel.js';

/**
 * Context passed to every tool ghost handler.
 */
export interface GhostContext {
    /** Logical X of cursor */
    lx: number;
    /** Logical Y of cursor */
    ly: number;
    /** Current click count for multi-point tools */
    clickNum: number;
    /** X-coordinate polygon being built */
    xpoly: number[];
    /** Y-coordinate polygon being built */
    ypoly: number[];
    /** Current editing layer */
    layer: number;
    /** Text font name */
    font: string;
    /** Text font size */
    fontSize: number;
}

/**
 * A tool-specific handler that creates a ghost (preview) primitive.
 * Returns null if no ghost should be shown for the current state.
 */
export type ToolGhostHandler = (
    ctx: GhostContext,
    edt: ElementsEdtActions,
    model: DrawingModel,
) => GraphicPrimitive | null;
