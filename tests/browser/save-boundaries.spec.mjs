import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fullResearchWorkshop } from '../helpers/research-workshop.mjs';

test('failed and repeated recovery keep the last valid backup, including an empty damaged primary', async ({
  page,
}) => {
  await page.goto('/');
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Manufacture creature' }).click();
    await page.getByRole('button', { name: 'Skip sequence' }).click();
    await page.getByRole('button', { name: 'Keep experimenting' }).click();
  }
  const backup = await page.evaluate(() => localStorage.getItem('monster-workshop.save.backup'));
  expect(JSON.parse(backup).data.creatures).toHaveLength(1);
  await page.evaluate(() => localStorage.setItem('monster-workshop.save', '{broken'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your workshop needs attention.' })).toBeVisible();
  await page.evaluate(() => {
    window.originalWrite = Storage.prototype.setItem;
    window.failRecoveryWrite = true;
    Storage.prototype.setItem = function (key, value) {
      if (window.failRecoveryWrite && key === 'monster-workshop.save')
        throw new DOMException('Test quota', 'QuotaExceededError');
      return window.originalWrite.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Restore backup' }).click();
  await expect(page.getByRole('alert')).toContainText('could not save');
  expect(await page.evaluate(() => localStorage.getItem('monster-workshop.save'))).toBe('{broken');
  expect(await page.evaluate(() => localStorage.getItem('monster-workshop.save.backup'))).toBe(
    backup,
  );
  await page.evaluate(() => (window.failRecoveryWrite = false));
  await page.getByRole('button', { name: 'Restore backup' }).click();
  await expect(page.getByRole('heading', { name: 'What will you create?' })).toBeVisible();
  for (const damaged of ['', '{broken again']) {
    expect(await page.evaluate(() => localStorage.getItem('monster-workshop.save.backup'))).toBe(
      backup,
    );
    await page.evaluate((raw) => localStorage.setItem('monster-workshop.save', raw), damaged);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Your workshop needs attention.' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Restore backup' }).click();
    await expect(page.getByRole('heading', { name: 'What will you create?' })).toBeVisible();
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('monster-workshop.save')).data),
    ).toEqual(JSON.parse(backup).data);
  }
});

test('recovery export and restore report blocked storage reads without uncaught errors', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'What will you create?' })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('monster-workshop.save', '{broken'));
  await page.addInitScript(() => {
    const originalRead = Storage.prototype.getItem;
    window.denySaveReads = true;
    Storage.prototype.getItem = function (key) {
      if (window.denySaveReads && key.startsWith('monster-workshop.save'))
        throw new DOMException('Test denied', 'SecurityError');
      return originalRead.call(this, key);
    };
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your workshop needs attention.' })).toBeVisible();
  await page.getByRole('button', { name: 'Export current save' }).click();
  await expect(page.getByRole('alert')).toContainText('could not read');
  await page.getByRole('button', { name: 'Restore backup' }).click();
  await expect(page.getByRole('alert')).toContainText('could not read');
  expect(errors).toEqual([]);
  await page.evaluate(() => (window.denySaveReads = false));
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export current save' }).click();
  const download = await exported;
  expect(await readFile(await download.path(), 'utf8')).toBe('{broken');
  await expect(page.getByRole('alert')).toBeEmpty();
  expect(await page.evaluate(() => localStorage.getItem('monster-workshop.save'))).toBe('{broken');
});

test('a changed battle snapshot fails file import without replacing the save or its backup', async ({
  page,
}) => {
  const { w } = fullResearchWorkshop();
  w.startBattle(
    w.creatures.slice(0, 3).map((c) => c.id),
    '2026-10-03T00:00:00Z',
  );
  await page.goto('/#settings');
  const upload = (raw, name) =>
    page.getByLabel('Import save', { exact: true }).setInputFiles({
      name,
      mimeType: 'application/json',
      buffer: Buffer.from(raw),
    });
  await upload(w.exportSave(), 'valid.json');
  await expect(page.getByRole('status')).toContainText('Workshop imported');
  const previous = await page.evaluate(() => [
    localStorage.getItem('monster-workshop.save'),
    localStorage.getItem('monster-workshop.save.backup'),
  ]);
  const damaged = JSON.parse(w.exportSave());
  damaged.data.activeBattle.units.find((u) => u.team === 'player').source.level = 100;
  await upload(JSON.stringify(damaged), 'bad-battle.json');
  await expect(page.getByRole('alert')).toContainText('Battle source');
  expect(
    await page.evaluate(() => [
      localStorage.getItem('monster-workshop.save'),
      localStorage.getItem('monster-workshop.save.backup'),
    ]),
  ).toEqual(previous);
  await page.goto('/#battle');
  await expect(page.locator('.fight-card')).toHaveCount(6);
  await page.reload();
  await expect(page.locator('.fight-card')).toHaveCount(6);
});
