import { DrawingModel } from './model/DrawingModel.js';
import { StandardLayers } from '../layers/StandardLayers.js';
import { MapCoordinates } from '../geom/MapCoordinates.js';
import { ParserActions } from './controllers/ParserActions.js';
import { SelectionActions } from './controllers/SelectionActions.js';
import { UndoActions } from './controllers/UndoActions.js';
import { EditorActions } from './controllers/EditorActions.js';
import { ElementsEdtActions } from './controllers/ElementsEdtActions.js';
import { ClipboardController } from './controllers/ClipboardController.js';

export interface EditorServices {
    model: DrawingModel;
    mapCoordinates: MapCoordinates;
    parserActions: ParserActions;
    selectionActions: SelectionActions;
    undoActions: UndoActions;
    editorActions: EditorActions;
    elementsEdt: ElementsEdtActions;
    clipboardController: ClipboardController;
}

/**
 * Create and wire all editor controllers for a new (empty) document.
 * The returned services are fully initialized but not yet connected to
 * any UI or canvas — that's the CircuitPanel's job.
 */
export function createEditorServices(): EditorServices {
    const model = new DrawingModel();
    model.setLayers(StandardLayers.createStandardLayers());

    const mapCoordinates = new MapCoordinates();
    mapCoordinates.setXCenter(0);
    mapCoordinates.setYCenter(0);
    mapCoordinates.setXMagnitude(20);
    mapCoordinates.setYMagnitude(20);

    const parserActions = new ParserActions(model);
    const selectionActions = new SelectionActions(model);
    const undoActions = new UndoActions(parserActions);
    const editorActions = new EditorActions(model, selectionActions, undoActions);
    const elementsEdt = new ElementsEdtActions(model, selectionActions, undoActions, editorActions);
    const clipboardController = new ClipboardController(
        selectionActions,
        parserActions,
        editorActions,
        undoActions,
        mapCoordinates,
    );

    return {
        model,
        mapCoordinates,
        parserActions,
        selectionActions,
        undoActions,
        editorActions,
        elementsEdt,
        clipboardController,
    };
}
