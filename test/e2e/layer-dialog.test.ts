import { test, expect } from '@playwright/test';
import { gotoApp, loadCircuit, getCircuitText } from './utils';

const TWO_LINES = `[FIDOCAD]
LI 20 10 45 35 0
LI 45 35 60 15 0
`;

async function openLayerDialog(page: import('@playwright/test').Page) {
    await page.locator('button', { hasText: 'View' }).hover();
    await page.getByText('Layer options', { exact: true }).click();
    await expect(page.locator('[data-testid="layer-dialog"]')).toBeVisible();
}

test.describe('Layer dialog — header serialization', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
    });

    test('changing one layer writes only that layer to the header', async ({ page }) => {
        await loadCircuit(page, TWO_LINES);
        await openLayerDialog(page);

        // Change only layer 5's alpha — the slider is a 0–1, 3-decimal float.
        await page.locator('[data-testid="layer-alpha-5"]').evaluate((el) => {
            (el as HTMLInputElement).value = '0.25';
            el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.locator('[data-testid="layer-dialog-ok"]').click();
        await expect(page.locator('[data-testid="layer-dialog"]')).toBeHidden();

        const fjcL = (await getCircuitText(page)).split('\n').filter((l) => l.startsWith('FJC L '));
        expect(fjcL).toHaveLength(1);
        // Layer 5, alpha written as a short 3-decimal float (no /255 conversion).
        expect(fjcL[0]).toMatch(/^FJC L 5 \d+ 0\.25$/);
    });

    test('confirming with no changes writes no layer lines', async ({ page }) => {
        await loadCircuit(page, TWO_LINES);
        await openLayerDialog(page);
        await page.locator('[data-testid="layer-dialog-ok"]').click();
        await expect(page.locator('[data-testid="layer-dialog"]')).toBeHidden();

        expect(await getCircuitText(page)).not.toContain('FJC L ');
    });
});
