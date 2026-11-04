/**
 * =============================================================================
 * Ο ΣΥΝΘΕΤΗΣ — από κεφάλαια σε έγγραφο διάταξης (ADR-923 §5.6)
 * =============================================================================
 *
 * Καθαρή συνάρτηση: ίδια είσοδος ⇒ ίδιο JSON, byte προς byte. Κανένα «τώρα», κανένα τυχαίο: το υποσέλιδο γράφει την
 * **ισχύ των τιμών**, όχι την ώρα απόδοσης, αλλιώς δύο ίδιες εκδόσεις δεν θα ήταν ποτέ ίδιο αρχείο.
 *
 * 🔑 **Ένας πίνακας προτύπων ανά είδος καταχώρισης** ({@link ENTRY_SECTION}): `Record` πάνω στο `kind`, άρα νέο είδος (§22)
 *    δεν μεταγλωττίζεται χωρίς πρότυπο.
 * 🔑 Η προεπισκόπηση μίας σελίδας είναι **αυτή** η σύνθεση με εύρος ένα μοντέλο και χωρίς προαιρετικά πρότυπα.
 * @module subapps/catalog/publishing/compose-publication
 */

import type { HumanLanguage } from '@/i18n/languages';
import type { PublicationRecipeDefinition, PublicationTheme } from '../types/publication';
import type { LayoutBlock, LayoutCell, LayoutCodeIndexEntry, LayoutDocument, LayoutImageRef, LayoutPage, LayoutQrCode, LayoutSection, LayoutTable, LayoutTheme } from './layout-model';
import { fitValueColumns, layoutTables, tableUsesRail } from './layout-table';
import { richTextBlocks, withBreakHints } from './layout-text';
import type { PriceChangeGroup, PriceChangesEntry, ProductGridEntry, PublicationChapter, PublicationEntry, SimpleProductCard, VariantModelEntry } from './publication-entries';
import { PUBLICATION_FONTS } from './publication-fonts';
import { PUBLICATION_RENDER_SCHEMA_VERSION, type PublicationOptionalTemplate } from './publication-vocabulary';

/** Οι λέξεις των προτύπων στη γλώσσα της συνταγής — από τα locales, ποτέ γραμμένες εδώ (N.11). */
export interface PublicationComposeWords {
  readonly contents: string;
  readonly codeIndex: string;
  /** «Μέρος 2 από 3» — έτοιμο από τον καλούντα (ICU). */
  readonly tablePart: (part: number, parts: number) => string;
}

export interface PublicationCompositionInput {
  readonly recipe: PublicationRecipeDefinition;
  readonly title: string;
  /** Το υποσέλιδο, έτοιμο: σημείωση + «τιμές έκδοσης Χ, ισχύς από…». */
  readonly footer: string;
  /** Το όνομα της οικογένειας προμηθευτή, όπως το ξέρει η μηχανή. Λείπει ⇒ η γραμματοσειρά της πλατφόρμας. */
  readonly supplierFontFamily?: string;
  readonly chapters: readonly PublicationChapter[];
  readonly words: PublicationComposeWords;
  /**
   * Το QR κάθε σελίδας οικογένειας, κατά id μοντέλου (§5.13 Σ7). Λείπει ⇒ χωρίς QR: μόνο μοντέλο που βλέπει ο ανώνυμος έχει
   * δημόσια σελίδα, και το αποφασίζει ο διακομιστής, όχι ο συνθέτης.
   */
  readonly qrCodes?: ReadonlyMap<string, LayoutQrCode>;
}

/** A4 με περιθώριο 15 mm· το bleed το βάζει το προφίλ εκτύπωσης στον προσαρμογέα. */
export const PUBLICATION_A4: LayoutPage = { widthMm: 210, heightMm: 297, marginMm: 15, bleedMm: 3 };

const TEXT_INK = { rgb: '#1a1a1a', cmyk: [0, 0, 0, 90] as const };
const RULE_INK = { rgb: '#bdbdbd', cmyk: [0, 0, 0, 30] as const };
const TINT_INK = { rgb: '#f0f2f5', cmyk: [3, 2, 0, 3] as const };

const LABEL_COLUMN_MM = 52;
const RAIL_COLUMN_MM = 10;
/** Κωδικός και όνομα χωρούν μαζί: οι στήλες τιμών είναι το πολύ τρεις. */
const CHANGE_LABEL_COLUMN_MM = 90;
const MIN_VALUE_COLUMN_MM = 15;
const MODEL_IMAGE_MM = 60;
const GRID_IMAGE_MM = 45;
const CODE_INDEX_COLUMNS = 3;

function themeOf(theme: PublicationTheme, supplierFamily: string | undefined): LayoutTheme {
  return { fontFamily: supplierFamily ?? PUBLICATION_FONTS[theme.fontCode].family, primary: theme.primary, accent: theme.accent, tint: TINT_INK, text: TEXT_INK, rule: RULE_INK };
}

const imageRef = (assetId: string, alt: string, widthMm: number): LayoutImageRef => ({ assetId, alt, widthMm });
const anchorOf = (entryId: string): string => `entry-${entryId}`;

function tableArea(page: LayoutPage): number {
  return page.widthMm - 2 * page.marginMm;
}

/** Η επικεφαλίδα της σελίδας οικογένειας, με το QR της όταν υπάρχει. Χωρίς QR μένει ακριβώς η παλιά επικεφαλίδα. */
function entryHeading(text: string, qr: LayoutQrCode | undefined): LayoutBlock {
  return qr ? { kind: 'heading', level: 2, text, outlined: true, qr } : { kind: 'heading', level: 2, text, outlined: true };
}

function variantSection(entry: VariantModelEntry, input: PublicationCompositionInput): LayoutSection {
  const { recipe, words } = input;
  const { groupStyle } = recipe.templates;
  const reservedMm = LABEL_COLUMN_MM + (tableUsesRail(entry.preview, groupStyle) ? RAIL_COLUMN_MM : 0);
  const maxValueColumns = fitValueColumns({ areaMm: tableArea(PUBLICATION_A4), labelMm: reservedMm, minColumnMm: MIN_VALUE_COLUMN_MM });
  const maxTransposedColumns = fitValueColumns({ areaMm: tableArea(PUBLICATION_A4), labelMm: LABEL_COLUMN_MM, minColumnMm: MIN_VALUE_COLUMN_MM });
  const tables = layoutTables(entry.preview, {
    id: entry.id, caption: entry.title, groupStyle, maxValueColumns, maxTransposedColumns, overflow: entry.tableOverflow, labelColumnMm: LABEL_COLUMN_MM, railColumnMm: RAIL_COLUMN_MM, priceRowIds: entry.priceRowIds,
  });
  const blocks: LayoutBlock[] = [
    { kind: 'anchor', anchor: anchorOf(entry.id) },
    entryHeading(entry.title, input.qrCodes?.get(entry.id)),
    ...(entry.imageAssetId ? [{ kind: 'image' as const, image: imageRef(entry.imageAssetId, entry.title, MODEL_IMAGE_MM) }] : []),
    ...(entry.descriptionHtml ? richTextBlocks(entry.descriptionHtml) : []),
    ...tables.flatMap((table): LayoutBlock[] => [
      ...(table.parts > 1 ? [{ kind: 'heading' as const, level: 3 as const, text: words.tablePart(table.part, table.parts), outlined: false }] : []),
      { kind: 'table', table },
    ]),
  ];
  return { id: entry.id, template: 'family', blocks };
}

function gridCard(card: SimpleProductCard) {
  return {
    id: card.id,
    title: card.title,
    code: card.code,
    image: card.imageAssetId ? imageRef(card.imageAssetId, card.title, GRID_IMAGE_MM) : null,
    lines: card.lines.map(withBreakHints),
    price: card.price,
  };
}

function gridSection(entry: ProductGridEntry, input: PublicationCompositionInput): LayoutSection {
  return {
    id: entry.id,
    template: 'grid',
    blocks: [
      { kind: 'anchor', anchor: anchorOf(entry.id) },
      { kind: 'heading', level: 2, text: entry.title, outlined: true },
      { kind: 'grid', columns: input.recipe.templates.gridColumns, cards: entry.cards.map(gridCard) },
    ],
  };
}

const plainCell = (text: string, role: LayoutCell['role']): LayoutCell => ({ text, role, colSpan: 1, rowSpan: 1 });

function changeTable(group: PriceChangeGroup, entryId: string, entryTitle: string): LayoutTable {
  const head = { id: `${group.id}-head`, header: true, cells: [plainCell('', 'corner'), ...group.columns.map((column) => plainCell(column, 'columnHead'))] };
  const body = group.rows.map((row) => ({ id: row.id, header: false, cells: [plainCell(row.label, 'rowHead'), ...row.cells.map((text) => plainCell(text, 'price'))] }));
  return {
    id: `${entryId}-${group.id}`, caption: `${entryTitle}: ${group.title}`, columnCount: group.columns.length + 1, railColumn: false,
    labelColumnMm: CHANGE_LABEL_COLUMN_MM, railColumnMm: RAIL_COLUMN_MM, part: 1, parts: 1, transposeUnmet: false, rows: [head, ...body],
  };
}

/** Τα ίδια μπλοκ με τη σελίδα οικογένειας, άρα το πρότυπο Typst δεν αλλάζει και οι παλιές εκδόσεις κρατούν τα bytes τους. */
function changesSection(entry: PriceChangesEntry): LayoutSection {
  const groups = entry.groups.flatMap((group): LayoutBlock[] => [
    { kind: 'heading', level: 3, text: group.title, outlined: false },
    { kind: 'table', table: changeTable(group, entry.id, entry.title) },
  ]);
  const comparison: LayoutBlock[] = entry.comparison === '' ? [] : [{ kind: 'paragraph', inlines: [{ text: entry.comparison }] }];
  return { id: entry.id, template: 'family', blocks: [{ kind: 'anchor', anchor: anchorOf(entry.id) }, { kind: 'heading', level: 2, text: entry.title, outlined: true }, ...comparison, ...groups] };
}

/** Ο **ένας** πίνακας «είδος καταχώρισης → πρότυπο». Νέο είδος χωρίς γραμμή = σφάλμα μεταγλώττισης. */
const ENTRY_SECTION: { readonly [K in PublicationEntry['kind']]: (entry: Extract<PublicationEntry, { kind: K }>, input: PublicationCompositionInput) => LayoutSection } = {
  variantModel: variantSection,
  productGrid: gridSection,
  priceChanges: changesSection,
};

function entrySection(entry: PublicationEntry, input: PublicationCompositionInput): LayoutSection {
  switch (entry.kind) {
    case 'variantModel': return ENTRY_SECTION.variantModel(entry, input);
    case 'productGrid': return ENTRY_SECTION.productGrid(entry, input);
    case 'priceChanges': return ENTRY_SECTION.priceChanges(entry, input);
  }
}

function entryCodes(entry: PublicationEntry): LayoutCodeIndexEntry[] {
  // Η σύγκριση δεν είναι σπίτι κανενός κωδικού: το ευρετήριο δείχνει τη σελίδα του προϊόντος.
  if (entry.kind === 'priceChanges') return [];
  const codes = entry.kind === 'variantModel'
    ? entry.codes
    : entry.cards.flatMap((card) => (card.code ? [{ code: card.code, label: card.title }] : []));
  return codes.map(({ code, label }) => ({ code, label, anchor: anchorOf(entry.id) }));
}

/** Το ευρετήριο κωδικών: φυσική σειρά, γιατί ο κωδικός «9» ψάχνεται πριν από τον «10». */
export function codeIndexEntries(chapters: readonly PublicationChapter[], language: HumanLanguage): LayoutCodeIndexEntry[] {
  const entries = chapters.flatMap((chapter) => chapter.entries.flatMap(entryCodes));
  return entries.sort((a, b) => a.code.localeCompare(b.code, language, { numeric: true }) || a.anchor.localeCompare(b.anchor));
}

function chapterSections(chapter: PublicationChapter, input: PublicationCompositionInput, divider: boolean): LayoutSection[] {
  const head: LayoutSection[] = divider && chapter.entries.every((entry) => entry.kind !== 'priceChanges')
    ? [{ id: `chapter-${chapter.id}`, template: 'chapterDivider', blocks: [{ kind: 'heading', level: 1, text: chapter.title, outlined: true }] }]
    : [];
  return [...head, ...chapter.entries.map((entry) => entrySection(entry, input))];
}

function coverBlocks(input: PublicationCompositionInput): LayoutBlock[] {
  const { theme } = input.recipe;
  const logo: LayoutBlock[] = theme.logoAssetId ? [{ kind: 'image', image: imageRef(theme.logoAssetId, input.title, 70) }] : [];
  return [...logo, { kind: 'heading', level: 1, text: input.title, outlined: false }];
}

function frontSections(input: PublicationCompositionInput, enabled: ReadonlySet<PublicationOptionalTemplate>): LayoutSection[] {
  const sections: LayoutSection[] = [];
  if (enabled.has('cover')) sections.push({ id: 'cover', template: 'cover', blocks: coverBlocks(input) });
  if (enabled.has('toc')) sections.push({ id: 'toc', template: 'toc', blocks: [{ kind: 'toc', title: input.words.contents }] });
  return sections;
}

function backSections(input: PublicationCompositionInput, enabled: ReadonlySet<PublicationOptionalTemplate>): LayoutSection[] {
  const sections: LayoutSection[] = [];
  const entries = codeIndexEntries(input.chapters, input.recipe.language);
  if (enabled.has('codeIndex') && entries.length > 0) {
    sections.push({
      id: 'code-index',
      template: 'codeIndex',
      blocks: [{ kind: 'heading', level: 1, text: input.words.codeIndex, outlined: true }, { kind: 'codeIndex', columns: CODE_INDEX_COLUMNS, entries }],
    });
  }
  if (enabled.has('backCover')) sections.push({ id: 'back-cover', template: 'backCover', blocks: coverBlocks(input).slice(0, 1) });
  return sections;
}

function documentShell(input: PublicationCompositionInput, sections: readonly LayoutSection[]): LayoutDocument {
  return {
    schemaVersion: PUBLICATION_RENDER_SCHEMA_VERSION,
    title: input.title,
    language: input.recipe.language,
    theme: themeOf(input.recipe.theme, input.supplierFontFamily),
    page: PUBLICATION_A4,
    footer: input.footer,
    sections,
  };
}

/** Η συνταγή της προεπισκόπησης: η πρώτη κατά κωδικό, ώστε ίδια βιβλιοθήκη να δείχνει πάντα την ίδια σελίδα. */
export function previewRecipeOf<T extends { readonly code: string }>(recipes: readonly T[]): T | null {
  return [...recipes].sort((a, b) => a.code.localeCompare(b.code))[0] ?? null;
}

/** Ολόκληρη η έκδοση. */
export function composePublication(input: PublicationCompositionInput): LayoutDocument {
  const enabled = new Set(input.recipe.templates.enabled);
  const body = input.chapters.flatMap((chapter) => chapterSections(chapter, input, enabled.has('chapterDivider')));
  return documentShell(input, [...frontSections(input, enabled), ...body, ...backSections(input, enabled)]);
}
