import { expect, test } from '@playwright/test';
import { gotoApp, loadCircuit, pressKey } from './utils';

const SIMPLE_FCD = '[FIDOCAD]\nLI 10 10 90 10 0\n';
const POLYGON_FCD = '[FIDOCAD]\nPP 10 10 60 10 60 60 10 60 0\n';

test.describe('Drawing context menu', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
        await pressKey(page, 'a');
    });

    test('uses menu icons and conditionally separates conversion actions', async ({ page }) => {
        const canvas = page.getByTestId('editor-canvas');
        const menu = page.getByRole('menu', { name: 'Drawing actions' });

        await canvas.click({ button: 'right', position: { x: 300, y: 300 } });
        await expect(menu).toBeVisible();
        await expect(menu.getByRole('menuitem')).toHaveCount(9);
        await expect(menu.locator('button img')).toHaveCount(9);
        await expect(menu.getByRole('separator')).toHaveCount(3);
        await expect(menu.getByRole('menuitem', { name: 'Symbol-o-matic' })).toHaveCount(0);
        await expect(menu.getByRole('menuitem', { name: 'Vectorize' })).toHaveCount(0);

        await page.keyboard.press('Escape');
        await loadCircuit(page, SIMPLE_FCD);
        await pressKey(page, 'Control+a');
        await canvas.click({ button: 'right', position: { x: 300, y: 300 } });

        const symbolize = menu.getByRole('menuitem', { name: 'Symbol-o-matic' });
        await expect(symbolize).toBeVisible();
        await expect(symbolize.locator('xpath=preceding-sibling::*[1]')).toHaveAttribute(
            'role',
            'separator',
        );
        await expect(menu.locator(':scope > :last-child')).toHaveText('Symbol-o-matic');

        await page.keyboard.press('Escape');
        await loadCircuit(page, POLYGON_FCD);
        await pressKey(page, 'Control+a');
        await canvas.click({ button: 'right', position: { x: 300, y: 300 } });

        const addNode = menu.getByRole('menuitem', { name: 'Add a node' });
        const removeNode = menu.getByRole('menuitem', { name: 'Remove a node' });
        await expect(addNode.locator('xpath=preceding-sibling::*[1]')).toHaveAttribute(
            'role',
            'separator',
        );
        await expect(removeNode.locator('xpath=following-sibling::*[1]')).toHaveAttribute(
            'role',
            'separator',
        );
        await expect(menu.locator(':scope > :last-child')).toHaveText('Symbol-o-matic');
    });
});
