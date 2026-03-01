import { test, expect } from '@playwright/test';
import { setupE2ETest, expandCard } from './test-helpers';

test.describe('Settings & Data', () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ETest(page);
    await page.goto('/');

    // Navigate to Settings
    await page.locator('nav').locator('button', { hasText: 'Settings & Data' }).click();
    await expect(page.locator('#settings')).toHaveClass(/active/);
    await page.waitForTimeout(500);
  });

  test('Profile Management', async ({ page }) => {
    await page.waitForTimeout(1000);
    await expandCard(page, 'Profiles');

    // Add Profile
    await page.click('#addProfileBtn', { force: true });
    await page.fill('input[data-input]', 'Secondary Profile');
    await page.click('button:has-text("OK")');
    await expect(page.locator('#profileSelect')).toContainText('Secondary Profile');

    // Rename Profile
    await page.click('#renameProfileBtn', { force: true });
    await page.fill('input[data-input]', 'Renamed Profile');
    await page.locator('button[data-ok]').click();
    await expect(page.locator('#profileSelect')).toContainText('Renamed Profile');

    // Switch Profile
    await page.locator('#profileSelect').selectOption({ label: 'Default' });
    await page.waitForTimeout(500);

    // Switch back to delete
    await page.locator('#profileSelect').selectOption({ label: 'Renamed Profile' });
    await page.waitForTimeout(500);

    // Delete Profile
    await page.click('#deleteProfileBtn', { force: true });
    await page.locator('button[data-confirm]').click();
    await expect(page.locator('#profileSelect')).not.toContainText('Renamed Profile');
  });

  test('UK Tax Settings', async ({ page }) => {
    await expandCard(page, 'UK Tax Settings');

    await page.selectOption('#taxBandSelect', 'higher');
    await page.fill('#taxIncomeAllowance', '500');
    await page.dispatchEvent('#taxIncomeAllowance', 'change'); // Trigger the 'change' event manually if needed

    await expect(page.locator('#taxBandSummary')).toContainText('Higher rate (40%)');
    await expect(page.locator('#taxAllowanceSummary')).toContainText('Savings: £500.00');

    // Verify it persists by reloading
    await page.reload();
    await page.locator('nav').locator('button', { hasText: 'Settings & Data' }).click();
    await page.waitForTimeout(500);
    await expandCard(page, 'UK Tax Settings');
    await expect(page.locator('#taxBandSelect')).toHaveValue('higher');
    await expect(page.locator('#taxIncomeAllowance')).toHaveValue('500');
  });

  test('Layout Settings', async ({ page }) => {
    await expandCard(page, 'Layout Settings');

    // Theme choice
    await page.selectOption('#themeSelect', 'inverted');
    await expect(page.locator('html')).toHaveClass(/theme-inverted/);

    // Sticky nav
    const stickyToggle = page.locator('label:has(#mobileNavStickyToggle) .toggle-track');
    await stickyToggle.click();
    await expect(page.locator('body')).toHaveClass(/mobile-header-static/);
    await stickyToggle.click();
    await expect(page.locator('body')).not.toHaveClass(/mobile-header-static/);

    // First-time guidance
    const guidanceToggle = page.locator('label:has(#welcomeToggle) .toggle-track');
    await guidanceToggle.click();
    await expect(page.locator('nav button[data-target="welcome"]')).not.toHaveClass(/hidden/);
    await guidanceToggle.click();
    await expect(page.locator('nav button[data-target="welcome"]')).toHaveClass(/hidden/);
  });

  test('App Reset', async ({ page }) => {
    await expandCard(page, 'Reset App');

    // Add some data first to see if it clears
    await page.locator('nav').locator('button', { hasText: 'Financial Inputs' }).click();
    await page.fill('#assetName', 'Temp Asset');
    await page.fill('#assetValue', '1000');
    await page.click('button:has-text("Add Asset")');

    await page.locator('nav').locator('button', { hasText: 'Settings & Data' }).click();
    await page.waitForTimeout(500);
    await expandCard(page, 'Reset App');

    await page.click('button:has-text("Clear Data")');
    await page.locator('button[data-confirm]').click();

    // App reloads. Check if data is gone.
    await expect(page.locator('#assetTableBody')).not.toContainText('Temp Asset');
  });
});
