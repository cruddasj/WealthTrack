import { test, expect } from '@playwright/test';

test.describe('Calculators', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Dismiss welcome modal if it appears
    const closeModalBtn = page.locator('.modal-close');
    if (await closeModalBtn.isVisible()) {
      await closeModalBtn.click();
    }
    // Navigate to Calculators section
    await page.locator('nav').locator('button', { hasText: 'Calculators' }).click({ force: true });
    await expect(page.locator('#calculators')).toHaveClass(/active/);
  });

  async function expandCard(page, title) {
    const card = page.locator('.card', { has: page.locator('h3', { hasText: title }) });
    if (await card.locator('.card-body').isHidden()) {
      await card.locator('h3', { hasText: title }).click();
    }
  }

  test('UK Take Home Pay calculator', async ({ page }) => {
    await expandCard(page, 'UK Take Home Pay');
    await page.fill('#take-home-income', '50000');
    await page.selectOption('#take-home-frequency', 'annual');
    await page.click('#takeHomePayForm button[type="submit"]');

    const result = page.locator('#takeHomeResult');
    await expect(result).toBeVisible();
    await expect(result).toContainText('Estimated take home');
    // For 50k, take home is roughly 38k-39k depending on tax year settings
    await expect(result).toContainText('£');
  });

  test('UK Tax Impact Estimator', async ({ page }) => {
    await expandCard(page, 'UK Tax Impact Estimator');
    await page.fill('#taxAssetValue', '10000');
    await page.fill('#taxAssetReturn', '5');
    await page.selectOption('#taxAssetTreatment', 'dividend');
    await page.click('#taxImpactForm button[type="submit"]');

    const result = page.locator('#taxCalculatorResult');
    await expect(result).toBeVisible();
    await expect(result).toContainText('Estimated tax due');
  });

  test('Share Target Profit (%) calculator', async ({ page }) => {
    await expandCard(page, 'Share Target Profit (%)');
    await page.fill('#stock-price', '100');
    await page.fill('#target-return', '10');
    await page.click('#stockProfitForm button[type="submit"]');

    const result = page.locator('#stockProfitResult');
    await expect(result).toBeVisible();
    await expect(result).toContainText('Required Sale Price');
  });

  test('Share Target Profit (£) calculator', async ({ page }) => {
    await expandCard(page, 'Share Target Profit (£)');
    await page.fill('#stock-price-profit', '100');
    await page.fill('#stock-shares-profit', '1000');
    await page.fill('#target-profit', '500');
    await page.click('#stockProfitAmountForm button[type="submit"]');

    const result = page.locator('#stockProfitAmountResult');
    await expect(result).toBeVisible();
    await expect(result).toContainText('Required Sale Price');
  });

  test('Compound Interest calculator', async ({ page }) => {
    await expandCard(page, 'Compound Interest');
    await page.fill('#ci-principal', '1000');
    await page.fill('#ci-rate', '5');
    await page.fill('#ci-years', '10');
    await page.fill('#ci-contribution', '100');
    await page.click('#compoundForm button[type="submit"]');

    const result = page.locator('#compoundResult');
    await expect(result).toBeVisible();
    await expect(result).toContainText('Future Value');
  });

  test('Simple Interest calculator', async ({ page }) => {
    await expandCard(page, 'Simple Interest');
    await page.fill('#si-principal', '1000');
    await page.fill('#si-rate', '5');
    await page.fill('#si-years', '10');
    await page.click('#simpleInterestForm button[type="submit"]');

    const result = page.locator('#simpleInterestResult');
    await expect(result).toBeVisible();
    await expect(result).toContainText('Future Value');
  });

  test('Passive Income Target calculator', async ({ page }) => {
    await expandCard(page, 'Passive Income Target');
    await page.fill('#passive-income-amount', '1000');
    await page.selectOption('#passive-income-frequency', 'monthly');
    await page.fill('#passive-income-return', '4');
    await page.click('#passiveIncomeTargetForm button[type="submit"]');

    const result = page.locator('#passiveIncomeTargetResult');
    await expect(result).toBeVisible();
    await expect(result).toContainText('Investment needed');
  });

  test('Interest Rate Difference calculator', async ({ page }) => {
    await expandCard(page, 'Interest Rate Difference');
    await page.fill('#interest-difference-amount', '10000');
    await page.fill('#interest-rate-a', '3');
    await page.fill('#interest-rate-b', '4');
    await page.click('#interestRateDifferenceForm button[type="submit"]');

    const result = page.locator('#interestDifferenceResult');
    await expect(result).toBeVisible();
    await expect(result).toContainText('Yearly interest comparison');
  });

  test('FIRE (Simple) calculator', async ({ page }) => {
    await expandCard(page, 'FIRE (Simple)');
    await page.fill('#fireLivingExpenses', '30000');
    await page.selectOption('#fireExpensesFrequency', 'annual');
    await page.fill('#fireWithdrawalRate', '4');
    await page.click('#fireForm button[type="submit"]');

    const result = page.locator('#fireResult');
    await expect(result).toBeVisible();
    await expect(result).toContainText('FIRE number');
  });
});
