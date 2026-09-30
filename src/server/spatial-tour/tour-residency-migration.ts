import 'server-only';

/**
 * @fileoverview **ΜΙΑ ΠΕΡΙΗΓΗΣΗ, ΟΛΟΚΛΗΡΗ, ΣΤΗΝ ΕΕ** — η σειρά της μετάβασης κατοικίας (ADR-895 Φ4 §7.5 · ADR-884 §4.15 ζ5).
 * @related `tour-media-migration.ts` (πλακίδια, ζ5) · `tour-original-migration.ts` (πρωτότυπα, Φ4) ·
 *   `scripts/migrations/migrate-tour-media-to-eu.ts` (ο ΜΟΝΟΣ καλών)
 * @module server/spatial-tour/tour-residency-migration
 *
 * 🔑 **Μονάδα τοποθεσίας = η περιήγηση**: πρώτα τα πλακίδια (το CAS του `mediaPlacement` της περιήγησης), μετά τα πρωτότυπα
 *   (που το απαιτούν). Κάθε σκέλος είναι **ιδεμπότητο** ⇒ μετά από μερική αποτυχία απλώς ξανατρέχει· κανένα κοινό «στάδιο».
 * 🔑 **Καθαρισμός**: κάθε σκέλος κρίνει μόνο του τη χάρη του (πλακίδια 15′ — κουπόνια που λήγουν· πρωτότυπα 24 ώρες — URL χωρίς λήξη).
 * 🔴 **Soft delete του κάδου-πηγής**: το σβήσιμο **δεν** τελειώνει την κατοικία — τα bytes μένουν soft-deleted στις ΗΠΑ για τη
 *   διάρκεια της πολιτικής **εκείνου** του κάδου. Το ξηρό τη **διαβάζει** και την αναφέρει (ADR-895 §10: «αδιάβαστη»).
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { FILE_STORAGE_PLACEMENT_LEGACY } from '@/lib/files/file-storage-placement';
import { fileStorageBucket } from '@/server/files/file-record-bucket';

import {
  cleanupLegacyTourMedia,
  migrateTourMedia,
  type TourMediaCleanupOutcome,
  type TourMediaMigrationOutcome,
} from './tour-media-migration';
import {
  cleanupTourOriginals,
  migrateTourOriginals,
  type OriginalCleanupOutcome,
  type OriginalMigrationOutcome,
  type TourOriginalsOutcome,
} from './tour-original-migration';

/** Ποιο σκέλος — για βηματισμό με χωριστό «ναι» ανά σκέλος. Απόν ⇒ και τα δύο, με τη σωστή σειρά. */
export type ResidencyPart = 'tiles' | 'originals';

export interface TourResidencyMigration {
  readonly tiles?: TourMediaMigrationOutcome;
  readonly originals?: TourOriginalsOutcome<OriginalMigrationOutcome>;
}

export interface TourResidencyCleanup {
  readonly tiles?: TourMediaCleanupOutcome;
  readonly originals?: TourOriginalsOutcome<OriginalCleanupOutcome>;
}

/** Πλακίδια **→** πρωτότυπα. Τα πρωτότυπα αρνούνται μόνα τους (`tiles-first`) αν τα πλακίδια δεν πέρασαν. */
export async function migrateTourResidency(
  db: Firestore, tourRef: DocumentReference, options: { readonly apply: boolean; readonly only?: ResidencyPart },
): Promise<TourResidencyMigration> {
  const tiles = options.only === 'originals' ? undefined : await migrateTourMedia(db, tourRef, options.apply);
  const originals = options.only === 'tiles' ? undefined : await migrateTourOriginals(db, tourRef, options.apply);
  return { ...(tiles ? { tiles } : {}), ...(originals ? { originals } : {}) };
}

/** Καθαρισμός των πηγών — κάθε σκέλος με τη δική του χάρη και νέα απόδειξη. */
export async function cleanupTourResidency(
  db: Firestore, tourRef: DocumentReference, options: { readonly only?: ResidencyPart } = {},
): Promise<TourResidencyCleanup> {
  const tiles = options.only === 'originals' ? undefined : await cleanupLegacyTourMedia(tourRef);
  const originals = options.only === 'tiles' ? undefined : await cleanupTourOriginals(db, tourRef);
  return { ...(tiles ? { tiles } : {}), ...(originals ? { originals } : {}) };
}

/**
 * Πόσο μένουν τα σβησμένα bytes στον κάδο-πηγή (δευτερόλεπτα soft delete). Ίδιος κάδος για πλακίδια legacy και πρωτότυπα
 * legacy (ο κανονικός). `null` = καμία πολιτική (σβήσιμο = οριστικό).
 */
export async function sourceSoftDeleteSeconds(): Promise<number | null> {
  const [metadata] = await fileStorageBucket(FILE_STORAGE_PLACEMENT_LEGACY).getMetadata();
  const seconds = Number(metadata.softDeletePolicy?.retentionDurationSeconds ?? 0);
  return seconds > 0 ? seconds : null;
}
