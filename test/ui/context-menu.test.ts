import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContextMenu, type ContextMenuItem } from '../../src/ui/ContextMenu.js';
import {
    ContextMenuManager,
    type ContextMenuCallbacks,
} from '../../src/circuit/ContextMenuManager.js';
import type { SelectionActions } from '../../src/circuit/controllers/SelectionActions.js';
import type { UndoActions } from '../../src/circuit/controllers/UndoActions.js';
import type { MapCoordinates } from '../../src/geom/MapCoordinates.js';
import type { ClipboardController } from '../../src/circuit/controllers/ClipboardController.js';
import type { GraphicPrimitive } from '../../src/primitives/GraphicPrimitive.js';
import { PrimitivePolygon } from '../../src/primitives/PrimitivePolygon.js';

afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
});

describe('ContextMenu', () => {
    it('renders menu icons and skips hidden separators', () => {
        vi.useFakeTimers();
        const menu = new ContextMenu();

        menu.show(10, 20, [
            { label: 'Copy', icon: 'copy.png' },
            { separator: true, visible: false },
            { label: 'Paste', icon: 'paste.png' },
        ]);

        const buttons = document.querySelectorAll('button');
        expect(buttons).toHaveLength(2);
        expect(buttons[0]!.querySelector('img')?.src).toContain('/icons/menu_icons/copy.png');
        expect(buttons[1]!.querySelector('img')?.src).toContain('/icons/menu_icons/paste.png');
        expect(document.querySelectorAll('hr')).toHaveLength(0);

        vi.runOnlyPendingTimers();
        menu.hide();
    });
});

describe('ContextMenuManager', () => {
    function getItems(first: GraphicPrimitive | null): ContextMenuItem[] {
        const show = vi.fn();
        const contextMenu = { show } as unknown as ContextMenu;
        const selectionActions = {
            getFirstSelectedPrimitive: () => first,
            getSelectedPrimitives: () => (first ? [first] : []),
            isUniquePrimitiveSelected: () => first !== null,
        } as unknown as SelectionActions;
        const mapCoordinates = {
            unmapXnosnap: (x: number) => x,
            unmapYnosnap: (y: number) => y,
        } as unknown as MapCoordinates;
        const clipboardController = {
            canPaste: () => false,
        } as unknown as ClipboardController;
        const callbacks: ContextMenuCallbacks = {
            onPropertiesRequested: null,
            onBatchPropertiesRequested: null,
            onSymbolizeRequested: () => {},
            onRender: () => {},
            copySelected: () => {},
            cutSelected: () => {},
            paste: async () => {},
            duplicateSelected: () => {},
            selectAll: () => {},
            startMoveSelected: () => {},
            rotateSelected: () => {},
            mirrorSelected: () => {},
            vectorizeMacro: () => {},
        };

        const manager = new ContextMenuManager(
            contextMenu,
            selectionActions,
            {} as UndoActions,
            mapCoordinates,
            clipboardController,
            document.createElement('canvas'),
            callbacks,
        );
        manager.show(10, 20);
        return show.mock.calls[0]![2] as ContextMenuItem[];
    }

    it('assigns an icon to every action', () => {
        const items = getItems({} as GraphicPrimitive);
        expect(items.filter((item) => !item.separator).every((item) => item.icon)).toBe(true);
    });

    it('shows the final separator only before an available conversion action', () => {
        const selectedItems = getItems({} as GraphicPrimitive);
        const symbolizeIndex = selectedItems.findIndex((item) => item.label === 'Symbolize');
        expect(selectedItems[symbolizeIndex - 1]).toMatchObject({
            separator: true,
            visible: true,
        });

        const emptyItems = getItems(null);
        const hiddenSeparator = emptyItems.find(
            (item, index) => item.separator && emptyItems[index + 1]?.label === 'Symbolize',
        );
        expect(hiddenSeparator?.visible).toBe(false);
    });

    it('places node actions between separators and keeps conversion last', () => {
        const polygon = new PrimitivePolygon(false, 0, 0, 'sans-serif', 12);
        const visibleTail = getItems(polygon)
            .filter((item) => item.visible !== false)
            .slice(-6)
            .map((item) => (item.separator ? 'separator' : item.label));

        expect(visibleTail).toEqual([
            'Mirror_E',
            'separator',
            'Add_node',
            'Remove_node',
            'separator',
            'Symbolize',
        ]);
    });
});
