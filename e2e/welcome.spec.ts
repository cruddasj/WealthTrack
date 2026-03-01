import { test, expect } from '@playwright/test';

test.describe('Welcome and first-time guidance', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto('/');
  });

  test('shows welcome guidance for first-time users and supports navigation from brand home', async ({
    page
  }) => {
    await expect(page.locator('#welcome')).toHaveClass(/active/);
    await expect(page.locator('#welcome h2')).toContainText('Welcome to WealthTrack');
    await expect(page.locator('#welcome .guidance-card')).toHaveCount(4);

    await page.locator('nav button[data-target="data-entry"]').click();
    await expect(page.locator('#data-entry')).toHaveClass(/active/);

    const modal = page.locator('#modal');
    if (await modal.isVisible()) {
        await page.locator('button[data-action="close-modal"]').click({ force: true }).catch(() => {});
    }

    // Brand home might be in mobile menu
    const isMobile = await page.evaluate(() => window.innerWidth < 768);
    if (isMobile) {
      await page.locator('#menu-toggle').click();
      await page.waitForTimeout(500); // Wait for menu
    }
    // Safari sometimes reports elements as outside viewport when they are conditionally visible
    await page.locator('#brandHome').dispatchEvent('click');
    await expect(page.locator('#data-entry')).toHaveClass(/active/);

    const welcomeSeen = await page.evaluate(() =>
      window.localStorage.getItem('wealthtrack:welcomeSeen')
    );
    expect(welcomeSeen).toBe('1');
  });

  test('hides and restores first-time content from layout settings', async ({ page }) => {
    await page.locator('nav button[data-target="settings"]').click();
    await expect(page.locator('#settings')).toHaveClass(/active/);

    const layoutCard = page
      .locator('.card')
      .filter({ has: page.locator('h3, h4', { hasText: 'Layout Settings' }) })
      .first();
    if (await layoutCard.evaluate((el) => el.classList.contains('collapsed'))) {
      await layoutCard.locator('h3, h4', { hasText: 'Layout Settings' }).first().click({ force: true });
    }

    const guidanceToggle = page.locator('label:has(#welcomeToggle) .toggle-track');
    await guidanceToggle.click();
    await expect(page.locator('nav button[data-target="welcome"]')).toHaveClass(/hidden/);

    await guidanceToggle.click();
    await expect(page.locator('nav button[data-target="welcome"]')).not.toHaveClass(/hidden/);
  });
});
