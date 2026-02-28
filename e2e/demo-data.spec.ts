import { test, expect } from '@playwright/test';

test.describe('Demo Data and Application Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the starting URL
    await page.goto('/');
    // Check we loaded correctly
    await expect(page).toHaveTitle(/WealthTrack/);
  });

  test('Load demo data and access all pages', async ({ page }) => {
    const closeModal = async () => {
      const btn = page.locator('button[data-action="close-modal"]').filter({ visible: true }).first();
      try {
        await btn.waitFor({ state: 'visible', timeout: 1000 });
        await btn.click();
      } catch (e) {
        // Modal not present or already closing
      }
    };

    // Close initial modal if present
    await closeModal();

    // 1. Load Demo Data
    const loadDemoBtn = page.locator('button[data-action="load-demo"]');
    await expect(loadDemoBtn).toBeVisible();
    await loadDemoBtn.click();

    // 2. Handle potential confirmation modal (if Demo profile already exists)
    const confirmBtn = page.locator('button[data-confirm]');
    try {
      await confirmBtn.waitFor({ state: 'visible', timeout: 1000 });
      await confirmBtn.click();
    } catch (e) {
      // Confirmation not required
    }

    // 3. Handle success alert modal
    const okBtn = page.locator('button[data-ok]');
    await expect(okBtn).toBeVisible();
    await okBtn.click();

    // 4. Handle potential onboarding modal after navigation to forecasts
    await closeModal();

    // 5. Verify restricted navigation buttons are now visible
    const forecastsBtn = page.locator('nav button[data-target="forecasts"]');
    const portfolioBtn = page.locator('nav button[data-target="portfolio-analysis"]');
    const snapshotsBtn = page.locator('nav button[data-target="snapshots"]');

    await expect(forecastsBtn).not.toHaveClass(/hidden/);
    await expect(portfolioBtn).not.toHaveClass(/hidden/);
    await expect(snapshotsBtn).not.toHaveClass(/hidden/);

    // 6. Navigate through all sections and verify they become active
    const sections = [
      { btn: 'welcome', id: '#welcome' },
      { btn: 'data-entry', id: '#data-entry' },
      { btn: 'forecasts', id: '#forecasts' },
      { btn: 'portfolio-analysis', id: '#portfolio-analysis' },
      { btn: 'snapshots', id: '#snapshots' },
      { btn: 'calculators', id: '#calculators' },
      { btn: 'settings', id: '#settings' },
    ];

    for (const section of sections) {
      const navBtn = page.locator(`nav button[data-target="${section.btn}"]`);

      // Close mobile menu if it's open (overlay visible) to avoid it blocking clicks
      const overlay = page.locator('#overlay');
      if (await overlay.isVisible()) {
          await overlay.click();
      }

      // Use force: true because sometimes animations or overlays might interfere
      await navBtn.click({ force: true });
      await expect(page.locator(section.id)).toHaveClass(/active/);

      // If navigating to a section triggers another onboarding modal, close it
      await closeModal();
    }
  });
});
