import { test, expect } from '@playwright/test';

test.describe('Menu Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Disable onboarding and welcome via localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem('wealthtrack:welcomeSeen', '1');
      window.localStorage.setItem('wealthtrack:onboardDataSeen', '1');
      window.localStorage.setItem('wealthtrack:forecastTipSeen', '1');
      window.localStorage.setItem('wealthtrack:welcomeDisabled', '0'); // KEEP IT ENABLED
    });

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

    // Go to Welcome
    await page.locator('nav').locator('button', { hasText: 'Welcome' }).click();
    await expect(page.locator('#welcome')).toHaveClass(/active/);
    await dismissModals();

    // Go to Data Entry (Financial Inputs)
    await page.locator('nav').locator('button', { hasText: 'Financial Inputs' }).click();
    await expect(page.locator('#data-entry')).toHaveClass(/active/);
    await dismissModals();

    // Go to Calculators
    await page.locator('nav').locator('button', { hasText: 'Calculators' }).click();
    await expect(page.locator('#calculators')).toHaveClass(/active/);
    await dismissModals();

    // Go to Settings
    await page.locator('nav').locator('button', { hasText: 'Settings & Data' }).click();
    await expect(page.locator('#settings')).toHaveClass(/active/);
    await dismissModals();
  });
});
