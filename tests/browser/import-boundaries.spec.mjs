import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { archivedWorkshop } from '../helpers/archived-workshop.mjs';
import { fullResearchWorkshop } from '../helpers/research-workshop.mjs';
import { MAX_SAVE_BYTES } from '../../dist/src/platform/save.js';
import { MAX_SHARE_BYTES } from '../../dist/src/domain/sharing.js';

test('a workshop with a large sales archive reimports its own downloaded save intact', async ({
  page,
}) => {
  const { w } = archivedWorkshop(),
    raw = w.exportSave();
  expect(Buffer.byteLength(raw, 'utf8')).toBeGreaterThan(1_000_000);
  expect(w.creatures).toHaveLength(3);
  await page.addInitScript((raw) => {
    if (localStorage.getItem('monster-workshop.save') === null)
      localStorage.setItem('monster-workshop.save', raw);
  }, raw);
  await page.goto('/#settings');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export save' }).click();
  const path = await (await downloaded).path();
  expect(await readFile(path, 'utf8')).toBe(raw);
  await page.getByLabel('Import save', { exact: true }).setInputFiles(path);
  await expect(page.getByRole('status')).toContainText('Workshop imported');
  const current = await page.evaluate(
    () => JSON.parse(localStorage.getItem('monster-workshop.save')).data,
  );
  expect(current).toEqual(w.state);
  await page.goto('/#creatures');
  await expect(page.locator('.creature-card')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('.creature-card')).toHaveCount(3);
});

test('oversized save and shared files are rejected before reading and a valid shared retry clears the error', async ({
  page,
}) => {
  const { w } = fullResearchWorkshop(),
    packet = JSON.parse(w.exportCreature(w.creatures[0].id));
  packet.creatures[0].genome.strength.extra = { attack: 99999 };
  packet.creatures[0].history.extra = { biomass: 99999 };
  await page.goto('/#settings');
  const previous = await page.evaluate(() => [
    localStorage.getItem('monster-workshop.save'),
    localStorage.getItem('monster-workshop.save.backup'),
  ]);
  await page.evaluate(
    ({ saveBytes, shareBytes }) => {
      const size = Object.getOwnPropertyDescriptor(Blob.prototype, 'size').get;
      const read = File.prototype.text;
      window.importFileReads = 0;
      Object.defineProperty(File.prototype, 'size', {
        get() {
          if (this.name === 'huge-save.json') return saveBytes + 1;
          if (this.name === 'huge-share.json') return shareBytes + 1;
          return size.call(this);
        },
      });
      File.prototype.text = function () {
        window.importFileReads++;
        return read.call(this);
      };
    },
    { saveBytes: MAX_SAVE_BYTES, shareBytes: MAX_SHARE_BYTES },
  );
  await page.getByLabel('Import save', { exact: true }).setInputFiles({
    name: 'huge-save.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{broken'),
  });
  await expect(page.getByRole('alert')).toContainText('Save file is too large');
  await page.goto('/#social');
  await page.getByLabel('Import shared design', { exact: true }).setInputFiles({
    name: 'huge-share.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{broken'),
  });
  await expect(page.getByRole('alert')).toContainText('Shared file is too large');
  expect(await page.evaluate(() => window.importFileReads)).toBe(0);
  expect(
    await page.evaluate(() => [
      localStorage.getItem('monster-workshop.save'),
      localStorage.getItem('monster-workshop.save.backup'),
    ]),
  ).toEqual(previous);
  await page.getByLabel('Import shared design', { exact: true }).setInputFiles({
    name: 'valid-shared.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(packet)),
  });
  await expect(page.getByRole('status')).toContainText('Shared design imported');
  expect(await page.evaluate(() => window.importFileReads)).toBe(1);
  const data = await page.evaluate(
    () => JSON.parse(localStorage.getItem('monster-workshop.save')).data,
  );
  expect(data.gallery[0].source).toEqual(w.state.creatures[0]);
  expect(data.creatures).toHaveLength(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('save imports canonicalize family snapshots and shared pasted biology without changing game records', async ({
  page,
}) => {
  const { w } = fullResearchWorkshop();
  w.buy('buy-fiber');
  const child = w.breed('creature-1', 'creature-2', '2026-10-03T00:00:00Z');
  const expected = w.state,
    envelope = JSON.parse(w.exportSave());
  const decorate = (source) => {
    source.genome = Object.fromEntries(
      Object.entries(source.genome)
        .reverse()
        .map(([id, gene]) => [id, { ...gene, extra: { biomass: 99999 } }]),
    );
    source.history.extra = { padding: 'x'.repeat(3000) };
    if (source.lineage) {
      source.lineage.inheritance = Object.fromEntries(
        Object.entries(source.lineage.inheritance).reverse(),
      );
      source.lineage.extra = { attack: 99999 };
    }
  };
  envelope.data.creatures.forEach(decorate);
  envelope.data.births.forEach((birth) => birth.parents.forEach(decorate));
  const time = new Date('2026-10-03T12:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  await page.goto('/#settings');
  await page.getByLabel('Import save', { exact: true }).setInputFiles({
    name: 'family.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(envelope)),
  });
  await expect(page.getByRole('status')).toContainText('Workshop imported');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('monster-workshop.save')).data),
  ).toEqual(expected);
  await page.goto('/#social');
  const packet = JSON.parse(w.exportCreature(child.id));
  decorate(packet.creatures[0]);
  await page.getByText('Paste a shared design', { exact: true }).click();
  await page.getByLabel('Shared JSON', { exact: true }).fill(JSON.stringify(packet));
  await page.getByRole('button', { name: 'Import pasted design' }).click();
  await expect(page.getByRole('status')).toContainText('Shared design imported');
  const current = await page.evaluate(
    () => JSON.parse(localStorage.getItem('monster-workshop.save')).data,
  );
  expect(current.gallery[0].source).toEqual(expected.creatures.find((c) => c.id === child.id));
  for (const key of [
    'creatures',
    'births',
    'breedingCooldowns',
    'inventory',
    'biomass',
    'experiments',
  ])
    expect(current[key]).toEqual(expected[key]);
  await page.reload();
  await expect(page.locator('.visiting-gallery article')).toHaveCount(1);
});
