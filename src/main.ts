import { logger } from './platform/services.js';
import { loadJson } from './platform/content.js';
const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing application root');
try {
  await loadJson('./content/settings.json');
  root.innerHTML = '<main class="shell"><p class="eyebrow">MONSTER WORKSHOP</p><h1>A little science.<br>A little strange.</h1><p>The workshop foundation is ready.</p></main>';
  logger.info('Workshop initialized');
} catch (error) {
  logger.error(error);
  root.textContent = 'The workshop could not start. Reload to retry.';
}
