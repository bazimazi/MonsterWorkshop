import { logger } from './platform/services.js';
import { loadJson } from './platform/content.js';
import { decodeCatalog, ContentIndex } from './domain/catalog.js';
import { generateCreature } from './domain/generator.js';
const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing application root');
try {
  const content = new ContentIndex(decodeCatalog(await loadJson('./content/catalog.json')));
  const creature = generateCreature(content.catalog.components.filter(p => p.discovery === 'starter').map(p => p.id), content, { seed: 1742, createdAt: '2026-10-02T00:00:00.000Z', creator: 'Engineer' });
  root.innerHTML = `<main class="shell"><p class="eyebrow">MONSTER WORKSHOP</p><h1>A little science.<br>A little strange.</h1><p>Generated ${creature.name} · ${creature.compatibility.tier} · ${creature.stats.hp} HP</p></main>`;
  logger.info('Workshop initialized');
} catch (error) {
  logger.error(error);
  root.textContent = 'The workshop could not start. Reload to retry.';
}
