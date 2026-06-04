/**
 * @file TeXMode.ts
 * @brief Tiny module holding the math-rendering flag, kept separate to avoid
 *        circular imports between CircuitPanel and PrimitiveAdvText.
 */

/** When true, PrimitiveAdvText.draw() typesets $...$ math onto the canvas via
 *  MathLayout/MathJax. When false, the literal source text is drawn instead.
 *  On-screen it follows the renderTeX setting; bitmap export forces it on. */
export const TeXMode = {
    active: false,
};
