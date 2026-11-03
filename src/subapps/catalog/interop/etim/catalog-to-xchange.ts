/**
 * Κατάλογος ⇒ έγγραφο ETIM xChange 2.0 (ADR-923 Φάση 7). Καθαρό: οι επιλογές και οι τιμές έρχονται έτοιμες από τον διακομιστή.
 *
 * 🔑 Κριτήριο εξόδου της φάσης: το έγγραφο περνά το **επίσημο** σχήμα. Άγκυρα: `etim-xchange-roundtrip.test.ts`, με Ajv.
 * 🔑 **Καμία μαντεψιά στην έξοδο**: ό,τι δεν εκφράζεται με βεβαιότητα (ιδιότητα σε μονάδα χωρίς δήλωση, επιλογή χωρίς κωδικό
 * ETIM, οικογένεια χωρίς κλάση) παραλείπεται και μετριέται στην {@link XChangeExportReport}, ποτέ σιωπηλά.
 * 🔒 Οι τιμές έρχονται **μόνο** ως `price` του κάθε SKU, κριμένες για το κοινό από τον διακομιστή (§12, `xchange-pricing.ts`).
 *    Χωρίς τιμή ⇒ `PriceOnRequest`. Η μονάδα παραγγελίας είναι η μονάδα της τιμής· χωρίς τιμή μένει το «τεμάχιο».
 * @module subapps/catalog/interop/etim/catalog-to-xchange
 */

import type { HumanLanguage } from '@/i18n/languages';
import { convertMeasurement, toFixedDecimal } from '../../measurement/conversion';
import type { MeasurementRegistry } from '../../measurement/measurement-registry';
import type { CatalogAttributeDefinition } from '../../types/attribute';
import type { CatalogFamilyDefinition } from '../../types/family';
import type { AttributeValue, NoValueReason, ValueSlots } from '../../types/product';
import { readSlot } from '../../values/value-shape';
import { ETIM_LANGUAGE_TAG, ETIM_MAX_FRACTION_DIGITS, ETIM_PIECE_UNIT, ETIM_REASON_OF, ETIM_XCHANGE_SCHEMA_VERSION } from '../../vocabulary/etim';
import type { XChangeTradePrice } from './xchange-pricing';

export interface XChangeProductSource {
  readonly identifier: string;
  readonly label: string;
  readonly familyId: string;
  /** Οι τιμές **με την κληρονομιά λυμένη**: το xChange δεν έχει μοντέλο. */
  readonly values: ReadonlyMap<string, ValueSlots>;
  readonly noValueReasons: ReadonlyMap<string, NoValueReason>;
  /** Η τιμή για το κοινό του αρχείου, χωρίς ΦΠΑ. `null` = «ζητήστε προσφορά». */
  readonly price: XChangeTradePrice | null;
}

export interface XChangeExportInput {
  readonly catalogueId: string;
  readonly language: HumanLanguage;
  readonly validFrom: string;
  readonly generatedOn: string;
  /** Από πότε ισχύουν οι τιμές (η έκδοση του τιμοκαταλόγου), ως ημερομηνία· `null` ⇒ αρχείο χωρίς τιμές. */
  readonly priceValidityDate: string | null;
  readonly currency: string;
  readonly supplier: { readonly name: string; readonly vatNumber: string | null };
  readonly families: ReadonlyMap<string, Pick<CatalogFamilyDefinition, 'etimClass' | 'attributes'>>;
  readonly attributes: ReadonlyMap<string, CatalogAttributeDefinition>;
  readonly registry: MeasurementRegistry;
  readonly products: readonly XChangeProductSource[];
}

export interface XChangeExportReport {
  readonly products: number;
  /** SKU σε οικογένεια χωρίς κλάση ETIM: βγαίνουν χωρίς τεχνικά στοιχεία. */
  readonly withoutClass: number;
  /** Χαρακτηριστικά που δεν γράφτηκαν, ανά αιτία. */
  readonly unitUndeclared: readonly string[];
  readonly optionUnmapped: readonly string[];
  readonly typeUnsupported: readonly string[];
}

type XChangeFeatureOutput = { readonly EtimFeatureCode: string } & Readonly<Record<string, string | boolean>>;

class ExportNotes {
  withoutClass = 0;
  readonly unitUndeclared = new Set<string>();
  readonly optionUnmapped = new Set<string>();
  readonly typeUnsupported = new Set<string>();
}

/** Το ποσό στη μορφή του `EtimValueNumeric`: έως 4 δεκαδικά, χωρίς τελικά μηδενικά. */
const numericOf = (value: number): string => toFixedDecimal(value, ETIM_MAX_FRACTION_DIGITS).replace(/\.?0+$/, '');

function measurementFeature(code: string, attribute: CatalogAttributeDefinition, value: Extract<AttributeValue, { type: 'measurement' }>, input: XChangeExportInput, notes: ExportNotes): XChangeFeatureOutput | null {
  const unit = attribute.mappings.etimUnitCode ?? null;
  const family = attribute.type === 'measurement' ? input.registry.get(attribute.config.measurementFamilyCode) : undefined;
  if (unit === null || !family) {
    notes.unitUndeclared.add(code);
    return null;
  }
  return { EtimFeatureCode: code, EtimValueNumeric: numericOf(convertMeasurement(family, Number(value.amount), value.unitCode, unit)) };
}

function selectFeature(code: string, attribute: CatalogAttributeDefinition, optionCode: string, notes: ExportNotes): XChangeFeatureOutput | null {
  const options = attribute.type === 'select' ? attribute.config.options : [];
  const etimValue = options.find((option) => option.code === optionCode)?.etimValue ?? null;
  if (etimValue === null) notes.optionUnmapped.add(code);
  return etimValue === null ? null : { EtimFeatureCode: code, EtimValueCode: etimValue };
}

function featureOf(code: string, attribute: CatalogAttributeDefinition, value: AttributeValue, input: XChangeExportInput, notes: ExportNotes): XChangeFeatureOutput | null {
  switch (value.type) {
    case 'measurement':
      return measurementFeature(code, attribute, value, input, notes);
    case 'number':
      return { EtimFeatureCode: code, EtimValueNumeric: numericOf(Number(value.amount)) };
    case 'boolean':
      return { EtimFeatureCode: code, EtimValueLogical: value.value };
    case 'select':
      return selectFeature(code, attribute, value.optionCode, notes);
    default:
      notes.typeUnsupported.add(code);
      return null;
  }
}

function featuresOf(product: XChangeProductSource, family: Pick<CatalogFamilyDefinition, 'attributes'>, input: XChangeExportInput, notes: ExportNotes): XChangeFeatureOutput[] {
  return family.attributes.flatMap(({ attributeId }) => {
    const attribute = input.attributes.get(attributeId);
    const code = attribute?.mappings.etimFeature ?? null;
    if (!attribute || code === null) return [];
    const reason = product.noValueReasons.get(attributeId);
    if (reason) return [{ EtimFeatureCode: code, ReasonNoValue: ETIM_REASON_OF[reason] }];
    const value = readSlot(product.values.get(attributeId), attribute, 'storefront', input.language);
    return (value && featureOf(code, attribute, value, input, notes)) || [];
  });
}

function classificationOf(product: XChangeProductSource, input: XChangeExportInput, notes: ExportNotes) {
  const family = input.families.get(product.familyId);
  if (!family?.etimClass) {
    notes.withoutClass += 1;
    return {};
  }
  return { EtimClassification: [{ EtimReleaseVersion: 'DYNAMIC', EtimClassCode: family.etimClass, EtimDynamicReleaseDate: input.generatedOn, EtimFeatures: featuresOf(product, family, input, notes) }] };
}

/** Μήκος `MinimalProductDescription` στο σχήμα. */
const MINIMAL_DESCRIPTION_MAX = 80;

function pricingOf(price: XChangeTradePrice | null, validityDate: string | null) {
  if (price === null) return { PriceUnit: ETIM_PIECE_UNIT, PriceQuantity: '1', PriceOnRequest: true };
  return {
    PriceUnit: price.unit,
    PriceQuantity: String(price.quantity),
    ...(price.grossList === null ? {} : { GrossListPrice: price.grossList }),
    ...(price.net === null ? {} : { NetPrice: price.net }),
    ...(validityDate === null ? {} : { PriceValidityDate: validityDate }),
  };
}

function tradeItemOf(product: XChangeProductSource, input: XChangeExportInput) {
  return {
    ItemIdentification: { SupplierItemNumber: product.identifier },
    Ordering: { OrderUnit: product.price?.unit ?? ETIM_PIECE_UNIT, MinimumOrderQuantity: '1', OrderStepSize: '1' },
    Pricing: [pricingOf(product.price, input.priceValidityDate)],
  };
}

function productOf(product: XChangeProductSource, input: XChangeExportInput, notes: ExportNotes) {
  return {
    ProductIdentification: { ManufacturerName: input.supplier.name, ManufacturerProductNumber: product.identifier },
    ProductDetails: {
      ProductDescriptions: [{ DescriptionLanguage: ETIM_LANGUAGE_TAG[input.language], MinimalProductDescription: product.label.slice(0, MINIMAL_DESCRIPTION_MAX) }],
    },
    ...classificationOf(product, input, notes),
    TradeItem: [tradeItemOf(product, input)],
  };
}

export function buildXChangeDocument(input: XChangeExportInput) {
  const notes = new ExportNotes();
  const document = {
    SchemaVersion: ETIM_XCHANGE_SCHEMA_VERSION,
    CatalogueId: input.catalogueId,
    CatalogueType: 'FULL',
    GenerationDate: input.generatedOn,
    CatalogueValidityStart: input.validFrom,
    Language: [ETIM_LANGUAGE_TAG[input.language]],
    CurrencyCode: input.currency,
    Supplier: [{
      SupplierName: input.supplier.name,
      ...(input.supplier.vatNumber === null ? {} : { SupplierVatNo: input.supplier.vatNumber }),
      Product: input.products.map((product) => productOf(product, input, notes)),
    }],
  };
  const report: XChangeExportReport = {
    products: input.products.length,
    withoutClass: notes.withoutClass,
    unitUndeclared: [...notes.unitUndeclared].sort(),
    optionUnmapped: [...notes.optionUnmapped].sort(),
    typeUnsupported: [...notes.typeUnsupported].sort(),
  };
  return { document, report };
}

/** Το έγγραφο όπως το χτίζει ο προσαρμογέας: αυτό κρίνει το επίσημο σχήμα. */
export type XChangeDocument = ReturnType<typeof buildXChangeDocument>['document'];
