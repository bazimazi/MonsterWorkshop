import { test, expect } from '@playwright/test';
test('game shell loads content with no runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Monster Workshop');
  await expect(page.locator('h1')).toBeVisible();
  expect(errors).toEqual([]);
});
test('modular preview changes anatomy immediately without horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-slot="legs"]')).toBeVisible();
  await page.getByRole('button', { name: 'Spider Legs' }).click();
  await expect(page.locator('[data-slot="legs"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Storm Wings' }).click();
  await expect(page.locator('[data-slot="wings"]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({ path: `artifacts/phase3-${test.info().project.name}.png`, fullPage: true });
});
