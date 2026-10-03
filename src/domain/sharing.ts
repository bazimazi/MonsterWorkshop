import type { ContentIndex } from './catalog.js';
import type { CreatureSource } from './model.js';
import { validateAnatomy } from './generator.js';
import { decodeCreature } from './serialization.js';
import { hash } from './random.js';
import { DomainError, list, number, record, string, strings, unique } from './validation.js';
export interface Profile {
  name: string;
  bio: string;
}
export interface Blueprint {
  id: string;
  name: string;
  author: string;
  componentIds: string[];
  controlledMutation: string | null;
}
export interface GalleryEntry {
  id: string;
  source: CreatureSource;
  profile: Profile;
}
export type Share =
  | { kind: 'creature'; profile: Profile; creatures: CreatureSource[] }
  | { kind: 'showcase'; profile: Profile; creatures: CreatureSource[] }
  | { kind: 'blueprint'; blueprint: Blueprint };
export function decodeProfile(raw: unknown): Profile {
  const p = record(raw, 'profile');
  return {
    name: string(p.name, 'profile name', 40).trim(),
    bio: string(p.bio, 'profile biography', 240).trim(),
  };
}
export function blueprintId(b: Omit<Blueprint, 'id'>): string {
  return `blueprint-${hash(JSON.stringify(b)).toString(16)}`;
}
export function decodeBlueprint(raw: unknown, c: ContentIndex): Blueprint {
  const b = record(raw, 'blueprint');
  const componentIds = validateAnatomy(strings(b.componentIds, 'blueprint anatomy', 6), c).map(
    (p) => p.id,
  );
  const controlledMutation =
    b.controlledMutation === null ? null : string(b.controlledMutation, 'blueprint mutation');
  if (controlledMutation && !c.mutations.has(controlledMutation))
    throw new DomainError('Unknown blueprint mutation');
  const source = {
    name: string(b.name, 'blueprint name', 40).trim(),
    author: string(b.author, 'blueprint author', 40).trim(),
    componentIds,
    controlledMutation,
  };
  const id = blueprintId(source);
  if (b.id !== id) throw new DomainError('Blueprint identity does not match its recipe');
  return { id, ...source };
}
export function galleryId(source: CreatureSource): string {
  return `gallery-${hash(JSON.stringify([source.id, source.creator, source.createdAt, source.signature])).toString(16)}`;
}
export function decodeGallery(raw: unknown, c: ContentIndex): GalleryEntry {
  const g = record(raw, 'gallery entry'),
    source = decodeCreature(g.source, c);
  const id = galleryId(source);
  if (g.id !== id) throw new DomainError('Gallery identity does not match its specimen');
  return { id, source, profile: decodeProfile(g.profile) };
}
export function encodeShare(share: Share, c: ContentIndex): string {
  return JSON.stringify(
    { format: 'monster-workshop.share', version: 1, contentVersion: c.catalog.version, ...share },
    null,
    2,
  );
}
export function decodeShare(raw: string, c: ContentIndex): Share {
  if (raw.length > 200000) throw new DomainError('Shared file is too large');
  const s = record(JSON.parse(raw), 'shared design');
  if (s.format !== 'monster-workshop.share')
    throw new DomainError('This is not a Monster Workshop shared design');
  number(s.version, 'sharing version', 1, 1, true);
  number(s.contentVersion, 'shared content version', c.catalog.version, c.catalog.version, true);
  if (s.kind === 'blueprint')
    return { kind: 'blueprint', blueprint: decodeBlueprint(s.blueprint, c) };
  if (s.kind !== 'creature' && s.kind !== 'showcase')
    throw new DomainError('Unknown shared design type');
  const creatures = list(s.creatures, 'shared creatures', s.kind === 'creature' ? 1 : 3).map(
    (source) => decodeCreature(source, c),
  );
  if (!creatures.length) throw new DomainError('Select at least one creature to share');
  unique(creatures.map(galleryId), 'shared specimens');
  return { kind: s.kind, profile: decodeProfile(s.profile), creatures };
}
