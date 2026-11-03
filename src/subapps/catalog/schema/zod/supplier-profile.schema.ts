/**
 * Το σύρμα του προφίλ παρόχου (ADR-923 §22 Υ8). Μορφή και όρια εδώ· η σημασιολογία στο `validate-supplier-profile.ts`.
 *
 * @module subapps/catalog/schema/zod/supplier-profile.schema
 */

import { z } from 'zod';

import { HUMAN_LANGUAGES, type HumanLanguage } from '@/i18n/languages';

import {
  MAX_PORTFOLIO_PROJECT_IMAGES,
  MAX_PORTFOLIO_PROJECTS,
  MAX_PORTFOLIO_YEAR,
  MAX_PROFILE_TEXT_LENGTH,
  MAX_QUOTE_RECIPIENT_EMAIL_LENGTH,
  MIN_PORTFOLIO_YEAR,
  QUOTE_INTAKE_OFF,
  type CatalogQuoteIntake,
  type CatalogSupplierProfileDefinition,
} from '../../types/supplier-profile';
import { entityIdSchema } from './common.schema';

const languageSchema = z.enum(HUMAN_LANGUAGES as unknown as [HumanLanguage, ...HumanLanguage[]]);
const profileTextSchema = z.record(languageSchema, z.string().max(MAX_PROFILE_TEXT_LENGTH));

const portfolioProjectSchema = z
  .object({
    id: entityIdSchema,
    title: profileTextSchema,
    description: profileTextSchema,
    year: z.number().int().min(MIN_PORTFOLIO_YEAR).max(MAX_PORTFOLIO_YEAR).nullable(),
    assetIds: z.array(entityIdSchema).max(MAX_PORTFOLIO_PROJECT_IMAGES),
  })
  .strict();

export const supplierProfileSchema: z.ZodType<CatalogSupplierProfileDefinition, z.ZodTypeDef, unknown> = z
  .object({
    description: profileTextSchema,
    projects: z.array(portfolioProjectSchema).max(MAX_PORTFOLIO_PROJECTS),
  })
  .strict();

/** Κενό ή μόνο κενά ⇒ `null`, ώστε «δεν έδωσε» να είναι ένα πράγμα. Η εγκυρότητα κρίνεται στο `validateQuoteIntake`. */
const recipientEmailSchema = z
  .string()
  .trim()
  .max(MAX_QUOTE_RECIPIENT_EMAIL_LENGTH)
  .nullable()
  .transform((email) => (email === null || email === '' ? null : email));

/** Το σύρμα της ρύθμισης «δέχομαι αιτήματα προσφοράς» (ADR-923 §5.13 Ε6β). */
export const quoteIntakeSchema: z.ZodType<CatalogQuoteIntake, z.ZodTypeDef, unknown> = z
  .object({ enabled: z.boolean(), recipientEmail: recipientEmailSchema })
  .strict();

/**
 * Το σύνορο ανάγνωσης του αποθηκευμένου `quoteIntake`. Απόν (έγγραφο πριν από το Ε6β) ή χαλασμένο ⇒ «δεν δέχεται»: η αμφιβολία
 * κλείνει την πόρτα, δεν την ανοίγει.
 */
export function storedQuoteIntakeOf(raw: unknown): CatalogQuoteIntake {
  const parsed = quoteIntakeSchema.safeParse(raw);
  return parsed.success ? parsed.data : QUOTE_INTAKE_OFF;
}
