/**
 * =============================================================================
 * ΟΙ ΚΑΤΑΧΩΡΙΣΕΙΣ ΜΙΑΣ ΕΚΔΟΣΗΣ — από τα δεδομένα στο περιεχόμενο σελίδας (ADR-923 §5.6)
 * =============================================================================
 *
 * Μία καταχώριση = μία ενότητα του σώματος. Κλειστή ένωση `kind` με **έναν** πίνακα προτύπων στον συνθέτη: όταν η §22
 * φέρει `service` ή `product + installation`, νέο μέλος εδώ σπάει τη μεταγλώττιση μέχρι να αποκτήσει πρότυπο.
 *
 * 🔑 Ο πίνακας περνά από τον **ένα** builder (`buildTablePreview` + `realTableColumn`) ⇒ ό,τι δείχνει το πλέγμα της οθόνης
 *    τυπώνεται, με τις ίδιες μετατροπές μονάδων.
 * 🔒 Οι τιμές έρχονται **μόνο** από το {@link PublicationPriceLookup} που χτίζει ο διακομιστής για το κοινό της έκδοσης.
 * @module subapps/catalog/publishing/publication-entries
 */

import type { LocalizedText } from '@/i18n/localized-text';
import type { HumanLanguage } from '@/i18n/languages';
import { catalogSortKey } from '../derived/sort-key';
import { buildTablePreview, realTableColumn, type PreviewRow, type PreviewWords, type TableAttribute, type TablePreview } from '../table/catalog-table';
import type { MeasurementRegistry } from '../measurement/measurement-registry';
import type { CatalogFamilyDefinition, VariantScheme } from '../types/family';
import { resolveInheritedValues, type InheritanceLink, type ResolvedValues } from '../values/resolve-inherited';
import { readSlot } from '../values/value-shape';
import type { ValueTextContext } from '../values/value-text-codec';
import { DEFAULT_LISTING_KIND, type CatalogListingKind } from '../vocabulary/listing-kinds';

/** Η τιμή μιας παραλλαγής για το κοινό της έκδοσης, έτοιμη για κελί· `null` = «ζητήστε προσφορά». */
export type PublicationPriceLookup = (variantId: string) => string | null;

export interface PublicationCode {
  readonly code: string;
  readonly label: string;
}

/** Μοντέλο με παραλλαγές ⇒ σελίδα οικογένειας με αυτόματο πίνακα. */
export interface VariantModelEntry {
  readonly kind: 'variantModel';
  readonly id: string;
  readonly title: string;
  readonly descriptionHtml: string | null;
  readonly imageAssetId: string | null;
  readonly preview: TablePreview;
  readonly priceRowIds: ReadonlySet<string>;
  readonly codes: readonly PublicationCode[];
  readonly listingKind: CatalogListingKind;
}

export interface SimpleProductCard {
  readonly id: string;
  readonly title: string;
  readonly code: string | null;
  readonly imageAssetId: string | null;
  readonly lines: readonly string[];
  readonly price: string | null;
}

/** Απλά προϊόντα μιας οικογένειας ⇒ πλέγμα. */
export interface ProductGridEntry {
  readonly kind: 'productGrid';
  readonly id: string;
  readonly title: string;
  readonly cards: readonly SimpleProductCard[];
  readonly listingKind: CatalogListingKind;
}

export type PublicationEntry = VariantModelEntry | ProductGridEntry;

export interface PublicationChapter {
  readonly id: string;
  readonly title: string;
  readonly entries: readonly PublicationEntry[];
}

export interface PublicationVariant {
  readonly id: string;
  /** Από τη ρίζα ως το SKU. */
  readonly chain: readonly InheritanceLink[];
  readonly identifier: string | null;
  readonly label: string | null;
}

export interface VariantEntryInput {
  readonly id: string;
  readonly family: CatalogFamilyDefinition;
  readonly scheme: VariantScheme;
  readonly model: InheritanceLink;
  readonly variants: readonly PublicationVariant[];
  readonly attributeById: ReadonlyMap<string, TableAttribute>;
  readonly registry: MeasurementRegistry;
  readonly language: HumanLanguage;
  readonly words: PreviewWords & { readonly price: string; readonly installationPrice?: string; readonly askForQuote: string };
  readonly codec: ValueTextContext;
  readonly priceOf: PublicationPriceLookup | null;
  /** Η τιμή τοποθέτησης ανά παραλλαγή (`productWithInstallation`, §22 Υ5). */
  readonly installationPriceOf?: PublicationPriceLookup | null;
  readonly listingKind?: CatalogListingKind;
}

const SCOPE = (language: HumanLanguage) => ({ channel: 'print' as const, locale: language });

/** Κλειδί σειράς ενός άξονα: δηλωμένη σειρά επιλογής · αριθμός μέτρησης · φυσική σειρά κειμένου. */
function axisRank(axis: TableAttribute, resolved: ResolvedValues, language: HumanLanguage): number | string {
  const value = readSlot(resolved.values.get(axis.id)?.slots, axis, 'print', language);
  if (value?.type === 'select' && axis.type === 'select') return axis.config.options.findIndex((option) => option.code === value.optionCode);
  if (value?.type === 'measurement' || value?.type === 'number') return Number(value.amount);
  if (value?.type === 'boolean') return value.value ? 0 : 1;
  return catalogSortKey(value?.type === 'text' ? value.text : '');
}

function compareRank(a: number | string, b: number | string): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

/** Οι παραλλαγές **κατά τους άξονες** (§5.6): με τη σειρά του σχήματος, ισοπαλία ⇒ το id, ποτέ σειρά ανάγνωσης. */
export function sortVariantsByAxes(
  variants: readonly { readonly variant: PublicationVariant; readonly resolved: ResolvedValues }[],
  axes: readonly TableAttribute[],
  language: HumanLanguage,
): typeof variants {
  const ranked = variants.map((entry) => ({ entry, ranks: axes.map((axis) => axisRank(axis, entry.resolved, language)) }));
  ranked.sort((a, b) => {
    for (let index = 0; index < a.ranks.length; index += 1) {
      const order = compareRank(a.ranks[index], b.ranks[index]);
      if (order !== 0) return order;
    }
    return a.entry.variant.id.localeCompare(b.entry.variant.id);
  });
  return ranked.map((item) => item.entry);
}

const PRICE_ROW_ID = 'publication-price';

const INSTALLATION_PRICE_ROW_ID = 'publication-installation-price';

function priceRow(id: string, label: string, priceOf: PublicationPriceLookup, input: VariantEntryInput, ordered: readonly { readonly variant: PublicationVariant }[]): PreviewRow {
  const cells = ordered.map(({ variant }) => priceOf(variant.id) ?? input.words.askForQuote);
  return { kind: 'attribute', id, label, unit: null, filter: null, merge: 'none', cells };
}

/** Οι γραμμές τιμής: του προϊόντος, και της τοποθέτησης **χωριστά** όταν υπάρχει (§22 Υ5), ποτέ άθροισμα. */
function priceRows(input: VariantEntryInput, ordered: readonly { readonly variant: PublicationVariant }[]): PreviewRow[] {
  const { priceOf, installationPriceOf, words } = input;
  if (!priceOf) return [];
  const product = priceRow(PRICE_ROW_ID, words.price, priceOf, input, ordered);
  if (!installationPriceOf) return [product];
  return [product, priceRow(INSTALLATION_PRICE_ROW_ID, words.installationPrice ?? words.price, installationPriceOf, input, ordered)];
}

function firstText(link: InheritanceLink, attributeId: string | null, attributeById: ReadonlyMap<string, TableAttribute>, language: HumanLanguage): string | null {
  const attribute = attributeId ? attributeById.get(attributeId) : undefined;
  if (!attribute) return null;
  const value = readSlot(link.holder.values[attribute.id], attribute, 'print', language);
  if (value?.type === 'text') return value.text;
  return value?.type === 'richText' ? value.html : null;
}

function firstImage(link: InheritanceLink, attributeId: string | null, attributeById: ReadonlyMap<string, TableAttribute>, language: HumanLanguage): string | null {
  const attribute = attributeId ? attributeById.get(attributeId) : undefined;
  if (!attribute) return null;
  const value = readSlot(link.holder.values[attribute.id], attribute, 'print', language);
  return value?.type === 'asset' ? value.assetIds[0] ?? null : null;
}

function descriptionOf(input: VariantEntryInput): string | null {
  for (const attribute of input.attributeById.values()) {
    if (attribute.type !== 'richText') continue;
    const value = readSlot(input.model.holder.values[attribute.id], attribute, 'print', input.language);
    if (value?.type === 'richText') return value.html;
  }
  return null;
}

/** Η σελίδα οικογένειας ενός μοντέλου: `null` όταν η οικογένεια δεν έχει δηλώσει πίνακα. */
export function variantModelEntry(input: VariantEntryInput): VariantModelEntry | null {
  const { family, scheme, attributeById, registry, words, codec, language, model } = input;
  const axisIds = scheme.levels.flatMap((level) => level.axisAttributeIds);
  const axes = axisIds.flatMap((id) => attributeById.get(id) ?? []);
  const resolved = input.variants.map((variant) => ({ variant, resolved: resolveInheritedValues(variant.chain, scheme) }));
  const ordered = sortVariantsByAxes(resolved, axes, language);
  const columns = ordered.map((entry) =>
    realTableColumn({ slotsOf: (id) => entry.resolved.values.get(id)?.slots, scheme, attributeById, scope: SCOPE(language), codec }));
  const preview = buildTablePreview(family, attributeById, registry, words, columns);
  if (!preview) return null;
  const rows = [...preview.rows, ...priceRows(input, ordered)];
  const hasInstallation = input.priceOf !== null && (input.installationPriceOf ?? null) !== null;
  return {
    kind: 'variantModel',
    id: input.id,
    title: firstText(model, family.labelAttributeId, attributeById, language) ?? words.text(family.labels as LocalizedText, family.code),
    descriptionHtml: descriptionOf(input),
    imageAssetId: firstImage(model, family.imageAttributeId, attributeById, language),
    preview: { ...preview, rows },
    priceRowIds: new Set([...(input.priceOf ? [PRICE_ROW_ID] : []), ...(hasInstallation ? [INSTALLATION_PRICE_ROW_ID] : [])]),
    listingKind: input.listingKind ?? DEFAULT_LISTING_KIND,
    codes: ordered.flatMap(({ variant }) => (variant.identifier ? [{ code: variant.identifier, label: variant.label ?? variant.identifier }] : [])),
  };
}
