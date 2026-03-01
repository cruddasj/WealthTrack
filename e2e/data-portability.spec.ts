import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Data portability', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('wealthtrack:welcomeSeen', '1');
      window.localStorage.setItem('wealthtrack:onboardDataSeen', '1');
      window.localStorage.setItem('wealthtrack:forecastTipSeen', '1');
      window.localStorage.setItem('wealthtrack:welcomeDisabled', '1');
    });

    await page.goto('/');
    await expect(page).toHaveTitle(/WealthTrack/);
  });

  async function navigateTo(page, section: string, sectionId: string) {
    await page.locator('nav').locator('button', { hasText: section }).click();
    await expect(page.locator(sectionId)).toHaveClass(/active/);
  }

  async function expandCard(page, title: string) {
    const card = page
      .locator('.card')
      .filter({ has: page.locator('h3, h4', { hasText: title }) })
      .first();

    const isCollapsed = await card.evaluate((el) => el.classList.contains('collapsed'));
    if (isCollapsed) {
      await card.locator('h3, h4', { hasText: title }).first().click({ force: true });
      await expect(card).not.toHaveClass(/collapsed/);
    }
    return card;
  }

  async function addAsset(page, name: string, value: string) {
    await navigateTo(page, 'Financial Inputs', '#data-entry');
    await expandCard(page, 'Assets');
    await page.fill('#assetName', name);
    await page.fill('#assetValue', value);
    await page.click('button:has-text("Add Asset")');
    await expect(page.locator('#assetTableBody')).toContainText(name);
  }

  test('exports selected profiles and re-imports them', async ({ page }, testInfo) => {
    await addAsset(page, 'Default Export Asset', '1200');

    await navigateTo(page, 'Settings & Data', '#settings');
    await expandCard(page, 'Profiles');
    await page.click('#addProfileBtn', { force: true });
    await page.fill('input[data-input]', 'Travel Fund');
    await page.click('button[data-ok]');
    await page.selectOption('#profileSelect', { label: 'Travel Fund' });

    await addAsset(page, 'Travel Export Asset', '2400');

    await navigateTo(page, 'Settings & Data', '#settings');
    await expandCard(page, 'Export Data');

    await page.click('#exportProfileToggle');
    const travelFundOption = page
      .locator('#exportProfileOptions label')
      .filter({ hasText: 'Travel Fund' })
      .first();
    await travelFundOption.locator('input[type="checkbox"]').uncheck();
    await expect(page.locator('#exportProfileSummary')).toContainText('Default');

    const downloadPromise = page.waitForEvent('download');
    await page.click('#exportBtn');
    const download = await downloadPromise;

    const exportPath = path.join(testInfo.outputDir, download.suggestedFilename());
    await download.saveAs(exportPath);
    expect(fs.existsSync(exportPath)).toBeTruthy();

    await expandCard(page, 'Reset App');
    await page.click('button[data-action="clear-data"]');
    await page.click('button[data-confirm]');

    await expect(page.locator('#assetTableBody')).not.toContainText('Default Export Asset');

    await navigateTo(page, 'Settings & Data', '#settings');
    await expandCard(page, 'Import Data');
    await page.setInputFiles('#importFile', exportPath);

    await expect(page.locator('#importProfileSummary')).toContainText('Default');
    await expect(page.locator('#importProfileOptions')).toContainText('Default');
    await expect(page.locator('#importProfileOptions')).not.toContainText('Travel Fund');

    await page.click('button[data-action="import-data"]');
    await page.click('button[data-ok]');

    await expect(page.locator('#data-entry')).toHaveClass(/active/);
    await expect(page.locator('#assetTableBody')).toContainText('Default Export Asset');
    await expect(page.locator('#assetTableBody')).not.toContainText('Travel Export Asset');

    await navigateTo(page, 'Settings & Data', '#settings');
    await expandCard(page, 'Profiles');
    await expect(page.locator('#profileSelect')).toContainText('Default');
    await expect(page.locator('#profileSelect')).not.toContainText('Travel Fund');
  });
});
