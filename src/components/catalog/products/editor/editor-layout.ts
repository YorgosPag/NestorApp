/**
 * **Τι δείχνει ο επεξεργαστής σε κάθε επίπεδο** — καθαρό (ADR-923 §5.10.4 Β3).
 *
 * Ιδιότητες του **επιπέδου** και των **προγόνων** (οι δεύτερες γκρι, «ορίζεται στο …»)· οι ιδιότητες των
 * **απογόνων** ζουν στο πλέγμα παραλλαγών, όχι εδώ (Akeneo: τα πεδία παραλλαγής δεν φαίνονται στο μοντέλο).
 * Καρτέλες ανά ομάδα ιδιοτήτων, με τη σειρά της βιβλιοθήκης (`orderKey`)· ιδιότητες με τη σειρά της οικογένειας.
 *
 * @module components/catalog/products/editor/editor-layout
 */

import type { AttributeGroupRecord, AttributeRecord } from '@/services/catalog/catalog-api.client';
import type { CatalogSchemaSnapshot } from '@/subapps/catalog/derived/chain-derived';
import type { CatalogFamilyDefinition, VariantScheme } from '@/subapps/catalog/types/family';
import { attributeOwnerDepth, isAxisOf } from '@/subapps/catalog/values/attribute-levels';
import type { CatalogChannel } from '@/subapps/catalog/vocabulary/channels';

export interface EditorFieldPlan {
  readonly attributeId: string;
  readonly attribute: AttributeRecord;
  readonly requiredChannels: readonly CatalogChannel[];
  readonly isAxis: boolean;
  /** Το βάθος που **κατέχει** την ιδιότητα (≤ του επιπέδου που επεξεργάζεσαι). */
  readonly ownerDepth: number;
}

export interface EditorGroupPlan {
  readonly groupId: string;
  readonly group: AttributeGroupRecord | null;
  readonly fields: readonly EditorFieldPlan[];
}

export function editorGroups(
  family: CatalogFamilyDefinition,
  attributeById: ReadonlyMap<string, AttributeRecord>,
  groups: readonly AttributeGroupRecord[],
  scheme: VariantScheme | null,
  depth: number,
): EditorGroupPlan[] {
  const byGroup = new Map<string, EditorFieldPlan[]>();
  for (const binding of family.attributes) {
    const attribute = attributeById.get(binding.attributeId);
    const ownerDepth = attributeOwnerDepth(scheme, binding.attributeId);
    if (!attribute || ownerDepth > depth) continue;
    const field = { attributeId: binding.attributeId, attribute, requiredChannels: binding.requiredChannels, isAxis: isAxisOf(scheme, binding.attributeId), ownerDepth };
    byGroup.set(attribute.groupId, [...(byGroup.get(attribute.groupId) ?? []), field]);
  }
  const ordered = [...groups].sort((a, b) => (a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : 0));
  const known = ordered.filter((group) => byGroup.has(group.id)).map((group) => ({ groupId: group.id, group, fields: byGroup.get(group.id) ?? [] }));
  const orphans = [...byGroup.keys()].filter((id) => !ordered.some((group) => group.id === id)).map((id) => ({ groupId: id, group: null, fields: byGroup.get(id) ?? [] }));
  return [...known, ...orphans];
}

/** Η ομάδα (καρτέλα) μιας ιδιότητας — για το «πήγαινε στο πεδίο» από το πάνελ πληρότητας. */
export function groupOfAttribute(plan: readonly EditorGroupPlan[], attributeId: string): string | null {
  return plan.find((group) => group.fields.some((field) => field.attributeId === attributeId))?.groupId ?? null;
}

/**
 * Η πληρότητα που **έχει νόημα** στο επίπεδο: το SKU κρίνεται σε όλη την οικογένεια (δικές + κληρονομημένες)· το
 * **μοντέλο** μόνο στις ιδιότητες που **κατέχει** — τις υπόλοιπες δεν μπορεί καν να τις ορίσει (μετρήθηκε ζωντανά: η
 * ρίζα έδειχνε «λείπει Κωδικός, Μέγεθος…»). Η πληρότητα των παραλλαγών του μοντέλου είναι το `derived.summary`.
 */
export function levelSchema(schema: CatalogSchemaSnapshot, isModel: boolean, depth: number): CatalogSchemaSnapshot {
  if (!isModel) return schema;
  const attributes = schema.family.attributes.filter((binding) => attributeOwnerDepth(schema.scheme, binding.attributeId) === depth);
  return { ...schema, family: { ...schema.family, attributes } };
}
