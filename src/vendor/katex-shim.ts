/**
 * @file katex-shim.ts
 * @brief Typed wrapper around the vendored KaTeX ESM module.
 * Isolates the untyped .mjs import so the rest of the codebase has full TS types.
 */

// Vendored JS module — no types available, suppressed inline
// @ts-expect-error
import katexModule from './katex/katex.mjs';

/** Options for KaTeX math rendering. */
export interface KatexOptions {
    /** Render in display mode (centered, larger). Default: false. */
    displayMode?: boolean;
    /** Throw on LaTeX syntax errors. Default: true. */
    throwOnError?: boolean;
    /** Fallback color for error text when throwOnError is false. */
    errorColor?: string;
}

/**
 * Render a LaTeX math expression to an HTML string.
 * @param latex  Raw LaTeX math source (without surrounding $ delimiters).
 * @param options  Rendering options.
 * @returns HTML string of the rendered math.
 */
export function renderToString(latex: string, options?: KatexOptions): string {
    return katexModule.renderToString(latex, options) as string;
}
