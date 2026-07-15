import { Tool } from './Tool.js';
import { DrawingModel } from '../model/DrawingModel.js';
import { UndoActions } from './UndoActions.js';
import { SelectionActions } from './SelectionActions.js';
import { EditorActions } from './EditorActions.js';
import { AddElements } from './AddElements.js';
import { MapCoordinates } from '../../geom/MapCoordinates.js';
import { GraphicPrimitive } from '../../primitives/GraphicPrimitive.js';
import { PrimitiveComplexCurve } from '../../primitives/PrimitiveComplexCurve.js';
import { PrimitivePolygon } from '../../primitives/PrimitivePolygon.js';
import { PrimitiveAdvText } from '../../primitives/PrimitiveAdvText.js';
import { PrimitiveMacro } from '../../primitives/PrimitiveMacro.js';
import { Globals } from '../../globals/Globals.js';

/**
 * ElementsEdtActions: main controller for adding and editing elements.
 * Coordinates all tool operations and manages the editing state.
 */
export class ElementsEdtActions {
    private readonly model: DrawingModel;
    private readonly undoActions: UndoActions | null;
    private readonly editorActions: EditorActions;
    private readonly selectionActions: SelectionActions;
    private readonly addElements: AddElements;

    // Current editing state
    public currentLayer: number = 0;
    public xpoly: number[];
    public ypoly: number[];
    public macroKey: string = '';
    public clickNumber: number = 0;
    public primEdit: GraphicPrimitive | null = null;
    public actionSelected: number = Tool.SELECTION;
    public successiveMove: boolean = false;

    // Maximum polygon vertices (must match PrimitivePolygon)
    public static readonly NPOLY = 256;

    // Callbacks
    public onTextEditRequested: ((prim: PrimitiveAdvText, sx: number, sy: number) => void) | null =
        null;
    public onExistingTextEditRequested: ((prim: PrimitiveAdvText) => void) | null = null;
    public onPropertiesRequested: ((prim: GraphicPrimitive) => void) | null = null;
    public onContextMenuRequested: ((sx: number, sy: number) => void) | null = null;

    constructor(
        model: DrawingModel,
        selectionActions: SelectionActions,
        undoActions: UndoActions | null,
        editorActions: EditorActions,
    ) {
        this.model = model;
        this.undoActions = undoActions;
        this.editorActions = editorActions;
        this.selectionActions = selectionActions;
        this.addElements = new AddElements(model, undoActions);

        this.xpoly = new Array(ElementsEdtActions.NPOLY);
        this.ypoly = new Array(ElementsEdtActions.NPOLY);
        this.actionSelected = Tool.SELECTION;
    }

    /** Get the AddElements controller */
    getAddElements(): AddElements {
        return this.addElements;
    }

    /** Set the current tool state */
    setState(s: number, macro: string = ''): void {
        this.actionSelected = s;
        this.clickNumber = 0;
        this.successiveMove = false;
        this.macroKey = macro;
        this.primEdit = null;
    }

    /** Rotate macro 90 degrees clockwise */
    rotateMacro(): void {
        if (this.primEdit instanceof PrimitiveMacro) {
            const first = this.primEdit.getFirstPoint();
            this.primEdit.rotatePrimitive(false, first.x, first.y);
        }
    }

    /** Mirror macro horizontally */
    mirrorMacro(): void {
        if (this.primEdit instanceof PrimitiveMacro) {
            const first = this.primEdit.getFirstPoint();
            this.primEdit.mirrorPrimitive(first.x);
        }
    }

    /**
     * Handle mouse click for tool operations.
     * @param cs coordinate mapping
     * @param x screen x coordinate
     * @param y screen y coordinate
     * @param button3 true if right/alternate button pressed
     * @param toggle true if toggle modifier (Ctrl) pressed
     * @param doubleClick true if double click
     * @returns true if repaint needed
     */
    handleClick(
        cs: MapCoordinates,
        x: number,
        y: number,
        button3: boolean,
        toggle: boolean,
        doubleClick: boolean,
    ): boolean {
        let repaint = false;

        if (this.clickNumber > ElementsEdtActions.NPOLY - 1) {
            this.clickNumber = ElementsEdtActions.NPOLY - 1;
        }

        // Reset primEdit unless entering a macro (need to preserve orientation/mirror)
        if (this.actionSelected !== Tool.MACRO) {
            this.primEdit = null;
        }

        // Right-click cancels any active drawing tool and returns to selection
        if (button3 && this.actionSelected > Tool.HAND) {
            this.actionSelected = Tool.SELECTION;
            this.clickNumber = 0;
            this.primEdit = null;
            return true;
        }

        switch (this.actionSelected) {
            case Tool.NONE:
                this.clickNumber = 0;
                break;

            case Tool.SELECTION:
                this.clickNumber = 0;
                if (doubleClick) {
                    // Fire callback if a primitive is selected
                    const sel = this.selectionActions.getSelectedPrimitives();
                    if (sel.length > 0) {
                        if (sel[0] instanceof PrimitiveAdvText) {
                            this.onExistingTextEditRequested?.(sel[0] as PrimitiveAdvText);
                        } else {
                            this.onPropertiesRequested?.(sel[0]);
                        }
                    }
                } else if (button3) {
                    // Handled via contextmenu event in CircuitPanel
                } else {
                    this.editorActions.handleSelection(cs, x, y, toggle);
                }
                break;

            case Tool.ZOOM:
                // TODO: Change zoom by step
                break;

            case Tool.CONNECTION:
                this.addElements.addConnection(
                    cs.unmapXsnap(x),
                    cs.unmapYsnap(y),
                    this.currentLayer,
                );
                repaint = true;
                break;

            case Tool.PCB_PAD:
                this.addElements.addPCBPad(cs.unmapXsnap(x), cs.unmapYsnap(y), this.currentLayer);
                repaint = true;
                break;

            case Tool.LINE:
                if (doubleClick) {
                    this.clickNumber = 0;
                } else {
                    this.successiveMove = false;
                    this.clickNumber = this.addElements.addLine(
                        cs.unmapXsnap(x),
                        cs.unmapYsnap(y),
                        this.xpoly,
                        this.ypoly,
                        this.currentLayer,
                        ++this.clickNumber,
                        button3,
                    );
                    repaint = true;
                }
                break;

            case Tool.TEXT:
                if (doubleClick) {
                    // Fire callback if a text primitive is selected
                    const sel = this.selectionActions.getSelectedPrimitives();
                    if (sel.length > 0 && sel[0] instanceof PrimitiveAdvText) {
                        this.onTextEditRequested?.(sel[0] as PrimitiveAdvText, x, y);
                    }
                } else {
                    const newText = new PrimitiveAdvText(
                        cs.unmapXsnap(x),
                        cs.unmapYsnap(y),
                        Math.max(1, Math.round((this.model.getDefaultTextFontSize() * 7) / 10)),
                        this.model.getDefaultTextFontSize(),
                        this.model.getDefaultTextFont(),
                        0,
                        0,
                        'String',
                        this.currentLayer,
                    );
                    this.selectionActions.setSelectionAll(false);
                    this.model.addPrimitive(newText, true, this.undoActions);
                    newText.setSelected(true);
                    repaint = true;
                    // Fire callback to show text editor
                    this.onTextEditRequested?.(newText, x, y);
                }
                break;

            case Tool.BEZIER:
                repaint = true;
                if (button3) {
                    this.clickNumber = 0;
                } else {
                    if (doubleClick) {
                        this.successiveMove = false;
                    }
                    this.clickNumber = this.addElements.addBezier(
                        cs.unmapXsnap(x),
                        cs.unmapYsnap(y),
                        this.xpoly,
                        this.ypoly,
                        this.currentLayer,
                        ++this.clickNumber,
                    );
                }
                break;

            case Tool.POLYGON:
                if (doubleClick) {
                    const poly = new PrimitivePolygon(
                        false,
                        this.currentLayer,
                        0,
                        this.model.getTextFont(),
                        this.model.getTextFontSize(),
                    );
                    for (let i = 1; i <= this.clickNumber; i++) {
                        poly.addPoint(this.xpoly[i], this.ypoly[i]);
                    }
                    this.model.addPrimitive(poly, true, this.undoActions);
                    this.clickNumber = 0;
                    repaint = true;
                } else {
                    ++this.clickNumber;
                    this.successiveMove = false;
                    if (this.clickNumber === ElementsEdtActions.NPOLY) {
                        return false;
                    }
                    this.xpoly[this.clickNumber] = cs.unmapXsnap(x);
                    this.ypoly[this.clickNumber] = cs.unmapYsnap(y);
                }
                break;

            case Tool.COMPLEXCURVE:
                if (doubleClick) {
                    const compc = new PrimitiveComplexCurve(
                        false,
                        false,
                        this.currentLayer,
                        false,
                        false,
                        0,
                        Globals.arrowLength,
                        Globals.arrowHalfWidth,
                        0,
                        this.model.getTextFont(),
                        this.model.getTextFontSize(),
                    );
                    for (let i = 1; i <= this.clickNumber; i++) {
                        compc.addPoint(this.xpoly[i], this.ypoly[i]);
                    }
                    this.model.addPrimitive(compc, true, this.undoActions);
                    this.clickNumber = 0;
                    repaint = true;
                } else {
                    ++this.clickNumber;
                    this.successiveMove = false;
                    if (this.clickNumber === ElementsEdtActions.NPOLY) {
                        return false;
                    }
                    this.xpoly[this.clickNumber] = cs.unmapXsnap(x);
                    this.ypoly[this.clickNumber] = cs.unmapYsnap(y);
                }
                break;

            case Tool.ELLIPSE:
                this.successiveMove = false;
                this.clickNumber = this.addElements.addEllipse(
                    cs.unmapXsnap(x),
                    cs.unmapYsnap(y),
                    this.xpoly,
                    this.ypoly,
                    this.currentLayer,
                    ++this.clickNumber,
                    toggle && this.clickNumber > 0,
                );
                repaint = true;
                break;

            case Tool.RECTANGLE:
                this.successiveMove = false;
                this.clickNumber = this.addElements.addRectangle(
                    cs.unmapXsnap(x),
                    cs.unmapYsnap(y),
                    this.xpoly,
                    this.ypoly,
                    this.currentLayer,
                    ++this.clickNumber,
                    toggle && this.clickNumber > 0,
                );
                repaint = true;
                break;

            case Tool.PCB_LINE:
                if (doubleClick) {
                    this.clickNumber = 0;
                } else {
                    this.successiveMove = false;
                    this.clickNumber = this.addElements.addPCBLine(
                        cs.unmapXsnap(x),
                        cs.unmapYsnap(y),
                        this.xpoly,
                        this.ypoly,
                        this.currentLayer,
                        ++this.clickNumber,
                        button3,
                        this.addElements.getPcbThickness(),
                    );
                    repaint = true;
                }
                break;

            case Tool.MACRO:
                this.successiveMove = false;
                this.primEdit = this.addElements.addMacro(
                    cs.unmapXsnap(x),
                    cs.unmapYsnap(y),
                    this.selectionActions,
                    this.primEdit,
                    this.macroKey,
                );
                repaint = true;
                break;
        }

        return repaint;
    }
}
