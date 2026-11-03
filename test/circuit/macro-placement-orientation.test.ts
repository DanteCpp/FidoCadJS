import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CircuitPanel } from '../../src/circuit/CircuitPanel.js';
import { Tool } from '../../src/circuit/controllers/Tool.js';
import { MacroDesc } from '../../src/primitives/MacroDesc.js';
import { PrimitiveMacro } from '../../src/primitives/PrimitiveMacro.js';
import { PrimitiveLine } from '../../src/primitives/PrimitiveLine.js';

const KEY = 'test.part';

function mouse(panel: CircuitPanel, type: string, sx: number, sy: number): void {
    const canvas = panel.getCanvasElement();
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
        new MouseEvent(type, {
            clientX: rect.left + sx,
            clientY: rect.top + sy,
            button: 0,
            bubbles: true,
        }),
    );
}

function click(panel: CircuitPanel, sx: number, sy: number): void {
    mouse(panel, 'mousedown', sx, sy);
    mouse(panel, 'mouseup', sx, sy);
}

function press(panel: CircuitPanel, key: string): void {
    panel
        .getCanvasElement()
        .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function ghost(panel: CircuitPanel): PrimitiveMacro {
    const g = (panel as any).inputHandler.ghostPrimitive;
    expect(g).toBeInstanceOf(PrimitiveMacro);
    return g as PrimitiveMacro;
}

function placedMacros(panel: CircuitPanel): PrimitiveMacro[] {
    return panel
        .getModel()
        .getPrimitiveVector()
        .filter((p): p is PrimitiveMacro => p instanceof PrimitiveMacro);
}

describe('Rotating and mirroring a macro before placement', () => {
    let container: HTMLDivElement;
    let panel: CircuitPanel;

    beforeEach(() => {
        container = document.createElement('div');
        Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true });
        Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });
        document.body.appendChild(container);

        panel = new CircuitPanel(container);
        panel.addKeyboardListeners();
        panel
            .getModel()
            .getLibrary()
            .set(KEY, new MacroDesc(KEY, 'Part', 'LI 100 100 120 100 0', 'Test', 'test', 'test'));
        panel.setMacroTool(KEY);
    });

    afterEach(() => {
        panel.destroy();
        container.remove();
    });

    it('R rotates the ghost in place, without waiting for a mouse move', () => {
        mouse(panel, 'mousemove', 200, 200);
        const before = ghost(panel);
        expect(before.getOrientation()).toBe(0);
        const anchor = before.getFirstPoint();

        press(panel, 'r');

        const after = ghost(panel);
        expect(after).not.toBe(before);
        expect(after.getOrientation()).toBe(1);
        expect(after.getFirstPoint().x).toBe(anchor.x);
        expect(after.getFirstPoint().y).toBe(anchor.y);
    });

    it('R cycles through the four orientations', () => {
        mouse(panel, 'mousemove', 200, 200);
        const seen: number[] = [];
        for (let i = 0; i < 4; i++) {
            press(panel, 'r');
            seen.push(ghost(panel).getOrientation());
        }
        expect(seen).toEqual([1, 2, 3, 0]);
    });

    it('S mirrors the ghost', () => {
        mouse(panel, 'mousemove', 200, 200);
        press(panel, 's');
        expect(ghost(panel).isMirrored()).toBe(true);
        press(panel, 's');
        expect(ghost(panel).isMirrored()).toBe(false);
    });

    it('places the macro with the previewed orientation and mirroring', () => {
        mouse(panel, 'mousemove', 200, 200);
        press(panel, 'r');
        press(panel, 'r');
        press(panel, 's');
        click(panel, 200, 200);

        const [placed] = placedMacros(panel);
        expect(placed).toBeDefined();
        expect(placed!.getOrientation()).toBe(2);
        expect(placed!.isMirrored()).toBe(true);
        expect(panel.getCircuitText()).toMatch(/^MC \d+ \d+ 2 1 test\.part$/m);
    });

    it('a rotation pressed before the cursor reaches the canvas still applies', () => {
        press(panel, 'r');
        mouse(panel, 'mousemove', 200, 200);
        expect(ghost(panel).getOrientation()).toBe(1);
    });

    it('keeps the orientation for repeated placements and leaves placed parts alone', () => {
        press(panel, 'r');
        click(panel, 100, 100);
        click(panel, 300, 300);
        expect(placedMacros(panel).map((m) => m.getOrientation())).toEqual([1, 1]);

        press(panel, 'r');
        click(panel, 400, 200);
        expect(placedMacros(panel).map((m) => m.getOrientation())).toEqual([1, 1, 2]);
    });

    it('resets the orientation when another macro or tool is chosen', () => {
        press(panel, 'r');
        press(panel, 's');
        panel.setMacroTool(KEY);
        click(panel, 200, 200);
        expect(placedMacros(panel)[0]!.getOrientation()).toBe(0);
        expect(placedMacros(panel)[0]!.isMirrored()).toBe(false);

        press(panel, 'r');
        panel.setTool(Tool.LINE);
        panel.setMacroTool(KEY);
        click(panel, 300, 300);
        expect(placedMacros(panel)[1]!.getOrientation()).toBe(0);
    });

    it('does not rotate a pre-existing selection while a macro is armed', () => {
        const line = new PrimitiveLine(10, 10, 50, 10, 0, false, false, 0, 3, 2, 0, 'Courier', 3);
        panel.getModel().addPrimitive(line, false, null);
        panel.selectAll();
        const before = panel.getCircuitText();

        press(panel, 'r');

        expect(panel.getCircuitText()).toBe(before);
        expect((panel as any).elementsEdt.macroOrientation).toBe(1);
    });

    it('R still rotates the selection with the selection tool', () => {
        panel.setTool(Tool.SELECTION);
        const line = new PrimitiveLine(
            200,
            200,
            280,
            200,
            0,
            false,
            false,
            0,
            3,
            2,
            0,
            'Courier',
            3,
        );
        panel.getModel().addPrimitive(line, false, null);
        panel.selectAll();
        const before = panel.getCircuitText();

        press(panel, 'r');

        expect(panel.getCircuitText()).not.toBe(before);
    });
});
