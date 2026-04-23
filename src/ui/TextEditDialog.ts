/**
 * TextEditDialog: overlay input for editing text primitives inline.
 */
export class TextEditDialog {
    private input: HTMLInputElement;
    private container: HTMLElement;

    constructor() {
        this.container = document.createElement('div');
        this.container.style.cssText =
            'position: absolute; z-index: 1000;';

        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.style.cssText =
            'position: absolute; z-index: 1001; border: 2px solid #0066cc; ' +
            'padding: 4px 8px; font-size: 14px; font-family: monospace; ' +
            'background: white; border-radius: 3px;';
        this.container.appendChild(this.input);
    }

    show(
        screenX: number,
        screenY: number,
        initialValue: string,
        onCommit: (value: string) => void,
        onCancel: () => void
    ): void {
        this.input.value = initialValue;
        this.input.style.left = screenX + 'px';
        this.input.style.top = screenY + 'px';

        document.body.appendChild(this.container);
        this.input.focus();
        this.input.select();

        const handleCommit = () => {
            this.hide();
            onCommit(this.input.value);
        };

        const handleCancel = () => {
            this.hide();
            onCancel();
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleCommit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
        };

        const handleBlur = () => {
            handleCancel();
        };

        this.input.addEventListener('keydown', handleKeyDown);
        this.input.addEventListener('blur', handleBlur);
    }

    private hide(): void {
        if (this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
    }
}
