/**
 * @file ContextMenu.ts
 * @author Dante Loi
 * @date 2026-04-23
 * @brief Right-click context menu DOM component
 * @copyright Copyright (C) 2026 Dante Loi — GPL v3
 */

export interface ContextMenuItem {
    label?: string;
    enabled?: boolean;
    visible?: boolean;
    separator?: boolean;
    action?: () => void;
}

export class ContextMenu {
    private readonly el: HTMLDivElement;
    private dismissHandler: ((e: MouseEvent) => void) | null = null;
    private keyHandler: ((e: KeyboardEvent) => void) | null = null;

    constructor(container: HTMLElement = document.body) {
        this.el = document.createElement('div');
        this.el.style.cssText = [
            'position: fixed',
            'z-index: 9999',
            'background: #ffffff',
            'border: 1px solid #b0b0b0',
            'border-radius: 4px',
            'box-shadow: 2px 4px 12px rgba(0,0,0,0.18)',
            'padding: 4px 0',
            'min-width: 160px',
            'font: 13px/1.4 system-ui, sans-serif',
            'user-select: none',
            'display: none',
        ].join(';');
        container.appendChild(this.el);
    }

    show(cssX: number, cssY: number, items: ContextMenuItem[]): void {
        this.hide();

        this.el.innerHTML = '';
        for (const item of items) {
            if (item.separator) {
                const hr = document.createElement('hr');
                hr.style.cssText = 'margin: 4px 0; border: none; border-top: 1px solid #e0e0e0;';
                this.el.appendChild(hr);
                continue;
            }
            if (item.visible === false) continue;

            const btn = document.createElement('button');
            btn.textContent = item.label ?? '';
            btn.disabled = item.enabled === false;
            btn.style.cssText = [
                'display: block',
                'width: 100%',
                'padding: 5px 16px',
                'background: none',
                'border: none',
                'text-align: left',
                'cursor: pointer',
                'color: ' + (item.enabled === false ? '#a0a0a0' : '#1a1a1a'),
                'font: inherit',
            ].join(';');

            if (item.enabled !== false) {
                btn.addEventListener('mouseenter', () => {
                    btn.style.background = '#e8f0fe';
                });
                btn.addEventListener('mouseleave', () => {
                    btn.style.background = 'none';
                });
                btn.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    this.hide();
                    item.action?.();
                });
            }
            this.el.appendChild(btn);
        }

        this.el.style.display = 'block';
        this.el.style.left = cssX + 'px';
        this.el.style.top = cssY + 'px';

        // Clamp to viewport
        const rect = this.el.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this.el.style.left = Math.max(0, cssX - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            this.el.style.top = Math.max(0, cssY - rect.height) + 'px';
        }

        // Dismiss on outside click
        this.dismissHandler = (e: MouseEvent) => {
            if (!this.el.contains(e.target as Node)) {
                this.hide();
            }
        };
        this.keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') this.hide();
        };
        // Use capture so we get the event before anything else
        setTimeout(() => {
            document.addEventListener('mousedown', this.dismissHandler!, true);
            document.addEventListener('keydown', this.keyHandler!, true);
        }, 0);
    }

    hide(): void {
        this.el.style.display = 'none';
        if (this.dismissHandler) {
            document.removeEventListener('mousedown', this.dismissHandler, true);
            this.dismissHandler = null;
        }
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler, true);
            this.keyHandler = null;
        }
    }

    isVisible(): boolean {
        return this.el.style.display !== 'none';
    }
}
