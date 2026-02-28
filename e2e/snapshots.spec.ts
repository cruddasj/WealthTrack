import { test, expect } from '@playwright/test';

test.describe('Snapshots', () => {
  test.beforeEach(async ({ page }) => {
    // Disable onboarding and welcome via localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem('wealthtrack:welcomeSeen', '1');
      window.localStorage.setItem('wealthtrack:onboardDataSeen', '1');
      window.localStorage.setItem('wealthtrack:forecastTipSeen', '1');
      window.localStorage.setItem('wealthtrack:welcomeDisabled', '1');
    });

    await page.goto('/');

    // Add some data to unlock Snapshots
    await page.locator('nav').locator('button', { hasText: 'Financial Inputs' }).click();

    // Add Asset
    const assetCard = page.locator('#data-entry .card', { has: page.locator('h3', { hasText: /^Assets$/ }) }).first();
    const isAssetCollapsed = await assetCard.evaluate(el => el.classList.contains('collapsed'));
    if (isAssetCollapsed) {
      await assetCard.locator('h3').click({ force: true });
    }
    await page.fill('#assetName', 'Savings');
    await page.fill('#assetValue', '10000');
    await page.click('button:has-text("Add Asset")');

    // Navigate to Snapshots
    await page.locator('nav').locator('button', { hasText: 'Snapshots' }).click();
    await expect(page.locator('#snapshots')).toHaveClass(/active/);
    await page.waitForTimeout(500);
  });

  async function expandCard(page, title) {
    const card = page.locator('.card').filter({ has: page.locator('h3, h4', { hasText: title }) }).first();
    const isCollapsed = await card.evaluate(el => el.classList.contains('collapsed'));
    if (isCollapsed) {
      await card.locator('h3, h4', { hasText: title }).first().click({ force: true });
      await expect(card).not.toHaveClass(/collapsed/);
      await page.waitForTimeout(500);
    }
    return card;
  }

  test('Take and manage snapshots', async ({ page }) => {
    await expandCard(page, 'Save Snapshot');

    // Take Snapshot
    await page.fill('#snapshotName', 'Initial Snapshot');
    await page.click('#snapshotBtn');
    await page.locator('button[data-ok]').click(); // Dismiss alert

    const snapshotList = page.locator('#snapshotUl');
    await expect(snapshotList).toContainText('Initial Snapshot');
    await page.waitForTimeout(500);

    // Rename Snapshot
    // Select based on desktop view buttons which are easier
    await page.click('[data-action="rename-snapshot"]', { force: true });
    await page.fill('input[data-input]', 'Renamed Snapshot');
    await page.locator('button[data-ok]').click();
    await expect(snapshotList).toContainText('Renamed Snapshot');

    // Delete Snapshot
    await page.click('[data-action="delete-snapshot"]', { force: true });
    await page.locator('button[data-confirm]').click();
    await expect(snapshotList).not.toContainText('Renamed Snapshot');
  });

  test('Snapshot Comparison', async ({ page }) => {
    // Take a snapshot
    await expandCard(page, 'Save Snapshot');
    await page.fill('#snapshotName', 'Base Snapshot');
    await page.click('#snapshotBtn');
    await page.locator('button[data-ok]').click();

    await expandCard(page, 'Snapshot Comparison');
    await expect(page.locator('#snapshotComparisonControls')).toBeVisible();

    // Some snapshots might have dates in the label.
    await page.locator('#snapshotComparisonBase').selectOption({ index: 0 });
    await expect(page.locator('#snapshotComparisonResult')).toContainText('Change');
    await expect(page.locator('#snapshotComparisonResult')).toContainText('£0.00');

    // Change current assets to see comparison change
    await page.locator('nav').locator('button', { hasText: 'Financial Inputs' }).click();
    await page.click('[data-action="edit-asset"]');
    await page.fill('#editAssetValue', '15000');
    await page.click('button:has-text("Save Changes")');

    await page.locator('nav').locator('button', { hasText: 'Snapshots' }).click();
    await expandCard(page, 'Snapshot Comparison');
    await expect(page.locator('#snapshotComparisonResult')).toContainText('£5,000.00');
  });

  test('Forecast Progress Check', async ({ page }) => {
    // Take a snapshot
    await expandCard(page, 'Save Snapshot');
    await page.fill('#snapshotName', 'Check Snapshot');
    await page.click('#snapshotBtn');
    await page.locator('button[data-ok]').click();

    await expandCard(page, 'Forecast Progress Check');
    await expect(page.locator('#progressCheckControls')).toBeVisible();

    await page.locator('#progressCheckSelect').selectOption({ index: 0 });
    await expect(page.locator('#progressCheckResult')).toContainText('Current Net Worth');
    await expect(page.locator('#progressCheckResult')).toContainText('£10,000.00');
  });
});
