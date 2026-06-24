/**
 * Active editing tool. Numeric values are significant: tools after HAND are
 * drawing/creation tools (the dispatch tests `tool > Tool.HAND`), so the
 * declaration order must be preserved.
 */
export enum Tool {
    NONE,
    SELECTION,
    ZOOM,
    HAND,
    LINE,
    TEXT,
    BEZIER,
    POLYGON,
    ELLIPSE,
    RECTANGLE,
    CONNECTION,
    PCB_LINE,
    PCB_PAD,
    MACRO,
    COMPLEXCURVE,
}
