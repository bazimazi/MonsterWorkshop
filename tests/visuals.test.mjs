import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ContentIndex, decodeCatalog } from '../dist/src/domain/catalog.js';
import { generateCreature } from '../dist/src/domain/generator.js';
import { renderCreature, blend, validateVisuals } from '../dist/src/presentation/creature.js';
const content = new ContentIndex(
  decodeCatalog(JSON.parse(readFileSync('content/catalog.json', 'utf8'))),
);
const c = generateCreature(
  content.catalog.components
    .filter((p) => ['starter', 'battle'].includes(p.discovery))
    .map((p) => p.id),
  content,
  {
    seed: 17,
    createdAt: '2026-10-02T00:00:00Z',
    creator: 'Engineer',
    forceMutation: 'electrical-overgrowth',
  },
);
test('every catalog component has an anchored bounded visual', () => {
  validateVisuals(content);
  const svg = renderCreature(c, content);
  for (const p of content.components.values()) assert(svg.includes(`data-slot="${p.slot}"`));
  assert(svg.includes('electric-spines'));
  assert(!svg.includes('NaN'));
  assert(!svg.includes('undefined'));
  assert(!renderCreature(c, content, false).includes('idle'));
});
test('names are escaped and SVG parts share inherited materials', () => {
  const svg = renderCreature({ ...c, name: '<script>alert("x")</script>' }, content);
  assert(!svg.includes('<script>'));
  assert(svg.includes('&lt;script&gt;'));
  assert.equal(blend('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(blend('#123456', '#abcdef', 0), '#123456');
});
test('discovered alternatives render in their correct slots without losing the shared skeleton', () => {
  for (const part of content.catalog.components.filter((p) => p.discovery === 'expedition')) {
    const ids = ['dragon-head', 'wolf-body'].filter(
      (id) => content.component(id).slot !== part.slot,
    );
    const creature = generateCreature([...ids, part.id], content, {
      seed: 1,
      createdAt: c.createdAt,
      creator: 'Test',
    });
    const svg = renderCreature(creature, content, false);
    assert(svg.includes(`data-slot="${part.slot}"`));
    assert(!svg.includes('undefined'));
    assert(!svg.includes('NaN'));
  }
});
