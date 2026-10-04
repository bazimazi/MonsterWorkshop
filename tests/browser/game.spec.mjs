import { test, expect } from '@playwright/test';
import { fullResearchWorkshop } from '../helpers/research-workshop.mjs';
test('weekly experiment earns seasonal anatomy, unlocks Frozen Peaks and enables its boss', async ({
  page,
}) => {
  const time = new Date('2026-10-03T00:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  const { w } = fullResearchWorkshop();
  await page.goto('/#settings');
  await page.getByLabel('Import save', { exact: true }).setInputFiles({
    name: 'events.json',
    mimeType: 'application/json',
    buffer: Buffer.from(w.exportSave()),
  });
  await expect(page.getByRole('status')).toContainText('imported');
  await page.getByRole('link', { name: 'Marketplace', exact: true }).click();
  await page.getByRole('link', { name: 'Event calendar', exact: true }).click();
  await page.getByRole('button', { name: 'Enroll in experiment' }).click();
  await expect(page.getByRole('button', { name: 'Collect seasonal reward' })).toBeDisabled();
  await page.getByRole('link', { name: 'Build event biology' }).click();
  for (const part of ['Lightning Organ', 'Storm Wings'])
    await page.getByRole('button', { name: part }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Manufacture creature' }).click();
    await page.getByRole('button', { name: 'Skip sequence' }).click();
    await page.getByRole('button', { name: 'Keep experimenting' }).click();
  }
  await page.goto('/#events');
  await expect(page.getByRole('button', { name: 'Collect seasonal reward' })).toBeEnabled();
  await page.screenshot({
    path: `artifacts/events-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Collect seasonal reward' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Enroll in experiment' })).toBeDisabled();
  await page.getByRole('link', { name: 'Workshop', exact: true }).click();
  await page.getByRole('button', { name: 'Aurora Organ' }).click();
  await page.getByRole('button', { name: 'Storm Wings' }).click();
  await page.getByRole('button', { name: 'Manufacture creature' }).click();
  await page.getByRole('button', { name: 'Skip sequence' }).click();
  await page.screenshot({
    path: `artifacts/seasonal-creature-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Keep experimenting' }).click();
  const id = await page.evaluate(
    () => JSON.parse(localStorage.getItem('monster-workshop.save')).data.creatures.at(-1).id,
  );
  await page.getByRole('link', { name: 'Explore', exact: true }).click();
  await page.getByRole('button', { name: 'Frozen Peaks' }).click();
  await page.getByRole('combobox', { name: 'Expedition creature' }).selectOption(id);
  await page.getByRole('button', { name: 'Send on expedition' }).click();
  await page.clock.runFor(61000);
  await page.getByRole('button', { name: 'Collect expedition' }).click();
  await expect(page.getByRole('status')).toContainText('Glacial Chassis');
  await page.goto('/#challenges');
  await page.getByRole('button', { name: 'Challenge Frost Matriarch' }).click();
  await expect(page.locator('.fight-card')).toHaveCount(6);
  await page.screenshot({
    path: `artifacts/live-boss-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Retreat safely' }).click();
  await page.getByRole('button', { name: 'Return to habitat' }).click();
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem('monster-workshop.save')).data.biomass,
  );
  await page.clock.setSystemTime(new Date('2026-10-06T00:00:00Z'));
  await page.goto('/#events');
  await expect(
    page.getByRole('heading', { name: 'Cinder Lab', exact: true, level: 2 }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Collect seasonal reward' })).toBeDisabled();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('monster-workshop.save')).data.biomass,
    ),
  ).toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('profile, showcase and blueprint files roundtrip without granting visiting creature ownership', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Manufacture', exact: false }).click();
  if (await page.getByRole('button', { name: 'Skip sequence' }).count())
    await page.getByRole('button', { name: 'Skip sequence' }).click();
  await page.getByRole('button', { name: 'Meet your creature' }).click();
  await page.getByRole('link', { name: 'Showcase & blueprints', exact: true }).click();
  await page.getByLabel('Engineer name', { exact: true }).fill('Aster');
  await page.getByLabel('Biography', { exact: true }).fill('Collector of strange ideas.');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.getByRole('button', { name: 'Add to showcase' }).click();
  await page.getByRole('button', { name: 'Save blueprint', exact: true }).click();
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export showcase' }).click();
  const download = await exported;
  await page
    .getByLabel('Import shared design', { exact: true })
    .setInputFiles(await download.path());
  await expect(page.getByText('VISITING SPECIMEN', { exact: true })).toBeVisible();
  await page.getByText('Inspect genome & recipe', { exact: true }).click();
  await page.screenshot({
    path: `artifacts/social-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Manufacture blueprint' }).click();
  await page.getByRole('button', { name: 'Keep experimenting' }).click();
  await page.reload();
  await expect(page.getByText('VISITING SPECIMEN', { exact: true })).toBeVisible();
  expect(
    (await page.evaluate(() => JSON.parse(localStorage.getItem('monster-workshop.save')).data))
      .creatures,
  ).toHaveLength(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('market purchases and crafting persist; NPC delivery frees habitat and keeps journal', async ({
  page,
}) => {
  const { w } = fullResearchWorkshop();
  await page.goto('/#settings');
  await page.getByLabel('Import save', { exact: true }).setInputFiles({
    name: 'market.json',
    mimeType: 'application/json',
    buffer: Buffer.from(w.exportSave()),
  });
  await expect(page.getByRole('status')).toContainText('imported');
  await page.getByRole('link', { name: 'Marketplace', exact: true }).click();
  await page.getByRole('combobox', { name: 'Market supply' }).selectOption('buy-fiber');
  await page.getByRole('button', { name: 'Buy supply' }).click();
  await page.getByRole('button', { name: 'Craft sample' }).click();
  await page.screenshot({
    path: `artifacts/market-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Deliver creature' }).click();
  await expect(page.getByText('REQUEST #2', { exact: true })).toBeVisible();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('monster-workshop.save')).data,
  );
  expect(saved.sales).toHaveLength(1);
  expect(saved.experiments).toHaveLength(w.state.experiments.length);
  await page.reload();
  await expect(page.getByText('REQUEST #2', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Creatures', exact: true }).click();
  await expect(page.locator('.creature-card')).toHaveCount(w.creatures.length - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('challenge arena starts a modifier tower battle and retreat preserves the floor', async ({
  page,
}) => {
  const { w } = fullResearchWorkshop();
  await page.goto('/#settings');
  await page.getByLabel('Import save', { exact: true }).setInputFiles({
    name: 'arena.json',
    mimeType: 'application/json',
    buffer: Buffer.from(w.exportSave()),
  });
  await expect(page.getByRole('status')).toContainText('imported');
  await page.getByRole('link', { name: 'Battle', exact: true }).click();
  await page.getByRole('link', { name: 'Challenge arena', exact: true }).click();
  await page.getByRole('combobox', { name: 'Challenge modifier' }).selectOption('armored');
  await page.screenshot({
    path: `artifacts/challenges-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Enter tower floor 1' }).click();
  await expect(page.locator('.fight-card')).toHaveCount(6);
  await page.reload();
  await page.getByRole('button', { name: 'Retreat safely' }).click();
  await page.getByRole('button', { name: 'Return to habitat' }).click();
  expect(
    (await page.evaluate(() => JSON.parse(localStorage.getItem('monster-workshop.save')).data))
      .towerFloor,
  ).toBe(1);
});
test('breeding creates inherited offspring and reload preserves family and cooldown', async ({
  page,
}) => {
  const { w } = fullResearchWorkshop();
  const job = w.startExpedition('green-meadow', 'creature-1', '2026-10-03T00:00:00Z');
  for (let i = 0; i < 20; i++) w.advanceExpeditions(1000);
  w.claimExpedition(job.id);
  await page.goto('/#settings');
  await page.getByLabel('Import save', { exact: true }).setInputFiles({
    name: 'family.json',
    mimeType: 'application/json',
    buffer: Buffer.from(w.exportSave()),
  });
  await expect(page.getByRole('status')).toContainText('imported');
  await page.getByRole('link', { name: 'Creatures', exact: true }).click();
  await page.getByRole('link', { name: 'Breeding nursery', exact: true }).click();
  await page.getByRole('combobox', { name: 'Parent A' }).selectOption('creature-1');
  await page.getByRole('combobox', { name: 'Parent B' }).selectOption('creature-2');
  await page.getByRole('button', { name: 'Create offspring' }).click();
  await page.getByRole('button', { name: 'Keep experimenting' }).click();
  await expect(page.getByRole('button', { name: 'Create offspring' })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Family album' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `artifacts/breeding-${test.info().project.name}.png`,
    fullPage: true,
  });
  const state = await page.evaluate(
    () => JSON.parse(localStorage.getItem('monster-workshop.save')).data,
  );
  expect(state.births).toHaveLength(1);
  expect(state.creatures.at(-1).lineage.generation).toBe(2);
});
test('research spends gathered materials, progressively reveals samples and unlocks new anatomy', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto('/');
  for (const part of ['Spider Legs', 'Lightning Organ', 'Crystal Armor'])
    await page.getByRole('button', { name: part }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Manufacture creature' }).click();
    await page.getByRole('button', { name: 'Skip sequence' }).click();
    await page.getByRole('button', { name: 'Keep experimenting' }).click();
  }
  async function gather(region, ms) {
    await page.getByRole('link', { name: 'Explore', exact: true }).click();
    await page.getByRole('button', { name: region }).click();
    await page.getByRole('combobox', { name: 'Expedition creature' }).selectOption('creature-1');
    await page.getByRole('button', { name: 'Send on expedition' }).click();
    await page.clock.runFor(ms + 2000);
    await page.getByRole('button', { name: 'Collect expedition' }).click();
  }
  await gather('Green Meadow', 20000);
  await page.getByRole('link', { name: 'Research', exact: true }).click();
  await page
    .getByRole('button', { name: 'Research Basic Biological Scanner', exact: true })
    .click();
  for (const component of ['dragon-head', 'wolf-body', 'lightning-organ']) {
    await page.getByRole('combobox', { name: 'Scanner component' }).selectOption(component);
    await page.getByRole('button', { name: 'Scan component', exact: true }).click();
  }
  await expect(page.locator('.hidden-properties')).toContainText('4 hidden');
  await expect(page.getByRole('heading', { name: 'Gene biases' })).toHaveCount(0);
  for (let i = 0; i < 3; i++) await gather('Green Meadow', 20000);
  await page.getByRole('link', { name: 'Research', exact: true }).click();
  await page.getByRole('button', { name: 'Research Botanical Anatomy', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Verdant Dragon Head', exact: true }),
  ).toBeVisible();
  await gather('Crystal Caves', 40000);
  await page.getByRole('link', { name: 'Research', exact: true }).click();
  await page.getByRole('button', { name: 'Research Resonance Scanner', exact: true }).click();
  await page.getByRole('button', { name: 'Upgrade analysis', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gene biases' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Mutation potential', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.hidden-properties')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Gene biases' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Scanner component' }).selectOption('lightning-organ');
  await expect(page.getByRole('heading', { name: 'Gene biases' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `artifacts/research-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page
    .locator('.component-scanner')
    .screenshot({ path: `artifacts/scanner-${test.info().project.name}.png` });
  await page.getByRole('link', { name: 'Workshop', exact: true }).click();
  await page.getByRole('button', { name: 'Verdant Dragon Head' }).click();
  await expect(page.locator('.part.selected[data-part="dragon-head"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Manufacture creature' }).click();
  await page.getByRole('button', { name: 'Skip sequence' }).click();
  await page.getByRole('button', { name: 'Meet your creature' }).click();
  const state = await page.evaluate(
    () => JSON.parse(localStorage.getItem('monster-workshop.save')).data,
  );
  expect(state.creatures[3].componentIds).toContain('verdant-head');
  expect(state.scans).toHaveLength(3);
  expect(state.completedResearch).toHaveLength(3);
  expect(errors).toEqual([]);
});
test('researched mutation guidance enforces biology and pays for a guaranteed discovered mutation', async ({
  page,
}) => {
  const { w } = fullResearchWorkshop();
  await page.goto('/');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Import save', { exact: true }).setInputFiles({
    name: 'progress.json',
    mimeType: 'application/json',
    buffer: Buffer.from(w.exportSave()),
  });
  await expect(page.getByRole('status')).toContainText('Workshop imported');
  await page.getByRole('link', { name: 'Workshop', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Mutation guidance' })
    .selectOption('electrical-overgrowth');
  await expect(page.getByRole('button', { name: 'Manufacture creature' })).toBeDisabled();
  await expect(page.getByText('Needs electric biology.', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Verdant Dragon Head' }).click();
  await page.getByRole('button', { name: 'Prism Organ' }).click();
  await expect(page.getByRole('button', { name: 'Manufacture creature' })).toBeEnabled();
  await page.getByRole('button', { name: 'Manufacture creature' }).click();
  await page.getByRole('button', { name: 'Skip sequence' }).click();
  await expect(page.getByRole('dialog')).toContainText('Electrical Overgrowth');
  await page
    .getByRole('dialog')
    .screenshot({ path: `artifacts/research-creature-${test.info().project.name}.png` });
  await page.getByRole('button', { name: 'Meet your creature' }).click();
  const state = await page.evaluate(
    () => JSON.parse(localStorage.getItem('monster-workshop.save')).data,
  );
  expect(state.creatures.at(-1).mutationIds).toContain('electrical-overgrowth');
  expect(state.experiments.at(-1).controlledMutation).toBe('electrical-overgrowth');
  expect(state.resources.crystal).toBe(w.state.resources.crystal - 2);
});
test('expedition survives reload, gathers resources, unlocks a component and supports a specialist build', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Spider Legs' }).click();
  await page.getByRole('button', { name: 'Manufacture creature' }).click();
  await page.getByRole('button', { name: 'Skip sequence' }).click();
  await page.getByRole('button', { name: 'Keep experimenting' }).click();
  await page.getByRole('link', { name: 'Explore', exact: true }).click();
  await page.getByRole('combobox', { name: 'Expedition creature' }).selectOption('creature-1');
  await page.getByRole('button', { name: 'Send on expedition' }).click();
  await expect(page.getByRole('button', { name: 'Collect expedition' })).toBeDisabled();
  await page.clock.runFor(5000);
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem('monster-workshop.save')).data.expeditions[0],
  );
  expect(before.elapsedMs).toBeGreaterThanOrEqual(4000);
  await page.clock.setSystemTime(new Date('2099-01-01T00:00:00Z'));
  await page.reload();
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem('monster-workshop.save')).data.expeditions[0],
  );
  expect(after.elapsedMs).toBe(before.elapsedMs);
  await page.clock.runFor(17000);
  await expect(page.getByRole('button', { name: 'Collect expedition' })).toBeEnabled();
  await page.getByRole('button', { name: 'Collect expedition' }).click();
  await expect(page.getByRole('status')).toContainText('Herbal Organ');
  await expect(page.getByRole('button', { name: 'Collect expedition' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Crystal Caves' }).click();
  await page.getByRole('combobox', { name: 'Expedition creature' }).selectOption('creature-1');
  await page.getByRole('button', { name: 'Send on expedition' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `artifacts/exploration-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Recall creature' }).click();
  await page.getByRole('link', { name: 'Workshop', exact: true }).click();
  await page.getByRole('button', { name: 'Lightning Organ' }).click();
  await page.getByRole('button', { name: 'Herbal Organ' }).click();
  await expect(page.locator('.part.selected[data-part="lightning-organ"]')).toHaveCount(0);
  await expect(page.locator('[data-slot="organ"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Manufacture creature' }).click();
  await page.getByRole('button', { name: 'Skip sequence' }).click();
  await page.getByRole('button', { name: 'Meet your creature' }).click();
  const state = await page.evaluate(
    () => JSON.parse(localStorage.getItem('monster-workshop.save')).data,
  );
  expect(state.creatures[1].componentIds).toContain('herbal-organ');
  expect(state.resources.fiber).toBeGreaterThanOrEqual(3);
  expect(state.expeditionReports).toHaveLength(2);
  expect(errors).toEqual([]);
});
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
  await expect(page.locator('[data-part="storm-wings"]')).toBeDisabled();
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
