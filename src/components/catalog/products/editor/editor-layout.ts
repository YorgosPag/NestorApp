/**
 * **Τι δείχνει ο επεξεργαστής σε κάθε επίπεδο** — καθαρό (ADR-923 §5.10.4 Β3).
 *
 * Ιδιότητες του **επιπέδου** και των **προγόνων** (οι δεύτερες γκρι, «ορίζεται στο …»)· οι ιδιότητες των
 * **απογόνων** ζουν στο πλέγμα παραλλαγών, όχι εδώ (Akeneo: τα πεδία παραλλαγής δεν φαίνονται στο μοντέλο).
 * Καρτέλες ανά ομάδα ιδιοτήτων, με τη σειρά της βιβλιοθήκης (`orderKey`)· ιδιότητες με τη σειρά της οικογένειας.
 * **Σύνθετες ενδείξεις** (§21.6) μόνο-ανάγνωσης στην ομάδα του **πρώτου μέρους** τους (Revit: το «Electrical Data» στην
 * ομάδα του), και **μόνο** στο επίπεδο όπου φαίνονται **όλα** τα μέρη — αλλιώς θα έδειχνε πάντα «κενό» για τιμή που
 * ορίζεται σε παραλλαγή.
 *
 * @module components/catalog/products/editor/editor-layout
 */

import type { AttributeGroupRecord, AttributeRecord } from '@/services/catalog/catalog-api.client';
import type { CatalogSchemaSnapshot } from '@/subapps/catalog/derived/chain-derived';
import { compositeDisplaysOf, type CatalogFamilyDefinition, type CompositeDisplay, type VariantScheme } from '@/subapps/catalog/types/family';
import { attributeOwnerDepth, isAxisOf } from '@/subapps/catalog/values/attribute-levels';
import type { CatalogChannel } from '@/subapps/catalog/vocabulary/channels';

/** Η ιδιότητα ενός ευρήματος πεδίου (`values.<id>…` · `noValueReasons.<id>`) — `null` για ό,τι δεν είναι πεδίο. */
export function attributeIdOfIssuePath(path: string): string | null {
  return /^(?:values|noValueReasons)\.([^.[]+)/.exec(path)?.[1] ?? null;
}

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
  /** Οι σύνθετες ενδείξεις που ζουν σε αυτή την καρτέλα, μετά τα πεδία της. */
  readonly composites: readonly CompositeDisplay[];
}

/** Ομάδα → οι ενδείξεις της: εκείνες με **όλα** τα μέρη ορατά, στην ομάδα του πρώτου μέρους. */
function compositesByGroup(
  family: CatalogFamilyDefinition,
  attributeById: ReadonlyMap<string, AttributeRecord>,
  visible: ReadonlySet<string>,
): ReadonlyMap<string, CompositeDisplay[]> {
  const byGroup = new Map<string, CompositeDisplay[]>();
  for (const composite of compositeDisplaysOf(family)) {
    if (!composite.parts.every((part) => visible.has(part.attributeId))) continue;
    const groupId = attributeById.get(composite.parts[0]?.attributeId ?? '')?.groupId;
    if (groupId !== undefined) byGroup.set(groupId, [...(byGroup.get(groupId) ?? []), composite]);
  }
  return byGroup;
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
  const visible = new Set([...byGroup.values()].flat().map((field) => field.attributeId));
  const composites = compositesByGroup(family, attributeById, visible);
  const plan = (groupId: string, group: AttributeGroupRecord | null): EditorGroupPlan =>
    ({ groupId, group, fields: byGroup.get(groupId) ?? [], composites: composites.get(groupId) ?? [] });
  const ordered = [...groups].sort((a, b) => (a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : 0));
  const known = ordered.filter((group) => byGroup.has(group.id)).map((group) => plan(group.id, group));
  const orphans = [...byGroup.keys()].filter((id) => !ordered.some((group) => group.id === id)).map((id) => plan(id, null));
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
