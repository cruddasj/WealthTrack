import { test, expect } from '@playwright/test';

test.describe('UI Interactions - Desktop', () => {
  test.beforeEach(async ({ page }) => {
    // Disable onboarding and welcome via localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem('wealthtrack:welcomeSeen', '1');
      window.localStorage.setItem('wealthtrack:onboardDataSeen', '1');
      window.localStorage.setItem('wealthtrack:forecastTipSeen', '1');
      window.localStorage.setItem('wealthtrack:welcomeDisabled', '1');
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
  });

  test('Expand and collapse cards on Financial Inputs', async ({ page }) => {
    await page.locator('nav').locator('button', { hasText: 'Financial Inputs' }).click();

    // Select the Income card specifically
    const incomeCard = page.locator('.card', { has: page.locator('h3, h4', { hasText: /^Income$/ }) }).first();
    const incomeHeader = incomeCard.locator('h3, h4');
    const incomeBody = incomeCard.locator('.card-body');

    // Initially might be expanded or collapsed depending on default
    const isInitiallyCollapsed = await incomeCard.evaluate(el => el.classList.contains('collapsed'));

    if (isInitiallyCollapsed) {
      await incomeHeader.click();
      await expect(incomeCard).not.toHaveClass(/collapsed/);
      await expect(incomeBody).toBeVisible();
    } else {
      await incomeHeader.click();
      await expect(incomeCard).toHaveClass(/collapsed/);
      await expect(incomeBody).not.toBeVisible();
    }
  });
});

test.describe('UI Interactions - Mobile', () => {
  test.beforeEach(async ({ page }) => {
    // Disable onboarding and welcome via localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem('wealthtrack:welcomeSeen', '1');
      window.localStorage.setItem('wealthtrack:onboardDataSeen', '1');
      window.localStorage.setItem('wealthtrack:forecastTipSeen', '1');
      window.localStorage.setItem('wealthtrack:welcomeDisabled', '1');
    });

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
  });

  test('Expand and collapse cards on Financial Inputs', async ({ page }) => {
    await page.click('#menu-toggle');
    await page.locator('nav').locator('button', { hasText: 'Financial Inputs' }).click();

    const incomeCard = page.locator('.card', { has: page.locator('h3, h4', { hasText: /^Income$/ }) }).first();
    const incomeHeader = incomeCard.locator('h3, h4');

    // Toggle collapse
    const isInitiallyCollapsed = await incomeCard.evaluate(el => el.classList.contains('collapsed'));

    await incomeHeader.click();
    if (isInitiallyCollapsed) {
      await expect(incomeCard).not.toHaveClass(/collapsed/);
    } else {
      await expect(incomeCard).toHaveClass(/collapsed/);
    }
  });

  test('Mobile menu functionality', async ({ page }) => {
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
