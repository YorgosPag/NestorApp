/**
 * **Το δημόσιο έγγραφο προφίλ** (ADR-923 §22 Υ8): κλειστό σχήμα, σύνορο ανάγνωσης και καθαρή προβολή, χωρίς I/O.
 *
 * 🔒 Κάθε αντικείμενο είναι `strict`, όπως στο δημόσιο μοντέλο (Δ1).
 * 🔒 Έργο χωρίς καμία εικόνα που επιτρέπεται να φύγει δεν βγαίνει: ληγμένη άδεια αδειάζει την κάρτα, και κενή κάρτα δεν μένει.
 * 🔑 Κενό προφίλ που δεν δέχεται αιτήματα δίνει `null`: το έγγραφο σβήνεται, ώστε «δεν συμπλήρωσε» και «δεν υπάρχει» να είναι
 *    ένα πράγμα.
 * 🔒 Από τη ρύθμιση αιτημάτων προσφοράς φεύγει **μόνο** το `acceptsQuoteRequests` (§5.13 Ε6β), ποτέ το email.
 * 🔑 Έκδοση 2 πρόσθεσε το `acceptsQuoteRequests`. Η έκδοση 1 διαβάζεται ακόμη, ως «δεν δέχεται», ώς την επόμενη προβολή.
 *
 * @module subapps/catalog/public/public-supplier-profile
 */

import { z } from 'zod';

import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import { hasAnyLocalizedText, resolveLocalizedText } from '@/i18n/localized-text';

import { quoteIntakeAccepts } from '../schema/validate-supplier-profile';
import type { CatalogPortfolioProject, CatalogQuoteIntake, CatalogSupplierProfileDefinition } from '../types/supplier-profile';
import { localizedTextSchema, publicMediaSchema, type PublicCatalogMedia } from './public-catalog-schema';

export const PUBLIC_SUPPLIER_PROFILE_SCHEMA_VERSION = 2;

const publicProjectSchema = z
  .object({
    projectId: z.string(),
    title: localizedTextSchema,
    description: localizedTextSchema,
    year: z.number().int().nullable(),
    images: z.array(publicMediaSchema).min(1),
  })
  .strict();

const profileFields = {
  companyId: z.string(),
  description: localizedTextSchema,
  projects: z.array(publicProjectSchema),
};

export const publicSupplierProfileSchema = z
  .object({ schemaVersion: z.literal(PUBLIC_SUPPLIER_PROFILE_SCHEMA_VERSION), ...profileFields, acceptsQuoteRequests: z.boolean() })
  .strict();

/** Έγγραφο γραμμένο πριν από το Ε6β: χωρίς ρύθμιση, άρα «δεν δέχεται». */
const publicSupplierProfileV1Schema = z
  .object({ schemaVersion: z.literal(1), ...profileFields })
  .strict()
  .transform((v1) => ({ ...v1, schemaVersion: PUBLIC_SUPPLIER_PROFILE_SCHEMA_VERSION, acceptsQuoteRequests: false }));

const storedPublicProfileSchema = z.union([publicSupplierProfileSchema, publicSupplierProfileV1Schema]);

export type PublicSupplierProfile = z.infer<typeof publicSupplierProfileSchema>;
export type PublicPortfolioProject = z.infer<typeof publicProjectSchema>;

/**
 * Ο τίτλος του έργου στη γλώσσα της διεύθυνσης (Ν11 στ). Ο ΕΝΑΣ ορισμός για slug, σελίδα και sitemap, όπως το
 * `publicModelTitle`: δύο γραφές θα έδιναν δύο κανονικές διευθύνσεις και έναν βρόχο 308.
 */
export function publicProjectTitle(project: PublicPortfolioProject): string {
  return resolveLocalizedText(project.title, DEFAULT_LANGUAGE);
}

/** Το έργο με αυτό το id, ή `null`: έργο που έφυγε από το προφίλ απαντά όπως το ανύπαρκτο. */
export function publicProjectOf(profile: PublicSupplierProfile | null, projectId: string): PublicPortfolioProject | null {
  return profile?.projects.find((project) => project.projectId === projectId) ?? null;
}

export function publicSupplierProfileFromDocument(raw: unknown, companyId: string): PublicSupplierProfile | null {
  const parsed = storedPublicProfileSchema.safeParse(raw);
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
  readonly quoteIntake: CatalogQuoteIntake;
  readonly media: ReadonlyMap<string, PublicCatalogMedia>;
}

export function projectPublicProfile({ companyId, definition, quoteIntake, media }: PublicProfileProjectionInput): PublicSupplierProfile | null {
  const projects = definition.projects.flatMap((project) => projectOf(project, media) ?? []);
  const acceptsQuoteRequests = quoteIntakeAccepts(quoteIntake);
  if (projects.length === 0 && !hasAnyLocalizedText(definition.description) && !acceptsQuoteRequests) return null;
  return { schemaVersion: PUBLIC_SUPPLIER_PROFILE_SCHEMA_VERSION, companyId, description: definition.description, projects, acceptsQuoteRequests };
}
