/**
 * **Το δημόσιο έγγραφο προφίλ** (ADR-923 §22 Υ8): κλειστό σχήμα, σύνορο ανάγνωσης και καθαρή προβολή, χωρίς I/O.
 *
 * 🔒 Κάθε αντικείμενο είναι `strict`, όπως στο δημόσιο μοντέλο (Δ1).
 * 🔒 Έργο χωρίς καμία εικόνα που επιτρέπεται να φύγει δεν βγαίνει: ληγμένη άδεια αδειάζει την κάρτα, και κενή κάρτα δεν μένει.
 * 🔑 Κενό προφίλ δίνει `null`: το έγγραφο σβήνεται, ώστε «δεν συμπλήρωσε» και «δεν υπάρχει» να είναι ένα πράγμα.
 *
 * @module subapps/catalog/public/public-supplier-profile
 */

import { z } from 'zod';

import { hasAnyLocalizedText } from '@/i18n/localized-text';

import type { CatalogPortfolioProject, CatalogSupplierProfileDefinition } from '../types/supplier-profile';
import { localizedTextSchema, publicMediaSchema, type PublicCatalogMedia } from './public-catalog-schema';

export const PUBLIC_SUPPLIER_PROFILE_SCHEMA_VERSION = 1;

const publicProjectSchema = z
  .object({
    projectId: z.string(),
    title: localizedTextSchema,
    description: localizedTextSchema,
    year: z.number().int().nullable(),
    images: z.array(publicMediaSchema).min(1),
  })
  .strict();

export const publicSupplierProfileSchema = z
  .object({
    schemaVersion: z.literal(PUBLIC_SUPPLIER_PROFILE_SCHEMA_VERSION),
    companyId: z.string(),
    description: localizedTextSchema,
    projects: z.array(publicProjectSchema),
  })
  .strict();

export type PublicSupplierProfile = z.infer<typeof publicSupplierProfileSchema>;
export type PublicPortfolioProject = z.infer<typeof publicProjectSchema>;

export function publicSupplierProfileFromDocument(raw: unknown, companyId: string): PublicSupplierProfile | null {
  const parsed = publicSupplierProfileSchema.safeParse(raw);
  if (!parsed.success || parsed.data.companyId !== companyId) return null;
  return parsed.data;
}

function projectOf(project: CatalogPortfolioProject, media: ReadonlyMap<string, PublicCatalogMedia>): PublicPortfolioProject | null {
  const images = project.assetIds.flatMap((assetId) => media.get(assetId) ?? []);
  if (images.length === 0) return null;
  return { projectId: project.id, title: project.title, description: project.description, year: project.year, images };
}

export interface PublicProfileProjectionInput {
  readonly companyId: string;
  readonly definition: CatalogSupplierProfileDefinition;
  readonly media: ReadonlyMap<string, PublicCatalogMedia>;
}

export function projectPublicProfile({ companyId, definition, media }: PublicProfileProjectionInput): PublicSupplierProfile | null {
  const projects = definition.projects.flatMap((project) => projectOf(project, media) ?? []);
  if (projects.length === 0 && !hasAnyLocalizedText(definition.description)) return null;
  return { schemaVersion: PUBLIC_SUPPLIER_PROFILE_SCHEMA_VERSION, companyId, description: definition.description, projects };
}
