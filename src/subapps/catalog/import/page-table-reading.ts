/**
 * Η **ανάγνωση πίνακα από τον διακομιστή** (ADR-923 §5.5.1 Ε1–Ε4): πίνακας + αντιστοίχιση ⇒ `ExtractedGroup`. Το μοντέλο είπε τι σημαίνει
 * κάθε γραμμή· τις τιμές τις διαβάζει αυτό το αρχείο. Καθαρό.
 *
 *   - **Ε1:** τιμή από το κελί, μονάδα από κελί της **ίδιας** γραμμής ή στήλης, μαζί με τις ενώσεις. Το «W» που απλώς υπάρχει στη σελίδα
 *     δεν αποδεικνύει τίποτα. Χωρίς μονάδα της ποσότητας ⇒ `unitCode: null` ⇒ `measurementUnitMissing`.
 *   - **Ε2:** κάθε γραμμή κωδικών μπαίνει υποψήφια στη `unique` ιδιότητα, είτε την αντιστοίχισε το μοντέλο είτε όχι. Κρίνουν τα ζωντανά SKU
 *     (`matchRows` · `settleRepeatedCells`): η ταύτιση δεν περιμένει το μοντέλο.
 *   - **Ε3:** ό,τι δεν είναι πίνακας παραλλαγών μπαίνει στην άκρη δηλωμένα, ποτέ ως πρόταση της οικογένειας.
 *   - **Ε4:** ο άξονας που δεν αντιστοιχίστηκε βγαίνει από γραμμή κωδικών, όταν κάθε κωδικός δείχνει μονοσήμαντα επιλογή.
 *   - **Ε7:** κάθε γραμμή με τιμές που δεν έγινε πεδίο δηλώνεται, με ετικέτα και τιμές: η οικογένεια που δεν έχει την ιδιότητα δεν
 *     σημαίνει ότι η πηγή δεν την τυπώνει.
 * @module subapps/catalog/import/page-table-reading
 */

import { tableCellAt } from '@/lib/pdf-tables/cell-text';
import type { PageTable, PageTableCell } from '@/lib/pdf-tables/page-table-types';
import { normalizeMixedScriptHomoglyphs } from '@/utils/greek-text';
import type { MeasurementRegistry } from '../measurement/measurement-registry';
import type { CatalogAttributeDefinition } from '../types/attribute';
import { MONEY_CURRENCY } from '@/lib/money/money';
import type { ExtractedCell, ExtractedGroup, ExtractedRow, ImportIssue, ImportLineIdentity, ImportPageSetAside, ImportPageUnmappedLine, ImportTarget, PageRegion } from '../types/catalog-import';
import { ANY_SLOT } from '../types/product';
import { parseEnteredAmount } from '../values/decimal-amount';
import { normalizeUniqueText } from '../values/normalize-unique';
import { unitForm } from '../values/value-text-codec';
import { pageTableGroupKey, priceGroupKeyOf } from './import-keys';
import type { PagePriceLine } from './page-line-overrides';
import { lineSiblingOf, type BoundLineOfTable } from './line-sibling';
import { labelPrintsUnit } from './page-tokens';
import { textLayerDoubted, type RawLineMapping, type RawPageMapping, type RawTableMapping, type VariantOrientation } from './page-table-mapping';
import { importTextContextOf, selectOptionFor } from './proposal-values';
import { fragmentFor } from './cell-fragments';

type NamedAttribute = CatalogAttributeDefinition & { readonly id: string };

export interface PageTableContext {
  readonly page: number;
  readonly tables: readonly PageTable[];
  readonly attributesByCode: ReadonlyMap<string, NamedAttribute>;
  readonly registry: MeasurementRegistry;
  readonly axisAttributeIds: readonly string[];
  /** Οι γραμμές τιμής ανά πίνακα, από αποφάσεις ανθρώπου (§5.5.2 Β4). Απούσα = καμία· η πληρωμένη ανάγνωση δεν τις έχει ποτέ. */
  readonly priceLinesByTable?: ReadonlyMap<string, readonly PagePriceLine[]>;
}

export interface PageTableReading {
  readonly groups: readonly ExtractedGroup[];
  readonly setAside: readonly ImportPageSetAside[];
  readonly unmappedLines: readonly ImportPageUnmappedLine[];
  /** Ό,τι δεν στέκει στην αντιστοίχιση, ως ανατροφοδότηση προς το μοντέλο (Ε5). */
  readonly findings: readonly string[];
  /** Η εικόνα διαφωνεί με τη στρώση κειμένου: η σελίδα ξαναδιαβάζεται με όραση. */
  readonly doubted: boolean;
}

/** Στήλη με τουλάχιστον τόσο μερίδιο αριθμών είναι στήλη τιμών. Οι ετικέτες και οι μονάδες δεν πλησιάζουν, οι λίγες μη αριθμητικές γραμμές δεν τη χαλούν. */
const DATA_SLOT_SHARE = 0.4;
/** Πίνακας παραλλαγών με μία ή καμία αντιστοιχισμένη γραμμή δεν έχει διαβαστεί. */
const MIN_MAPPED_LINES = 2;
const MIN_CODE_LENGTH = 3;
const IDENTIFIED_CONFIDENCE = 1;

/** Ο πίνακας με «γραμμές» τις ιδιότητες και «θέσεις» τις παραλλαγές, όπου κι αν είναι τυπωμένες. */
interface TableView {
  readonly lines: number;
  readonly slots: number;
  at(line: number, slot: number): PageTableCell | null;
  spansSlots(cell: PageTableCell): boolean;
}

function viewOf(table: PageTable, mapping: Pick<RawTableMapping, 'variantsIn'>): TableView {
  const columns = mapping.variantsIn === 'columns';
  return {
    lines: columns ? table.rowCount : table.colCount,
    slots: columns ? table.colCount : table.rowCount,
    at: (line, slot) => (columns ? tableCellAt(table, line, slot) : tableCellAt(table, slot, line)),
    spansSlots: (cell) => (columns ? cell.colSpan : cell.rowSpan) > 1,
  };
}

const range = (count: number): number[] => Array.from({ length: count }, (_, index) => index);

const isAmount = (cell: PageTableCell | null, view: TableView): boolean =>
  cell !== null && !view.spansSlots(cell) && parseEnteredAmount(cell.text.trim()) !== null;

function dataSlots(view: TableView): number[] {
  return range(view.slots).filter((slot) => range(view.lines).filter((line) => isAmount(view.at(line, slot), view)).length / view.lines >= DATA_SLOT_SHARE);
}

/** Τα κελιά ετικετών μιας γραμμής: ό,τι δεν είναι θέση τιμής. Ενωμένο κελί μετρά μία φορά. */
function labelCells(view: TableView, line: number, data: readonly number[]): PageTableCell[] {
  const cells = range(view.slots).filter((slot) => !data.includes(slot)).flatMap((slot) => view.at(line, slot) ?? []);
  return [...new Set(cells)].filter((cell) => cell.text !== '');
}

interface PrintedUnit {
  readonly symbol: string;
  readonly cell: PageTableCell;
}

export type UnitDefinition = { readonly code: string; readonly symbol: string };

/**
 * Πρώτα ακριβώς («mW» δεν είναι «MW»), αλλιώς χωρίς πεζά-κεφαλαία μόνο αν απαντά μία μονάδα («Kg»). Ο **ένας** κανόνας «ποια μονάδα
 * τυπώνει η ετικέτα» — τον χρησιμοποιεί και η πρόταση νέας ιδιότητας από γραμμή (§5.5.2 Β3 Γ7).
 */
export function unitInLabel(label: string, units: readonly UnitDefinition[]): UnitDefinition | null {
  const forms = units.flatMap((unit) => [{ unit, form: unitForm(unit.symbol) }, { unit, form: unitForm(unit.code) }]);
  const exact = forms.filter(({ form }) => labelPrintsUnit(label, form));
  const found = exact.length > 0 ? exact : forms.filter(({ form }) => labelPrintsUnit(label.toLowerCase(), form.toLowerCase()));
  const distinct = new Set(found.map(({ unit }) => unit.code));
  return distinct.size === 1 ? found[0].unit : null;
}

function printedUnit(attribute: NamedAttribute, labels: readonly PageTableCell[], registry: MeasurementRegistry): PrintedUnit | null {
  if (attribute.type !== 'measurement') return null;
  const units = registry.get(attribute.config.measurementFamilyCode)?.units ?? [];
  for (const cell of [...labels].reverse()) {
    const unit = unitInLabel(cell.text, units);
    if (unit) return { symbol: unit.symbol, cell };
  }
  return null;
}

const printsAnyUnit = (labels: readonly PageTableCell[], registry: MeasurementRegistry): boolean => {
  const forms = registry.families.flatMap((family) => family.units.map((unit) => unitForm(unit.symbol)));
  return labels.some((cell) => forms.some((form) => labelPrintsUnit(cell.text, form)));
};

const attributeTarget = (attribute: NamedAttribute): ImportTarget => ({ kind: 'attribute', attributeId: attribute.id, channel: ANY_SLOT, locale: ANY_SLOT });

interface CellSource {
  readonly attribute: NamedAttribute;
  readonly confidence: number;
  readonly unit: PrintedUnit | null;
  readonly disputed: boolean;
}

function extractedCell(cell: PageTableCell | null, source: CellSource, page: number): ExtractedCell | null {
  if (cell === null || cell.text.trim() === '') return null;
  const { attribute, confidence, unit, disputed } = source;
  return {
    target: attributeTarget(attribute),
    text: normalizeMixedScriptHomoglyphs(cell.text.trim()),
    confidence,
    anchor: { kind: 'page', page, regions: unit ? [cell.box, unit.cell.box] : [cell.box], verified: true },
    unitCode: unit?.symbol ?? null,
    flags: disputed ? [{ code: 'tableStructureDisputed', path: attribute.id }] : [],
  };
}

const CODE_SHAPE = /^\S*\d\S*$/u;

function isCode(cell: PageTableCell | null, view: TableView): cell is PageTableCell {
  if (cell === null || view.spansSlots(cell)) return false;
  const text = cell.text.trim();
  return text.length >= MIN_CODE_LENGTH && CODE_SHAPE.test(text) && parseEnteredAmount(text) === null;
}

/** Γραμμές κωδικών: κάθε παραλλαγή έχει δικό της, όλοι διαφορετικοί, και η γραμμή δεν τυπώνει μονάδα (όπως οι διαστάσεις σε mm). */
function codeLines(view: TableView, data: readonly number[], registry: MeasurementRegistry): number[] {
  return range(view.lines).filter((line) => {
    const cells = data.map((slot) => view.at(line, slot));
    const codes = cells.filter((cell): cell is PageTableCell => isCode(cell, view)).map((cell) => cell.text.trim());
    return data.length > 0 && codes.length === data.length && new Set(codes).size === data.length && !printsAnyUnit(labelCells(view, line, data), registry);
  });
}

interface LineBinding {
  readonly line: number;
  readonly attribute: NamedAttribute;
  readonly confidence: number;
}

const labelsKey = (view: TableView, line: number, data: readonly number[], unit: PrintedUnit | null): string =>
  labelCells(view, line, data).filter((cell) => cell !== unit?.cell).map((cell) => normalizeMixedScriptHomoglyphs(cell.text)).join('|');

/** Ίδια ετικέτα σε άλλη μονάδα είναι το ίδιο μέγεθος (ΤΗ Η W · ΤΗ Η Btu/h): η ανεξάρτητη επιβεβαίωση του Δ4 δεν περιμένει το μοντέλο. */
function sameQuantityLines(view: TableView, data: readonly number[], bound: readonly LineBinding[], context: PageTableContext): LineBinding[] {
  const taken = new Set(bound.map(({ line }) => line));
  const unitOf = (line: number, attribute: NamedAttribute) => printedUnit(attribute, labelCells(view, line, data), context.registry);
  return bound.flatMap((binding) => {
    const key = labelsKey(view, binding.line, data, unitOf(binding.line, binding.attribute));
    return range(view.lines).filter((line) => !taken.has(line) && unitOf(line, binding.attribute) !== null && labelsKey(view, line, data, unitOf(line, binding.attribute)) === key)
      .map((line) => ({ ...binding, line }));
  });
}

function identifierLines(view: TableView, data: readonly number[], bound: readonly LineBinding[], context: PageTableContext): LineBinding[] {
  const unique = [...context.attributesByCode.values()].filter((attribute) => attribute.unique);
  const has = (line: number, attribute: NamedAttribute): boolean => bound.some((binding) => binding.line === line && binding.attribute.id === attribute.id);
  return codeLines(view, data, context.registry).flatMap((line) => unique.filter((attribute) => !has(line, attribute)).map((attribute) => ({ line, attribute, confidence: IDENTIFIED_CONFIDENCE })));
}

function axisLines(view: TableView, data: readonly number[], bound: readonly LineBinding[], context: PageTableContext): LineBinding[] {
  const axes = [...context.attributesByCode.values()].filter((attribute) => context.axisAttributeIds.includes(attribute.id) && !bound.some((binding) => binding.attribute.id === attribute.id));
  return axes.flatMap((attribute) => {
    const line = codeLines(view, data, context.registry).find((candidate) => {
      const options = data.map((slot) => selectOptionFor(attribute, view.at(candidate, slot)?.text ?? ''));
      return options.every((option) => option !== null) && new Set(options).size === data.length;
    });
    return line === undefined ? [] : [{ line, attribute, confidence: IDENTIFIED_CONFIDENCE }];
  });
}

function boundLines(view: TableView, lines: readonly RawLineMapping[], context: PageTableContext): LineBinding[] {
  return lines.flatMap(({ line, attribute: code, confidence }) => {
    const attribute = code === null ? undefined : context.attributesByCode.get(code);
    const clamped = Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0;
    return attribute && line >= 0 && line < view.lines ? [{ line, attribute, confidence: clamped }] : [];
  });
}

function unitFindings(view: TableView, data: readonly number[], bound: readonly LineBinding[], context: PageTableContext): string[] {
  return bound.filter(({ attribute, line }) => attribute.type === 'measurement' && printedUnit(attribute, labelCells(view, line, data), context.registry) === null)
    .map(({ attribute, line }) => `Line ${line} is mapped to ${attribute.code}, but it prints no unit of that quantity. Check the mapping of this line.`);
}

/** Η ταυτότητα μιας παραλλαγής μέσα στη σελίδα: **ίδια** για την πρόταση ιδιοτήτων και την πρόταση τιμών του πίνακα (§5.5.2 Β4). */
const variantRowKey = (page: number, table: PageTable, position: number): string => `p${page}${table.key}v${position}`;

/** Βήμα 3Α: γραμμή με 2+ ιδιότητες (Γ13) ⇒ κάθε στόχος κρατά το δικό του κομμάτι του κελιού (`fragmentFor`). */
function ownFragment(cell: ExtractedCell, attribute: NamedAttribute, context: PageTableContext): ExtractedCell {
  if (cell.text === null) return cell;
  const text = fragmentFor(attribute, cell.text, cell.unitCode, importTextContextOf(context.registry));
  return text === cell.text ? cell : { ...cell, text };
}

function rowsOf(view: TableView, table: PageTable, data: readonly number[], lines: readonly LineBinding[], page: number, context: PageTableContext): ExtractedRow[] {
  const disputed = table.witness === 'disputed';
  const targetsOn = (line: number): number => new Set(lines.filter((binding) => binding.line === line).map(({ attribute }) => attribute.id)).size;
  return data.map((slot, position) => ({
    rowKey: variantRowKey(page, table, position),
    cells: lines.flatMap(({ line, attribute, confidence }) => {
      const unit = printedUnit(attribute, labelCells(view, line, data), context.registry);
      const cell = extractedCell(view.at(line, slot), { attribute, confidence, unit, disputed }, page);
      if (cell === null) return [];
      return [targetsOn(line) > 1 ? ownFragment(cell, attribute, context) : cell];
    }),
  }));
}

interface TableOutcome {
  readonly groups: readonly ExtractedGroup[];
  readonly setAside: ImportPageSetAside | null;
  readonly unmapped: readonly ImportPageUnmappedLine[];
  readonly findings: readonly string[];
}

const printedText = (cell: PageTableCell): string => normalizeMixedScriptHomoglyphs(cell.text.trim());

/** Ε7: ό,τι τυπώνει η γραμμή στις θέσεις τιμών. Ενωμένο κελί (230V-50Hz-1Ph) μετρά μία φορά. */
function lineValues(view: TableView, line: number, data: readonly number[]): string[] {
  const cells = [...new Set(data.flatMap((slot) => view.at(line, slot) ?? []))];
  return cells.map(printedText).filter((text) => text !== '');
}

/** Τα κελιά της γραμμής στη σελίδα, για εστίαση στο PDF (§5.5.2 Β3). */
function lineRegions(view: TableView, line: number, data: readonly number[]): PageRegion[] {
  const cells = new Set([...labelCells(view, line, data), ...data.flatMap((slot) => view.at(line, slot) ?? [])]);
  return [...cells].filter((cell) => cell.text.trim() !== '').map((cell) => cell.box);
}

/** Η μονάδα που τυπώνει η γραμμή, από **όλο** το μητρώο: η μνήμη ρωτά πριν μάθει ποια ιδιότητα είναι η γραμμή (§5.5.2 Β5). */
function anyPrintedUnit(labels: readonly PageTableCell[], registry: MeasurementRegistry): { readonly code: string; readonly cell: PageTableCell } | null {
  const units = registry.families.flatMap((family) => family.units);
  for (const cell of [...labels].reverse()) {
    const unit = unitInLabel(cell.text, units);
    if (unit) return { code: unit.code, cell };
  }
  return null;
}

/** Τι είναι η γραμμή, χωρίς τη θέση της: ετικέτες χωρίς τη μονάδα (όπως το `labelsKey`) + η μονάδα. */
function lineIdentity(view: TableView, line: number, data: readonly number[], registry: MeasurementRegistry): ImportLineIdentity {
  const labels = labelCells(view, line, data);
  const unit = anyPrintedUnit(labels, registry);
  const printed = labels.filter((cell) => cell !== unit?.cell).map(printedText).filter((text) => text !== '').join(' · ');
  return { label: normalizeUniqueText(printed), unitCode: unit?.code ?? null, printed };
}

/** Η ταυτότητα κάθε γραμμής ενός πίνακα, στον προσανατολισμό που δίνεται (§5.5.2 Β5). Ο **ένας** κανόνας για μάθηση και εφαρμογή. */
export function tableLineIdentities(table: PageTable, variantsIn: VariantOrientation, registry: MeasurementRegistry): ReadonlyMap<number, ImportLineIdentity> {
  const view = viewOf(table, { variantsIn });
  const data = dataSlots(view);
  return new Map(range(view.lines).map((line) => [line, lineIdentity(view, line, data, registry)]));
}

/**
 * Ό,τι τυπώνει κάθε γραμμή **ανά παραλλαγή**, στη σειρά των παραλλαγών (`''` = κενό κελί), με την ίδια ανάγνωση κελιού με την
 * πρόταση. Η πηγή της απόδειξης του §5.5.2 Β7: ποια γραμμή δίνει τον άξονα το κρίνει το ίδιο κείμενο που θα διαβάσει ο αγωγός.
 */
export function tableLineTexts(table: PageTable, variantsIn: VariantOrientation): readonly (readonly string[])[] {
  const view = viewOf(table, { variantsIn });
  const data = dataSlots(view);
  return range(view.lines).map((line) => data.map((slot) => {
    const cell = view.at(line, slot);
    return cell === null ? '' : printedText(cell);
  }));
}

interface LeftOutLines {
  readonly view: TableView;
  readonly data: readonly number[];
  readonly lines: readonly LineBinding[];
  readonly priced: readonly PagePriceLine[];
}

/** §5.5.2 Β3 Γ11: οι γραμμές που μπορούν να γίνουν πρότυπο νέας ιδιότητας — όχι άξονας, όχι κωδικός (μοναδική). */
function siblingCandidates({ view, data, lines }: LeftOutLines, context: PageTableContext): BoundLineOfTable[] {
  const usable = lines.filter(({ attribute }) => !attribute.unique && !context.axisAttributeIds.includes(attribute.id));
  return usable.map(({ line, attribute }) => ({ identity: lineIdentity(view, line, data, context.registry), attributeId: attribute.id }));
}

function unmappedLines(left: LeftOutLines, table: PageTable, context: PageTableContext): ImportPageUnmappedLine[] {
  const { view, data, lines, priced } = left;
  const taken = new Set([...lines.map(({ line }) => line), ...priced.map(({ line }) => line)]);
  const candidates = siblingCandidates(left, context);
  return range(view.lines).filter((line) => !taken.has(line)).flatMap((line) => {
    const values = lineValues(view, line, data);
    if (values.length === 0) return [];
    const label = labelCells(view, line, data).map(printedText).join(' · ');
    const identity = lineIdentity(view, line, data, context.registry);
    const sibling = lineSiblingOf(identity, candidates);
    return [{ page: context.page, table: table.key, line, label, values, regions: lineRegions(view, line, data), identity, ...(sibling ? { sibling } : {}) }];
  });
}

const asideOf = (page: number, table: PageTable, role: ImportPageSetAside['role']): ImportPageSetAside => ({
  page,
  table: table.key,
  role,
  rows: table.rowCount,
  label: table.cells.filter((cell) => cell.row === 0 && cell.text !== '').map((cell) => cell.text).join(' · '),
});

/** Το σύμβολο του νομίσματος του καταλόγου («€»), από το `Intl` και όχι γραμμένο με το χέρι. */
const MONEY_SIGN = new Intl.NumberFormat('en', { style: 'currency', currency: MONEY_CURRENCY }).formatToParts(0).find((part) => part.type === 'currency')?.value ?? MONEY_CURRENCY;

/** Σύμβολο νομίσματος (Unicode `Sc`) στην ετικέτα που **δεν** είναι του καταλόγου: η τιμή δεν μετατρέπεται ποτέ σιωπηλά. */
function foreignCurrencyOf(labels: readonly PageTableCell[]): string | null {
  const signs = labels.flatMap((cell) => cell.text.match(/\p{Sc}/gu) ?? []);
  return signs.find((sign) => sign !== MONEY_SIGN) ?? null;
}

const priceTarget = (field: 'netPrice' | 'unitCode'): ImportTarget => ({ kind: 'price', field });

/**
 * Τα κελιά τιμής μιας παραλλαγής (§5.5.2 Β4 Δ3): το ποσό από τον πίνακα, η μονάδα από τον άνθρωπο. Ενωμένο κελί (μία τιμή για
 * πολλές παραλλαγές) δεν μοιράζεται σιωπηλά: γίνεται εύρημα στοίχισης.
 */
function priceCells(view: TableView, slot: number, entry: PagePriceLine, labels: readonly PageTableCell[], page: number): ExtractedCell[] {
  const cell = view.at(entry.line, slot);
  if (cell === null || cell.text.trim() === '') return [];
  const foreign = foreignCurrencyOf(labels);
  const flags: ImportIssue[] = [
    ...(foreign === null ? [] : [{ code: 'currencyConflict' as const, path: 'netPrice', params: { currency: foreign, expected: MONEY_CURRENCY } }]),
    ...(view.spansSlots(cell) ? [{ code: 'misaligned' as const, path: 'netPrice' }] : []),
  ];
  const anchor = { kind: 'page' as const, page, regions: [cell.box, ...labels.map((label) => label.box)], verified: true };
  return [
    { target: priceTarget('netPrice'), text: printedText(cell), confidence: IDENTIFIED_CONFIDENCE, anchor, unitCode: null, flags },
    { target: priceTarget('unitCode'), text: entry.unitCode, confidence: IDENTIFIED_CONFIDENCE, anchor: null, unitCode: null, flags: [] },
  ];
}

/**
 * Η **δεύτερη** πρόταση της ίδιας ανάγνωσης (§5.5.2 Β4, BMEcat: ένα `PRODUCT`, δύο προορισμοί): οι τιμές του πίνακα, με τα **ίδια**
 * `rowKey` με την πρόταση ιδιοτήτων. Ο πίνακας έχει μία γραμμή τιμής· τη δεύτερη την αρνείται ο γραφέας (`priceLineTaken`).
 */
function priceGroupOf(view: TableView, table: PageTable, data: readonly number[], priced: readonly PagePriceLine[], attributesKey: string, page: number): ExtractedGroup | null {
  const [entry] = priced;
  if (!entry) return null;
  const labels = labelCells(view, entry.line, data);
  const rows = data.map((slot, position) => ({ rowKey: variantRowKey(page, table, position), cells: priceCells(view, slot, entry, labels, page) }));
  return { groupKey: priceGroupKeyOf(attributesKey), purpose: 'priceLines', modelCode: null, sharedCells: [], rows: rows.filter((row) => row.cells.length > 0), pages: [page] };
}

function readTable(table: PageTable, mapping: RawTableMapping, context: PageTableContext): TableOutcome {
  const { page } = context;
  if (mapping.role !== 'variants') return { groups: [], setAside: asideOf(page, table, mapping.role), unmapped: [], findings: [] };
  const view = viewOf(table, mapping);
  const data = dataSlots(view);
  const mapped = boundLines(view, mapping.lines, context);
  if (data.length === 0 || mapped.length < MIN_MAPPED_LINES) {
    return { groups: [], setAside: asideOf(page, table, 'unmapped'), unmapped: [], findings: [`Table ${table.key} has role "variants", but only ${mapped.length} lines were mapped to attributes.`] };
  }
  const repeated = [...mapped, ...sameQuantityLines(view, data, mapped, context)];
  const lines = [...repeated, ...identifierLines(view, data, repeated, context), ...axisLines(view, data, repeated, context)];
  const group: ExtractedGroup = { groupKey: pageTableGroupKey(page, table.key), modelCode: null, sharedCells: [], rows: rowsOf(view, table, data, lines, page, context), pages: [page] };
  const priced = (context.priceLinesByTable?.get(table.key) ?? []).filter(({ line }) => line >= 0 && line < view.lines);
  const prices = priceGroupOf(view, table, data, priced, group.groupKey, page);
  return { groups: prices ? [group, prices] : [group], setAside: null, unmapped: unmappedLines({ view, data, lines, priced }, table, context), findings: unitFindings(view, data, mapped, context) };
}

/** Τα ανασυντεθειμένα κείμενα ζουν στον πίνακα: το μοντέλο δεν έχει τρόπο να γράψει τιμή, μόνο να δείξει γραμμή. */
export function readPageTables(mapping: RawPageMapping, context: PageTableContext): PageTableReading {
  const byKey = new Map(mapping.tables.map((table) => [table.table, table]));
  const answered = context.tables.flatMap((table) => {
    const answer = byKey.get(table.key);
    return answer ? [{ table, answer }] : [];
  });
  const outcomes = answered.map(({ table, answer }) => readTable(table, answer, context));
  const unanswered = context.tables.filter((table) => !byKey.has(table.key)).map((table) => `Table ${table.key} has no entry.`);
  return {
    groups: outcomes.flatMap((outcome) => outcome.groups),
    setAside: outcomes.flatMap((outcome) => outcome.setAside ?? []),
    unmappedLines: outcomes.flatMap((outcome) => outcome.unmapped),
    findings: [...outcomes.flatMap((outcome) => outcome.findings), ...unanswered],
    doubted: answered.some(({ table, answer }) => textLayerDoubted(table, answer)),
  };
}
