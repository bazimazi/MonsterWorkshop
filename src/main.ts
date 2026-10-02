import { logger } from './platform/services.js';
import { loadJson } from './platform/content.js';
import { decodeCatalog, ContentIndex } from './domain/catalog.js';
import { generateCreature } from './domain/generator.js';
import { renderCreature, validateVisuals } from './presentation/creature.js';
import { escape } from './presentation/html.js';
const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing application root');
try {
  const content = new ContentIndex(decodeCatalog(await loadJson('./content/catalog.json')));
  validateVisuals(content);
  const selected = new Set(content.catalog.components.filter(p => p.discovery === 'starter').map(p => p.id));
  const render = (): void => {
    const creature = generateCreature([...selected], content, { seed: 1742, createdAt: '2026-10-02T00:00:00.000Z', creator: 'Engineer', skipMutations: true });
    root.innerHTML = `<main class="shell"><p class="eyebrow">MONSTER WORKSHOP / VISUAL LAB</p><h1>A little science.<br>A little strange.</h1><div class="preview-grid"><section class="panel stage"><div class="stage-label"><span class="tag">LIVE SPECIMEN PREVIEW</span><span class="tag">${creature.compatibility.score}% compatible</span></div>${renderCreature(creature, content)}<h2>${creature.name}</h2><p>${creature.element} · ${creature.quality}</p></section><section class="panel"><h2>Anatomy bench</h2><p class="muted">Swap the parts. See what takes shape.</p><div class="part-list">${content.catalog.components.map(p=>`<button class="part ${selected.has(p.id)?'selected':''}" data-part="${p.id}" aria-pressed="${selected.has(p.id)}" ${p.slot==='head'||p.slot==='body'?'disabled':''}><span>${escape(p.name)}</span><small>${p.slot} · ${p.element}</small></button>`).join('')}</div></section></div></main>`;
    root.querySelectorAll<HTMLButtonElement>('[data-part]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.part!;if(selected.has(id))selected.delete(id);else selected.add(id);render();}));
  };
  render();
  logger.info('Workshop initialized');
} catch (error) {
  logger.error(error);
  root.textContent = 'The workshop could not start. Reload to retry.';
}
