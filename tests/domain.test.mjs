import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ContentIndex, decodeCatalog } from '../dist/src/domain/catalog.js';
import { GENES } from '../dist/src/domain/model.js';
import { decodeGenome, decodeCreature, serializeCreature, deserializeCreature } from '../dist/src/domain/serialization.js';
const raw = JSON.parse(readFileSync('content/catalog.json', 'utf8'));
export const content = new ContentIndex(decodeCatalog(raw));
export function source() { return { id:'c-1',signature:'abc',generationVersion:1,seed:1,componentIds:['dragon-head','wolf-body'],genome:Object.fromEntries(GENES.map(id=>[id,{value:50,dominance:'hybrid'}])),mutationIds:[],name:'Emberfang',experience:0,level:1,training:{},equipment:[],createdAt:'2026-10-02T00:00:00.000Z',creator:'Engineer',history:{battles:0,victories:0,discoveries:0,firstBattleAt:null} }; }
test('catalog covers components, genes, traits, abilities and mutations', () => {
  assert.equal(content.components.size, 6); assert.equal(content.mutations.size, 1);
  assert.equal(content.ability('strike').cost, 0); assert.throws(()=>content.component('missing'));
  assert.equal(content.component('storm-wings').discovery, 'battle');
});
test('catalog rejects invalid references, duplicate IDs, effects, slots, costs, visuals and rules', () => {
  for (const change of [c=>c.components.push(c.components[0]),c=>c.components[0].slot='mouth',c=>c.components[0].abilities=['missing'],c=>c.components[0].energyCost=-1,c=>c.components[0].visual.color='bad',c=>c.abilities[0].effects[0].type='oops',c=>c.mutations[0].traits=['unknown'],c=>c.rules.generation.qualityBands.reverse(),c=>c.rules.combat.opponents.pop()]) {
    const catalog = structuredClone(raw); change(catalog); assert.throws(()=>decodeCatalog(catalog));
  }
});
test('creature source serialization preserves provenance and drops derived imports', () => {
  const c = source(); assert.deepEqual(deserializeCreature(serializeCreature(c, content), content), c);
  assert.equal(decodeCreature({...c, stats:{attack:99999}}, content).stats, undefined);
});
test('genome validates every gene, bounds and dominance', () => {
  const genome=source().genome; assert.deepEqual(decodeGenome(genome),genome);
  for (const change of [g=>delete g.strength,g=>g.speed.value=-1,g=>g.stability.value=NaN,g=>g.element.value=101,g=>g.mutation.dominance='oops']) { const g=structuredClone(genome);change(g);assert.throws(()=>decodeGenome(g)); }
});
test('serialization rejects invalid anatomy, mutations, history, versions and metadata', () => {
  for (const change of [c=>c.componentIds=['dragon-head'],c=>c.componentIds.push('dragon-head'),c=>c.mutationIds=['missing'],c=>c.generationVersion=2,c=>c.level=101,c=>c.history.victories=1,c=>c.createdAt='yesterday',c=>c.name='']) { const c=source();change(c);assert.throws(()=>decodeCreature(c,content)); }
});
