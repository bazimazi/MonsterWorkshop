import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ContentIndex, decodeCatalog } from '../../dist/src/domain/catalog.js';
import { componentAnalysis, hasResearch, scannerLevel } from '../../dist/src/domain/research.js';
import { chooseAction } from '../../dist/src/domain/combat.js';
import { Workshop } from '../../dist/src/application/workshop.js';
import { stateCodec } from '../../dist/src/application/state.js';
import { SaveRepository } from '../../dist/src/platform/save.js';
import { LocalAnalytics } from '../../dist/src/platform/services.js';
const raw = JSON.parse(readFileSync('content/catalog.json', 'utf8'));
const content = new ContentIndex(decodeCatalog(raw));
const at = '2026-10-03T00:00:00Z',
  base = ['dragon-head', 'wolf-body'];
function fixture() {
  const values = new Map();
  let failed = false;
  const repo = new SaveRepository(
    {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => {
        if (failed) throw new Error('quota');
        values.set(k, v);
      },
    },
    stateCodec(content),
  );
  const analytics = new LocalAnalytics();
  return {
    w: new Workshop(content, repo, analytics, 42),
    repo,
    analytics,
    fail: () => {
      failed = true;
    },
  };
}
function gather(w, region, id) {
  const job = w.startExpedition(region, id, at);
  for (let i = 0; i < content.region(region).durationMs / 1000; i++) w.advanceExpeditions(1000);
  return w.claimExpedition(job.id);
}
export function fullResearchWorkshop() {
  const f = fixture(),
    w = f.w;
  const starter = content.catalog.components
    .filter((p) => p.discovery === 'starter')
    .map((p) => p.id);
  const ids = Array.from({ length: 3 }, () => w.manufacture(starter, at).id);
  let battle = w.startBattle(ids, at);
  while (battle.status === 'active') battle = w.battleAction(chooseAction(battle, content));
  assert(w.claimBattle().victory);
  for (let i = 0; i < 4; i++) gather(w, 'green-meadow', ids[0]);
  w.completeResearch('basic-scanner');
  for (const id of [...base, 'lightning-organ']) w.scanComponent(id, at);
  w.completeResearch('botanical-anatomy');
  for (let i = 0; i < 7; i++) gather(w, 'crystal-caves', ids[0]);
  w.completeResearch('advanced-scanner');
  for (const id of [...base, 'lightning-organ']) w.scanComponent(id, at);
  w.manufacture(['verdant-head', 'wolf-body', 'lightning-organ'], at);
  w.completeResearch('crystalline-anatomy');
  w.completeResearch('mutation-atlas');
  const flyer = w.manufacture([...starter, 'storm-wings'], at);
  gather(w, 'storm-valley', flyer.id);
  while (w.state.experiments.length < 8) w.manufacture(base, at);
  w.completeResearch('controlled-mutation');
  return f;
}
