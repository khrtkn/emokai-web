import { test, expect } from '@playwright/test';

// 1x1 PNG
const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

test.describe('Happy Path A–G', () => {
  test('English flow from Terms to AR session + Gallery', async ({ page }) => {
    // Step 0: Terms acceptance
    await page.goto('/en/start');
    await page.getByRole('button', { name: 'Accept and continue' }).click();
    await expect(page).toHaveURL(/\/en\/stage$/);

    // Step A: Stage description moderation and upload
    await page.getByPlaceholder('e.g. Rooftop garden at dusk with neon city lights in the distance.').fill('Rooftop garden at dusk with neon lights');
    await page.getByRole('button', { name: 'Moderate description' }).click();

    // Upload image to hidden input
    const fileInput = page.locator('input[type="file"][accept^="image/"]');
    await expect(fileInput).toBeAttached();
    await fileInput.setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from(PNG_1x1, 'base64') });

    // Wait for options to render and select first option
    const option = page.locator('button:has-text("Select this option")').first();
    await option.click();
    // Proceed to character step
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(/\/en\/character$/);

    // Step B: Generate character options, select, and start background jobs
    await page.getByPlaceholder('e.g. A stargazing traveler with translucent wings.').fill('A brave traveler with translucent wings');
    await page.getByRole('button', { name: 'Generate character options' }).click();

    // Select first character option
    const charOption = page.locator('button:has-text("Select this character")').first();
    await charOption.click();
    // Start 3D & story generation
    await page.getByRole('button', { name: 'Start 3D & story generation' }).click();

    // Wait for Next to enable (jobs complete)
    const nextBtn = page.getByRole('button', { name: 'Next' });
    await expect(nextBtn).toBeEnabled({ timeout: 15000 });
    await nextBtn.click();
    await expect(page).toHaveURL(/\/en\/result$/);

    // Step D: Result screens – iterate steps and save/share
    // Story step: Next to composite
    await page.getByRole('button', { name: 'Next' }).click();
    // Composite step: Next to AR
    await page.getByRole('button', { name: 'Next' }).click();
    // Save + Share
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();
    await page.getByRole('button', { name: 'Share' }).click();
    await expect(page.getByRole('heading', { name: 'Share' })).toBeVisible();
    // Close share sheet overlay before proceeding
    await page.getByRole('button', { name: 'Close' }).click();

    // Proceed to AR Launcher
    await page.getByRole('button', { name: 'Proceed to AR' }).click();
    await expect(page).toHaveURL(/\/en\/ar$/);

    // Step E: Fallback viewer launch (no AR support by default)
    await page.getByRole('button', { name: 'Open 3D viewer' }).click();
    await expect(page).toHaveURL(/\/en\/ar\/session\?mode=fallback$/);
    await page.waitForLoadState('load');

    // Step F/G: Visit Gallery and ensure item present
    await page.goto('/en/gallery');
    await expect(page.getByText('Gallery')).toBeVisible();
  });
});
