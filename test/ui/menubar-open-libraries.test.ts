import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadLocale } from '../../src/i18n/i18n.js';
import { MenuBar } from '../../src/ui/MenuBar.js';
import type { EditorFacade } from '../../src/circuit/EditorFacade.js';

/** Resolve pending microtasks so FileReader.onload and chained .then() run. */
function flush(): Promise<void> {
    return new Promise((r) => setTimeout(r, 0));
}

/** Poll until `cond()` is true or the timeout elapses (FileReader.onload in
 *  jsdom fires on an indeterminate later task, so we cannot assume a fixed
 *  number of microtask flushes). */
async function waitUntil(cond: () => boolean, timeoutMs = 1000): Promise<void> {
    const start = Date.now();
    while (!cond() && Date.now() - start < timeoutMs) {
        await flush();
    }
}

describe('File → Open waits for libraries before parsing', () => {
    let loadCircuit: ReturnType<typeof vi.fn>;
    let facade: EditorFacade;
    let menuBar: MenuBar;
    let capturedInput: HTMLInputElement | null;
    let origCreate: typeof document.createElement;

    beforeEach(async () => {
        await loadLocale('en');
        loadCircuit = vi.fn();
        const overrides: Record<string, unknown> = {
            loadCircuit,
            setFileName: vi.fn(),
            setFileHandle: vi.fn(),
        };
        // The MenuBar constructor reads assorted panel state for its menu
        // labels; back every other member with a harmless no-op getter.
        facade = new Proxy(overrides, {
            get(target, prop: string) {
                if (prop in target) return target[prop];
                return () => false;
            },
        }) as unknown as EditorFacade;

        // Capture the hidden <input type=file> that importCircuit creates so the
        // test can drive its change event directly.
        capturedInput = null;
        origCreate = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tag: string, opts?: any) => {
            const el = origCreate(tag, opts);
            if (tag === 'input') {
                capturedInput = el as HTMLInputElement;
                (el as HTMLInputElement).click = () => {}; // don't open a real dialog
            }
            return el;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('does not call loadCircuit until librariesReady resolves', async () => {
        // A librariesReady promise we control, behind a spy so the test can
        // tell when the open flow reaches the libraries gate.
        let resolveLibs!: () => void;
        const librariesReady = new Promise<void>((res) => {
            resolveLibs = res;
        });
        const readyProvider = vi.fn(() => librariesReady);

        menuBar = new MenuBar(facade, () => {}, undefined, undefined, readyProvider);

        // Trigger the (private) open flow and feed it a file.
        (menuBar as unknown as { importCircuit(): void }).importCircuit();
        expect(capturedInput).not.toBeNull();
        const input = capturedInput!;
        const file = new File(['[FIDOCAD]\nMC 100 100 0 0 000\n'], 'a.fcd', {
            type: 'text/plain',
        });
        Object.defineProperty(input, 'files', { value: [file], configurable: true });
        input.dispatchEvent(new Event('change'));

        // Wait until the FileReader has delivered the text and the flow has
        // either consulted the libraries gate (fixed) or already parsed (buggy).
        await waitUntil(
            () => readyProvider.mock.calls.length > 0 || loadCircuit.mock.calls.length > 0,
        );

        // With the fix the flow consults librariesReady and, since it has not
        // resolved, defers loadCircuit. The bug parses immediately.
        expect(readyProvider).toHaveBeenCalled();
        expect(loadCircuit).not.toHaveBeenCalled();

        // Once libraries are ready, the deferred load runs exactly once.
        resolveLibs();
        await waitUntil(() => loadCircuit.mock.calls.length > 0);
        expect(loadCircuit).toHaveBeenCalledTimes(1);
        expect(loadCircuit).toHaveBeenCalledWith('[FIDOCAD]\nMC 100 100 0 0 000\n');
    });
});
