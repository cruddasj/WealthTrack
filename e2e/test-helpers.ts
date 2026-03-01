import { Page, expect } from '@playwright/test';

export async function setupE2ETest(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('wealthtrack:welcomeSeen', '1');
    window.localStorage.setItem('wealthtrack:onboardDataSeen', '1');
    window.localStorage.setItem('wealthtrack:forecastTipSeen', '1');
    window.localStorage.setItem('wealthtrack:welcomeDisabled', '1');
  });
}

export async function expandCard(page: Page, title: string | RegExp) {
  const card = page.locator('.card', { has: page.locator('h3, h4', { hasText: title }) }).first();
  const isCollapsed = await card.evaluate((el: Element) => el.classList.contains('collapsed'));
  if (isCollapsed) {
    await card.locator('h3, h4').first().click({ force: true });
    await expect(card).not.toHaveClass(/collapsed/);
    await page.waitForTimeout(500);
  }
  return card;
}
