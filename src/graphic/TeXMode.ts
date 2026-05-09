/**
 * @file TeXMode.ts
 * @brief Tiny module holding the TeX overlay flag to avoid circular imports
 *        between CircuitPanel and PrimitiveAdvText.
 */

/** When true, PrimitiveAdvText.draw() skips text containing $ so the
 *  TeX overlay (which runs KaTeX) handles rendering instead. */
export const TeXMode = {
    active: false,
};
