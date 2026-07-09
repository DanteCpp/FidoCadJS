import { expect, test } from '@playwright/test';
import { gotoApp, loadCircuit, pressKey } from './utils';

test('font size controls width while width remains independently editable', async ({ page }) => {
    await gotoApp(page);
    await loadCircuit(page, '[FIDOCAD]\nTY 50 50 4 3 0 0 0 * $x$\n');
    await pressKey(page, 'a');
    await pressKey(page, 'Control+a');

    await page
        .getByTestId('editor-canvas')
        .click({ button: 'right', position: { x: 300, y: 300 } });
    await page
        .getByRole('menu', { name: 'Drawing actions' })
        .getByRole('menuitem', { name: 'Properties' })
        .click();

    const sidebar = page.getByTestId('properties-sidebar');
    await expect(sidebar).toBeVisible();
    const size = sidebar.getByText('Font size:', { exact: true }).locator('..').locator('input');
    const width = sidebar.getByText('Font width:', { exact: true }).locator('..').locator('input');

    await size.fill('20');
    await size.dispatchEvent('change');
    await expect(width).toHaveValue('14');

    await width.fill('9');
    await width.dispatchEvent('change');
    await expect(size).toHaveValue('20');
});
