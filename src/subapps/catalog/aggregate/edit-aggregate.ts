/**
 * **Το σύνολο όπως θα είναι μετά τις αλλαγές της οθόνης** — καθαρό (ADR-923 §5.10.4 Β3/Β4).
 *
 * Η οθόνη κρίνει **πριν** στείλει, με την **ίδια** `judgeAggregate` του διακομιστή, πάνω στο **ίδιο** σχήμα συνόλου:
 * αποθηκευμένα μέλη (ζωντανά) + οι αλλαγές του προχείρου, συναρμολογημένα με τα **κοινά** `aggregate-members`. Γνωστό
 * 422 δεν στέλνεται ποτέ (§5.10.2). Ό,τι ξέρει μόνο ο διακομιστής (κρατήσεις μοναδικότητας σε **άλλα** σύνολα,
 * ταυτόχρονες αλλαγές) μένει σε εκείνον — η οθόνη το δείχνει στο κελί όταν επιστρέψει.
 *
 * @module subapps/catalog/aggregate/edit-aggregate
 */

import type { CatalogSchemaSnapshot } from '../derived/chain-derived';
import type { MeasurementRegistry } from '../measurement/measurement-registry';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { CatalogSettingsDefinition } from '../types/catalog-settings';
import type { CatalogFamilyDefinition } from '../types/family';
import type { CatalogProductDefinition, CatalogProductModelDefinition, CatalogReferenceTarget, CatalogValueHolder } from '../types/product';
import { findVariantScheme } from '../values/attribute-levels';
import {
  cascadeDeletes,
  createdProductMember,
  deletedMember,
  unchangedMember,
  updatedModelMember,
  updatedProductMember,
  type StoredMemberShape,
  type StoredModelShape,
  type StoredProductShape,
} from './aggregate-members';
import type { AggregateMember, CatalogAggregate } from './aggregate-model';

/** Ο ορισμός ενός αποθηκευμένου μοντέλου — **χωρίς** μεταδεδομένα και παράγωγα (ό,τι στέλνει ο πελάτης). */
export function modelDefinitionOf(record: StoredModelShape): CatalogProductModelDefinition {
  const { code, familyId, variantSchemeCode, parentId, values, noValueReasons, categoryIds } = record;
  return { code, familyId, variantSchemeCode, parentId, values, noValueReasons, categoryIds };
}

export function productDefinitionOf(record: StoredProductShape): CatalogProductDefinition {
  const { modelId, familyId, values, noValueReasons, categoryIds } = record;
  return { modelId, familyId, values, noValueReasons, categoryIds };
}

export interface AggregateEdits {
  /** id → νέος ορισμός (ίδιου είδους). */
  readonly updates: ReadonlyMap<string, CatalogProductModelDefinition | CatalogProductDefinition>;
  /** Νέα SKU με id γεννημένο στον πελάτη (ADR-866 Β — ο διακομιστής το επαληθεύει). */
  readonly creates: readonly { readonly id: string; readonly definition: CatalogProductDefinition }[];
  readonly deletes: readonly string[];
}

export const NO_EDITS: AggregateEdits = { updates: new Map(), creates: [], deletes: [] };

function editedMember(member: StoredMemberShape, next: CatalogProductModelDefinition | CatalogProductDefinition): AggregateMember {
  if (member.kind === 'productModel' && 'code' in next) return updatedModelMember(member.record, next);
  if (member.kind === 'product' && 'modelId' in next) return updatedProductMember(member.record, next);
  return unchangedMember(member);
}

/** Αποθηκευμένα μέλη + αλλαγές ⇒ το σύνολο προς κρίση. Άγνωστο id στις αλλαγές αγνοείται (το κρίνει ο διακομιστής). */
export function editAggregate(rootId: string | null, stored: readonly StoredMemberShape[], edits: AggregateEdits): CatalogAggregate {
  const byId = new Map(stored.map((member) => [member.record.id, member]));
  const members = new Map<string, AggregateMember>(stored.map((member) => [member.record.id, unchangedMember(member)]));
  for (const [id, definition] of edits.updates) {
    const member = byId.get(id);
    if (member) members.set(id, editedMember(member, definition));
  }
  for (const id of edits.deletes) {
    const member = byId.get(id);
    if (!member) continue;
    members.set(id, deletedMember(member));
    cascadeDeletes(byId, members, id);
  }
  for (const created of edits.creates) members.set(created.id, createdProductMember(created.id, created.definition));
  return { rootId, members };
}

/** Το στιγμιότυπο σχήματος που κρίνει ένα σύνολο — το ίδιο σχήμα με το `readSchemaSnapshot` του διακομιστή. */
export function schemaSnapshotOf(input: {
  readonly family: CatalogFamilyDefinition;
  readonly attributes: ReadonlyMap<string, CatalogAttributeDefinition>;
  readonly registry: MeasurementRegistry;
  readonly settings: CatalogSettingsDefinition;
  readonly variantSchemeCode: string | null;
}): CatalogSchemaSnapshot {
  const scheme = input.variantSchemeCode === null ? null : findVariantScheme(input.family.variantSchemes, input.variantSchemeCode) ?? null;
  return { family: input.family, attributes: input.attributes, registry: input.registry, settings: input.settings, scheme };
}

/** Οι στόχοι αναφορών που αναφέρουν οι φορείς — ό,τι πρέπει να διαβαστεί για τον έλεγχο `targetFamilyCodes`. */
export function referenceTargetsOf(holders: readonly CatalogValueHolder[]): CatalogReferenceTarget[] {
  const seen = new Map<string, CatalogReferenceTarget>();
  for (const holder of holders) {
    for (const slots of Object.values(holder.values)) {
      for (const locales of Object.values(slots)) {
        for (const value of Object.values(locales ?? {})) {
          if (value?.type === 'reference') value.targets.forEach((target) => seen.set(`${target.kind}:${target.id}`, target));
        }
      }
    }
  }
  return [...seen.values()];
}
