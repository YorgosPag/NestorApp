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
import type { LayoutBlock, LayoutCodeIndexEntry, LayoutDocument, LayoutImageRef, LayoutPage, LayoutSection, LayoutTheme } from './layout-model';
import { fitValueColumns, layoutTables, tableUsesRail } from './layout-table';
import { richTextBlocks, withBreakHints } from './layout-text';
import type { ProductGridEntry, PublicationChapter, PublicationEntry, SimpleProductCard, VariantModelEntry } from './publication-entries';
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
  readonly chapters: readonly PublicationChapter[];
  readonly words: PublicationComposeWords;
}

/** A4 με περιθώριο 15 mm· το bleed το βάζει το προφίλ εκτύπωσης στον προσαρμογέα. */
export const PUBLICATION_A4: LayoutPage = { widthMm: 210, heightMm: 297, marginMm: 15, bleedMm: 3 };

const TEXT_INK = { rgb: '#1a1a1a', cmyk: [0, 0, 0, 90] as const };
const RULE_INK = { rgb: '#bdbdbd', cmyk: [0, 0, 0, 30] as const };
const TINT_INK = { rgb: '#f0f2f5', cmyk: [3, 2, 0, 3] as const };

const LABEL_COLUMN_MM = 52;
const RAIL_COLUMN_MM = 10;
const MIN_VALUE_COLUMN_MM = 15;
const MODEL_IMAGE_MM = 60;
const GRID_IMAGE_MM = 45;
const CODE_INDEX_COLUMNS = 3;

function themeOf(theme: PublicationTheme): LayoutTheme {
  return { fontFamily: PUBLICATION_FONTS[theme.fontCode].family, primary: theme.primary, accent: theme.accent, tint: TINT_INK, text: TEXT_INK, rule: RULE_INK };
}

const imageRef = (assetId: string, alt: string, widthMm: number): LayoutImageRef => ({ assetId, alt, widthMm });
const anchorOf = (entryId: string): string => `entry-${entryId}`;

function tableArea(page: LayoutPage): number {
  return page.widthMm - 2 * page.marginMm;
}

function variantSection(entry: VariantModelEntry, input: PublicationCompositionInput): LayoutSection {
  const { recipe, words } = input;
  const { groupStyle } = recipe.templates;
  const reservedMm = LABEL_COLUMN_MM + (tableUsesRail(entry.preview, groupStyle) ? RAIL_COLUMN_MM : 0);
  const maxValueColumns = fitValueColumns({ areaMm: tableArea(PUBLICATION_A4), labelMm: reservedMm, minColumnMm: MIN_VALUE_COLUMN_MM });
  const tables = layoutTables(entry.preview, {
    id: entry.id, caption: entry.title, groupStyle, maxValueColumns, labelColumnMm: LABEL_COLUMN_MM, railColumnMm: RAIL_COLUMN_MM, priceRowIds: entry.priceRowIds,
  });
  const blocks: LayoutBlock[] = [
    { kind: 'anchor', anchor: anchorOf(entry.id) },
    { kind: 'heading', level: 2, text: entry.title, outlined: true },
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

/** Ο **ένας** πίνακας «είδος καταχώρισης → πρότυπο». Νέο είδος χωρίς γραμμή = σφάλμα μεταγλώττισης. */
const ENTRY_SECTION: { readonly [K in PublicationEntry['kind']]: (entry: Extract<PublicationEntry, { kind: K }>, input: PublicationCompositionInput) => LayoutSection } = {
  variantModel: variantSection,
  productGrid: gridSection,
};

function entrySection(entry: PublicationEntry, input: PublicationCompositionInput): LayoutSection {
  return entry.kind === 'variantModel' ? ENTRY_SECTION.variantModel(entry, input) : ENTRY_SECTION.productGrid(entry, input);
}

function entryCodes(entry: PublicationEntry): LayoutCodeIndexEntry[] {
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
  const head: LayoutSection[] = divider
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
    theme: themeOf(input.recipe.theme),
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
