import type { MapCoordinates } from '../geom/MapCoordinates.js';
import type { GraphicsInterface } from '../graphic/GraphicsInterface.js';

export interface ImageAttachState {
    dataUrl: string;
    x: number;
    y: number;
    scale: number;
    alpha: number;
    naturalWidth: number;
    naturalHeight: number;
}

export class ImageAsCanvas {
    private imageElement: HTMLImageElement | null = null;
    private x: number = 0;
    private y: number = 0;
    private scale: number = 1.0;
    private alpha: number = 0.5;
    /** Original natural dimensions of the loaded image. */
    private naturalWidth: number = 0;
    private naturalHeight: number = 0;
    /** Whether an image is currently attached. */
    private hasImage: boolean = false;
    private readyPromise: Promise<void> | null = null;
    /** Set by the parser when an FJC IMG line is read; the UI consumes it to
     *  re-attach the image bytes (kept locally, not stored in the .fcd). */
    private pendingRestore: boolean = false;

    // ── Getters / Setters ───────────────────────────────────────────────

    getImage(): HTMLImageElement | null {
        return this.imageElement;
    }

    getX(): number {
        return this.x;
    }
    getY(): number {
        return this.y;
    }
    setX(v: number): void {
        this.x = v;
    }
    setY(v: number): void {
        this.y = v;
    }

    getScale(): number {
        return this.scale;
    }
    setScale(v: number): void {
        this.scale = Math.max(0.01, Math.min(100, v));
    }

    getAlpha(): number {
        return this.alpha;
    }
    setAlpha(v: number): void {
        this.alpha = Math.max(0, Math.min(1, v));
    }

    getNaturalWidth(): number {
        return this.naturalWidth;
    }
    getNaturalHeight(): number {
        return this.naturalHeight;
    }

    isAttached(): boolean {
        return this.hasImage;
    }

    // ── Image loading ──────────────────────────────────────────────────

    /**
     * Attach an image from a data URL or regular URL.
     * Returns a promise that resolves when the image metadata is known.
     */
    attachImage(src: string): Promise<void> {
        const loadPromise = new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.imageElement = img;
                this.naturalWidth = img.naturalWidth;
                this.naturalHeight = img.naturalHeight;
                this.hasImage = true;
                resolve();
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = src;
        });
        this.readyPromise = loadPromise;
        void loadPromise.finally(() => {
            if (this.readyPromise === loadPromise) this.readyPromise = null;
        });
        return loadPromise;
    }

    /**
     * Attach an image from a File object (from a file picker).
     * Reads the file as a data URL, stores the image, and returns the data URL.
     */
    attachFile(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result as string;
                this.attachImage(dataUrl)
                    .then(() => resolve(dataUrl))
                    .catch(reject);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    /** Remove the attached image. */
    detach(): void {
        this.imageElement = null;
        this.hasImage = false;
        this.readyPromise = null;
        this.pendingRestore = false;
        this.x = 0;
        this.y = 0;
        this.scale = 1.0;
        this.alpha = 0.5;
        this.naturalWidth = 0;
        this.naturalHeight = 0;
    }

    // ── Serialisation ──────────────────────────────────────────────────

    /** Get the current state for FCD serialisation. */
    getState(): ImageAttachState | null {
        if (!this.hasImage || !this.imageElement) return null;
        return {
            dataUrl: this.imageElement.src,
            x: this.x,
            y: this.y,
            scale: this.scale,
            alpha: this.alpha,
            naturalWidth: this.naturalWidth,
            naturalHeight: this.naturalHeight,
        };
    }

    /** Restore state (e.g. after FCD parse). */
    async restoreState(state: ImageAttachState): Promise<void> {
        await this.attachImage(state.dataUrl);
        this.x = state.x;
        this.y = state.y;
        this.scale = state.scale;
        this.alpha = state.alpha;
    }

    /** Start an async restore from a synchronous parser path. */
    startRestore(state: ImageAttachState): void {
        const restorePromise = this.restoreState(state).catch((err) => {
            console.error('ImageAsCanvas.restoreState failed:', err);
            this.detach();
        });
        this.readyPromise = restorePromise;
        void restorePromise.finally(() => {
            if (this.readyPromise === restorePromise) this.readyPromise = null;
        });
    }

    /** Promise that resolves once any parser-started image load has completed. */
    whenReady(): Promise<void> {
        return this.readyPromise ?? Promise.resolve();
    }

    /** Flag that a parsed file referenced a background image whose bytes must
     *  be re-attached by the UI from local storage. */
    markPendingRestore(): void {
        this.pendingRestore = true;
    }

    /** Consume the pending-restore flag, returning whether one was set. */
    takePendingRestore(): boolean {
        const pending = this.pendingRestore;
        this.pendingRestore = false;
        return pending;
    }

    // ── Rendering ──────────────────────────────────────────────────────

    /**
     * Render the attached image onto a GraphicsInterface.
     * Called before drawing primitives so the image appears behind everything.
     */
    draw(gi: GraphicsInterface, cs: MapCoordinates): void {
        if (!this.hasImage || !this.imageElement) return;

        const ctx = (gi as any).getCtx?.();
        if (!ctx) return;

        const mag = cs.getXMagnitude();
        const sx = (this.x + cs.getXCenter()) * mag;
        const sy = (this.y + cs.getYCenter()) * mag;
        const sw = this.naturalWidth * this.scale * mag;
        const sh = this.naturalHeight * this.scale * mag;

        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.drawImage(this.imageElement, sx, sy, sw, sh);
        ctx.restore();
    }

    /**
     * Track the image bounds for bounding-box calculations.
     * Called during getImageSize so the image contributes to the model extent.
     */
    trackExtremePoints(cs: MapCoordinates): void {
        if (!this.hasImage) return;
        cs.trackPoint(this.x, this.y);
        cs.trackPoint(
            this.x + this.naturalWidth * this.scale,
            this.y + this.naturalHeight * this.scale,
        );
    }
}
