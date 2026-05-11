/**
 * @file TeXRenderer.ts
 * @author Dante Loi
 * @date 2026-05-09
 * @brief Parses FidoCad text primitives for LaTeX math delimiters and
 *        renders math segments via the vendored KaTeX engine.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { renderToString } from '../vendor/katex-shim.js';

/** A segment of mixed text, after splitting on math delimiters. */
export interface RenderedSegment {
    /** Segment type. */
    type: 'text' | 'math-inline' | 'math-display';
    /** For 'text': the raw text. For math types: KaTeX-rendered HTML. */
    content: string;
    /** The raw source that produced this segment (for fallback/debug). */
    source: string;
}

/**
 * Parse text containing LaTeX math delimiters and render math through KaTeX.
 *
 * Delimiters:
 *   `$...$`   — inline math
 *   `$$...$$` — display (centered) math
 *
 * @param text  Raw text from a FidoCad text primitive.
 * @returns Array of rendered segments. Text segments contain verbatim content;
 *          math segments contain KaTeX HTML.
 */
export function renderMixedText(text: string): RenderedSegment[] {
    if (!text) return [];

    const segments: RenderedSegment[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        // Look for math delimiters. $$ takes priority (display math).
        const displayIdx = remaining.indexOf('$$');
        const inlineIdx = remaining.indexOf('$');

        // No math delimiters at all → rest is plain text
        if (inlineIdx === -1) {
            segments.push({ type: 'text', content: remaining, source: remaining });
            break;
        }

        // Text before the first delimiter
        const firstDelim = (displayIdx !== -1 && displayIdx <= inlineIdx) ? displayIdx : inlineIdx;
        if (firstDelim > 0) {
            segments.push({
                type: 'text',
                content: remaining.slice(0, firstDelim),
                source: remaining.slice(0, firstDelim),
            });
            remaining = remaining.slice(firstDelim);
            continue;
        }

        // Cursor is at a delimiter
        if (displayIdx === 0) {
            // Display math: $$...$$
            const closingIdx = remaining.indexOf('$$', 2);
            if (closingIdx === -1) {
                // Unclosed $$ — treat as literal $$ text
                segments.push({ type: 'text', content: '$$', source: '$$' });
                remaining = remaining.slice(2);
            } else {
                const mathSrc = remaining.slice(2, closingIdx);
                try {
                    const html = renderToString(mathSrc, {
                        displayMode: true,
                        throwOnError: false,
                        errorColor: '#cc0000',
                    });
                    segments.push({ type: 'math-display', content: html, source: mathSrc });
                } catch {
                    // KaTeX failure — fall back to raw source
                    segments.push({ type: 'text', content: `$$${mathSrc}$$`, source: `$$${mathSrc}$$` });
                }
                remaining = remaining.slice(closingIdx + 2);
            }
        } else {
            // Inline math: $...$
            const closingIdx = remaining.indexOf('$', 1);
            if (closingIdx === -1) {
                // Unclosed $ — treat as literal $
                segments.push({ type: 'text', content: '$', source: '$' });
                remaining = remaining.slice(1);
            } else {
                const mathSrc = remaining.slice(1, closingIdx);
                try {
                    const html = renderToString(mathSrc, {
                        displayMode: false,
                        throwOnError: false,
                        errorColor: '#cc0000',
                    });
                    segments.push({ type: 'math-inline', content: html, source: mathSrc });
                } catch {
                    segments.push({ type: 'text', content: `$${mathSrc}$`, source: `$${mathSrc}$` });
                }
                remaining = remaining.slice(closingIdx + 1);
            }
        }
    }

    return segments;
}
