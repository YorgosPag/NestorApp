/**
 * Προϊόντα xChange ⇒ `ExtractedGroup[]` (ADR-923 §5.5.1): ο προσαρμογέας προς τη μία ουδέτερη μορφή. Από εδώ και κάτω ο
 * αγωγός δεν ξέρει από πού ήρθαν τα δεδομένα: ίδιος κωδικοποιητής, ίδια σύγκριση τριών σημείων, ίδια έγκριση ανθρώπου.
 *
 * 🔑 **Το xChange γράφει τον αριθμό χωρίς μονάδα**: τη μονάδα την ορίζει η κλάση ETIM. Τη δηλώνει η ιδιότητα
 * (`mappings.etimUnitCode`). Αδήλωτη ⇒ `unitCode: null`, άρα απόφαση ανθρώπου και ποτέ η προεπιλογή της ιδιότητας (σφάλμα ×1000).
 * 🔑 **Τίποτα δεν χάνεται σιωπηλά**: ό,τι δεν μπαίνει μετριέται στην {@link XChangeImportReport}.
 * @module subapps/catalog/interop/etim/xchange-to-groups
 */

import type { HumanLanguage } from '@/i18n/languages';
import { byModelCode, type TableRow } from '../../import/apply-column-rules';
import type { CatalogAttributeDefinition } from '../../types/attribute';
import type { ExtractedCell, ExtractedGroup, ExtractedRow } from '../../types/catalog-import';
import { ANY_SLOT } from '../../types/product';
import { localeSlotFor } from '../../values/value-shape';
import { ETIM_LANGUAGE_TAG, ETIM_NO_VALUE_REASON_OF, isEtimImperialFeature } from '../../vocabulary/etim';
import type { XChangeFeature, XChangeProduct } from './xchange-document';
import type { XChangeImportReport } from './xchange-report';

export type XChangeAttribute = CatalogAttributeDefinition & { readonly id: string };

export interface XChangeImportSchema {
  /** `null` = η οικογένεια δεν έχει δηλωμένη κλάση, άρα μετρούν όλα τα προϊόντα του αρχείου. */
  readonly etimClass: string | null;
  readonly attributes: readonly XChangeAttribute[];
  readonly labelAttributeId: string | null;
  readonly hasVariants: boolean;
  readonly language: HumanLanguage;
}

const cellOf = (attribute: XChangeAttribute, language: HumanLanguage, text: string, unitCode: string | null): ExtractedCell => ({
  target: { kind: 'attribute', attributeId: attribute.id, channel: ANY_SLOT, locale: localeSlotFor(attribute, language) },
  text,
  confidence: 1,
  anchor: null,
  unitCode,
  flags: [],
});

function codeText(attribute: XChangeAttribute, valueCode: string): string {
  if (attribute.type !== 'select' && attribute.type !== 'multiSelect') return valueCode;
  return attribute.config.options.find((option) => option.etimValue === valueCode)?.code ?? valueCode;
}

/** Το κείμενο του χαρακτηριστικού, ή `null` αν δεν λέει τιμή. Εύρος με ίσα άκρα είναι απλή τιμή. */
function featureText(feature: XChangeFeature, attribute: XChangeAttribute): string | null {
  if (feature.EtimValueCode !== undefined) return codeText(attribute, feature.EtimValueCode);
  if (feature.EtimValueLogical !== undefined) return String(feature.EtimValueLogical);
  if (feature.EtimValueNumeric !== undefined) return feature.EtimValueNumeric;
  const lower = feature.EtimValueRangeLower;
  return lower !== undefined && lower === feature.EtimValueRangeUpper ? lower : null;
}

const unitOf = (attribute: XChangeAttribute): string | null => (attribute.type === 'measurement' ? attribute.mappings.etimUnitCode ?? null : null);

const isOpenRange = (feature: XChangeFeature): boolean =>
  (feature.EtimValueRangeLower !== undefined || feature.EtimValueRangeUpper !== undefined) && feature.EtimValueRangeLower !== feature.EtimValueRangeUpper;

function descriptionOf(product: XChangeProduct, language: HumanLanguage): string | null {
  const descriptions = product.ProductDetails?.ProductDescriptions ?? [];
  const tag = ETIM_LANGUAGE_TAG[language];
  return (descriptions.find((entry) => entry.DescriptionLanguage === tag) ?? descriptions[0])?.MinimalProductDescription ?? null;
}

/** Ο κωδικός του SKU: του προμηθευτή όπου υπάρχει, αλλιώς του κατασκευαστή. */
const identifierOf = (product: XChangeProduct): string =>
  product.TradeItem[0]?.ItemIdentification.SupplierItemNumber ?? product.ProductIdentification.ManufacturerProductNumber;

const seriesOf = (product: XChangeProduct): string | null => product.ProductIdentification.BrandDetails[0]?.BrandSeries[0]?.BrandSeries ?? null;

class ReportBuilder {
  otherClassProducts = 0;
  imported = 0;
  declaredNoValue = 0;
  extraTradeItems = 0;
  readonly otherClasses = new Set<string>();
  readonly unmapped = new Set<string>();
  readonly ranges = new Set<string>();

  noteFeature(feature: XChangeFeature, attribute: XChangeAttribute | undefined): void {
    const code = feature.EtimFeatureCode;
    if (!attribute) {
      if (!isEtimImperialFeature(code)) this.unmapped.add(code);
    } else if (isOpenRange(feature)) {
      this.ranges.add(code);
    } else if (feature.ReasonNoValue !== undefined && ETIM_NO_VALUE_REASON_OF[feature.ReasonNoValue]) {
      this.declaredNoValue += 1;
    }
  }

  build(products: number): XChangeImportReport {
    return {
      products,
      imported: this.imported,
      otherClasses: [...this.otherClasses].sort(),
      otherClassProducts: this.otherClassProducts,
      unmappedFeatures: [...this.unmapped].sort(),
      rangeFeatures: [...this.ranges].sort(),
      declaredNoValue: this.declaredNoValue,
      extraTradeItems: this.extraTradeItems,
    };
  }
}

function classificationOf(product: XChangeProduct, schema: XChangeImportSchema, report: ReportBuilder) {
  const { etimClass } = schema;
  const match = etimClass === null ? product.EtimClassification[0] : product.EtimClassification.find((entry) => entry.EtimClassCode === etimClass);
  if (match || etimClass === null) return match;
  report.otherClassProducts += 1;
  for (const entry of product.EtimClassification) report.otherClasses.add(entry.EtimClassCode);
  return null;
}

function featureCells(features: readonly XChangeFeature[], schema: XChangeImportSchema, byFeature: ReadonlyMap<string, XChangeAttribute>, report: ReportBuilder): ExtractedCell[] {
  return features.flatMap((feature) => {
    const attribute = byFeature.get(feature.EtimFeatureCode);
    report.noteFeature(feature, attribute);
    const text = attribute ? featureText(feature, attribute) : null;
    return attribute && text !== null ? [cellOf(attribute, schema.language, text, unitOf(attribute))] : [];
  });
}

function identityCells(product: XChangeProduct, schema: XChangeImportSchema): ExtractedCell[] {
  const identifier = schema.attributes.find((attribute) => attribute.unique);
  const label = schema.attributes.find((attribute) => attribute.id === schema.labelAttributeId);
  const description = descriptionOf(product, schema.language);
  return [
    ...(identifier ? [cellOf(identifier, schema.language, identifierOf(product), null)] : []),
    ...(label && label !== identifier && description !== null ? [cellOf(label, schema.language, description, null)] : []),
  ];
}

function tableRowOf(product: XChangeProduct, index: number, schema: XChangeImportSchema, byFeature: ReadonlyMap<string, XChangeAttribute>, report: ReportBuilder): TableRow | null {
  const classification = classificationOf(product, schema, report);
  if (classification === null) return null;
  report.imported += 1;
  if (product.TradeItem.length > 1) report.extraTradeItems += 1;
  const cells = [...identityCells(product, schema), ...featureCells(classification?.EtimFeatures ?? [], schema, byFeature, report)];
  const row: ExtractedRow = { rowKey: `p${index + 1}`, cells };
  return { modelCode: schema.hasVariants ? seriesOf(product) : null, row };
}

export function extractGroupsFromXChange(products: readonly XChangeProduct[], schema: XChangeImportSchema): { readonly groups: readonly ExtractedGroup[]; readonly report: XChangeImportReport } {
  const byFeature = new Map(schema.attributes.flatMap((attribute) => (attribute.mappings.etimFeature ? [[attribute.mappings.etimFeature, attribute] as const] : [])));
  const report = new ReportBuilder();
  const rows = products.flatMap((product, index) => tableRowOf(product, index, schema, byFeature, report) ?? []);
  return { groups: byModelCode(rows), report: report.build(products.length) };
}
