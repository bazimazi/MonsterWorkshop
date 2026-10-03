import type { CreatureSource, Genome } from './model.js';
import { GENES, STAT_KEYS } from './model.js';
import type { ContentIndex } from './catalog.js';
import {
  DomainError,
  date,
  member,
  modifiers,
  number,
  record,
  string,
  strings,
  unique,
} from './validation.js';
export function decodeGenome(value: unknown): Genome {
  const genome = record(value, 'genome');
  for (const id of GENES) {
    const gene = record(genome[id], id);
    number(gene.value, id, 0, 100, true);
    member(gene.dominance, ['dominant', 'recessive', 'hybrid', 'unstable'], 'dominance');
  }
  if (Object.keys(genome).length !== GENES.length)
    throw new DomainError('Genome has unknown genes');
  return structuredClone(genome) as Genome;
}
export function decodeCreature(value: unknown, content: ContentIndex): CreatureSource {
  const c = record(value, 'creature');
  string(c.id, 'creature id');
  string(c.signature, 'signature');
  number(
    c.generationVersion,
    'generator version',
    1,
    content.catalog.rules.generation.version,
    true,
  );
  number(c.seed, 'seed', 0, 0xffffffff, true);
  const ids = strings(c.componentIds, 'components', 6);
  unique(ids, 'components');
  const parts = ids.map((id) => content.component(id));
  unique(
    parts.map((p) => p.slot),
    'anatomy slots',
  );
  for (const slot of content.catalog.rules.generation.requiredSlots)
    if (!parts.some((p) => p.slot === slot)) throw new DomainError(`Missing ${slot}`);
  decodeGenome(c.genome);
  const mutations = strings(c.mutationIds, 'mutations');
  unique(mutations, 'mutations');
  for (const id of mutations)
    if (!content.mutations.has(id)) throw new DomainError(`Unknown mutation: ${id}`);
  string(c.name, 'creature name', 40);
  string(c.creator, 'creator', 40);
  date(c.createdAt, 'creation time');
  number(c.experience, 'experience', 0, 1000000, true);
  number(c.level, 'level', 1, 100, true);
  modifiers(c.training, STAT_KEYS, 'training');
  if (strings(c.equipment, 'equipment').length)
    throw new DomainError('Equipment is unavailable in this content version');
  const history = record(c.history, 'history');
  for (const k of ['battles', 'victories', 'discoveries']) number(history[k], k, 0, 1000000, true);
  if ((history.victories as number) > (history.battles as number))
    throw new DomainError('Victories exceed battles');
  if (history.firstBattleAt !== null) date(history.firstBattleAt, 'first battle');
  if (c.lineage !== undefined) {
    const lineage = record(c.lineage, 'lineage');
    const parents = strings(lineage.parentIds, 'parents', 2);
    if (parents.length !== 2 || parents.includes(c.id as string))
      throw new DomainError('Invalid parents');
    unique(parents, 'parents');
    if (strings(lineage.parentNames, 'parent names', 2).length !== 2)
      throw new DomainError('Two parent names required');
    number(lineage.generation, 'lineage generation', 2, 1000000, true);
    const inheritance = record(lineage.inheritance, 'inheritance');
    if (Object.keys(inheritance).length !== GENES.length)
      throw new DomainError('Incomplete inheritance');
    for (const gene of GENES) member(inheritance[gene], ['a', 'b', 'blend'], 'inherited gene');
  }
  // Pick source fields explicitly; derived stats injected into an import are discarded.
  return structuredClone({
    id: c.id,
    signature: c.signature,
    generationVersion: c.generationVersion,
    seed: c.seed,
    componentIds: ids,
    genome: c.genome,
    mutationIds: mutations,
    name: c.name,
    experience: c.experience,
    level: c.level,
    training: c.training,
    equipment: [],
    createdAt: c.createdAt,
    creator: c.creator,
    history: c.history,
    ...(c.lineage === undefined
      ? {}
      : { lineage: c.lineage as NonNullable<CreatureSource['lineage']> }),
  }) as CreatureSource;
}
export function serializeCreature(creature: CreatureSource, content: ContentIndex): string {
  return JSON.stringify(decodeCreature(creature, content));
}
export function deserializeCreature(json: string, content: ContentIndex): CreatureSource {
  return decodeCreature(JSON.parse(json) as unknown, content);
}
