/**
 * Zod της **συνταγής έκδοσης** (ADR-923 §5.6) — η δομή του συνόρου. Η σημασία κρίνεται στο `validatePublicationRecipe`
 * (ίδια συνάρτηση με τη φόρμα) και στον γραφέα (αναφορές, κοινό τιμών).
 * @module subapps/catalog/schema/zod/publication.schema
 */

import { z } from 'zod';

import { HUMAN_LANGUAGES } from '@/i18n/languages';
import { PUBLICATION_FONT_CODES } from '../../publishing/publication-fonts';
import {
  PUBLICATION_LIMITS,
  PUBLICATION_OPTIONAL_TEMPLATES,
  PUBLICATION_OUTPUT_PROFILES,
  PUBLICATION_PAPER_SIZES,
  TABLE_GROUP_STYLES,
} from '../../publishing/publication-vocabulary';
import type { PublicationRecipeDefinition } from '../../types/publication';
import { CATALOG_LIMITS } from '../../vocabulary/catalog-limits';
import { catalogCodeSchema, entityIdSchema, expectedRevisionSchema, labelsSchema, localizedTextSchema } from './common.schema';
import { priceAudienceSchema } from './price-list.schema';

const percentSchema = z.number().min(0).max(100);

const colourSchema = z.object({
  rgb: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  cmyk: z.tuple([percentSchema, percentSchema, percentSchema, percentSchema]),
});

const selectionEntrySchema = z.object({ kind: z.enum(['productModel', 'product']), id: entityIdSchema });

const scopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({ kind: z.literal('categories'), categoryIds: z.array(entityIdSchema).max(PUBLICATION_LIMITS.maxCategories) }),
  z.object({ kind: z.literal('selection'), entries: z.array(selectionEntrySchema).max(PUBLICATION_LIMITS.maxSelectionEntries) }),
]);

const pricingSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('priced'), priceListId: entityIdSchema, priceListVersionId: entityIdSchema, audience: priceAudienceSchema }),
]);

const themeSchema = z.object({
  fontCode: z.enum(PUBLICATION_FONT_CODES as unknown as [string, ...string[]]),
  logoAssetId: entityIdSchema.nullable(),
  primary: colourSchema,
  accent: colourSchema,
});

const templatesSchema = z.object({
  enabled: z.array(z.enum(PUBLICATION_OPTIONAL_TEMPLATES)),
  groupStyle: z.enum(TABLE_GROUP_STYLES),
  gridColumns: z.number().int().min(1).max(5),
});

export const publicationRecipeDefinitionSchema = z.object({
  code: catalogCodeSchema,
  labels: labelsSchema,
  title: localizedTextSchema(CATALOG_LIMITS.maxLabelLength),
  scope: scopeSchema,
  pricing: pricingSchema,
  language: z.enum(HUMAN_LANGUAGES as unknown as [string, ...string[]]),
  theme: themeSchema,
  templates: templatesSchema,
  profiles: z.array(z.enum(PUBLICATION_OUTPUT_PROFILES)).max(PUBLICATION_OUTPUT_PROFILES.length),
  paper: z.enum(PUBLICATION_PAPER_SIZES),
  footerNote: localizedTextSchema(PUBLICATION_LIMITS.maxFooterNoteLength),
}) as unknown as z.ZodType<PublicationRecipeDefinition, z.ZodTypeDef, unknown>;

export const createPublicationRecipeBodySchema = z.object({ definition: publicationRecipeDefinitionSchema });

export const updatePublicationRecipeBodySchema = z.object({ expectedRevision: expectedRevisionSchema, definition: publicationRecipeDefinitionSchema });

/** Μόνο το μοντέλο: τη συνταγή τη διαλέγει ο διακομιστής, γιατί ο κριτής `products` δεν διαβάζει συνταγές. */
export const publicationPreviewBodySchema = z.object({ modelId: entityIdSchema }).strict();

/** Η πράξη «έκδοση» δεν έχει σώμα: όλα τα δίνει η αποθηκευμένη συνταγή. */
export const runPublicationBodySchema = z.object({}).strict();
