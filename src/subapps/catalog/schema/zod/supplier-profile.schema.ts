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
  MIN_PORTFOLIO_YEAR,
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
