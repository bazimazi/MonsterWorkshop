import { test, expect } from '@playwright/test';
test('game shell loads content with no runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Monster Workshop');
  await expect(page.locator('h1')).toBeVisible();
  expect(errors).toEqual([]);
});
test('modular preview changes anatomy immediately without horizontal overflow', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Spider Legs' }).click();
  await expect(page.locator('[data-slot="legs"]')).toBeVisible();
  await page.getByRole('button', { name: 'Spider Legs' }).click();
  await expect(page.locator('[data-slot="legs"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Unknown component' })).toBeDisabled();
  await page.getByRole('button', { name: 'Lightning Organ' }).click();
  await expect(page.locator('[data-slot="organ"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `artifacts/workshop-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test('manufacture, reveal, rename, journal and reload preserve the invention', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Lightning Organ' }).click();
  await page.getByRole('button', { name: 'Manufacture creature' }).click();
  await page.getByRole('button', { name: 'Skip sequence' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Meet your creature' }).click();
  await expect(page.getByRole('heading', { name: 'The habitat' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Name your creation' }).fill('Pip the Impossible');
  await page.getByRole('button', { name: 'Save name' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Pip the Impossible' })).toBeVisible();
  await page.getByRole('link', { name: 'Journal', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pip the Impossible' })).toBeVisible();
  const save = await page.evaluate(
    () => JSON.parse(localStorage.getItem('monster-workshop.save')).data,
  );
  expect(save.creatures).toHaveLength(1);
  expect(save.experiments).toHaveLength(1);
  expect(save.inventory['dragon-head']).toBe(4);
});
test('reduced motion and larger text persist; invalid anatomy cannot manufacture', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Dragon Head' }).click();
  await expect(page.getByRole('button', { name: 'Manufacture creature' })).toBeDisabled();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Reduce animation' }).check();
  await page.getByRole('combobox', { name: 'Text size' }).selectOption('1.3');
  await page.getByRole('link', { name: 'Workshop', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(page.locator('body')).toHaveClass('reduced-motion');
  await expect(page.locator('.creature-svg.idle')).toHaveCount(0);
});
test('corrupt save is preserved and the previous valid backup restores', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Manufacture creature' }).click();
  await page.getByRole('button', { name: 'Skip sequence' }).click();
  await page.getByRole('button', { name: 'Keep experimenting' }).click();
  await page.evaluate(() => localStorage.setItem('monster-workshop.save', '{broken'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your workshop needs attention.' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('monster-workshop.save'))).toBe('{broken');
  await page.getByRole('button', { name: 'Restore backup' }).click();
  await expect(page.getByRole('heading', { name: 'What will you create?' })).toBeVisible();
});
test('full loop: build three, fight, resume, claim, discover wings and manufacture again', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  for (const part of ['Spider Legs', 'Lightning Organ', 'Crystal Armor'])
    await page.getByRole('button', { name: part }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Manufacture creature' }).click();
    await page.getByRole('button', { name: 'Skip sequence' }).click();
    await page.getByRole('button', { name: 'Keep experimenting' }).click();
  }
  await page.getByRole('link', { name: 'Battle', exact: true }).click();
  await page.getByRole('button', { name: 'Start field test' }).click();
  await expect(page.locator('.fight-card')).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `artifacts/battle-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Use Claw Strike', exact: true }).click();
  await page.getByRole('button', { name: 'Crystal Guard', exact: false }).click();
  await expect(page.locator('.allies .fight-card[aria-pressed="true"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Use Crystal Guard', exact: true }).click();
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem('monster-workshop.save')).data.activeBattle,
  );
  await page.reload();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('monster-workshop.save')).data.activeBattle,
    ),
  ).toEqual(before);
  for (
    let i = 0;
    i < 80 && (await page.getByRole('button', { name: 'Use Claw Strike', exact: true }).count());
    i++
  )
    await page.getByRole('button', { name: 'Use Claw Strike', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Collect rewards' })).toBeVisible();
  await page.getByRole('button', { name: 'Collect rewards' }).click();
  await expect(page.getByRole('heading', { name: 'Storm Wings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Collect rewards' })).toHaveCount(0);
  await page.screenshot({
    path: `artifacts/discovery-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Try your new component' }).click();
  await expect(page.locator('[data-slot="wings"]')).toBeVisible();
  await page.getByRole('button', { name: 'Manufacture creature' }).click();
  await page.getByRole('button', { name: 'Skip sequence' }).click();
  await page.getByRole('button', { name: 'Meet your creature' }).click();
  const save = await page.evaluate(
    () => JSON.parse(localStorage.getItem('monster-workshop.save')).data,
  );
  expect(save.creatures).toHaveLength(4);
  expect(save.claimedBattles).toHaveLength(1);
  expect(save.creatures.at(-1).componentIds).toContain('storm-wings');
  expect(errors).toEqual([]);
});
test('offline cached reload still allows creature manufacture', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'What will you create?' })).toBeVisible();
  await page.getByRole('button', { name: 'Manufacture creature' }).click();
  await page.getByRole('button', { name: 'Skip sequence' }).click();
  await page.getByRole('button', { name: 'Meet your creature' }).click();
  await expect(page.locator('.creature-card')).toHaveCount(1);
  await context.setOffline(false);
});
test('exported file reimports correctly; invalid files preserve the workshop', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Manufacture creature' }).click();
  await page.getByRole('button', { name: 'Skip sequence' }).click();
  await page.getByRole('button', { name: 'Keep experimenting' }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export save' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('monster-workshop-save.json');
  const previous = await page.evaluate(
    () => JSON.parse(localStorage.getItem('monster-workshop.save')).data,
  );
  await page.getByLabel('Import save', { exact: true }).setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":2}'),
  });
  await expect(page.getByRole('alert')).toContainText('Unsupported save version');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('monster-workshop.save')).data),
  ).toEqual(previous);
  await page.getByLabel('Import save', { exact: true }).setInputFiles(await download.path());
  await expect(page.getByRole('status')).toContainText('Workshop imported');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('monster-workshop.save')).data),
  ).toEqual(previous);
});
