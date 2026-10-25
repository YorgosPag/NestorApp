/**
 * Zod schemas μοντέλων, προϊόντων και ρυθμίσεων καταλόγου (ADR-923 §5.10) — **δομή** του σώματος
 * αιτήματος. Η σημασιολογία (ανήκει η ιδιότητα στην οικογένεια; σωστό επίπεδο; ενεργή γλώσσα;
 * κανονικό ποσό; όρια;) ζει στο `validate-product-values.ts` και τρέχει **μετά**, σε οθόνη και γραφέα.
 *
 * 🔑 Τα ποσά φτάνουν **ήδη κανονικά** (`"2.50"`): τα κανονικοποιεί ο πελάτης με τον **έναν**
 * αναλυτή (`values/decimal-amount.ts`) τη στιγμή που ξέρει τι πληκτρολόγησε ο άνθρωπος. Ο
 * διακομιστής **δεν** μαντεύει αν το «1.200» ήταν χίλια διακόσια — απορρίπτει ό,τι δεν είναι κανονικό.
 *
 * @module subapps/catalog/schema/zod/product.schema
 */

import { z } from 'zod';
import { HUMAN_LANGUAGES, isHumanLanguage, type HumanLanguage } from '@/i18n/languages';
import type { CatalogSettingsDefinition } from '../../types/catalog-settings';
import {
  ANY_SLOT,
  NO_VALUE_REASONS,
  type AttributeValue,
  type CatalogProductDefinition,
  type CatalogProductModelDefinition,
  type CatalogValueHolder,
  type ProductValues,
} from '../../types/product';
import { CATALOG_CHANNELS, mapCatalogChannels } from '../../vocabulary/channels';
import { CATALOG_LIMITS } from '../../vocabulary/catalog-limits';
import { catalogCodeSchema, entityIdSchema, expectedRevisionSchema, measurementUnitCodeSchema } from './common.schema';

const amountSchema = z.string().max(40);
const idListSchema = (max: number) => z.array(entityIdSchema).max(max);

const tableCellSchema = z.union([z.string().max(CATALOG_LIMITS.maxTextValueLength), z.boolean()]);

/** Η ρητή επισημείωση τύπου είναι η **εγγύηση μεταγλώττισης** ότι schema και `AttributeValue` δεν αποκλίνουν. */
export const attributeValueSchema: z.ZodType<AttributeValue, z.ZodTypeDef, unknown> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().max(CATALOG_LIMITS.maxTextValueLength) }),
  z.object({ type: z.literal('richText'), html: z.string().max(CATALOG_LIMITS.maxRichTextValueLength) }),
  z.object({ type: z.literal('number'), amount: amountSchema }),
  z.object({ type: z.literal('measurement'), amount: amountSchema, unitCode: measurementUnitCodeSchema }),
  z.object({ type: z.literal('boolean'), value: z.boolean() }),
  z.object({ type: z.literal('select'), optionCode: catalogCodeSchema }),
  z.object({ type: z.literal('multiSelect'), optionCodes: z.array(catalogCodeSchema).max(CATALOG_LIMITS.maxSelectOptions) }),
  z.object({ type: z.literal('date'), date: z.string().max(10) }),
  z.object({ type: z.literal('asset'), assetIds: idListSchema(100) }),
  z.object({
    type: z.literal('reference'),
    targets: z.array(z.object({ kind: z.enum(['product', 'productModel']), id: entityIdSchema })).max(100),
  }),
  z.object({
    type: z.literal('table'),
    rows: z.array(z.record(catalogCodeSchema, tableCellSchema)).max(CATALOG_LIMITS.maxTableValueRows),
  }),
]);

const CHANNEL_SLOTS: readonly string[] = [ANY_SLOT, ...CATALOG_CHANNELS];
const LOCALE_SLOTS: readonly string[] = [ANY_SLOT, ...HUMAN_LANGUAGES];

const valueSlotsSchema = z.record(
  z.string().refine((key) => CHANNEL_SLOTS.includes(key)),
  z.record(z.string().refine((key) => LOCALE_SLOTS.includes(key)), attributeValueSchema),
);

const productValuesSchema: z.ZodType<ProductValues, z.ZodTypeDef, unknown> = z
  .record(entityIdSchema, valueSlotsSchema)
  .refine((values) => Object.keys(values).length <= CATALOG_LIMITS.maxAttributesPerFamily);

const holderShape = {
  values: productValuesSchema.default({}),
  noValueReasons: z.record(entityIdSchema, z.enum(NO_VALUE_REASONS)).default({}),
  categoryIds: idListSchema(CATALOG_LIMITS.maxCategoriesPerProduct).default([]),
};

export const valueHolderSchema: z.ZodType<CatalogValueHolder, z.ZodTypeDef, unknown> = z.object(holderShape);

export const productModelDefinitionSchema: z.ZodType<CatalogProductModelDefinition, z.ZodTypeDef, unknown> = z.object({
  ...holderShape,
  code: catalogCodeSchema,
  familyId: entityIdSchema,
  variantSchemeCode: catalogCodeSchema,
  parentId: entityIdSchema.nullable(),
});

export const productDefinitionSchema: z.ZodType<CatalogProductDefinition, z.ZodTypeDef, unknown> = z.object({
  ...holderShape,
  modelId: entityIdSchema.nullable(),
  familyId: entityIdSchema,
});

export const createProductModelBodySchema = z.object({ definition: productModelDefinitionSchema });
export const updateProductModelBodySchema = z.object({
  expectedRevision: expectedRevisionSchema,
  definition: productModelDefinitionSchema,
});

export const createProductBodySchema = z.object({ definition: productDefinitionSchema });
export const updateProductBodySchema = z.object({
  expectedRevision: expectedRevisionSchema,
  definition: productDefinitionSchema,
});

const localeListSchema = z
  .array(z.custom<HumanLanguage>((value) => isHumanLanguage(value)))
  .max(HUMAN_LANGUAGES.length);

/** Ένα κλειδί ανά κανάλι — **παράγεται** από τη ρίζα, ώστε νέο κανάλι να μην μείνει χωρίς γλώσσες. */
export const catalogSettingsSchema: z.ZodType<CatalogSettingsDefinition, z.ZodTypeDef, unknown> = z.object({
  channelLocales: z.object(mapCatalogChannels(() => localeListSchema)),
});
