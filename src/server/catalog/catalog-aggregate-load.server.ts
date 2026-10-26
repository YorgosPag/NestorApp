import 'server-only';

/**
 * =============================================================================
 * ΦΟΡΤΩΣΗ ΕΝΟΣ ΣΥΝΟΛΟΥ + ΕΦΑΡΜΟΓΗ ΤΩΝ ΑΛΛΑΓΩΝ (ADR-923 §5.10) — μόνο αναγνώσεις
 * =============================================================================
 *
 * Διαβάζει τη ρίζα και **όλους** τους απογόνους της μέσα από το ευρετήριό της (`derived.descendants` — ένα
 * `getAll`, κανένα ερώτημα μέσα στη συναλλαγή), και πάνω τους εφαρμόζει τις αλλαγές του ανθρώπου: CAS ανά μέλος,
 * αμετάβλητα πεδία, στόχοι δημιουργίας, διαγραφή **σε καταρράκτη** (Akeneo: η διαγραφή μοντέλου σβήνει τα παιδιά
 * του). Το αποτέλεσμα είναι το σύνολο με τις δύο όψεις, έτοιμο για την καθαρή κρίση.
 *
 * @module server/catalog/catalog-aggregate-load.server
 */

import {
  cascadeDeletes,
  createdModelMember,
  createdProductMember,
  deletedMember,
  unchangedMember,
  updatedModelMember,
  updatedProductMember,
} from '@/subapps/catalog/aggregate/aggregate-members';
import type { AggregateMember, CatalogAggregate } from '@/subapps/catalog/aggregate/aggregate-model';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { CatalogProductDefinition, CatalogProductModelDefinition, CatalogValueHolderKind } from '@/subapps/catalog/types/product';
import type {
  StoredCatalogProductDefinition,
  StoredCatalogProductModelDefinition,
} from '@/subapps/catalog/types/product-derived';
import { readActiveByIds } from './catalog-library-reads.server';
import {
  assertCodeUnchanged,
  assertRevision,
  readForCreate,
  readForRandomCreate,
  readOwnedOrNull,
  type CatalogTx,
  type CreateTarget,
  type StoredCatalogRecord,
} from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';

export type StoredModel = StoredCatalogRecord<StoredCatalogProductModelDefinition>;
export type StoredProduct = StoredCatalogRecord<StoredCatalogProductDefinition>;
export type StoredMember = { readonly kind: 'productModel'; readonly record: StoredModel } | { readonly kind: 'product'; readonly record: StoredProduct };

/** Μία αλλαγή ανθρώπου πάνω σε μέλος του συνόλου. */
export type HolderChange =
  | { readonly op: 'create'; readonly kind: 'productModel'; readonly definition: CatalogProductModelDefinition }
  | { readonly op: 'create'; readonly kind: 'product'; readonly definition: CatalogProductDefinition; readonly requestedId: string | null }
  | { readonly op: 'update'; readonly kind: 'productModel'; readonly id: string; readonly expectedRevision: number; readonly definition: CatalogProductModelDefinition }
  | { readonly op: 'update'; readonly kind: 'product'; readonly id: string; readonly expectedRevision: number; readonly definition: CatalogProductDefinition }
  | { readonly op: 'delete'; readonly kind: CatalogValueHolderKind; readonly id: string; readonly expectedRevision: number }
  /** Καμία αλλαγή — μόνο «φόρτωσε αυτό το μέλος» (επανυπολογισμός παραγώγων απλού προϊόντος). */
  | { readonly op: 'touch'; readonly kind: CatalogValueHolderKind; readonly id: string };

export interface LoadedAggregate {
  readonly aggregate: CatalogAggregate;
  /** Οι στόχοι των δημιουργιών (id → στόχος). */
  readonly targets: ReadonlyMap<string, CreateTarget>;
  /** Τα αποθηκευμένα μέλη όπως διαβάστηκαν. */
  readonly stored: ReadonlyMap<string, StoredMember>;
}

/** Η ρίζα και οι απόγονοί της, μέσα από το ευρετήριο της ρίζας. */
async function readRootAggregate(scope: CatalogTx, rootId: string): Promise<Map<string, StoredMember>> {
  const root = await readOwnedOrNull<StoredCatalogProductModelDefinition>(scope, 'productModel', rootId);
  const stored = new Map<string, StoredMember>();
  if (!root) return stored;
  stored.set(root.id, { kind: 'productModel', record: root });
  const entries = Object.entries(root.derived?.descendants ?? {});
  const idsOf = (kind: CatalogValueHolderKind) => entries.filter(([, entry]) => entry.kind === kind).map(([id]) => id);
  const models = await readActiveByIds<StoredCatalogProductModelDefinition>(scope, 'productModel', idsOf('productModel'));
  const products = await readActiveByIds<StoredCatalogProductDefinition>(scope, 'product', idsOf('product'));
  models.forEach((record, id) => stored.set(id, { kind: 'productModel', record }));
  products.forEach((record, id) => stored.set(id, { kind: 'product', record }));
  return stored;
}

/** Απλό προϊόν: το σύνολο είναι μόνο του — όσα από τα ids του υπάρχουν και **δεν** ανήκουν σε μοντέλο. */
async function readStandaloneAggregate(scope: CatalogTx, ids: readonly string[]): Promise<Map<string, StoredMember>> {
  const products = await readActiveByIds<StoredCatalogProductDefinition>(scope, 'product', ids);
  const stored = new Map<string, StoredMember>();
  products.forEach((record, id) => {
    if (record.modelId === null) stored.set(id, { kind: 'product', record });
  });
  return stored;
}

const immutable = (field: string): CatalogWriteError =>
  new CatalogWriteError('immutable', [{ code: 'fieldImmutable', path: field, params: { field } } satisfies CatalogIssue]);

function assertModelIdentity(current: StoredModel, next: CatalogProductModelDefinition): void {
  assertCodeUnchanged(current, next.code);
  if (current.familyId !== next.familyId) throw immutable('familyId');
  if (current.variantSchemeCode !== next.variantSchemeCode) throw immutable('variantSchemeCode');
  if (current.parentId !== next.parentId) throw immutable('parentId');
}

function assertProductIdentity(current: StoredProduct, next: CatalogProductDefinition): void {
  if (current.familyId !== next.familyId) throw immutable('familyId');
  if (current.modelId !== next.modelId) throw immutable('modelId');
}

/** Το μέλος που ορίζει μια αλλαγή ενημέρωσης/διαγραφής — υπάρχει, είναι του σωστού είδους, CAS. */
function existingFor(stored: ReadonlyMap<string, StoredMember>, change: Extract<HolderChange, { readonly expectedRevision: number }>): StoredMember {
  const member = stored.get(change.id);
  if (!member || member.kind !== change.kind) throw new CatalogWriteError('notFound', [], { id: change.id });
  assertRevision(member.record, change.expectedRevision);
  return member;
}

// Η συναρμολόγηση μελών ζει στο κοινό `aggregate-members` (ίδια στην οθόνη, Β4)· εδώ μόνο οι ισχυρισμοί.
function updatedMember(member: StoredMember, change: Extract<HolderChange, { readonly op: 'update' }>): AggregateMember {
  if (member.kind === 'productModel' && change.kind === 'productModel') {
    assertModelIdentity(member.record, change.definition);
    return updatedModelMember(member.record, change.definition);
  }
  if (member.kind === 'product' && change.kind === 'product') {
    assertProductIdentity(member.record, change.definition);
    return updatedProductMember(member.record, change.definition);
  }
  throw new CatalogWriteError('notFound', [], { id: change.id });
}

async function createdMember(scope: CatalogTx, change: Extract<HolderChange, { readonly op: 'create' }>) {
  if (change.kind === 'productModel') {
    const target = await readForCreate(scope, 'productModel', change.definition.code);
    return { target, member: createdModelMember(target.id, change.definition, target.previousRevision) };
  }
  const target = await readForRandomCreate(scope, 'product', change.requestedId);
  return { target, member: createdProductMember(target.id, change.definition, target.previousRevision) };
}

/**
 * Διαβάζει το σύνολο και εφαρμόζει τις αλλαγές. `rootId` = η ρίζα (υπάρχουσα ή αυτή που δημιουργείται), ή
 * `null` για απλό προϊόν. Μόνο αναγνώσεις.
 */
export async function loadAggregate(scope: CatalogTx, rootId: string | null, changes: readonly HolderChange[]): Promise<LoadedAggregate> {
  const ids = changes.flatMap((change) => ('id' in change ? [change.id] : []));
  const stored = rootId === null ? await readStandaloneAggregate(scope, ids) : await readRootAggregate(scope, rootId);
  const members = new Map<string, AggregateMember>([...stored.values()].map((member) => [member.record.id, unchangedMember(member)]));
  const targets = new Map<string, CreateTarget>();
  let effectiveRoot = rootId;
  for (const change of changes) {
    if (change.op === 'create') {
      const { target, member } = await createdMember(scope, change);
      if (members.has(target.id)) throw new CatalogWriteError('duplicateCode', [], { code: target.id });
      targets.set(target.id, target);
      members.set(target.id, member);
      if (change.kind === 'productModel' && change.definition.parentId === null) effectiveRoot = target.id;
      continue;
    }
    if (change.op === 'touch') continue;
    const existing = existingFor(stored, change);
    members.set(change.id, change.op === 'update' ? updatedMember(existing, change) : deletedMember(existing));
    if (change.op === 'delete') cascadeDeletes(stored, members, change.id);
  }
  return { aggregate: { rootId: effectiveRoot, members }, targets, stored };
}
