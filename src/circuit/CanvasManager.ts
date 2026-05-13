/**
 * @file CanvasManager.ts
 * @author Dante Loi
 * @date 2026-05-13
 * @brief Canvas element lifecycle manager extracted from CircuitPanel
 * @copyright Copyright 2026 Dante Loi - GPL v3
 * @details Handles canvas creation, ResizeObserver for responsive sizing,
 *          device-pixel-ratio change detection, and cleanup on destroy.
 *          Extracted during agent-friendly refactoring (P2.1).
 */

export class CanvasManager {
    readonly canvas: HTMLCanvasElement;
    private container: HTMLElement;
    private resizeObserver: ResizeObserver | null = null;
    private dprMediaQuery: MediaQueryList | null = null;
    private readonly boundHandleResize: () => void;
    private onResize: (() => void) | null = null;

    constructor(container: HTMLElement) {
        this.container = container;
        this.boundHandleResize = () => this.handleResize();

        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.setAttribute('data-testid', 'editor-canvas');
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        container.appendChild(this.canvas);

        // Setup high-DPI canvas with ResizeObserver for robust sizing
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(container);

        // Detect device-pixel-ratio changes (e.g. window moved to another monitor)
        try {
            this.dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
            this.dprMediaQuery.addEventListener('change', this.boundHandleResize);
        } catch {
            // matchMedia not available — graceful degradation
        }

        // Force initial layout computation
        container.offsetWidth;
    }

    /** Set the callback invoked after every resize (for render + clampCenter). */
    setOnResize(callback: (() => void) | null): void {
        this.onResize = callback;
    }

    /** Handle canvas resize triggered by ResizeObserver or DPR changes.
     *  Reads devicePixelRatio fresh each invocation so the internal canvas
     *  resolution stays in sync with the actual screen density. */
    private handleResize(): void {
        const dpr = window.devicePixelRatio || 1;
        const w = this.container.clientWidth * dpr;
        const h = this.container.clientHeight * dpr;
        if (w <= 0 || h <= 0) return;
        if (w === this.canvas.width && h === this.canvas.height) return;

        this.canvas.width = w;
        this.canvas.height = h;
        this.onResize?.();
    }

    /** Remove all global listeners and observers. */
    destroy(): void {
        if (this.dprMediaQuery) {
            this.dprMediaQuery.removeEventListener('change', this.boundHandleResize);
            this.dprMediaQuery = null;
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
    }
}
