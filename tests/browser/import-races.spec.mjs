import { test, expect } from '@playwright/test';
import { fullResearchWorkshop } from '../helpers/research-workshop.mjs';

async function delayReads(page) {
  await page.evaluate(() => {
    const read = File.prototype.text;
    window.delayedImportReads = new Map();
    File.prototype.text = async function () {
      const raw = await read.call(this);
      if (!this.name.startsWith('delayed-')) return raw;
      return new Promise((resolve, reject) =>
        window.delayedImportReads.set(this.name, {
          finish: () => resolve(raw),
          fail: () => reject(new Error('The file could not be read.')),
        }),
      );
    };
  });
}
async function selectFile(page, label, name, raw) {
  await page.getByLabel(label, { exact: true }).setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(raw),
  });
  if (name.startsWith('delayed-'))
    await expect
      .poll(() => page.evaluate((name) => window.delayedImportReads.has(name), name))
      .toBe(true);
}
async function finishRead(page, name, fail = false) {
  await page.evaluate(
    ({ name, fail }) => {
      const read = window.delayedImportReads.get(name);
      window.delayedImportReads.delete(name);
      read[fail ? 'fail' : 'finish']();
    },
    { name, fail },
  );
  // Drain the handler's continuation before inspecting the persisted records.
  await page.evaluate(() => undefined);
}
async function records(page) {
  return page.evaluate(() => [
    localStorage.getItem('monster-workshop.save'),
    localStorage.getItem('monster-workshop.save.backup'),
  ]);
}
async function state(page) {
  return JSON.parse((await records(page))[0]).data;
}

test('the latest selected save wins and superseded read failures do not replace its success', async ({
  page,
}) => {
  const { w } = fullResearchWorkshop();
  const older = w.exportSave();
  w.updateProfile('Latest engineer', 'This is the file selected last.');
  const latest = w.exportSave();
  await page.goto('/#settings');
  await delayReads(page);
  for (const fail of [false, true]) {
    const name = `delayed-${fail ? 'failed' : 'older'}.json`;
    await selectFile(page, 'Import save', name, older);
    await selectFile(page, 'Import save', 'latest.json', latest);
    await expect(page.getByRole('status')).toContainText('Workshop imported');
    const saved = await records(page);
    await finishRead(page, name, fail);
    expect(await records(page)).toEqual(saved);
    expect(await state(page)).toEqual(w.state);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Workshop imported');
  }
});

test('local edits and backup restoration preserve newer progress when pending files finish', async ({
  page,
}) => {
  const { w } = fullResearchWorkshop();
  await page.goto('/#settings');
  await delayReads(page);
  await selectFile(page, 'Import save', 'delayed-save.json', w.exportSave());
  await page.getByLabel('Reduce animation', { exact: true }).check();
  await expect(page.getByRole('alert')).toContainText('workshop changed');
  await expect(page.getByRole('button', { name: 'Cancel import', exact: true })).toHaveCount(0);
  const edited = await records(page);
  await finishRead(page, 'delayed-save.json');
  expect(await records(page)).toEqual(edited);
  await expect(page.getByLabel('Reduce animation', { exact: true })).toBeChecked();
  await expect(page.getByRole('alert')).toContainText('workshop changed');

  await page.goto('/#social');
  await selectFile(
    page,
    'Import shared design',
    'delayed-visitor.json',
    w.exportCreature(w.creatures[0].id),
  );
  await page.goto('/#settings');
  await page.getByRole('button', { name: 'Restore previous save' }).click();
  await expect(page.getByRole('status')).toContainText('Previous save restored');
  const restored = await records(page);
  await finishRead(page, 'delayed-visitor.json');
  expect(await records(page)).toEqual(restored);
  expect((await state(page)).gallery).toHaveLength(0);
  await expect(page.getByRole('status')).toContainText('Previous save restored');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('pending imports pause active timers and cancellation or failed reads resume without catch-up', async ({
  page,
}) => {
  const { w } = fullResearchWorkshop();
  w.startExpedition('green-meadow', 'creature-1', '2026-10-03T00:00:00Z');
  w.buy('buy-fiber');
  w.breed('creature-2', 'creature-3', '2026-10-03T00:00:00Z');
  w.updateOptions({ ...w.state.options, textScale: 1.3 });
  const raw = w.exportSave();
  const time = new Date('2026-10-03T12:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  await page.addInitScript((raw) => {
    if (localStorage.getItem('monster-workshop.save') === null)
      localStorage.setItem('monster-workshop.save', raw);
  }, raw);
  await page.goto('/#settings');
  await delayReads(page);
  const original = await records(page);
  await selectFile(page, 'Import save', 'delayed-cancel.json', raw);
  await expect(page.getByRole('status')).toContainText('Reading save file');
  await page.clock.runFor(5000);
  expect(await records(page)).toEqual(original);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `artifacts/pending-import-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Cancel import', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Import cancelled');
  await page.clock.runFor(1000);
  expect((await state(page)).expeditions[0].elapsedMs).toBe(1000);
  const resumed = await records(page);
  await finishRead(page, 'delayed-cancel.json');
  expect(await records(page)).toEqual(resumed);

  await selectFile(page, 'Import save', 'delayed-failure.json', raw);
  await page.clock.runFor(5000);
  expect(await records(page)).toEqual(resumed);
  await finishRead(page, 'delayed-failure.json', true);
  await expect(page.getByRole('alert')).toContainText('file could not be read');
  await expect(page.getByRole('button', { name: 'Cancel import', exact: true })).toHaveCount(0);
  await page.clock.runFor(1000);
  expect((await state(page)).expeditions[0].elapsedMs).toBe(2000);

  await selectFile(page, 'Import save', 'retry.json', raw);
  await expect(page.getByRole('status')).toContainText('Workshop imported');
  expect(await state(page)).toEqual(w.state);
  await page.clock.runFor(1000);
  const current = await state(page);
  expect(current.expeditions[0].elapsedMs).toBe(1000);
  expect(current.breedingCooldowns['creature-2']).toBe(
    w.state.breedingCooldowns['creature-2'] - 1000,
  );
});

test('failed edits keep the pending import valid and an older failed read cannot cancel a newer shared file', async ({
  page,
}) => {
  const { w } = fullResearchWorkshop();
  await page.goto('/#settings');
  await delayReads(page);
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    window.failImportTestWrites = true;
    Storage.prototype.setItem = function (key, value) {
      if (window.failImportTestWrites && key.startsWith('monster-workshop.save'))
        throw new DOMException('Test quota', 'QuotaExceededError');
      return write.call(this, key, value);
    };
  });
  await selectFile(page, 'Import save', 'delayed-retry.json', w.exportSave());
  const before = await records(page);
  await page.getByLabel('Reduce animation', { exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not save');
  await expect(page.getByLabel('Reduce animation', { exact: true })).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Cancel import', exact: true })).toBeVisible();
  expect(await records(page)).toEqual(before);
  await page.evaluate(() => {
    window.failImportTestWrites = false;
  });
  await finishRead(page, 'delayed-retry.json');
  await expect(page.getByRole('status')).toContainText('Workshop imported');
  expect(await state(page)).toEqual(w.state);
  await expect(page.getByRole('alert')).toHaveCount(0);

  await page.goto('/#social');
  await selectFile(
    page,
    'Import shared design',
    'delayed-earlier-share.json',
    w.exportCreature(w.creatures[0].id),
  );
  await selectFile(
    page,
    'Import shared design',
    'delayed-latest-share.json',
    w.exportCreature(w.creatures[1].id),
  );
  const pending = await records(page);
  await finishRead(page, 'delayed-earlier-share.json', true);
  expect(await records(page)).toEqual(pending);
  await expect(page.getByRole('status')).toContainText('Reading shared design');
  await expect(page.getByRole('button', { name: 'Cancel import', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await finishRead(page, 'delayed-latest-share.json');
  await expect(page.getByRole('status')).toContainText('Shared design imported');
  const current = await state(page);
  expect(current.gallery).toHaveLength(1);
  expect(current.gallery[0].source).toEqual(w.state.creatures[1]);
  expect(current.creatures).toEqual(w.state.creatures);
  expect(current.inventory).toEqual(w.state.inventory);
});
