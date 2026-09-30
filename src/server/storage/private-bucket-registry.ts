import 'server-only';

/**
 * @fileoverview **ΟΙ ΔΗΛΩΜΕΝΟΙ ΙΔΙΩΤΙΚΟΙ ΚΑΔΟΙ** — ο ΜΟΝΟΣ τόπος όπου ένας ιδιωτικός κάδος αποκτά δήλωση (ADR-895 Α5).
 * @related `declared-private-bucket` (ο μηχανισμός) · `config/gcs-buckets` (τιμές) · `lib/firebaseAdmin` (accessors) ·
 *   `scripts/provision-private-bucket.ts` · `lib/cron/jobs/storage-bucket-drift.job`
 * @module server/storage/private-bucket-registry
 *
 * 🏆 Νέος ιδιωτικός κάδος = **μία γραμμή εδώ** ⇒ αποκτά αυτόματα προμήθεια (`npm run provision:<id>`) **και** επιτήρηση
 * απόκλισης (ο cron διαβάζει αυτή τη λίστα) — καμία δεύτερη λίστα που θα ξεχαστεί.
 */

import {
  GCS_FILES_EU_BUCKET,
  GCS_FILES_EU_BUCKET_CONFIG,
  GCS_TOUR_MEDIA_BUCKET,
  GCS_TOUR_MEDIA_BUCKET_CONFIG,
} from '@/config/gcs-buckets';
import { getFilesEuBucket, getTourMediaBucket } from '@/lib/firebaseAdmin';
import { TOUR_INGEST_ROOT } from '@/lib/spatial-tour/tour-media-path';

import type { DeclaredPrivateBucket } from './declared-private-bucket';

/** Τα μέσα της περιήγησης (ADR-884 Φ2ζ ζ5): καραντίνα που λήγει μόνη της + πλακίδια, soft delete 0. */
const TOUR_MEDIA: DeclaredPrivateBucket = {
  id: 'tour-media',
  bucketName: GCS_TOUR_MEDIA_BUCKET,
  getBucket: getTourMediaBucket,
  location: GCS_TOUR_MEDIA_BUCKET_CONFIG.location,
  storageClass: GCS_TOUR_MEDIA_BUCKET_CONFIG.storageClass,
  softDeleteRetentionSeconds: GCS_TOUR_MEDIA_BUCKET_CONFIG.softDeleteRetentionSeconds,
  lifecycleRules: [{
    action: { type: 'Delete' },
    condition: { age: GCS_TOUR_MEDIA_BUCKET_CONFIG.ingestTtlDays, matchesPrefix: [`${TOUR_INGEST_ROOT}/`] },
  }],
  cors: GCS_TOUR_MEDIA_BUCKET_CONFIG.cors,
};

/** Τα πρωτότυπα στην ΕΕ (ADR-895 Α4): soft delete 7 ημέρες, **κανένας** κύκλος ζωής. */
const FILES_EU: DeclaredPrivateBucket = {
  id: 'files-eu',
  bucketName: GCS_FILES_EU_BUCKET,
  getBucket: getFilesEuBucket,
  location: GCS_FILES_EU_BUCKET_CONFIG.location,
  storageClass: GCS_FILES_EU_BUCKET_CONFIG.storageClass,
  softDeleteRetentionSeconds: GCS_FILES_EU_BUCKET_CONFIG.softDeleteRetentionSeconds,
  lifecycleRules: [],
  cors: GCS_FILES_EU_BUCKET_CONFIG.cors,
};

export const DECLARED_PRIVATE_BUCKETS: readonly DeclaredPrivateBucket[] = [TOUR_MEDIA, FILES_EU];

/** Η δήλωση ενός κάδου — `undefined` αν δεν δηλώθηκε ποτέ (ο καλών αποφασίζει τι λέει στον άνθρωπο). */
export function declaredPrivateBucket(id: string): DeclaredPrivateBucket | undefined {
  return DECLARED_PRIVATE_BUCKETS.find((decl) => decl.id === id);
}
