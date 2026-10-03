import type { ContentIndex } from './catalog.js';
import type { Creature, Catalog } from './model.js';
export type Order = Catalog['economy']['orders'][number];
export interface Sale {
  creatureId: string;
  orderSerial: number | null;
  biomass: number;
  resources: Record<string, number>;
}
export function salePrice(c: Creature, content: ContentIndex): number {
  const rules = content.catalog.economy;
  const cost =
    content.catalog.rules.workshop.baseCost +
    c.componentIds.reduce((n, id) => n + content.component(id).energyCost, 0);
  return (
    Math.floor(cost * rules.saleRatio) +
    Math.min(c.level - 1, 10) * rules.levelBonus +
    c.mutationIds.length * rules.mutationBonus
  );
}
export function orderAt(serial: number, content: ContentIndex): Order {
  return content.catalog.economy.orders[(serial - 1) % content.catalog.economy.orders.length]!;
}
export function orderRequirements(
  order: Order,
  c: Creature | undefined,
  content: ContentIndex,
): string[] {
  if (!c) return ['Choose a creature to deliver.'];
  const tags = new Set(c.componentIds.flatMap((id) => content.component(id).tags));
  return [
    ...order.tags.filter((t) => !tags.has(t)).map((t) => `Needs ${t} biology.`),
    ...Object.entries(order.genes)
      .filter(([g, n]) => c.genome[g as keyof typeof c.genome].value < n)
      .map(([g, n]) => `Needs ${n} ${g}.`),
    ...Object.entries(order.minimumStats)
      .filter(([s, n]) => c.stats[s as keyof typeof c.stats] < n)
      .map(([s, n]) => `Needs ${n} ${s}.`),
  ];
}
