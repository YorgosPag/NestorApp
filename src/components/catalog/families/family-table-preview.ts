/**
 * @fileoverview **Πρόταση γραμμών του πίνακα καταλόγου** — καθαρή συνάρτηση της οθόνης της οικογένειας (ADR-923 §5.6 · §21 · Φάση 1γ).
 * @module components/catalog/families/family-table-preview
 *
 * 🔑 **Πρόταση γραμμών**: άξονες πρώτα, μετά οι ιδιότητες των επιπέδων ανά ομάδα βιβλιοθήκης με κεφαλίδα — η μορφή
 *    της σελ. 60 του MFP. Αφετηρία, όχι επιβολή: ο άνθρωπος την αλλάζει.
 * 🔑 **Σύνθετες ενδείξεις** (§21.6): ο κανόνας απορρόφησης της κάρτας (`absorbComposites`) — η ένδειξη στη θέση του πρώτου
 *    μέρους της, στην ομάδα εκείνου του μέρους (όπως στον επεξεργαστή προϊόντος), χωρίς τις γραμμές των μερών. Μπαίνει μόνο
 *    όταν **όλα** τα μέρη είναι ιδιότητες των επιπέδων· ομάδα που άδειασε από την απορρόφηση δεν παίρνει κεφαλίδα.
 * ℹ️ Ο **builder** του πίνακα ζει στο `subapps/catalog/table/catalog-table` — κοινός με τον εκδότη (Φάση 5).
 */

import type { CompositeDisplay, FamilyTableRow, VariantScheme } from '@/subapps/catalog/types/family';
import { absorbComposites, type DisplaySlot } from '@/subapps/catalog/values/composite-display';
import type { AttributeGroupRecord, AttributeRecord } from '@/services/catalog/catalog-api.client';
import { compareOrderKeys } from '@/lib/ordering/fractional-index';
import { nextLocalId } from './family-draft';

/** Η ομάδα βιβλιοθήκης μιας θέσης: της ιδιότητας, ή του πρώτου μέρους της ένδειξης. */
function slotGroupId(slot: DisplaySlot, library: ReadonlyMap<string, AttributeRecord>): string | undefined {
  const attributeId = slot.kind === 'attribute' ? slot.attributeId : slot.composite.parts[0]?.attributeId;
  return attributeId === undefined ? undefined : library.get(attributeId)?.groupId;
}

function slotRow(slot: DisplaySlot, id: string): FamilyTableRow {
  return slot.kind === 'composite'
    ? { kind: 'composite', id, compositeId: slot.composite.id, labelOverride: null, merge: 'none' }
    : { kind: 'attribute', id, attributeId: slot.attributeId, labelOverride: null, displayUnitCode: null, axisFilter: null, merge: 'none' };
}

/** Πρόταση γραμμών από το σχήμα: άξονες, και οι ιδιότητες των επιπέδων ανά ομάδα με κεφαλίδα (σύνθετες ενδείξεις απορροφούν τα μέρη τους). */
export function suggestTableRows(
  scheme: VariantScheme,
  library: ReadonlyMap<string, AttributeRecord>,
  groups: readonly AttributeGroupRecord[],
  composites: readonly CompositeDisplay[],
): FamilyTableRow[] {
  const rows: FamilyTableRow[] = [];
  const add = (make: (id: string) => FamilyTableRow) => rows.push(make(nextLocalId('row', rows.map((row) => row.id))));
  for (const axisId of scheme.levels.flatMap((level) => level.axisAttributeIds)) add((id) => ({ kind: 'axis', id, axisAttributeId: axisId }));
  const levelAttributeIds = scheme.levels.flatMap((level) => level.attributeIds).filter((id) => library.has(id));
  const slots = absorbComposites(levelAttributeIds, composites);
  const sortedGroups = [...groups].sort((a, b) => compareOrderKeys(a.orderKey, b.orderKey));
  for (const group of sortedGroups) {
    const members = slots.filter((slot) => slotGroupId(slot, library) === group.id);
    if (members.length === 0) continue;
    add((id) => ({ kind: 'groupHeader', id, labels: group.labels }));
    for (const slot of members) add((id) => slotRow(slot, id));
  }
  return rows;
}
