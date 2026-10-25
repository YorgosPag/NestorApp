/**
 * @fileoverview **Ο πίνακας καταλόγου της οικογένειας: προεπισκόπηση και πρόταση γραμμών** — καθαρές συναρτήσεις
 *   (ADR-923 §5.6 · §21 · Φάση 1γ).
 * @module components/catalog/families/family-table-preview
 *
 * 🔑 **«Ο πίνακας παράγεται, δεν σχεδιάζεται»** (§5.6): στήλες = οι συνδυασμοί των αξόνων του σχήματος, γραμμές = η
 *    δήλωση του `tableSpec`. Η προεπισκόπηση δείχνει τη **δομή** σε δείγμα στηλών (δεν υπάρχουν ακόμη προϊόντα —
 *    Φάση 2): ετικέτες, μονάδες, φίλτρα άξονα, συγχωνεύσεις — ό,τι αποφασίζει ο άνθρωπος εδώ.
 * 🔑 Άξονας μέτρησης δεν απαριθμείται (συνεχές μέγεθος) ⇒ μία δειγματική στήλη με τη μονάδα του.
 * 🔑 **Πρόταση γραμμών**: άξονες πρώτα, μετά οι ιδιότητες των επιπέδων ανά ομάδα βιβλιοθήκης με κεφαλίδα — η μορφή
 *    της σελ. 60 του MFP. Αφετηρία, όχι επιβολή: ο άνθρωπος την αλλάζει.
 */

import type { LocalizedText } from '@/i18n/localized-text';
import { findUnit } from '@/subapps/catalog/measurement/conversion';
import type { MeasurementRegistry } from '@/subapps/catalog/measurement/measurement-registry';
import type {
  CatalogFamilyDefinition,
  FamilyTableRow,
  TableRowMergeMode,
  VariantScheme,
} from '@/subapps/catalog/types/family';
import type { AttributeGroupRecord, AttributeRecord } from '@/services/catalog/catalog-api.client';
import { compareOrderKeys } from '@/lib/ordering/fractional-index';
import { nextLocalId } from './family-draft';

/** Πόσες στήλες δείγματος δείχνει η προεπισκόπηση — οι υπόλοιπες μετριούνται («+N»). */
export const MAX_PREVIEW_COLUMNS = 8;

export interface PreviewWords {
  readonly text: (value: LocalizedText | undefined, fallback?: string) => string;
  readonly yes: string;
  readonly no: string;
  /** Η ετικέτα δείγματος συνεχούς άξονα (μέτρηση). */
  readonly sample: string;
}

export type PreviewRow =
  | { readonly kind: 'groupHeader'; readonly id: string; readonly label: string }
  | { readonly kind: 'axis'; readonly id: string; readonly label: string; readonly cells: readonly string[] }
  | {
      readonly kind: 'attribute';
      readonly id: string;
      readonly label: string;
      readonly unit: string | null;
      readonly filter: string | null;
      readonly merge: TableRowMergeMode;
    };

export interface TablePreview {
  /** Κάθε στήλη = ένας συνδυασμός τιμών αξόνων (axisId → ετικέτα τιμής). */
  readonly columns: readonly ReadonlyMap<string, string>[];
  /** Πόσοι συνδυασμοί δεν χωράνε στο δείγμα. */
  readonly hiddenColumns: number;
  readonly rows: readonly PreviewRow[];
}

function axisValues(axis: AttributeRecord, registry: MeasurementRegistry, words: PreviewWords): string[] {
  if (axis.type === 'select') return axis.config.options.map((option) => words.text(option.labels, option.code));
  if (axis.type === 'boolean') return [words.yes, words.no];
  if (axis.type === 'measurement') {
    const family = registry.get(axis.config.measurementFamilyCode);
    const unit = family ? findUnit(family, axis.config.defaultUnitCode)?.symbol : undefined;
    return [unit ? `${words.sample} ${unit}` : words.sample];
  }
  return [words.sample];
}

function combinations(axes: readonly AttributeRecord[], registry: MeasurementRegistry, words: PreviewWords): Map<string, string>[] {
  return axes.reduce<Map<string, string>[]>(
    (acc, axis) => acc.flatMap((combo) => axisValues(axis, registry, words).map((value) => new Map(combo).set(axis.id, value))),
    [new Map()],
  );
}

function unitOf(attribute: AttributeRecord, displayUnitCode: string | null, registry: MeasurementRegistry): string | null {
  if (attribute.type !== 'measurement') return null;
  const family = registry.get(attribute.config.measurementFamilyCode);
  return family ? findUnit(family, displayUnitCode ?? attribute.config.defaultUnitCode)?.symbol ?? null : null;
}

function filterLabel(row: Extract<FamilyTableRow, { kind: 'attribute' }>, library: ReadonlyMap<string, AttributeRecord>, words: PreviewWords): string | null {
  if (!row.axisFilter) return null;
  const axis = library.get(row.axisFilter.axisAttributeId);
  if (!axis || axis.type !== 'select') return row.axisFilter.optionCode;
  const option = axis.config.options.find((candidate) => candidate.code === row.axisFilter?.optionCode);
  return option ? words.text(option.labels, option.code) : row.axisFilter.optionCode;
}

function previewRow(
  row: FamilyTableRow,
  columns: readonly ReadonlyMap<string, string>[],
  library: ReadonlyMap<string, AttributeRecord>,
  registry: MeasurementRegistry,
  words: PreviewWords,
): PreviewRow | null {
  if (row.kind === 'groupHeader') return { kind: 'groupHeader', id: row.id, label: words.text(row.labels) };
  const attribute = library.get(row.kind === 'axis' ? row.axisAttributeId : row.attributeId);
  if (!attribute) return null;
  const name = words.text(attribute.labels, attribute.code);
  if (row.kind === 'axis') return { kind: 'axis', id: row.id, label: name, cells: columns.map((column) => column.get(attribute.id) ?? '') };
  return {
    kind: 'attribute',
    id: row.id,
    label: row.labelOverride ? words.text(row.labelOverride, name) : name,
    unit: unitOf(attribute, row.displayUnitCode, registry),
    filter: filterLabel(row, library, words),
    merge: row.merge,
  };
}

export function buildTablePreview(
  draft: CatalogFamilyDefinition,
  library: ReadonlyMap<string, AttributeRecord>,
  registry: MeasurementRegistry,
  words: PreviewWords,
): TablePreview | null {
  const spec = draft.tableSpec;
  const scheme = spec ? draft.variantSchemes.find((candidate) => candidate.code === spec.variantSchemeCode) : undefined;
  if (!spec || !scheme) return null;
  const axes = scheme.levels.flatMap((level) => level.axisAttributeIds).flatMap((id) => library.get(id) ?? []);
  const all = combinations(axes, registry, words);
  const columns = all.slice(0, MAX_PREVIEW_COLUMNS);
  const rows = spec.rows.flatMap((row) => previewRow(row, columns, library, registry, words) ?? []);
  return { columns, hiddenColumns: all.length - columns.length, rows };
}

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
