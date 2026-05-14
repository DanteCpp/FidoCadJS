/**
 * @file RenderCtx.ts
 * @author Dante Loi
 * @date 2026-05-14
 * @brief Per-render context replacing static oldalpha in GraphicPrimitive
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * Each render pass creates a fresh RenderCtx. This eliminates the static
 * oldalpha field and makes the rendering pipeline re-entrant.
 */

export interface RenderCtx {
    /** Last alpha value seen during rendering (for change detection). */
    alpha: number;
}

/** Factory for a fresh render context. */
export function createRenderCtx(): RenderCtx {
    return { alpha: 1.0 };
}
