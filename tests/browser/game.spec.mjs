import { test, expect } from '@playwright/test';
test('game shell loads content with no runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Monster Workshop');
  await expect(page.locator('h1')).toBeVisible();
  expect(errors).toEqual([]);
});
