import { DrawingModel } from '../model/DrawingModel.js';
import { UndoActions } from './UndoActions.js';
import { SelectionActions } from './SelectionActions.js';
import { GraphicPrimitive } from '../../primitives/GraphicPrimitive.js';
import { PrimitiveConnection } from '../../primitives/PrimitiveConnection.js';
import { PrimitiveLine } from '../../primitives/PrimitiveLine.js';
import { PrimitiveOval } from '../../primitives/PrimitiveOval.js';
import { PrimitiveRectangle } from '../../primitives/PrimitiveRectangle.js';
import { PrimitiveBezier } from '../../primitives/PrimitiveBezier.js';
import { PrimitivePCBLine } from '../../primitives/PrimitivePCBLine.js';
import { PrimitivePCBPad } from '../../primitives/PrimitivePCBPad.js';
import { PrimitiveMacro } from '../../primitives/PrimitiveMacro.js';

/**
 * AddElements: handles the creation and insertion of graphic primitives.
 */
export class AddElements {
    private readonly model: DrawingModel;
    private readonly undoActions: UndoActions | null;

    // Default sizes for PCB elements
    public pcbPadSizeX: number = 5;
    public pcbPadSizeY: number = 5;
    public pcbPadStyle: number = 0;
    public pcbPadDrill: number = 2;
    public pcbThickness: number = 5;

    constructor(model: DrawingModel, undoActions: UndoActions | null) {
        this.model = model;
        this.undoActions = undoActions;
    }

    /** Add a connection primitive at the given point */
    addConnection(x: number, y: number, currentLayer: number): void {
        const conn = new PrimitiveConnection(
            x, y, currentLayer,
            this.model.getTextFont(), this.model.getTextFontSize()
        );
        conn.setMacroFont(this.model.getTextFont(), this.model.getTextFontSize());
        this.model.addPrimitive(conn, true, this.undoActions);
    }

    /** Add a PCB pad at the given point */
    addPCBPad(x: number, y: number, currentLayer: number): void {
        const pad = new PrimitivePCBPad(
            x, y,
            this.pcbPadSizeX, this.pcbPadSizeY,
            this.pcbPadDrill, this.pcbPadStyle,
            currentLayer,
            this.model.getTextFont(), this.model.getTextFontSize()
        );
        this.model.addPrimitive(pad, true, this.undoActions);
    }

    /**
     * Add a line segment. Returns the new clickNumber.
     * @param x logical x coordinate
     * @param y logical y coordinate
     * @param xpoly array of x coordinates (1-indexed)
     * @param ypoly array of y coordinates (1-indexed)
     * @param currentLayer current layer
     * @param clickNumber current click number (1 or 2)
     * @param altButton true if alternate button pressed (stop drawing)
     * @returns new clickNumber (0 = stop, 1 = continue from last point)
     */
    addLine(
        x: number, y: number,
        xpoly: number[], ypoly: number[],
        currentLayer: number,
        clickNumber: number,
        altButton: boolean
    ): number {
        let cn = clickNumber;
        xpoly[clickNumber] = x;
        ypoly[clickNumber] = y;

        if (clickNumber === 2 || altButton) {
            const line = new PrimitiveLine(
                xpoly[1], ypoly[1],
                xpoly[2], ypoly[2],
                currentLayer,
                false, false, 0, 3, 2, 0,
                this.model.getTextFont(),
                this.model.getTextFontSize()
            );
            this.model.addPrimitive(line, true, this.undoActions);

            if (altButton) {
                cn = 0;
            } else {
                cn = 1;
                xpoly[1] = xpoly[2];
                ypoly[1] = ypoly[2];
            }
        }
        return cn;
    }

    /**
     * Add an ellipse. Returns the new clickNumber.
     * @param x logical x coordinate
     * @param y logical y coordinate
     * @param xpoly array of x coordinates (1-indexed)
     * @param ypoly array of y coordinates (1-indexed)
     * @param currentLayer current layer
     * @param clickNumber current click number (1 or 2)
     * @param isCircle if true, force circle instead of ellipse
     * @returns new clickNumber (0 = finished)
     */
    addEllipse(
        x: number, y: number,
        xpoly: number[], ypoly: number[],
        currentLayer: number,
        clickNumber: number,
        isCircle: boolean
    ): number {
        let cn = clickNumber;
        let adjustedY = y;

        if (isCircle && clickNumber === 1) {
            adjustedY = ypoly[1] + x - xpoly[1];
        }

        xpoly[clickNumber] = x;
        ypoly[clickNumber] = adjustedY;

        if (cn === 2) {
            const oval = new PrimitiveOval(
                xpoly[1], ypoly[1],
                xpoly[2], ypoly[2],
                false,
                currentLayer, 0,
                this.model.getTextFont(),
                this.model.getTextFontSize()
            );
            this.model.addPrimitive(oval, true, this.undoActions);
            cn = 0;
        }
        return cn;
    }

    /**
     * Add a rectangle. Returns the new clickNumber.
     * @param x logical x coordinate
     * @param y logical y coordinate
     * @param xpoly array of x coordinates (1-indexed)
     * @param ypoly array of y coordinates (1-indexed)
     * @param currentLayer current layer
     * @param clickNumber current click number (1 or 2)
     * @param isSquare if true, force square instead of rectangle
     * @returns new clickNumber (0 = finished)
     */
    addRectangle(
        x: number, y: number,
        xpoly: number[], ypoly: number[],
        currentLayer: number,
        clickNumber: number,
        isSquare: boolean
    ): number {
        let cn = clickNumber;
        let adjustedY = y;

        if (isSquare && clickNumber === 1) {
            adjustedY = ypoly[1] + x - xpoly[1];
        }

        xpoly[clickNumber] = x;
        ypoly[clickNumber] = adjustedY;

        if (cn === 2) {
            const rect = new PrimitiveRectangle(
                xpoly[1], ypoly[1],
                xpoly[2], ypoly[2],
                false,
                currentLayer, 0,
                this.model.getTextFont(),
                this.model.getTextFontSize()
            );
            this.model.addPrimitive(rect, true, this.undoActions);
            cn = 0;
        }
        if (cn >= 2) cn = 0;
        return cn;
    }

    /**
     * Add a Bezier curve. Returns the new clickNumber.
     * @param x logical x coordinate
     * @param y logical y coordinate
     * @param xpoly array of x coordinates (1-indexed)
     * @param ypoly array of y coordinates (1-indexed)
     * @param currentLayer current layer
     * @param clickNumber current click number (1-4)
     * @returns new clickNumber (0 = finished)
     */
    addBezier(
        x: number, y: number,
        xpoly: number[], ypoly: number[],
        currentLayer: number,
        clickNumber: number
    ): number {
        let cn = clickNumber;
        xpoly[clickNumber] = x;
        ypoly[clickNumber] = y;

        if (clickNumber === 4) {
            const bezier = new PrimitiveBezier(
                xpoly[1], ypoly[1],
                xpoly[2], ypoly[2],
                xpoly[3], ypoly[3],
                xpoly[4], ypoly[4],
                currentLayer,
                false, false, 0, 3, 2, 0,
                this.model.getTextFont(),
                this.model.getTextFontSize()
            );
            this.model.addPrimitive(bezier, true, this.undoActions);
            cn = 0;
        }
        return cn;
    }

    /**
     * Add a PCB line. Returns the new clickNumber.
     * @param x logical x coordinate
     * @param y logical y coordinate
     * @param xpoly array of x coordinates (1-indexed)
     * @param ypoly array of y coordinates (1-indexed)
     * @param currentLayer current layer
     * @param clickNumber current click number (1 or 2)
     * @param altButton if true, stop drawing
     * @param thickness line thickness
     * @returns new clickNumber (0 = stop, 1 = continue from last point)
     */
    addPCBLine(
        x: number, y: number,
        xpoly: number[], ypoly: number[],
        currentLayer: number,
        clickNumber: number,
        altButton: boolean,
        thickness: number
    ): number {
        let cn = clickNumber;
        xpoly[cn] = x;
        ypoly[cn] = y;

        if (cn === 2 || altButton) {
            const pcbLine = new PrimitivePCBLine(
                xpoly[1], ypoly[1],
                xpoly[2], ypoly[2],
                thickness,
                currentLayer,
                this.model.getTextFont(),
                this.model.getTextFontSize()
            );
            this.model.addPrimitive(pcbLine, true, this.undoActions);

            if (altButton) {
                cn = 0;
            } else {
                cn = 1;
                xpoly[1] = xpoly[2];
                ypoly[1] = ypoly[2];
            }
        }
        return cn;
    }

    /**
     * Add a macro at the given point.
     * @param x logical x coordinate
     * @param y logical y coordinate
     * @param sa SelectionActions controller
     * @param primEdit current primitive being edited (may contain orientation/mirror info)
     * @param macroKey the macro key to insert
     * @returns the new primitive being edited, or null if finished
     */
    addMacro(
        x: number, y: number,
        sa: SelectionActions,
        primEdit: GraphicPrimitive | null,
        macroKey: string
    ): GraphicPrimitive | null {
        try {
            sa.setSelectionAll(false);

            const macro = new PrimitiveMacro(
                this.model.getLibrary(),
                this.model.getLayers(),
                this.model.getTextFont(),
                this.model.getTextFontSize()
            );
            // Set the position and macro name
            macro.virtualPoint[0]!.x = x;
            macro.virtualPoint[0]!.y = y;
            macro.virtualPoint[1]!.x = x + 10;
            macro.virtualPoint[1]!.y = y + 10;
            macro.virtualPoint[2]!.x = x + 10;
            macro.virtualPoint[2]!.y = y + 5;
            macro.macroDesc = macroKey;
            this.model.addPrimitive(macro, true, this.undoActions);
            return macro;
        } catch (e) {
            console.error('Error adding macro:', e);
            return primEdit;
        }
    }

    // Getters and setters for PCB defaults
    setPcbPadSizeX(s: number): void { this.pcbPadSizeX = s; }
    getPcbPadSizeX(): number { return this.pcbPadSizeX; }
    setPcbPadSizeY(s: number): void { this.pcbPadSizeY = s; }
    getPcbPadSizeY(): number { return this.pcbPadSizeY; }
    setPcbPadStyle(s: number): void { this.pcbPadStyle = s; }
    getPcbPadStyle(): number { return this.pcbPadStyle; }
    setPcbPadDrill(s: number): void { this.pcbPadDrill = s; }
    getPcbPadDrill(): number { return this.pcbPadDrill; }
    setPcbThickness(s: number): void { this.pcbThickness = s; }
    getPcbThickness(): number { return this.pcbThickness; }
}
