/**
 * Ανάγνωση αρχείου ETIM xChange (ADR-923 §5.5 · Φάση 7): JSON ⇒ η στενή όψη που χρειάζεται η εισαγωγή.
 *
 * 🔑 Το αρχείο έρχεται από τρίτο, άρα το σύνορο είναι ρητό: κρατάμε **μόνο** ό,τι διαβάζουμε, και κάθε άλλο πεδίο του
 * προτύπου (νομοθεσία, LCA, συσκευασίες) αγνοείται χωρίς να απορρίπτεται το αρχείο.
 * @module subapps/catalog/interop/etim/xchange-document
 */

import { z } from 'zod';

import { ETIM_XCHANGE_SCHEMA_VERSION } from '../../vocabulary/etim';

const featureSchema = z.object({
  EtimFeatureCode: z.string(),
  EtimValueCode: z.string().optional(),
  EtimValueNumeric: z.string().optional(),
  EtimValueRangeLower: z.string().optional(),
  EtimValueRangeUpper: z.string().optional(),
  EtimValueLogical: z.boolean().optional(),
  ReasonNoValue: z.string().optional(),
});

const classificationSchema = z.object({
  EtimClassCode: z.string(),
  EtimFeatures: z.array(featureSchema).default([]),
});

const descriptionSchema = z.object({
  DescriptionLanguage: z.string().optional(),
  MinimalProductDescription: z.string(),
});

const seriesSchema = z.object({ BrandSeries: z.string() });

const productSchema = z.object({
  ProductIdentification: z.object({
    ManufacturerProductNumber: z.string(),
    BrandDetails: z.array(z.object({ BrandSeries: z.array(seriesSchema).default([]) })).default([]),
  }),
  ProductDetails: z.object({ ProductDescriptions: z.array(descriptionSchema).default([]) }).optional(),
  EtimClassification: z.array(classificationSchema).default([]),
  TradeItem: z.array(z.object({ ItemIdentification: z.object({ SupplierItemNumber: z.string() }) })).default([]),
});

const documentSchema = z.object({
  // Το πεδίο εμφανίστηκε στο 2.0: τα 1.x δεν το έχουν, και το απαιτούμενο `CatalogueId` ξεχωρίζει το έγγραφο.
  SchemaVersion: z.literal(ETIM_XCHANGE_SCHEMA_VERSION).optional(),
  CatalogueId: z.string(),
  Supplier: z.array(z.object({ Product: z.array(productSchema) })).min(1),
});

export type XChangeFeature = z.infer<typeof featureSchema>;
export type XChangeProduct = z.infer<typeof productSchema>;

/** Τα προϊόντα του αρχείου, από όλους τους προμηθευτές του. `null` = δεν είναι έγγραφο xChange που διαβάζουμε. */
export function readXChangeProducts(text: string): readonly XChangeProduct[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
  const parsed = documentSchema.safeParse(raw);
  return parsed.success ? parsed.data.Supplier.flatMap((supplier) => supplier.Product) : null;
}
