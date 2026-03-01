import { test, expect } from '@playwright/test';
import { setupE2ETest, expandCard } from './test-helpers';

test.describe('Forecasts', () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ETest(page);
    await page.goto('/');

    // Add an asset to unlock Forecasts
    await page.locator('nav').locator('button', { hasText: 'Financial Inputs' }).click();
    await expandCard(page, /^Assets$/);
    await page.fill('#assetName', 'Test Asset');
    await page.fill('#assetValue', '10000');
    await page.fill('#assetReturn', '5');
    await page.click('button:has-text("Add Asset")');

    // Navigate to Forecasts
    await page.locator('nav').locator('button', { hasText: 'Forecasts' }).click();
    await expect(page.locator('#forecasts')).toHaveClass(/active/);
    await page.waitForTimeout(500);
  });

  test('Scenario Modelling: Add, Edit, and Delete event', async ({ page }) => {
    await expandCard(page, 'Scenario Modelling');

    // Add Event
    await page.fill('#eventName', 'Bonus');
    await page.fill('#eventAmount', '5000');
    await page.selectOption('#eventDirection', 'gain');
    await page.selectOption('#eventType', 'absolute');

    // Set date to next year
    const nextYear = new Date().getFullYear() + 1;
    await page.fill('#eventDate', `${nextYear}-01-01`);

    await page.click('#eventForm button[type="submit"]');

    const tableBody = page.locator('#eventTableBody');
    await expect(tableBody).toContainText('Bonus');
    await expect(tableBody).toContainText('£5,000.00');

    // Edit Event
    await page.click('[data-action="edit-event"]');
    await page.fill('#editEventName', 'Big Bonus');
    await page.fill('#editEventAmount', '10000');
    await page.click('button:has-text("Save Changes")');

    await expect(tableBody).toContainText('Big Bonus');
    await expect(tableBody).toContainText('£10,000.00');

    // Toggle Scenario Modelling status
    const toggle = page.locator('label:has(#scenarioEventsToggle) .toggle-track');
    await toggle.click();
    await expect(page.locator('#scenarioEventsStatus')).toContainText('are paused');
    await toggle.click();
    await expect(page.locator('#scenarioEventsStatus')).toContainText('are enabled');

    // Delete Event
    await page.click('[data-action="delete-event"]');
    await page.locator('button[data-confirm]').click();
    await expect(tableBody).not.toContainText('Big Bonus');
  });

  test('Future Portfolio projection', async ({ page }) => {
    await expandCard(page, 'Future Portfolio');

    await page.selectOption('#futurePortfolioScenario', 'base');
    const nextYear = new Date().getFullYear() + 1;
    await page.fill('#futurePortfolioDate', `${nextYear}-01-01`);

    const result = page.locator('#futurePortfolioResult');
    await expect(result).toBeVisible();
    await expect(page.locator('#futurePortfolioTotal')).not.toHaveText('£0');
    await expect(page.locator('#futurePortfolioChart')).toBeVisible();
    await expect(page.locator('#futurePortfolioTableContainer')).toBeVisible();
  });

  test('Stress Testing (Monte Carlo)', async ({ page }) => {
    await expandCard(page, 'Stress Testing (Monte Carlo Simulations)');

    // Set goal to enable stress test if required by logic
    await page.locator('nav').locator('button', { hasText: 'Financial Inputs' }).click();
    // Manual expand because it's on a different page
    const goalCard = page.locator('#data-entry .card', { has: page.locator('h3', { hasText: /^Goal$/ }) }).first();
    const isGoalCollapsed = await goalCard.evaluate(el => el.classList.contains('collapsed'));
    if (isGoalCollapsed) {
       await goalCard.locator('h3').click({ force: true });
    }
    await page.fill('#goalValue', '20000');
    await page.fill('#goalYear', (new Date().getFullYear() + 10).toString());
    await page.click('#goalBtn');
    await page.locator('button[data-ok]').click(); // Dismiss goal alert

    await page.locator('nav').locator('button', { hasText: 'Forecasts' }).click();
    await expandCard(page, 'Stress Testing (Monte Carlo Simulations)');

    await page.fill('#stressRuns', '10');
    await page.click('button:has-text("Run Stress Test")');

    const result = page.locator('#stressTestResult');
    await expect(result).toContainText('simulations reached the goal');
    await expect(page.locator('#stressEventsCard')).toBeVisible();
  });

  test('FIRE Readiness projection', async ({ page }) => {
    await expandCard(page, 'FIRE Readiness');

    await page.fill('#fireForecastLivingCosts', '30000');
    await page.selectOption('#fireForecastFrequency', 'annual');
    await page.fill('#fireForecastInflation', '2.5');
    await page.click('button:has-text("Update FIRE Forecast")');

    const summary = page.locator('#fireForecastSummary');
    await expect(summary).not.toBeEmpty();
    const results = page.locator('#fireForecastResults');
    await expect(results).toBeVisible();
  });
});
