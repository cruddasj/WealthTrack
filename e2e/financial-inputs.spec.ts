import { test, expect } from '@playwright/test';
import { setupE2ETest, expandCard } from './test-helpers';

test.describe('Financial Inputs', () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ETest(page);
    await page.goto('/');

    // Ensure we are on the data-entry page
    await page.locator('nav').locator('button', { hasText: 'Financial Inputs' }).click();
    await expect(page.locator('#data-entry')).toHaveClass(/active/);
  });

  test('Add and edit Income', async ({ page }) => {
    await expandCard(page, 'Income');

    // Add Income
    await page.fill('#incomeName', 'Salary');
    await page.fill('#incomeAmount', '5000');
    await page.selectOption('#incomeFrequency', 'monthly');
    await page.click('button:has-text("Add Income")');

    const tableBody = page.locator('#incomeTableBody');
    await expect(tableBody).toContainText('Salary');
    await expect(tableBody).toContainText('£5,000.00');

    // Edit Income
    await page.click('[data-action="edit-income"]');
    await page.fill('#editIncomeName', 'New Salary');
    await page.fill('#editIncomeAmount', '6000');
    await page.click('button:has-text("Save Changes")');

    await expect(tableBody).toContainText('New Salary');
    await expect(tableBody).toContainText('£6,000.00');
  });

  test('Add and edit Expense', async ({ page }) => {
    await expandCard(page, 'Expenses');

    // Add Expense
    await page.fill('#expenseName', 'Rent');
    await page.fill('#expenseAmount', '1500');
    await page.selectOption('#expenseFrequency', 'monthly');
    await page.click('button:has-text("Add Expense")');

    const tableBody = page.locator('#expenseTableBody');
    await expect(tableBody).toContainText('Rent');
    await expect(tableBody).toContainText('£1,500.00');

    // Edit Expense
    await page.click('[data-action="edit-expense"]');
    await page.fill('#editExpenseName', 'New Rent');
    await page.fill('#editExpenseAmount', '1600');
    await page.click('button:has-text("Save Changes")');

    await expect(tableBody).toContainText('New Rent');
    await expect(tableBody).toContainText('£1,600.00');
  });

  test('Add and edit Asset', async ({ page }) => {
    await expandCard(page, 'Assets');

    // Add Asset
    await page.fill('#assetName', 'Savings');
    await page.fill('#assetValue', '10000');
    await page.fill('#assetReturn', '5');
    await page.click('button:has-text("Add Asset")');

    const tableBody = page.locator('#assetTableBody');
    await expect(tableBody).toContainText('Savings');
    await expect(tableBody).toContainText('£10,000.00');

    // Edit Asset
    await page.click('[data-action="edit-asset"]');
    await page.fill('#editAssetName', 'Total Savings');
    await page.fill('#editAssetValue', '12000');
    await page.click('button:has-text("Save Changes")');

    await expect(tableBody).toContainText('Total Savings');
    await expect(tableBody).toContainText('£12,000.00');
  });

  test('Add and edit Liability', async ({ page }) => {
    await expandCard(page, 'Liabilities');

    // Add Liability
    await page.fill('#liabilityName', 'Car Loan');
    await page.fill('#liabilityValue', '8000');
    await page.click('button:has-text("Add Liability")');

    const tableBody = page.locator('#liabilityTableBody');
    await expect(tableBody).toContainText('Car Loan');
    await expect(tableBody).toContainText('£8,000.00');

    // Edit Liability
    await page.click('[data-action="edit-liability"]');
    await page.fill('#editLiabilityName', 'New Car Loan');
    await page.fill('#editLiabilityValue', '7000');
    await page.click('button:has-text("Save Changes")');

    await expect(tableBody).toContainText('New Car Loan');
    await expect(tableBody).toContainText('£7,000.00');
  });

  test('Set Goal', async ({ page }) => {
    await expandCard(page, 'Goal');

    await page.fill('#goalValue', '1000000');
    await page.fill('#goalYear', '2050');
    await page.click('#goalBtn');

    // Dismiss alert modal that appears after setting goal
    const closeModalBtn = page.locator('.modal-close');
    await expect(closeModalBtn).toBeVisible();
    await closeModalBtn.click();

    // Check if values persisted in inputs
    await expect(page.locator('#goalValue')).toHaveValue('1000000');
    await expect(page.locator('#goalYear')).toHaveValue('2050');
  });
});
