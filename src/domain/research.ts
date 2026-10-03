import type { ContentIndex } from './catalog.js';
import type { Component, Cost, Element, ResearchNode, Trait } from './model.js';
import { DomainError, date, number, record, string } from './validation.js';

export interface Scan {
  componentId: string;
  level: 1 | 2;
  scannedAt: string;
}
export interface ResearchProgress {
  completedResearch: string[];
  scans: Scan[];
  experimentCount: number;
  discoveredMutations: string[];
  completedRegions: string[];
  biomass: number;
  resources: Record<string, number>;
}
export interface ComponentAnalysis {
  name: string;
  element: Element;
  tags: string[];
  hidden: number;
  genes?: Component['genes'];
  compatibleTags?: string[];
  conflictTags?: string[];
  traits?: Trait[];
  mutationChance?: number;
}
export function scannerLevel(completed: string[], content: ContentIndex): number {
  return Math.max(
    0,
    ...completed.map((id) => {
      const unlock = content.research.get(id)?.unlock;
      return unlock?.type === 'scanner' ? unlock.level : 0;
    }),
  );
}
export function hasResearch(
  completed: string[],
  type: 'mutation-analysis' | 'mutation-control',
  content: ContentIndex,
): boolean {
  return completed.some((id) => content.research.get(id)?.unlock.type === type);
}
export function costRequirements(
  cost: Cost,
  biomass: number,
  resources: Record<string, number>,
  content: ContentIndex,
): string[] {
  const reasons = biomass < cost.biomass ? [`Needs ${cost.biomass} biomass.`] : [];
  for (const [id, quantity] of Object.entries(cost.resources))
    if ((resources[id] ?? 0) < quantity)
      reasons.push(`Needs ${quantity} ${content.resources.get(id)!.name}.`);
  return reasons;
}
export function researchRequirements(
  node: ResearchNode,
  progress: ResearchProgress,
  content: ContentIndex,
  includeCost = true,
): string[] {
  if (progress.completedResearch.includes(node.id)) return ['Already researched.'];
  const reasons = node.prerequisites
    .filter((id) => !progress.completedResearch.includes(id))
    .map((id) => `Research ${content.research.get(id)!.name} first.`);
  for (const region of node.objectives.regions)
    if (!progress.completedRegions.includes(region))
      reasons.push(`Complete ${content.region(region).name}.`);
  const counts = {
    experiments: progress.experimentCount,
    scans: progress.scans.length,
    advancedScans: progress.scans.filter((s) => s.level === 2).length,
    mutations: progress.discoveredMutations.length,
  };
  const labels = {
    experiments: 'experiments',
    scans: 'component scans',
    advancedScans: 'advanced scans',
    mutations: 'mutation discoveries',
  };
  for (const key of ['experiments', 'scans', 'advancedScans', 'mutations'] as const)
    if (counts[key] < node.objectives[key])
      reasons.push(`${counts[key]} / ${node.objectives[key]} ${labels[key]}.`);
  if (includeCost)
    reasons.push(...costRequirements(node.cost, progress.biomass, progress.resources, content));
  return reasons;
}
export function decodeScan(value: unknown, content: ContentIndex): Scan {
  const scan = record(value, 'scan');
  const componentId = content.component(string(scan.componentId, 'scanned component')).id;
  const level = number(scan.level, 'scan level', 1, 2, true) as 1 | 2;
  return { componentId, level, scannedAt: date(scan.scannedAt, 'scan date') };
}
// Projection deliberately omits unrevealed biology; presentation cannot accidentally print it.
export function componentAnalysis(
  id: string,
  level: number,
  content: ContentIndex,
): ComponentAnalysis {
  number(level, 'analysis level', 0, 2, true);
  const part = content.component(id);
  if (level === 0) return { name: part.name, element: part.element, tags: [], hidden: 5 };
  const basic = { name: part.name, element: part.element, tags: part.tags.slice(0, 2), hidden: 4 };
  if (level === 1) return basic;
  return structuredClone({
    ...basic,
    tags: part.tags,
    hidden: 0,
    genes: part.genes,
    compatibleTags: part.compatibleTags,
    conflictTags: part.conflictTags,
    traits: part.traits.map((id) => content.traits.get(id)!),
    mutationChance: part.mutationChance,
  });
}
export function researchNode(id: string, content: ContentIndex): ResearchNode {
  const node = content.research.get(id);
  if (!node) throw new DomainError(`Unknown research: ${id}`);
  return node;
}
export function mutationConditions(
  ids: string[],
  mutationId: string,
  content: ContentIndex,
): string[] {
  const mutation = content.mutations.get(mutationId);
  if (!mutation) throw new DomainError('Unknown mutation');
  const tags = new Set(ids.flatMap((id) => content.component(id).tags));
  const reasons = mutation.requiredTags
    .filter((tag) => !tags.has(tag))
    .map((tag) => `Needs ${tag} biology.`);
  for (const tag of mutation.excludedTags)
    if (tags.has(tag)) reasons.push(`Cannot use ${tag} biology.`);
  return reasons;
}
