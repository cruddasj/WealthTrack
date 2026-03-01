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
    await page.locator('nav').locator('button', { hasText: 'Welcome' }).click();
    await expect(page.locator('#welcome')).toHaveClass(/active/);
    await dismissModals();

    // Wait for the animation to complete
    await page.waitForTimeout(1000);

    // Go to Data Entry (Financial Inputs)
    await page.locator('nav').locator('button', { hasText: 'Financial Inputs' }).click();
    await expect(page.locator('#data-entry')).toHaveClass(/active/);
    await dismissModals();

    // Wait for the animation to complete
    await page.waitForTimeout(1000);

    // Go to Calculators
    await page.locator('nav').locator('button', { hasText: 'Calculators' }).click();
    await expect(page.locator('#calculators')).toHaveClass(/active/);
    await dismissModals();

    // Go to Settings
    await page.locator('nav').locator('button', { hasText: 'Settings & Data' }).click();
    await expect(page.locator('#settings')).toHaveClass(/active/);
    await dismissModals();
  });

  test('Mobile menu overlay keeps content visible with blur', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const menuToggle = page.locator('#menu-toggle');
    await expect(menuToggle).toBeVisible();
    await menuToggle.click();

    const overlay = page.locator('#overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveClass(/backdrop-blur-sm/);

    const overlayStyles = await overlay.evaluate((element) => {
      const computed = window.getComputedStyle(element);
      return {
        backgroundColor: computed.backgroundColor,
        backdropFilter: computed.backdropFilter,
        webkitBackdropFilter: computed.webkitBackdropFilter
      };
    });

    expect(overlayStyles.backgroundColor).not.toBe('rgb(0, 0, 0)');
    expect(
      overlayStyles.backdropFilter.includes('blur(') ||
        overlayStyles.webkitBackdropFilter.includes('blur(')
    ).toBe(true);
  });

  test('Mobile menu navigation functionality', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const sidebar = page.locator('#sidebar');
    const menuToggle = page.locator('#menu-toggle');

    // Initially hidden (off-screen)
    await expect(sidebar).toHaveClass(/-translate-x-full/);

    // Open menu
    await menuToggle.click();
    await expect(sidebar).not.toHaveClass(/-translate-x-full/);

    // Navigate to Settings & Data
    await page.locator('nav').locator('button', { hasText: 'Settings & Data' }).click();
    await expect(page.locator('#settings')).toHaveClass(/active/);

    // Menu should close after navigation
    await expect(sidebar).toHaveClass(/-translate-x-full/);
  });
});
