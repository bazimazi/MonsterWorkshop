import type { ContentIndex } from './catalog.js';
import type { Creature, CreatureSource, Gene, Genome } from './model.js';
import { GENES, SLOTS } from './model.js';
import { deriveCreature, generateCreature } from './generator.js';
import type { GenerationOptions } from './generator.js';
import { clamp, hash, Random } from './random.js';
import { DomainError } from './validation.js';

export interface Birth {
  childId: string;
  parents: [CreatureSource, CreatureSource];
}
export function inheritGene(
  a: Gene,
  b: Gene,
  random: Random,
  content: ContentIndex,
): { gene: Gene; from: 'a' | 'b' | 'blend' } {
  const rules = content.catalog.rules.breeding;
  const weights = { dominant: 3, hybrid: 2, recessive: 1, unstable: 1 };
  const from =
    random.next() < rules.blendChance
      ? 'blend'
      : random.next() < weights[a.dominance] / (weights[a.dominance] + weights[b.dominance])
        ? 'a'
        : 'b';
  const selected = from === 'a' ? a : b;
  const value = from === 'blend' ? (a.value + b.value) / 2 : selected.value;
  return {
    from,
    gene: {
      value: Math.round(clamp(value + random.integer(-rules.variation, rules.variation), 0, 100)),
      dominance:
        from === 'blend'
          ? a.dominance === 'recessive' && b.dominance === 'recessive'
            ? 'recessive'
            : 'hybrid'
          : selected.dominance,
    },
  };
}
export function breedCreature(
  a: CreatureSource,
  b: CreatureSource,
  content: ContentIndex,
  options: GenerationOptions,
): Creature {
  if (a.id === b.id) throw new DomainError('Choose two different parents');
  const random = new Random(hash(`breeding:1:${options.seed}:${a.signature}:${b.signature}`));
  const ids = SLOTS.flatMap((slot) => {
    const choices = [a, b].map((p) =>
      p.componentIds.find((id) => content.component(id).slot === slot),
    );
    const selected = choices[random.integer(0, 1)];
    return selected ? [selected] : [];
  });
  const child = generateCreature(ids, content, options);
  const genome = {} as Genome,
    inheritance = {} as NonNullable<CreatureSource['lineage']>['inheritance'];
  for (const id of GENES) {
    const inherited = inheritGene(a.genome[id], b.genome[id], random, content);
    genome[id] = inherited.gene;
    inheritance[id] = inherited.from;
  }
  const tags = new Set(ids.flatMap((id) => content.component(id).tags));
  const inheritedMutations = [...new Set([...a.mutationIds, ...b.mutationIds])].filter((id) => {
    const rule = content.mutations.get(id)!;
    return (
      rule.requiredTags.every((t) => tags.has(t)) &&
      !rule.excludedTags.some((t) => tags.has(t)) &&
      random.next() < content.catalog.rules.breeding.mutationInheritance
    );
  });
  // Parent genomes already express their inherited mutations. Apply only new natural gene changes.
  for (const id of child.mutationIds.filter(
    (id) => !a.mutationIds.includes(id) && !b.mutationIds.includes(id),
  ))
    for (const gene of GENES)
      genome[gene].value = Math.round(
        clamp(genome[gene].value + (content.mutations.get(id)!.genes[gene] ?? 0), 0, 100),
      );
  child.genome = genome;
  child.mutationIds = [...new Set([...child.mutationIds, ...inheritedMutations])].sort();
  child.signature = hash(
    `offspring:1:${options.seed}:${a.signature}:${b.signature}:${ids.join('|')}`,
  )
    .toString(16)
    .padStart(8, '0');
  child.lineage = {
    parentIds: [a.id, b.id],
    parentNames: [a.name, b.name],
    generation: Math.max(a.lineage?.generation ?? 1, b.lineage?.generation ?? 1) + 1,
    inheritance,
  };
  child.name = `${child.name} II`;
  return deriveCreature(child, content);
}
