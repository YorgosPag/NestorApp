/**
 * @fileoverview **ΤΑ ΑΠΟΘΗΚΕΥΜΕΝΑ ΕΓΓΡΑΦΑ ΤΟΥ ΗΡΩΑ** — σχήματα και η μία ανάγνωση (ADR-881 §4.2).
 * @related ADR-881 · lib/landing/landing-hero-vocabulary · services/landing-hero/landing-hero-store
 * @module lib/landing/landing-hero-document
 *
 * ```
 * settings/landing_heroes                      ← ο ΔΕΙΚΤΗΣ ανά σελίδα
 * settings/landing_heroes/revisions/{lhrev_*}  ← ΑΜΕΤΑΒΛΗΤΗ έκδοση
 * ```
 *
 * 🔑 **Ανεκτικός αναγνώστης, αυστηρός γραφέας**: ό,τι δεν περνά το σχήμα ⇒ `null` (έκδοση) ή κενός
 *    δείκτης (σελίδα) — **ποτέ** `throw` στη διαδρομή ανάγνωσης της δημόσιας σελίδας. Μια χαλασμένη
 *    γραμμή πέφτει στην ενσωματωμένη εικόνα, δεν ρίχνει την αρχική σελίδα.
 *
 * ⚠️ **Καθαρό module**: οι χρονοσφραγίδες φτάνουν εδώ **ήδη** ως ISO συμβολοσειρές — η μετατροπή
 *    `Timestamp → ISO` ζει στην αποθήκη (Admin SDK), ώστε αυτό το αρχείο να το διαβάζει και ο browser.
 */

import { z } from 'zod';

import { photoFocalPointSchema, type PhotoFocalPoint } from '@/lib/listings/photo-focal-point';
import { isRecord } from '@/lib/type-guards';

import {
  isLandingHeroRevisionId,
  LANDING_HERO_PAGES,
  type LandingHeroAsset,
  type LandingHeroImage,
  type LandingHeroPage,
  type LandingHeroSet,
} from './landing-hero-vocabulary';

// ============================================================================
// 1. ΣΧΗΜΑΤΑ
// ============================================================================

const positiveInt = z.number().int().positive();

const heroSourceSchema = z.object({ url: z.string().url(), width: positiveInt });

/** Εκδοχή **από το ράφι** — τα παράγωγα είναι υποχρεωτικά (αλλιώς δεν είναι έκδοση ραφιού). */
const heroAssetSchema = z.object({
  src: z.string().url(),
  width: positiveInt,
  height: positiveInt,
  sources: z.array(heroSourceSchema).min(1),
});

/** Από πού ήρθε το σημείο — για να το **πει** η οθόνη, όχι για να αποφασίσει κάτι. */
export const LANDING_HERO_FOCAL_ORIGINS = ['declared', 'detected', 'default'] as const;
export type LandingHeroFocalOrigin = (typeof LANDING_HERO_FOCAL_ORIGINS)[number];

const revisionSchema = z.object({
  page: z.enum(LANDING_HERO_PAGES),
  day: heroAssetSchema,
  dusk: heroAssetSchema.nullable(),
  focalPoint: photoFocalPointSchema,
  focalOrigin: z.enum(LANDING_HERO_FOCAL_ORIGINS),
  /** Τα **ιδιωτικά** πρωτότυπα — προέλευση, για αναπαραγωγή· ποτέ δημόσια. */
  sources: z.object({ day: z.string().min(1), dusk: z.string().min(1).nullable() }),
  /** Έκδοση που άλλαξε **μόνο** την εστίαση άλλης ⇒ η ταυτότητα εκείνης. */
  derivedFrom: z.string().nullable(),
  createdAt: z.string().min(1),
  createdBy: z.string().min(1),
});

/** Μία **αμετάβλητη** έκδοση, όπως τη διαβάζει κάθε καταναλωτής. */
export interface LandingHeroRevision {
  readonly id: string;
  readonly page: LandingHeroPage;
  readonly day: LandingHeroAsset;
  readonly dusk: LandingHeroAsset | null;
  readonly focalPoint: PhotoFocalPoint;
  readonly focalOrigin: LandingHeroFocalOrigin;
  readonly sources: { readonly day: string; readonly dusk: string | null };
  readonly derivedFrom: string | null;
  readonly createdAt: string;
  readonly createdBy: string;
}

/** Ο δείκτης **μίας** σελίδας. `publishedRevisionId: null` ⇒ η ενσωματωμένη εικόνα. */
export interface LandingHeroPagePointer {
  readonly publishedRevisionId: string | null;
  readonly publishedAt: string | null;
  readonly publishedBy: string | null;
}

export type LandingHeroPointers = Readonly<Record<LandingHeroPage, LandingHeroPagePointer>>;

const pointerSchema = z.object({
  publishedRevisionId: z.string().nullable(),
  publishedAt: z.string().nullable(),
  publishedBy: z.string().nullable(),
});

/** Κανείς δεν δημοσίευσε τίποτα — η αρχική κατάσταση κάθε σελίδας. */
export const EMPTY_LANDING_HERO_POINTER: LandingHeroPagePointer = {
  publishedRevisionId: null,
  publishedAt: null,
  publishedBy: null,
};

// ============================================================================
// 2. Η ΜΙΑ ΑΝΑΓΝΩΣΗ
// ============================================================================

/** **Μία έκδοση** — `null` για ό,τι δεν είναι έγκυρη έκδοση (ταυτότητα **ή** σώμα). */
export function readLandingHeroRevision(id: string, data: unknown): LandingHeroRevision | null {
  if (!isLandingHeroRevisionId(id)) return null;
  const parsed = revisionSchema.safeParse(data);
  return parsed.success ? { id, ...parsed.data } : null;
}

/**
 * **Ο δείκτης όλων των σελίδων** — πάντα πλήρης. Άγνωστη/χαλασμένη γραμμή ⇒ κενός δείκτης
 * **μόνο** για εκείνη τη σελίδα· οι άλλες δεν τιμωρούνται.
 */
export function readLandingHeroPointers(data: unknown): LandingHeroPointers {
  const pages: Record<string, unknown> = isRecord(data) && isRecord(data.pages) ? data.pages : {};
  // 🔑 Ρητή κατασκευή, όχι `Object.fromEntries(...) as …`: νέα σελίδα στο λεξιλόγιο ⇒ ο
  //    μεταγλωττιστής **απαιτεί** γραμμή εδώ, αντί να σιωπήσει πίσω από ένα `as`.
  return { home: readPointer(pages.home), pros: readPointer(pages.pros), stay: readPointer(pages.stay) };
}

function readPointer(value: unknown): LandingHeroPagePointer {
  const parsed = pointerSchema.safeParse(value);
  if (!parsed.success) return EMPTY_LANDING_HERO_POINTER;
  const target = parsed.data.publishedRevisionId;
  return target === null || isLandingHeroRevisionId(target) ? parsed.data : EMPTY_LANDING_HERO_POINTER;
}

// ============================================================================
// 3. ΑΠΟ ΕΚΔΟΣΗ ΣΕ ΕΙΚΟΝΑ ΗΡΩΑ
// ============================================================================

/**
 * **Ό,τι αποδίδεται ανά σελίδα**: η δημοσιευμένη έκδοση, αλλιώς η ενσωματωμένη.
 * 🔑 Ρητή κατασκευή ανά σελίδα (όχι `Object.fromEntries … as`): νέα σελίδα ⇒ ο μεταγλωττιστής ζητά γραμμή.
 */
export function resolveLandingHeroSet(
  published: Partial<Record<LandingHeroPage, LandingHeroImage>>,
  builtin: LandingHeroSet,
): LandingHeroSet {
  return {
    home: published.home ?? builtin.home,
    pros: published.pros ?? builtin.pros,
    stay: published.stay ?? builtin.stay,
  };
}

/** Η έκδοση όπως την αποδίδει ο ήρωας — απούσα `dusk` ⇒ η `day` και στα δύο θέματα. */
export function revisionToHeroImage(revision: LandingHeroRevision): LandingHeroImage {
  return revision.dusk === null
    ? { day: revision.day, focalPoint: revision.focalPoint }
    : { day: revision.day, dusk: revision.dusk, focalPoint: revision.focalPoint };
}
