/**
 * **Το δημόσιο έγγραφο μοντέλου** (ADR-923 §5.13 Σ2 · Ε4 · Δ1): ό,τι βλέπει ο ανώνυμος, σε κλειστό σχήμα.
 *
 * 🔒 Κάθε αντικείμενο είναι `strict`: κλειδί που δεν δηλώνεται εδώ κάνει το έγγραφο άκυρο, δεν περνά σιωπηλά.
 * 🔒 Κανένα χρηματικό ποσό (Ε4). Γι' αυτό η αριθμητική τιμή λέγεται `value` και όχι `amount`: έτσι η άγκυρα
 *    απαγορεύει ολόκληρη την οικογένεια κλειδιών ποσού, χωρίς εξαίρεση.
 * 🔒 Οι τύποι `reference` και `table` δεν υπάρχουν εδώ: η αναφορά μπορεί να δείχνει κρυφό προϊόν και ο πίνακας μπορεί
 *    να κρατά στήλη τιμής. Το `asset` φτάνει μόνο ως μέσο με ελεγμένα δικαιώματα.
 *
 * 🔑 Το `schemaVersion` είναι η άδεια για μελλοντική προσθήκη (Κοινό Λεξικό, Φ8): νέο πεδίο ανεβάζει την έκδοση.
 *
 * @module subapps/catalog/public/public-catalog-schema
 */

import { z } from 'zod';

import { HUMAN_LANGUAGES, type HumanLanguage } from '@/i18n/languages';

export const PUBLIC_CATALOG_SCHEMA_VERSION = 1;

const languageSchema = z.enum(HUMAN_LANGUAGES as unknown as [HumanLanguage, ...HumanLanguage[]]);
const localizedTextSchema = z.record(languageSchema, z.string());

const publicOptionSchema = z.object({ optionCode: z.string(), labels: localizedTextSchema }).strict();

const publicValueSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }).strict(),
  z.object({ type: z.literal('richText'), html: z.string() }).strict(),
  z.object({ type: z.literal('number'), value: z.string() }).strict(),
  z.object({ type: z.literal('measurement'), value: z.string(), unitCode: z.string() }).strict(),
  z.object({ type: z.literal('boolean'), value: z.boolean() }).strict(),
  z.object({ type: z.literal('option'), option: publicOptionSchema }).strict(),
  z.object({ type: z.literal('options'), options: z.array(publicOptionSchema) }).strict(),
  z.object({ type: z.literal('date'), date: z.string() }).strict(),
]);

const publicAttributeSchema = z
  .object({ attributeId: z.string(), labels: localizedTextSchema, values: z.record(languageSchema, publicValueSchema) })
  .strict();

const publicMediaSchema = z.object({ assetId: z.string(), url: z.string(), labels: localizedTextSchema }).strict();

const publicVariantSchema = z
  .object({
    variantId: z.string(),
    code: z.string().nullable(),
    label: z.string().nullable(),
    attributes: z.array(publicAttributeSchema),
    media: z.array(publicMediaSchema),
  })
  .strict();

export const publicCatalogModelSchema = z
  .object({
    schemaVersion: z.literal(PUBLIC_CATALOG_SCHEMA_VERSION),
    companyId: z.string(),
    modelId: z.string(),
    kind: z.enum(['productModel', 'product']),
    code: z.string(),
    familyId: z.string(),
    familyLabels: localizedTextSchema,
    categoryIds: z.array(z.string()),
    locales: z.array(languageSchema),
    attributes: z.array(publicAttributeSchema),
    media: z.array(publicMediaSchema),
    variants: z.array(publicVariantSchema).min(1),
  })
  .strict();

export type PublicCatalogModel = z.infer<typeof publicCatalogModelSchema>;
export type PublicCatalogVariant = z.infer<typeof publicVariantSchema>;
export type PublicCatalogAttribute = z.infer<typeof publicAttributeSchema>;
export type PublicCatalogValue = z.infer<typeof publicValueSchema>;
export type PublicCatalogOption = z.infer<typeof publicOptionSchema>;
export type PublicCatalogMedia = z.infer<typeof publicMediaSchema>;
