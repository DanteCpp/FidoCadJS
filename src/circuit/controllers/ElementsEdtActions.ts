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

/**
 * ElementsEdtActions: main controller for adding and editing elements.
 * Coordinates all tool operations and manages the editing state.
 */
export class ElementsEdtActions {
    // Tool state constants
    public static readonly NONE = 0;
    public static readonly SELECTION = 1;
    public static readonly ZOOM = 2;
    public static readonly HAND = 3;
    public static readonly LINE = 4;
    public static readonly TEXT = 5;
    public static readonly BEZIER = 6;
    public static readonly POLYGON = 7;
    public static readonly ELLIPSE = 8;
    public static readonly RECTANGLE = 9;
    public static readonly CONNECTION = 10;
    public static readonly PCB_LINE = 11;
    public static readonly PCB_PAD = 12;
    public static readonly MACRO = 13;
    public static readonly COMPLEXCURVE = 14;

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
    public actionSelected: number = ElementsEdtActions.SELECTION;
    public successiveMove: boolean = false;

    // Maximum polygon vertices (must match PrimitivePolygon)
    public static readonly NPOLY = 256;

    // Callbacks
    public onTextEditRequested: ((prim: PrimitiveAdvText, sx: number, sy: number) => void) | null = null;
    public onExistingTextEditRequested: ((prim: PrimitiveAdvText) => void) | null = null;
    public onPropertiesRequested: ((prim: GraphicPrimitive) => void) | null = null;
    public onContextMenuRequested: ((sx: number, sy: number) => void) | null = null;

    constructor(
        model: DrawingModel,
        selectionActions: SelectionActions,
        undoActions: UndoActions | null,
        editorActions: EditorActions
    ) {
        this.model = model;
        this.undoActions = undoActions;
        this.editorActions = editorActions;
        this.selectionActions = selectionActions;
        this.addElements = new AddElements(model, undoActions);

        this.xpoly = new Array(ElementsEdtActions.NPOLY);
        this.ypoly = new Array(ElementsEdtActions.NPOLY);
        this.actionSelected = ElementsEdtActions.SELECTION;
    }

    /** Get the AddElements controller */
    getAddElements(): AddElements {
        return this.addElements;
    }

    /** Check if currently entering a macro */
    isEnteringMacro(): boolean {
        return this.primEdit instanceof PrimitiveMacro;
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
        x: number, y: number,
        button3: boolean,
        toggle: boolean,
        doubleClick: boolean
    ): boolean {
        let repaint = false;

        if (this.clickNumber > ElementsEdtActions.NPOLY - 1) {
            this.clickNumber = ElementsEdtActions.NPOLY - 1;
        }

        // Reset primEdit unless entering a macro (need to preserve orientation/mirror)
        if (this.actionSelected !== ElementsEdtActions.MACRO) {
            this.primEdit = null;
        }

        // Right-click cancels macro insertion
        if (button3 && this.actionSelected === ElementsEdtActions.MACRO) {
            this.actionSelected = ElementsEdtActions.SELECTION;
            this.primEdit = null;
            return true;
        }

        switch (this.actionSelected) {
            case ElementsEdtActions.NONE:
                this.clickNumber = 0;
                break;

            case ElementsEdtActions.SELECTION:
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

            case ElementsEdtActions.ZOOM:
                // TODO: Change zoom by step
                break;

            case ElementsEdtActions.CONNECTION:
                this.addElements.addConnection(
                    cs.unmapXsnap(x),
                    cs.unmapYsnap(y),
                    this.currentLayer
                );
                repaint = true;
                break;

            case ElementsEdtActions.PCB_PAD:
                this.addElements.addPCBPad(
                    cs.unmapXsnap(x),
                    cs.unmapYsnap(y),
                    this.currentLayer
                );
                repaint = true;
                break;

            case ElementsEdtActions.LINE:
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
                        button3
                    );
                    repaint = true;
                }
                break;

            case ElementsEdtActions.TEXT:
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
                        3, 4,
                        this.model.getTextFont(),
                        0, 0,
                        'String',
                        this.currentLayer
                    );
                    this.selectionActions.setSelectionAll(false);
                    this.model.addPrimitive(newText, true, this.undoActions);
                    newText.setSelected(true);
                    repaint = true;
                    // Fire callback to show text editor
                    this.onTextEditRequested?.(newText, x, y);
                }
                break;

            case ElementsEdtActions.BEZIER:
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
                        ++this.clickNumber
                    );
                }
                break;

            case ElementsEdtActions.POLYGON:
                if (doubleClick) {
                    const poly = new PrimitivePolygon(
                        false,
                        this.currentLayer,
                        0,
                        this.model.getTextFont(),
                        this.model.getTextFontSize()
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

            case ElementsEdtActions.COMPLEXCURVE:
                if (doubleClick) {
                    const compc = new PrimitiveComplexCurve(
                        false,
                        false,
                        this.currentLayer,
                        false, false, 0, 3, 2, 0,
                        this.model.getTextFont(),
                        this.model.getTextFontSize()
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

            case ElementsEdtActions.ELLIPSE:
                this.successiveMove = false;
                this.clickNumber = this.addElements.addEllipse(
                    cs.unmapXsnap(x),
                    cs.unmapYsnap(y),
                    this.xpoly,
                    this.ypoly,
                    this.currentLayer,
                    ++this.clickNumber,
                    toggle && this.clickNumber > 0
                );
                repaint = true;
                break;

            case ElementsEdtActions.RECTANGLE:
                this.successiveMove = false;
                this.clickNumber = this.addElements.addRectangle(
                    cs.unmapXsnap(x),
                    cs.unmapYsnap(y),
                    this.xpoly,
                    this.ypoly,
                    this.currentLayer,
                    ++this.clickNumber,
                    toggle && this.clickNumber > 0
                );
                repaint = true;
                break;

            case ElementsEdtActions.PCB_LINE:
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
                        this.addElements.getPcbThickness()
                    );
                    repaint = true;
                }
                break;

            case ElementsEdtActions.MACRO:
                this.successiveMove = false;
                this.primEdit = this.addElements.addMacro(
                    cs.unmapXsnap(x),
                    cs.unmapYsnap(y),
                    this.selectionActions,
                    this.primEdit,
                    this.macroKey
                );
                repaint = true;
                break;
        }

        return repaint;
    }

    /** Get current selection state (active tool) */
    getSelectionState(): number {
        return this.actionSelected;
    }

    /** Set current editing primitive */
    setPrimEdit(gp: GraphicPrimitive | null): void {
        this.primEdit = gp;
    }

    /** Get current editing primitive */
    getPrimEdit(): GraphicPrimitive | null {
        return this.primEdit;
    }
}
