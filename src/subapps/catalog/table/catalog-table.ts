/**
 * =============================================================================
 * Ο ΠΙΝΑΚΑΣ ΚΑΤΑΛΟΓΟΥ — ο ΕΝΑΣ builder για οθόνη και εκδότη (ADR-923 §5.6 · §21 · §5.10.4 Β6 · §5.6.1)
 * =============================================================================
 *
 * 🔑 **«Ο πίνακας παράγεται, δεν σχεδιάζεται»** (§5.6): στήλες = οι συνδυασμοί των αξόνων του σχήματος (ή οι πραγματικές
 *    παραλλαγές), γραμμές = η δήλωση του `tableSpec`. Η προεπισκόπηση της οικογένειας, ο πίνακας του μοντέλου και το
 *    τυπωμένο PDF περνούν από **αυτόν** τον builder: ό,τι δείχνει η οθόνη είναι ό,τι τυπώνεται, από κατασκευή.
 * 🔑 Άξονας μέτρησης δεν απαριθμείται (συνεχές μέγεθος) ⇒ μία δειγματική στήλη με τη μονάδα του.
 * 🔑 **Η συγχώνευση είναι δηλωμένη ανά γραμμή** (§21.4.3): {@link mergeRowCells} είναι ο ένας κανόνας της.
 *
 * Καθαρό, χωρίς I/O: ζούσε στο `components/catalog/families/family-table-preview`, όπου ο διακομιστής δεν μπορούσε να το
 * φτάσει (Φάση 5).
 * @module subapps/catalog/table/catalog-table
 */

import type { LocalizedText } from '@/i18n/localized-text';
import { convertMeasurement, findUnit, toFixedDecimal } from '../measurement/conversion';
import type { MeasurementRegistry } from '../measurement/measurement-registry';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { CatalogFamilyDefinition, FamilyTableRow, TableRowMergeMode, VariantScheme } from '../types/family';
import type { AttributeValue, ValueSlots } from '../types/product';
import { readSlot } from '../values/value-shape';
import { displayAmount, formatAttributeValue, type ValueTextContext } from '../values/value-text-codec';
import type { CatalogChannel } from '../vocabulary/channels';
import type { HumanLanguage } from '@/i18n/languages';

/** Πόσες στήλες δείγματος δείχνει η προεπισκόπηση — οι υπόλοιπες μετριούνται («+N»). */
export const MAX_PREVIEW_COLUMNS = 8;

/** Ιδιότητα με ταυτότητα — ό,τι χρειάζεται ο πίνακας, δομικά (και εγγραφή βάσης και αντίστοιχο στο σύρμα). */
export type TableAttribute = CatalogAttributeDefinition & { readonly id: string };

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
      /** Πραγματικές τιμές ανά στήλη (Β6) — `null` ⇒ δείγμα (προεπισκόπηση οικογένειας). Κενό = «·». */
      readonly cells: readonly string[] | null;
    };

/**
 * **Πραγματικά δεδομένα** για τον ίδιο πίνακα (ADR-923 §5.10.4 Β6): μία στήλη ανά παραλλαγή, με τις ετικέτες των αξόνων
 * της και το κείμενο κάθε ιδιότητας (στη μονάδα προβολής της γραμμής).
 */
export interface RealTableColumn {
  readonly axes: ReadonlyMap<string, string>;
  /** Οι κωδικοί επιλογής των αξόνων (για το φίλτρο γραμμής `axisFilter`). */
  readonly axisCodes: ReadonlyMap<string, string>;
  readonly valueOf: (attributeId: string, displayUnitCode: string | null) => string;
}

export interface TablePreview {
  /** Κάθε στήλη = ένας συνδυασμός τιμών αξόνων (axisId → ετικέτα τιμής). */
  readonly columns: readonly ReadonlyMap<string, string>[];
  /** Πόσοι συνδυασμοί δεν χωράνε στο δείγμα. */
  readonly hiddenColumns: number;
  readonly rows: readonly PreviewRow[];
}

function axisValues(axis: TableAttribute, registry: MeasurementRegistry, words: PreviewWords): string[] {
  if (axis.type === 'select') return axis.config.options.map((option) => words.text(option.labels, option.code));
  if (axis.type === 'boolean') return [words.yes, words.no];
  if (axis.type === 'measurement') {
    const family = registry.get(axis.config.measurementFamilyCode);
    const unit = family ? findUnit(family, axis.config.defaultUnitCode)?.symbol : undefined;
    return [unit ? `${words.sample} ${unit}` : words.sample];
  }
  return [words.sample];
}

function combinations(axes: readonly TableAttribute[], registry: MeasurementRegistry, words: PreviewWords): Map<string, string>[] {
  return axes.reduce<Map<string, string>[]>(
    (acc, axis) => acc.flatMap((combo) => axisValues(axis, registry, words).map((value) => new Map(combo).set(axis.id, value))),
    [new Map()],
  );
}

function unitOf(attribute: TableAttribute, displayUnitCode: string | null, registry: MeasurementRegistry): string | null {
  if (attribute.type !== 'measurement') return null;
  const family = registry.get(attribute.config.measurementFamilyCode);
  return family ? findUnit(family, displayUnitCode ?? attribute.config.defaultUnitCode)?.symbol ?? null : null;
}

function filterLabel(row: Extract<FamilyTableRow, { kind: 'attribute' }>, library: ReadonlyMap<string, TableAttribute>, words: PreviewWords): string | null {
  if (!row.axisFilter) return null;
  const axis = library.get(row.axisFilter.axisAttributeId);
  if (!axis || axis.type !== 'select') return row.axisFilter.optionCode;
  const option = axis.config.options.find((candidate) => candidate.code === row.axisFilter?.optionCode);
  return option ? words.text(option.labels, option.code) : row.axisFilter.optionCode;
}

function realCells(row: Extract<FamilyTableRow, { kind: 'attribute' }>, real: readonly RealTableColumn[] | null): string[] | null {
  if (!real) return null;
  return real.map((column) => {
    const filter = row.axisFilter;
    if (filter && column.axisCodes.get(filter.axisAttributeId) !== filter.optionCode) return '';
    return column.valueOf(row.attributeId, row.displayUnitCode);
  });
}

interface RowContext {
  readonly columns: readonly ReadonlyMap<string, string>[];
  readonly library: ReadonlyMap<string, TableAttribute>;
  readonly registry: MeasurementRegistry;
  readonly words: PreviewWords;
  readonly real: readonly RealTableColumn[] | null;
}

function previewRow(row: FamilyTableRow, ctx: RowContext): PreviewRow | null {
  const { columns, library, registry, words, real } = ctx;
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
    cells: realCells(row, real),
  };
}

export function buildTablePreview(
  draft: CatalogFamilyDefinition,
  library: ReadonlyMap<string, TableAttribute>,
  registry: MeasurementRegistry,
  words: PreviewWords,
  real: readonly RealTableColumn[] | null = null,
): TablePreview | null {
  const spec = draft.tableSpec;
  const scheme = spec ? draft.variantSchemes.find((candidate) => candidate.code === spec.variantSchemeCode) : undefined;
  if (!spec || !scheme) return null;
  const axes = scheme.levels.flatMap((level) => level.axisAttributeIds).flatMap((id) => library.get(id) ?? []);
  // Πραγματικά δεδομένα ⇒ **όλες** οι παραλλαγές (ο πίνακας του φυλλαδίου)· δείγμα ⇒ ως MAX_PREVIEW_COLUMNS.
  const all = real ? real.map((column) => column.axes) : combinations(axes, registry, words);
  const columns = real ? all : all.slice(0, MAX_PREVIEW_COLUMNS);
  const ctx: RowContext = { columns, library, registry, words, real };
  const rows = spec.rows.flatMap((row) => previewRow(row, ctx) ?? []);
  return { columns, hiddenColumns: all.length - columns.length, rows };
}

// ── Συγχώνευση κελιών ──────────────────────────────────────────────────────────

export interface MergedCell {
  readonly text: string;
  readonly span: number;
}

/** Διαδοχικά **ίδια** κελιά ⇒ ένα, με `colSpan` (ο τυπωμένος πίνακας του φυλλαδίου). Κενά δεν συγχωνεύονται. */
export function mergeAdjacent(cells: readonly string[]): MergedCell[] {
  const runs: { text: string; span: number }[] = [];
  for (const cell of cells) {
    const last = runs[runs.length - 1];
    if (last && cell !== '' && last.text === cell) last.span += 1;
    else runs.push({ text: cell, span: 1 });
  }
  return runs;
}

/**
 * Ο **ένας** κανόνας συγχώνευσης μιας γραμμής: `none` ⇒ κανένα (το «3/4″-3/4″» του MFP) · `all` με ίδια όλα ⇒ ένα κελί ·
 * αλλιώς διαδοχικά ίσα. Κοινός για `<table>` της οθόνης και μοντέλο διάταξης του εκδότη.
 */
export function mergeRowCells(merge: TableRowMergeMode, cells: readonly string[]): readonly MergedCell[] {
  if (merge === 'none') return cells.map((text) => ({ text, span: 1 }));
  const allSame = cells.length > 0 && cells.every((cell) => cell === cells[0]);
  return merge === 'all' && allSame ? [{ text: cells[0], span: cells.length }] : mergeAdjacent(cells);
}

// ── Πραγματικό κελί ────────────────────────────────────────────────────────────

type MeasurementAttribute = Extract<TableAttribute, { type: 'measurement' }>;

/** Η μέτρηση στη μονάδα προβολής της γραμμής, **χωρίς** σύμβολο (η μονάδα είναι στην κεφαλίδα). */
function measurementCell(attribute: MeasurementAttribute, value: Extract<AttributeValue, { type: 'measurement' }>, unit: string | null, codec: ValueTextContext): string {
  const target = unit ?? attribute.config.defaultUnitCode;
  if (target === value.unitCode) return displayAmount(value.amount, codec.language);
  const family = codec.registry.get(attribute.config.measurementFamilyCode);
  if (!family) return displayAmount(value.amount, codec.language);
  const converted = convertMeasurement(family, Number(value.amount), value.unitCode, target);
  return displayAmount(toFixedDecimal(converted, attribute.config.decimals), codec.language);
}

function cellText(attribute: TableAttribute | undefined, value: AttributeValue | undefined, unit: string | null, codec: ValueTextContext): string {
  if (!attribute || !value) return '';
  if (attribute.type === 'measurement' && value.type === 'measurement') return measurementCell(attribute, value, unit, codec);
  return formatAttributeValue(attribute, value, codec);
}

export interface TableColumnScope {
  readonly channel: CatalogChannel;
  readonly locale: HumanLanguage;
}

export interface TableColumnInput {
  /** Οι τιμές της παραλλαγής, **συγχωνευμένες** με των προγόνων της (`resolveInheritedValues`). */
  readonly slotsOf: (attributeId: string) => ValueSlots | undefined;
  readonly scheme: VariantScheme | null;
  readonly attributeById: ReadonlyMap<string, TableAttribute>;
  readonly scope: TableColumnScope;
  readonly codec: ValueTextContext;
}

/** Μία στήλη του πίνακα από τις συγχωνευμένες τιμές μιας παραλλαγής — ίδιο για πλέγμα οθόνης και εκδότη. */
export function realTableColumn(input: TableColumnInput): RealTableColumn {
  const { attributeById, scope, codec } = input;
  // Όλοι οι άξονες του σχήματος — όπως ο builder της προεπισκόπησης (μία ταυτότητα στήλης).
  const axisIds = input.scheme?.levels.flatMap((level) => level.axisAttributeIds) ?? [];
  const valueAt = (attributeId: string) => {
    const attribute = attributeById.get(attributeId);
    return attribute ? readSlot(input.slotsOf(attributeId), attribute, scope.channel, scope.locale) : undefined;
  };
  const axes = new Map(axisIds.map((axisId) => [axisId, cellText(attributeById.get(axisId), valueAt(axisId), null, codec)] as const));
  const axisCodes = new Map(axisIds.flatMap((axisId) => { const value = valueAt(axisId); return value?.type === 'select' ? [[axisId, value.optionCode] as const] : []; }));
  return { axes, axisCodes, valueOf: (attributeId, unit) => cellText(attributeById.get(attributeId), valueAt(attributeId), unit, codec) };
}
