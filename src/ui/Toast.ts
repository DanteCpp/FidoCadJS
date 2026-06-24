export class Toast {
    private static readonly DURATION_MS = 4000;

    /**
     * Show a temporary toast message at the bottom of the screen.
     * Multiple calls stack vertically.
     */
    static show(message: string, type: 'error' | 'info' = 'error'): void {
        const toast = document.createElement('div');
        const bgColor = type === 'error' ? '#d32f2f' : '#1976d2';
        toast.style.cssText =
            `position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); ` +
            `background: ${bgColor}; color: white; padding: 10px 24px; ` +
            `border-radius: 6px; font-family: sans-serif; font-size: 13px; ` +
            `z-index: 100001; box-shadow: 0 4px 12px rgba(0,0,0,0.3); ` +
            `max-width: 80vw; transition: opacity 0.3s;`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Stack above any existing toasts
        const existing = document.querySelectorAll('[data-toast]');
        toast.style.bottom = `${20 + existing.length * 50}px`;
        toast.setAttribute('data-toast', '');

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentElement) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, Toast.DURATION_MS);
    }
}
