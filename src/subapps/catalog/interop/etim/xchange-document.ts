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

/**
 * Μία εγγραφή `TradeItem.Pricing` (ETIM xChange Guideline V2.0). Οι εγγραφές ξεχωρίζουν με **περίοδο ισχύος**
 * (EX000211/212), όχι με κλιμάκιο: τα κλιμάκια είναι `AllowanceSurcharge` (EX000220), που κρατάμε μόνο ως πλήθος.
 * 🔑 Όλα προαιρετικά **εδώ**, ακόμη κι όσα το πρότυπο θέλει υποχρεωτικά: μια ελλιπής τιμή δεν πρέπει να ρίχνει την
 * εισαγωγή **ιδιοτήτων**. Την πληρότητα την κρίνει ο προσαρμογέας τιμών, και ό,τι λείπει μετριέται.
 */
const pricingSchema = z.object({
  PriceUnit: z.string().optional(),
  PriceQuantity: z.string().optional(),
  PriceOnRequest: z.boolean().optional(),
  GrossListPrice: z.string().optional(),
  NetPrice: z.string().optional(),
  PriceValidityDate: z.string().optional(),
  PriceExpiryDate: z.string().optional(),
  AllowanceSurcharge: z.array(z.unknown()).default([]),
});

/**
 * Συνημμένο (ETIM xChange 2.0, `ProductAttachments` / `ItemAttachments`, EX000028–EX000032 · ADR-934 §5.2). **Δύο επίπεδα**:
 * ο τύπος (`AttachmentType` · `AttachmentTypeSpecification` · `AttachmentOrder`, μόνο στο προϊόν) και από κάτω οι
 * λεπτομέρειες — ένα αρχείο η καθεμία (π.χ. ένα ανά γλώσσα).
 * 🔑 Όλα ανεκτικά **εδώ**, όπως οι τιμές: κακό συνημμένο δεν ρίχνει την εισαγωγή ιδιοτήτων. Ό,τι δεν διαβάζεται μετριέται.
 */
const attachmentDetailSchema = z.object({
  AttachmentUri: z.string().optional(),
  AttachmentFilename: z.string().optional(),
  AttachmentLanguage: z.array(z.string()).default([]),
  AttachmentIssueDate: z.string().optional(),
  AttachmentExpiryDate: z.string().optional(),
});

const attachmentSchema = z.object({
  AttachmentType: z.string(),
  AttachmentTypeSpecification: z.string().optional(),
  AttachmentOrder: z.number().int().optional(),
  AttachmentDetails: z.array(attachmentDetailSchema).default([]),
});

/**
 * Λίστα συνημμένων που **δεν** ρίχνει το έγγραφο: απούσα ή όχι λίστα ⇒ κενή. Κάθε στοιχείο μένει **ωμό** και κρίνεται
 * χωριστά από το {@link readXChangeAttachment}: ένα στραβό συνημμένο δεν παίρνει μαζί του τα σωστά του ίδιου προϊόντος,
 * και η απόρριψή του **μετριέται** στην αναφορά αντί να χαθεί μέσα σε ένα `catch`.
 */
const attachmentListSchema = z.array(z.unknown()).catch([]);

/** Λίστα GTIN του σχήματος (`^[0-9]{8,14}$`). Εδώ **κάθε** κείμενο: το άκυρο γίνεται εύρημα στο κελί, όχι αόρατη απόρριψη αρχείου. */
const gtinListSchema = z.array(z.string()).default([]);

const tradeItemSchema = z.object({
  ItemIdentification: z.object({ SupplierItemNumber: z.string(), ItemGtin: gtinListSchema }),
  Pricing: z.array(pricingSchema).default([]),
  ItemAttachments: attachmentListSchema,
});

const productSchema = z.object({
  // ADR-934 Σ1γ: η ταυτότητα εμπορίου. Όλα προαιρετικά **εδώ** (το σχήμα θέλει υποχρεωτικό το `ManufacturerName`): ελλιπής
  // ταυτότητα δεν πρέπει να ρίχνει την εισαγωγή ιδιοτήτων — ό,τι λείπει απλώς δεν γίνεται κελί.
  ProductIdentification: z.object({
    ManufacturerName: z.string().optional(),
    ManufacturerProductNumber: z.string(),
    ProductGtin: gtinListSchema,
    BrandName: z.string().optional(),
    BrandDetails: z.array(z.object({ BrandSeries: z.array(seriesSchema).default([]) })).default([]),
  }),
  ProductDetails: z.object({ ProductDescriptions: z.array(descriptionSchema).default([]) }).optional(),
  EtimClassification: z.array(classificationSchema).default([]),
  TradeItem: z.array(tradeItemSchema).default([]),
  ProductAttachments: attachmentListSchema,
});

const documentSchema = z.object({
  // Το πεδίο εμφανίστηκε στο 2.0: τα 1.x δεν το έχουν, και το απαιτούμενο `CatalogueId` ξεχωρίζει το έγγραφο.
  SchemaVersion: z.literal(ETIM_XCHANGE_SCHEMA_VERSION).optional(),
  CatalogueId: z.string(),
  // EX000219 · ISO 4217 · προαιρετικό: η απουσία του δεν λέει «ευρώ»· το λέει, δηλωμένα, όποιος διαβάζει τις τιμές.
  CurrencyCode: z.string().optional(),
  Supplier: z.array(z.object({ Product: z.array(productSchema) })).min(1),
});

export type XChangeFeature = z.infer<typeof featureSchema>;
export type XChangeProduct = z.infer<typeof productSchema>;
export type XChangePricingEntry = z.infer<typeof pricingSchema>;
export type XChangeAttachment = z.infer<typeof attachmentSchema>;

/** Ένα ωμό συνημμένο ⇒ η στενή όψη του, ή `null` όταν δεν είναι συνημμένο που διαβάζουμε (ο καλών το μετρά). */
export function readXChangeAttachment(raw: unknown): XChangeAttachment | null {
  const parsed = attachmentSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export interface XChangeDocumentView {
  /** Το `CurrencyCode` του εγγράφου, ή `null` όταν το αρχείο δεν το δηλώνει. */
  readonly currency: string | null;
  readonly products: readonly XChangeProduct[];
}

/** Η στενή όψη του αρχείου: νόμισμα και τα προϊόντα όλων των προμηθευτών του. `null` = δεν είναι έγγραφο xChange που διαβάζουμε. */
export function readXChangeDocument(text: string): XChangeDocumentView | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success) return null;
  return { currency: parsed.data.CurrencyCode ?? null, products: parsed.data.Supplier.flatMap((supplier) => supplier.Product) };
}
