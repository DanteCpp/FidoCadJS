import { PrimitiveAdvText } from '../primitives/PrimitiveAdvText.js';
import { MapCoordinates } from '../geom/MapCoordinates.js';
import { LayerDesc } from '../layers/LayerDesc.js';
import { ColorCanvas } from '../graphic/canvas/ColorCanvas.js';

export class InPlaceTextEditor {
    private textarea: HTMLTextAreaElement;
    private container: HTMLDivElement;
    private badge: HTMLDivElement | null = null;
    private isEditing: boolean = false;
    private originalValue: string = '';
    private currentPrim: PrimitiveAdvText | null = null;
    private commitHandler: ((value: string) => void) | null = null;
    private cancelHandler: (() => void) | null = null;
    private liveUpdateHandler: (() => void) | null = null;
    private closed: boolean = false;

    private currentKeyDown: ((e: KeyboardEvent) => void) | null = null;
    private currentInput: (() => void) | null = null;
    private currentBlur: (() => void) | null = null;

    constructor() {
        this.container = document.createElement('div');
        this.container.style.cssText = 'position: absolute; z-index: 1000;';

        this.textarea = document.createElement('textarea');
        this.textarea.style.cssText =
            'position: absolute; z-index: 1001; border: 2px solid #0066cc; ' +
            'padding: 2px 4px; background: rgba(255,255,255,0.9); border-radius: 2px; ' +
            'resize: none; overflow: hidden; outline: none;';

        this.container.appendChild(this.textarea);
    }

    show(
        prim: PrimitiveAdvText,
        canvas: HTMLCanvasElement,
        coordSys: MapCoordinates,
        layers: LayerDesc[],
        onCommit: (value: string) => void,
        onCancel: () => void,
        onLiveUpdate: () => void
    ): void {
        // If already editing, commit the current edit first
        if (this.isEditing) {
            this.commit();
        }

        this.removeHandlers();
        this.removeBadge();

        this.currentPrim = prim;
        this.originalValue = prim.getString();
        this.commitHandler = onCommit;
        this.cancelHandler = onCancel;
        this.liveUpdateHandler = onLiveUpdate;
        this.closed = false;
        this.isEditing = true;

        const dpr = window.devicePixelRatio || 1;

        // Compute screen position of text anchor
        const lx = prim.virtualPoint[0]!.x;
        const ly = prim.virtualPoint[0]!.y;
        const devX = coordSys.mapX(lx, ly);
        const devY = coordSys.mapY(lx, ly);

        // Convert device pixels to CSS pixels relative to the canvas container
        const cssX = devX / dpr;
        const cssY = devY / dpr;

        // Compute font CSS
        const yMag = coordSys.getYMagnitude();
        const canvasFontSize = prim.getFontWidth() * 12 * yMag / 7 + 0.5;
        const cssFontSize = canvasFontSize / dpr;
        const isBold = prim.isBold();
        const isItalic = prim.isItalic();
        // Use defaultTextFont as fallback if fontName is not accessible
        const fontName = (prim as any).fontName || 'Courier New';

        const fontStyle = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}`;
        this.textarea.style.font = `${fontStyle}${cssFontSize}px ${fontName}`;

        // Get layer color
        const layerIdx = prim.getLayer();
        let textColor = '#000000';
        if (layerIdx >= 0 && layerIdx < layers.length) {
            const color = layers[layerIdx].getColor();
            if (color) {
                textColor = (color as ColorCanvas).toCSSColor();
            }
        }
        this.textarea.style.color = textColor;

        // Measure text width using the canvas context
        const ctx = canvas.getContext('2d');
        let textWidth = 100;
        if (ctx) {
            ctx.font = `${fontStyle}${canvasFontSize}px ${fontName}`;
            const lines = this.originalValue.split('\n');
            let maxW = 0;
            for (const line of lines) {
                const w = ctx.measureText(line || ' ').width / dpr;
                if (w > maxW) maxW = w;
            }
            textWidth = maxW;
        }

        // Position and size the textarea
        const padX = 8;
        const padY = 4;
        const lineHeight = cssFontSize * 1.2;
        const lineCount = this.originalValue.split('\n').length;
        const minW = 80;
        const minH = lineHeight + padY * 2;

        this.textarea.style.left = cssX + 'px';
        this.textarea.style.top = cssY + 'px';
        this.textarea.style.width = Math.max(textWidth + padX * 2, minW) + 'px';
        this.textarea.style.height = Math.max(lineCount * lineHeight + padY * 2, minH) + 'px';
        this.textarea.style.minWidth = minW + 'px';
        this.textarea.style.minHeight = minH + 'px';

        // Handle rotated text: show badge
        const orientation = prim.getOrientation();
        const isMirrored = prim.isMirrored() !== 0;
        if (orientation !== 0 || isMirrored) {
            this.badge = document.createElement('div');
            const parts: string[] = [];
            if (orientation !== 0) parts.push(`${orientation}deg`);
            if (isMirrored) parts.push('Mirrored');
            this.badge.textContent = parts.join(', ');
            this.badge.style.cssText =
                'position: absolute; z-index: 1002; font-size: 10px; ' +
                'color: #666; background: rgba(255,255,255,0.85); ' +
                'padding: 1px 4px; border-radius: 2px; pointer-events: none; ' +
                'white-space: nowrap;';
            this.badge.style.left = cssX + 'px';
            this.badge.style.top = (cssY - 14) + 'px';
            this.container.appendChild(this.badge);
        }

        this.textarea.value = this.originalValue;

        // Wire event handlers
        const self = this;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                self.close(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                self.close(false);
            }
        };

        const handleInput = () => {
            if (self.currentPrim && !self.closed) {
                self.currentPrim.setString(self.textarea.value);
                self.currentPrim.setChanged(true);
                self.liveUpdateHandler?.();
            }
        };

        const handleBlur = () => {
            if (!self.closed) {
                self.close(true);
            }
        };

        this.currentKeyDown = handleKeyDown;
        this.currentInput = handleInput;
        this.currentBlur = handleBlur;

        this.textarea.addEventListener('keydown', handleKeyDown);
        this.textarea.addEventListener('input', handleInput);
        this.textarea.addEventListener('blur', handleBlur);

        // Append to the canvas's parent container (must have position: relative)
        const parent = canvas.parentElement;
        if (parent) {
            if (!parent.style.position || parent.style.position === 'static') {
                parent.style.position = 'relative';
            }
            parent.appendChild(this.container);
        }

        this.textarea.focus();
        this.textarea.select();
    }

    private close(commit: boolean): void {
        if (this.closed) return;
        this.closed = true;
        this.isEditing = false;

        this.removeHandlers();

        // Capture value and handlers before hide() nulls them
        const value = this.textarea.value;
        const onCommit = this.commitHandler;
        const onCancel = this.cancelHandler;

        // Remove editor from DOM before running callbacks to prevent
        // blur or reflow-triggered events during callback execution
        this.hide();

        if (commit) {
            onCommit?.(value);
        } else {
            onCancel?.();
        }
    }

    commit(): void {
        this.close(true);
    }

    cancel(): void {
        this.close(false);
    }

    isActive(): boolean {
        return this.isEditing;
    }

    private hide(): void {
        this.removeBadge();
        this.resetStyles();
        if (this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
        this.currentPrim = null;
        this.commitHandler = null;
        this.cancelHandler = null;
        this.liveUpdateHandler = null;
    }

    private resetStyles(): void {
        this.textarea.style.left = '';
        this.textarea.style.top = '';
        this.textarea.style.width = '';
        this.textarea.style.height = '';
        this.textarea.style.minWidth = '';
        this.textarea.style.minHeight = '';
        this.textarea.style.font = '';
        this.textarea.style.color = '';
    }

    private removeHandlers(): void {
        if (this.currentKeyDown) {
            this.textarea.removeEventListener('keydown', this.currentKeyDown);
            this.currentKeyDown = null;
        }
        if (this.currentInput) {
            this.textarea.removeEventListener('input', this.currentInput);
            this.currentInput = null;
        }
        if (this.currentBlur) {
            this.textarea.removeEventListener('blur', this.currentBlur);
            this.currentBlur = null;
        }
    }

    private removeBadge(): void {
        if (this.badge && this.badge.parentElement) {
            this.badge.parentElement.removeChild(this.badge);
        }
        this.badge = null;
    }
}