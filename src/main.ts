import { logger } from './platform/services.js';
import { loadJson } from './platform/content.js';
import { decodeCatalog, ContentIndex } from './domain/catalog.js';
const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing application root');
try {
  const content = new ContentIndex(decodeCatalog(await loadJson('./content/catalog.json')));
  root.innerHTML = `<main class="shell"><p class="eyebrow">MONSTER WORKSHOP</p><h1>A little science.<br>A little strange.</h1><p>${content.components.size} biological components cataloged. The creature domain is ready.</p></main>`;
  logger.info('Workshop initialized');
} catch (error) {
  logger.error(error);
  root.textContent = 'The workshop could not start. Reload to retry.';
}
