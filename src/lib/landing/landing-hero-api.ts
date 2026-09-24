/**
 * @fileoverview **ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΟΥ ΣΥΡΜΑΤΟΣ** του εργαλείου ηρώων — ένα, για πελάτη και διακομιστή (ADR-881).
 * @related ADR-881 · app/api/admin/landing-heroes/** · components/admin/landing-heroes/*
 * @module lib/landing/landing-hero-api
 *
 * 🔑 Τα σχήματα των **αιτημάτων** ζουν εδώ και τα **ελέγχει** ο διακομιστής (`readJsonBody`)· ο πελάτης
 *    εισάγει μόνο τους **τύπους** — δύο πλευρές που δεν μπορούν να αποκλίνουν σιωπηλά.
 */

import { z } from 'zod';

import { photoFocalPointSchema } from '@/lib/listings/photo-focal-point';

import type { LandingHeroPointers, LandingHeroRevision } from './landing-hero-document';
import { isLandingHeroRevisionId, LANDING_HERO_PAGES } from './landing-hero-vocabulary';

const revisionIdSchema = z.string().refine(isLandingHeroRevisionId);
const privatePathSchema = z.string().min(1).max(1024);

/**
 * `POST /api/admin/landing-heroes` — **δύο** είδη νέας έκδοσης, με ρητή διάκριση:
 * - `upload`: νέα αρχεία (ιδιωτικά μονοπάτια) + προαιρετική δηλωμένη εστίαση
 * - `refocus`: ίδια δημόσια παράγωγα μιας υπάρχουσας έκδοσης, **άλλο** σημείο (κανένα re-encode)
 */
export const createLandingHeroRevisionBodySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('upload'),
    page: z.enum(LANDING_HERO_PAGES),
    dayPath: privatePathSchema,
    duskPath: privatePathSchema.nullable(),
    focalPoint: photoFocalPointSchema.nullable(),
  }).strict(),
  z.object({
    kind: z.literal('refocus'),
    baseRevisionId: revisionIdSchema,
    focalPoint: photoFocalPointSchema,
  }).strict(),
]);

export type CreateLandingHeroRevisionBody = z.infer<typeof createLandingHeroRevisionBodySchema>;

/** `POST /api/admin/landing-heroes/publish` — `revisionId: null` ⇒ επιστροφή στην ενσωματωμένη. */
export const publishLandingHeroBodySchema = z.object({
  page: z.enum(LANDING_HERO_PAGES),
  revisionId: revisionIdSchema.nullable(),
}).strict();

export type PublishLandingHeroBody = z.infer<typeof publishLandingHeroBodySchema>;

/** `GET` — ποια έκδοση είναι ζωντανή ανά σελίδα, και το ιστορικό (νεότερη πρώτη). */
export interface LandingHeroesStateResponse {
  readonly pointers: LandingHeroPointers;
  readonly revisions: readonly LandingHeroRevision[];
}

/** `POST` επιτυχία. */
export interface LandingHeroRevisionResponse {
  readonly revision: LandingHeroRevision;
}

/** Οι λόγοι απόρριψης που ταξιδεύουν — κλειδιά i18n στον πελάτη, ποτέ κείμενο. */
export const LANDING_HERO_API_ERRORS = [
  'foreign-source',
  'shelf-failed',
  'unreadable-image',
  'dimensions-rejected',
  'revision-not-found',
  'invalid-target',
] as const;

export type LandingHeroApiError = (typeof LANDING_HERO_API_ERRORS)[number];

export function isLandingHeroApiError(value: unknown): value is LandingHeroApiError {
  return typeof value === 'string' && (LANDING_HERO_API_ERRORS as readonly string[]).includes(value);
}
