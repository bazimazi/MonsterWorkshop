import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { fullResearchWorkshop } from '../helpers/research-workshop.mjs';

const key = 'monster-workshop.save';
async function records(page) {
  const values = await page.evaluate(
    (key) => [localStorage.getItem(key), localStorage.getItem(key + '.backup')],
    key,
  );
  return values.map((raw) =>
    raw === null ? null : createHash('sha256').update(raw).digest('hex'),
  );
}
async function savedState(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)).data, key);
}
async function freezeClock(page) {
  const time = new Date('2026-10-03T12:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
}
async function importWorkshop(page, raw) {
  await page.goto('/#settings');
  await page.getByLabel('Import save', { exact: true }).setInputFiles({
    name: 'workshop.json',
    mimeType: 'application/json',
    buffer: Buffer.from(raw),
  });
  await expect(page.getByRole('status')).toContainText('Workshop imported');
}

test('a second tab waits without saving and opens the latest workshop after the owner closes', async ({
  page,
  context,
}) => {
  await freezeClock(page);
  const { w } = fullResearchWorkshop();
  w.updateOptions({ ...w.state.options, textScale: 1.3 });
  await importWorkshop(page, w.exportSave());
  const second = await context.newPage();
  await second.goto('/#explore');
  await expect(
    second.getByRole('heading', { name: 'Your workshop is open in another tab.' }),
  ).toBeVisible();
  const before = await records(page);
  await second.clock.runFor(10000);
  expect(await records(second)).toEqual(before);
  await second.evaluate(() => (document.documentElement.style.fontSize = '20.8px'));
  expect(await second.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await second.screenshot({
    path: `artifacts/waiting-tab-${test.info().project.name}.png`,
    fullPage: true,
  });
  w.startExpedition('green-meadow', 'creature-1', '2026-10-03T00:00:00Z');
  await importWorkshop(page, w.exportSave());
  await page.goto('/#social');
  await page.getByLabel('Engineer name', { exact: true }).fill('Latest engineer');
  await page.getByRole('button', { name: 'Save profile' }).click();
  const latest = await records(page);
  await page.close();
  await expect(second.getByRole('heading', { name: 'Into the wild' })).toBeVisible();
  expect(await records(second)).toEqual(latest);
  await second.clock.runFor(3000);
  const current = await savedState(second);
  expect(current.playerName).toBe('Latest engineer');
  expect(current.expeditions[0].elapsedMs).toBeGreaterThanOrEqual(2000);
  expect(current.expeditions[0].elapsedMs).toBeLessThanOrEqual(3000);
});

test('without tab locks, external progress pauses stale timers and reloads the latest save', async ({
  page,
  context,
}) => {
  await context.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, 'locks', { get: () => undefined }),
  );
  await freezeClock(page);
  const { w } = fullResearchWorkshop();
  w.startExpedition('green-meadow', 'creature-1', '2026-10-03T00:00:00Z');
  await importWorkshop(page, w.exportSave());
  const second = await context.newPage();
  await second.goto('/#settings');
  await expect(second.getByRole('heading', { name: 'Workshop settings' })).toBeVisible();
  await page.goto('/#social');
  await page.getByLabel('Engineer name', { exact: true }).fill('Updated elsewhere');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(second.getByRole('heading', { name: 'Your saved workshop changed.' })).toBeVisible();
  await second.evaluate(() => (document.documentElement.style.fontSize = '20.8px'));
  expect(await second.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await second.screenshot({
    path: `artifacts/changed-save-${test.info().project.name}.png`,
    fullPage: true,
  });
  const latest = await records(page);
  await page.close();
  await second.clock.runFor(60000);
  expect(await records(second)).toEqual(latest);
  await second.getByRole('button', { name: 'Reload latest workshop' }).click();
  await expect(second.getByRole('heading', { name: 'Workshop settings' })).toBeVisible();
  await second.goto('/#social');
  await expect(second.getByLabel('Engineer name', { exact: true })).toHaveValue(
    'Updated elsewhere',
  );
  await second.clock.runFor(3000);
  const current = await savedState(second);
  expect(current.expeditions[0].elapsedMs).toBeGreaterThanOrEqual(2000);
  expect(current.expeditions[0].elapsedMs).toBeLessThanOrEqual(3000);
});

test('recovery retains ownership and navigating away cancels a waiting tab before it can write', async ({
  page,
  context,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Manufacture creature' }).click();
  await page.getByRole('button', { name: 'Skip sequence' }).click();
  await page.getByRole('button', { name: 'Keep experimenting' }).click();
  await page.evaluate((key) => localStorage.setItem(key, '{broken'), key);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your workshop needs attention.' })).toBeVisible();
  const second = await context.newPage();
  second.on('pageerror', (error) => errors.push(error.message));
  await second.goto('/');
  await expect(
    second.getByRole('heading', { name: 'Your workshop is open in another tab.' }),
  ).toBeVisible();
  const damaged = await records(page);
  await second.goto('about:blank');
  expect(await records(page)).toEqual(damaged);
  await page.getByRole('button', { name: 'Restore backup' }).click();
  await expect(page.getByRole('heading', { name: 'What will you create?' })).toBeVisible();
  const restored = await records(page);
  await second.goBack();
  await expect(
    second.getByRole('heading', { name: 'Your workshop is open in another tab.' }),
  ).toBeVisible();
  await page.close();
  await expect(second.getByRole('heading', { name: 'What will you create?' })).toBeVisible();
  expect(await records(second)).toEqual(restored);
  expect(errors).toEqual([]);
});

test('a rejected ownership request leaves saved data intact and can be retried', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'What will you create?' })).toBeVisible();
  const before = await records(page);
  await page.addInitScript(() => {
    const request = navigator.locks.request.bind(navigator.locks);
    navigator.locks.request = (...args) =>
      localStorage.getItem('test.blockLock')
        ? Promise.reject(new DOMException('Test denied', 'SecurityError'))
        : request(...args);
  });
  await page.evaluate(() => localStorage.setItem('test.blockLock', 'true'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'The workshop could not open.' })).toBeVisible();
  expect(await records(page)).toEqual(before);
  await page.evaluate(() => localStorage.removeItem('test.blockLock'));
  await page.getByRole('button', { name: 'Reload workshop' }).click();
  await expect(page.getByRole('heading', { name: 'What will you create?' })).toBeVisible();
  expect(await records(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test('a timer save detects changed data even without a storage event and reload grants no catch-up', async ({
  page,
}) => {
  await freezeClock(page);
  const { w } = fullResearchWorkshop();
  w.startExpedition('green-meadow', 'creature-1', '2026-10-03T00:00:00Z');
  await importWorkshop(page, w.exportSave());
  await page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key));
    saved.data.playerName = 'External engineer';
    localStorage.setItem(key, JSON.stringify(saved));
  }, key);
  const latest = await records(page);
  await page.clock.runFor(2000);
  await expect(page.getByRole('heading', { name: 'Your saved workshop changed.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume active timers' })).toHaveCount(0);
  await page.clock.runFor(60000);
  expect(await records(page)).toEqual(latest);
  await page.getByRole('button', { name: 'Reload latest workshop' }).click();
  await expect(page.getByRole('heading', { name: 'Workshop settings' })).toBeVisible();
  await page.clock.runFor(3000);
  const current = await savedState(page);
  expect(current.playerName).toBe('External engineer');
  expect(current.expeditions[0].elapsedMs).toBeGreaterThanOrEqual(2000);
  expect(current.expeditions[0].elapsedMs).toBeLessThanOrEqual(3000);
});

for (const locks of ['available', 'unavailable']) {
  test(`returning from a cached page reloads the latest workshop with locks ${locks}`, async ({
    page,
    context,
  }) => {
    if (locks === 'unavailable')
      await context.addInitScript(() =>
        Object.defineProperty(Navigator.prototype, 'locks', { get: () => undefined }),
      );
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'What will you create?' })).toBeVisible();
    // Simulate browser cache lifecycle events so this also exercises persisted pages
    // in automation environments where actual back/forward caching is disabled.
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })),
    );
    const second = await context.newPage();
    await second.goto('/#social');
    await second.getByLabel('Engineer name', { exact: true }).fill('Saved while away');
    await second.getByRole('button', { name: 'Save profile' }).click();
    const latest = await records(second);
    await second.close();
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
    );
    await expect(page.getByRole('heading', { name: 'What will you create?' })).toBeVisible();
    expect(await records(page)).toEqual(latest);
    await page.goto('/#social');
    await expect(page.getByLabel('Engineer name', { exact: true })).toHaveValue('Saved while away');
    await expect(page.locator('#app')).not.toHaveAttribute('inert', '');
  });
}

test('a startup save race asks for the latest workshop without offering to reset valid progress', async ({
  page,
}) => {
  const { w } = fullResearchWorkshop();
  w.updateProfile('Concurrent engineer', 'Created while another tab was opening.');
  await page.addInitScript(
    ({ key, raw }) => {
      Object.defineProperty(Navigator.prototype, 'locks', { get: () => undefined });
      const read = Storage.prototype.getItem;
      Storage.prototype.getItem = function (item) {
        const value = read.call(this, item);
        if (item === key && value === null) {
          // Another writer creates its workshop between this tab's load and first save.
          this.setItem(key, raw);
          return null;
        }
        return value;
      };
    },
    { key, raw: w.exportSave() },
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your saved workshop changed.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start a new workshop' })).toHaveCount(0);
  expect(await savedState(page)).toEqual(w.state);
  const latest = await records(page);
  await page.getByRole('button', { name: 'Reload latest workshop' }).click();
  await expect(page.getByRole('heading', { name: 'What will you create?' })).toBeVisible();
  expect(await records(page)).toEqual(latest);
  await page.goto('/#social');
  await expect(page.getByLabel('Engineer name', { exact: true })).toHaveValue(
    'Concurrent engineer',
  );
});

test('recovery switches to reloading when newer valid progress appears before a restore', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Manufacture creature' }).click();
  await page.getByRole('button', { name: 'Skip sequence' }).click();
  await page.getByRole('button', { name: 'Keep experimenting' }).click();
  const latest = await savedState(page);
  latest.playerName = 'Recovered elsewhere';
  await page.evaluate((key) => localStorage.setItem(key, '{broken'), key);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your workshop needs attention.' })).toBeVisible();
  await page.evaluate(
    ({ key, data }) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, data })),
    { key, data: latest },
  );
  const previous = await records(page);
  await page.getByRole('button', { name: 'Restore backup' }).click();
  await expect(page.getByRole('heading', { name: 'Your saved workshop changed.' })).toBeVisible();
  expect(await records(page)).toEqual(previous);
  await page.getByRole('button', { name: 'Reload latest workshop' }).click();
  await expect(page.getByRole('heading', { name: 'What will you create?' })).toBeVisible();
  expect(await savedState(page)).toEqual(latest);
  expect(await records(page)).toEqual(previous);
});
