import { test, expect } from '@playwright/test';
import { fullResearchWorkshop } from '../helpers/research-workshop.mjs';

async function importWorkshop(page, w) {
  await page.goto('/#settings');
  await page.getByLabel('Import save', { exact: true }).setInputFiles({
    name: 'keyboard.json',
    mimeType: 'application/json',
    buffer: Buffer.from(w.exportSave()),
  });
  await expect(page.getByRole('status')).toContainText('Workshop imported');
}
async function choose(page, name, value) {
  const control = page.getByLabel(name, { exact: true });
  await control.focus();
  await control.selectOption(value);
  await expect(control).toBeFocused();
}
async function activate(control) {
  await control.focus();
  await control.press('Enter');
}

test('keyboard users can skip repeated navigation without changing screens', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'What will you create?' })).toBeVisible();
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await page.screenshot({ path: `artifacts/keyboard-skip-${test.info().project.name}.png` });
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'What will you create?' })).toBeFocused();
  expect(new URL(page.url()).hash).toBe('');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement.closest('main')))).toBe(true);
  await activate(page.getByRole('link', { name: 'Battle', exact: true }));
  await expect(page.getByRole('heading', { name: 'Combat simulator' })).toBeFocused();
  await activate(skip);
  await expect(page.getByRole('heading', { name: 'Combat simulator' })).toBeFocused();
  expect(new URL(page.url()).hash).toBe('#battle');
});

test('settings and biology controls retain keyboard focus and a usable tab sequence', async ({
  page,
}) => {
  const { w } = fullResearchWorkshop();
  await importWorkshop(page, w);
  const motion = page.getByLabel('Reduce animation', { exact: true });
  await motion.focus();
  await motion.press('Space');
  await expect(motion).toBeFocused();
  await expect(motion).toBeChecked();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Text size', { exact: true })).toBeFocused();
  await choose(page, 'Text size', '1.3');
  await page.goto('/#breeding');
  await choose(page, 'Parent A', 'creature-1');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Parent B', { exact: true })).toBeFocused();
  await choose(page, 'Parent B', 'creature-2');
  await page.goto('/#explore');
  await choose(page, 'Expedition creature', 'creature-1');
  const region = page.getByRole('button', { name: 'Crystal Caves' });
  await activate(region);
  await expect(region).toBeFocused();
  await page.goto('/#research');
  await choose(page, 'Scanner component', 'lightning-organ');
  await page.goto('/#market');
  await choose(page, 'Market supply', 'buy-fiber');
  await choose(page, 'Creature to sell', 'creature-2');
  await page.goto('/#social');
  await choose(page, 'Specimen to share', 'creature-2');
  await page.goto('/#creatures');
  await choose(page, 'Filter creatures', 'mutated');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('combat actions preserve focus and modal return handles blueprint and resting parents', async ({
  page,
}) => {
  await page.clock.install();
  const { w } = fullResearchWorkshop();
  for (let trip = 0; trip < 2; trip++) {
    const job = w.startExpedition('green-meadow', 'creature-1', '2026-10-03T00:00:00Z');
    for (let i = 0; i < 20; i++) w.advanceExpeditions(1000);
    w.claimExpedition(job.id);
  }
  w.saveBlueprint('creature-1');
  await importWorkshop(page, w);
  await page.goto('/#battle');
  await activate(page.getByRole('button', { name: 'Start field test' }));
  const strike = page.locator('[data-action="ability"][data-ability="strike"]');
  await activate(strike);
  await expect(strike).toBeFocused();
  const target = page.locator('.enemies [data-action="target"]:enabled').first();
  await activate(target);
  await expect(target).toBeFocused();
  const execute = page.getByRole('button', { name: 'Use Claw Strike', exact: true });
  await activate(execute);
  await expect(execute).toBeFocused();
  await activate(page.getByRole('button', { name: 'Retreat safely' }));
  await expect(page.getByRole('heading', { name: 'Combat simulator' })).toBeFocused();
  await activate(page.getByRole('button', { name: 'Return to habitat' }));
  await page.goto('/#social');
  const blueprint = page.getByRole('button', { name: 'Manufacture blueprint' });
  await activate(blueprint);
  await expect(page.getByRole('dialog')).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement.closest('dialog')))).toBe(true);
  }
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement.closest('dialog')))).toBe(true);
  }
  await page.getByRole('dialog').screenshot({
    path: `artifacts/keyboard-dialog-${test.info().project.name}.png`,
  });
  await page.keyboard.press('Escape');
  await expect(blueprint).toBeFocused();
  await page.goto('/#breeding');
  await choose(page, 'Parent A', 'creature-1');
  await choose(page, 'Parent B', 'creature-2');
  await activate(page.getByRole('button', { name: 'Create offspring' }));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Breeding nursery' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Create offspring' })).toBeDisabled();
  await page.clock.runFor(31000);
  await expect(page.getByRole('button', { name: 'Create offspring' })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Breeding nursery' })).toBeFocused();
});

test('expanded disclosures and form focus survive saved profile and pasted design updates', async ({
  page,
}) => {
  const { w } = fullResearchWorkshop();
  w.importShare(w.exportCreature('creature-1'));
  const shared = w.exportCreature('creature-2');
  await importWorkshop(page, w);
  await page.goto('/#social');
  const genome = page.getByText('Inspect genome & recipe', { exact: true });
  await activate(genome);
  await expect(page.locator('.visiting-gallery details').first()).toHaveAttribute('open', '');
  await page.getByLabel('Engineer name', { exact: true }).fill('Aster');
  const profile = page.getByRole('button', { name: 'Save profile' });
  await activate(profile);
  await expect(profile).toBeFocused();
  await expect(page.locator('.visiting-gallery details').first()).toHaveAttribute('open', '');
  const name = page.getByLabel('Engineer name', { exact: true });
  await name.fill('Nova');
  await name.evaluate((input) => input.setSelectionRange(1, 3));
  await name.press('Enter');
  await expect(name).toBeFocused();
  expect(await name.evaluate((input) => [input.selectionStart, input.selectionEnd])).toEqual([
    1, 3,
  ]);
  const paste = page.getByText('Paste a shared design', { exact: true });
  await activate(paste);
  await page.getByLabel('Shared JSON', { exact: true }).fill(shared);
  const submit = page.getByRole('button', { name: 'Import pasted design' });
  await activate(submit);
  await expect(page.getByRole('status')).toContainText('Shared design imported');
  await expect(submit).toBeFocused();
  await expect(page.getByLabel('Shared JSON', { exact: true })).toBeVisible();
  await expect(page.getByText('VISITING SPECIMEN', { exact: true })).toHaveCount(2);
});
