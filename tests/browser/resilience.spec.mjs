import { test, expect } from '@playwright/test';
import { fullResearchWorkshop } from '../helpers/research-workshop.mjs';

async function importWorkshop(page, raw) {
  await page.goto('/#settings');
  await page.getByLabel('Import save', { exact: true }).setInputFiles({
    name: 'workshop.json',
    mimeType: 'application/json',
    buffer: Buffer.from(raw),
  });
  await expect(page.getByRole('status')).toContainText('Workshop imported');
}
async function savedState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('monster-workshop.save')).data);
}
async function failWrites(page, failed) {
  await page.evaluate((value) => {
    if (!window.originalStorageWrite) {
      window.originalStorageWrite = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, data) {
        if (window.failWorkshopWrites && key.startsWith('monster-workshop.save'))
          throw new DOMException('Test storage quota', 'QuotaExceededError');
        return window.originalStorageWrite.call(this, key, data);
      };
    }
    window.failWorkshopWrites = value;
  }, failed);
}

test('active timers recover after an import or an explicit save retry without catch-up rewards', async ({
  page,
}) => {
  await page.clock.install();
  const { w } = fullResearchWorkshop();
  w.startExpedition('green-meadow', 'creature-1', '2026-10-03T00:00:00Z');
  w.updateOptions({ ...w.state.options, textScale: 1.3 });
  const raw = w.exportSave();
  await importWorkshop(page, raw);
  await failWrites(page, true);
  await page.clock.runFor(2000);
  await expect(page.getByRole('alert')).toContainText('could not save');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `artifacts/timer-recovery-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect((await savedState(page)).expeditions[0].elapsedMs).toBe(0);
  await page.clock.runFor(60000);
  expect((await savedState(page)).expeditions[0].elapsedMs).toBe(0);
  await failWrites(page, false);
  await page.getByLabel('Import save', { exact: true }).setInputFiles({
    name: 'workshop.json',
    mimeType: 'application/json',
    buffer: Buffer.from(raw),
  });
  await expect(page.getByRole('status')).toContainText('Workshop imported');
  await page.clock.runFor(3000);
  const progressed = (await savedState(page)).expeditions[0].elapsedMs;
  expect(progressed).toBeGreaterThanOrEqual(2000);
  expect(progressed).toBeLessThanOrEqual(3000);
  await failWrites(page, true);
  await page.clock.runFor(2000);
  await expect(page.getByRole('button', { name: 'Resume active timers' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume active timers' }).click();
  await expect(page.getByRole('alert')).toContainText('could not save');
  expect((await savedState(page)).expeditions[0].elapsedMs).toBe(progressed);
  await failWrites(page, false);
  await page.getByRole('button', { name: 'Resume active timers' }).click();
  await expect(page.getByRole('status')).toContainText('Active timers resumed');
  await page.clock.runFor(3000);
  expect((await savedState(page)).expeditions[0].elapsedMs).toBeGreaterThan(progressed);
  await expect(page.getByRole('button', { name: 'Resume active timers' })).toHaveCount(0);
});

test('restoring a previous workshop clears newer parents and initializes a valid field team', async ({
  page,
}) => {
  const { w } = fullResearchWorkshop();
  const older = w.exportSave();
  const newest = w.manufacture(['dragon-head', 'wolf-body'], '2026-10-03T00:00:00Z');
  await importWorkshop(page, w.exportSave());
  await page.goto('/#battle');
  await page.locator('[data-action="squad"][data-id="creature-1"]').click();
  await page.locator(`[data-action="squad"][data-id="${newest.id}"]`).click();
  await page.goto('/#breeding');
  await page.getByLabel('Parent A', { exact: true }).selectOption(newest.id);
  await page.getByLabel('Parent B', { exact: true }).selectOption('creature-1');
  await page.evaluate((raw) => localStorage.setItem('monster-workshop.save.backup', raw), older);
  await page.goto('/#settings');
  await page.getByRole('button', { name: 'Restore previous save' }).click();
  await expect(page.getByRole('status')).toContainText('Previous save restored');
  await page.goto('/#breeding');
  await expect(page.getByLabel('Parent A', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Parent B', { exact: true })).toHaveValue('');
  await page.goto('/#battle');
  await expect(page.locator('.squad-selected')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Start field test' })).toBeEnabled();
  await expect(page.locator(`[data-action="squad"][data-id="${newest.id}"]`)).toHaveCount(0);
});

test('weekly calendar and seasonal shop refresh while the game stays open', async ({ page }) => {
  await page.clock.install();
  await page.clock.setSystemTime(new Date('2026-10-03T00:00:00Z'));
  const { w } = fullResearchWorkshop();
  w.joinEvent('2026-10-03T00:00:00Z');
  for (let i = 0; i < 2; i++)
    w.manufacture(
      ['dragon-head', 'wolf-body', 'lightning-organ', 'storm-wings'],
      '2026-10-03T00:00:01Z',
    );
  w.claimEvent('2026-10-03T00:00:02Z');
  await importWorkshop(page, w.exportSave());
  await page.goto('/#events');
  await expect(
    page.getByRole('heading', { name: 'Aurora Lab', exact: true, level: 2 }),
  ).toBeVisible();
  const biomass = (await savedState(page)).biomass;
  await page.clock.setSystemTime(new Date('2026-10-05T00:00:00Z'));
  await page.clock.runFor(1000);
  await expect(
    page.getByRole('heading', { name: 'Cinder Lab', exact: true, level: 2 }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enroll in experiment' })).toBeEnabled();
  expect((await savedState(page)).biomass).toBe(biomass);
  await page.clock.setSystemTime(new Date('2026-10-04T23:59:59Z'));
  await page.goto('/#market');
  await expect(
    page.getByLabel('Market supply').locator('option', { hasText: 'Aurora Organ' }),
  ).toHaveCount(1);
  await page.clock.runFor(2000);
  await expect(
    page.getByLabel('Market supply').locator('option', { hasText: 'Aurora Organ' }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel('Crafting recipe').locator('option', { hasText: 'Aurora Organ' }),
  ).toHaveCount(0);
});

test('direct challenge navigation displays the actual squad and honors an incomplete selection', async ({
  page,
}) => {
  const { w } = fullResearchWorkshop();
  await importWorkshop(page, w.exportSave());
  await page.goto('/#challenges');
  await expect(
    page.getByText('SELECTED SQUAD: Crystal Wall / Storm Circuit', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enter tower floor 1' })).toBeEnabled();
  await page.getByRole('link', { name: 'Choose your squad' }).click();
  await page.locator('[data-action="squad"][data-id="creature-1"]').click();
  await page.getByRole('link', { name: 'Challenge arena', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enter tower floor 1' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Challenge Storm Hydra' })).toBeDisabled();
  await page.getByRole('link', { name: 'Choose your squad' }).click();
  await page.locator('[data-action="squad"][data-id="creature-1"]').click();
  await page.getByRole('link', { name: 'Challenge arena', exact: true }).click();
  await page.getByRole('button', { name: 'Enter tower floor 1' }).click();
  expect(
    (await savedState(page)).activeBattle.units
      .filter((u) => u.team === 'player')
      .map((u) => u.source.id),
  ).toEqual(['creature-2', 'creature-3', 'creature-1']);
});

test('successful profile and shared-file submissions clear the previous error announcement', async ({
  page,
}) => {
  const { w } = fullResearchWorkshop();
  const share = w.exportCreature('creature-1');
  await importWorkshop(page, w.exportSave());
  await page.goto('/#social');
  await page.getByLabel('Engineer name', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Engineer name', { exact: true }).fill('Aster');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved.×');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByLabel('Import shared design', { exact: true }).setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Import shared design', { exact: true }).setInputFiles({
    name: 'creature.json',
    mimeType: 'application/json',
    buffer: Buffer.from(share),
  });
  await expect(page.getByRole('status')).toContainText('Shared design imported');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
