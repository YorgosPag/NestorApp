/**
 * @fileoverview **Πρόταση γραμμών του πίνακα καταλόγου** — καθαρή συνάρτηση της οθόνης της οικογένειας (ADR-923 §5.6 · §21 · Φάση 1γ).
 * @module components/catalog/families/family-table-preview
 *
 * 🔑 **Πρόταση γραμμών**: άξονες πρώτα, μετά οι ιδιότητες των επιπέδων ανά ομάδα βιβλιοθήκης με κεφαλίδα — η μορφή
 *    της σελ. 60 του MFP. Αφετηρία, όχι επιβολή: ο άνθρωπος την αλλάζει.
 * ℹ️ Ο **builder** του πίνακα ζει στο `subapps/catalog/table/catalog-table` — κοινός με τον εκδότη (Φάση 5).
 */

import type { FamilyTableRow, VariantScheme } from '@/subapps/catalog/types/family';
import type { AttributeGroupRecord, AttributeRecord } from '@/services/catalog/catalog-api.client';
import { compareOrderKeys } from '@/lib/ordering/fractional-index';
import { nextLocalId } from './family-draft';

/** Πρόταση γραμμών από το σχήμα: άξονες, και οι ιδιότητες των επιπέδων ανά ομάδα με κεφαλίδα. */
export function suggestTableRows(
  scheme: VariantScheme,
  library: ReadonlyMap<string, AttributeRecord>,
  groups: readonly AttributeGroupRecord[],
): FamilyTableRow[] {
  const rows: FamilyTableRow[] = [];
  const add = (make: (id: string) => FamilyTableRow) => rows.push(make(nextLocalId('row', rows.map((row) => row.id))));
  for (const axisId of scheme.levels.flatMap((level) => level.axisAttributeIds)) add((id) => ({ kind: 'axis', id, axisAttributeId: axisId }));
  const levelAttributes = scheme.levels.flatMap((level) => level.attributeIds).flatMap((id) => library.get(id) ?? []);
  const sortedGroups = [...groups].sort((a, b) => compareOrderKeys(a.orderKey, b.orderKey));
  for (const group of sortedGroups) {
    const members = levelAttributes.filter((attribute) => attribute.groupId === group.id);
    if (members.length === 0) continue;
    add((id) => ({ kind: 'groupHeader', id, labels: group.labels }));
    for (const attribute of members) {
      add((id) => ({ kind: 'attribute', id, attributeId: attribute.id, labelOverride: null, displayUnitCode: null, axisFilter: null, merge: 'none' }));
    }
  }
  return rows;
}
