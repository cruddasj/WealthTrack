import { test, expect } from '@playwright/test';

test.describe('Menu Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the starting URL
    await page.goto('/');
    // Check we loaded correctly
    await expect(page).toHaveTitle(/WealthTrack/);
  });

  test('Navigate through main menu sections', async ({ page }) => {
    async function dismissModals() {
      const closeModalBtn = page.locator('.modal-close');
      if (await closeModalBtn.isVisible()) {
        await closeModalBtn.click();
      }
    }

    // Wait for the modal if present and dismiss it if it blocks
    await dismissModals();

    // Close mobile menu if present and opened to avoid intercepting clicks
    const menuToggle = page.locator('#menu-toggle');
    if (await menuToggle.isVisible()) {
      await menuToggle.click({ force: true });
    }

    // Wait for any initial animations
    await page.waitForTimeout(1000);

    // Go to Welcome
    await page.locator('nav').locator('button', { hasText: 'Welcome' }).click({ force: true });
    await expect(page.locator('#welcome')).toHaveClass(/active/);
    await dismissModals();

    // Wait for the animation to complete
    await page.waitForTimeout(1000);

    // Go to Data Entry (Financial Inputs)
    await page.locator('nav').locator('button', { hasText: 'Financial Inputs' }).click({ force: true });
    await expect(page.locator('#data-entry')).toHaveClass(/active/);
    await dismissModals();

    // Wait for the animation to complete
    await page.waitForTimeout(1000);

    // Go to Calculators
    await page.locator('nav').locator('button', { hasText: 'Calculators' }).click({ force: true });
    await expect(page.locator('#calculators')).toHaveClass(/active/);
    await dismissModals();

    // Wait for the animation to complete
    await page.waitForTimeout(1000);

    // Go to Settings
    await page.locator('nav').locator('button', { hasText: 'Settings & Data' }).click({ force: true });
    await expect(page.locator('#settings')).toHaveClass(/active/);
    await dismissModals();
  });
});
