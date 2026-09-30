import 'server-only';

/**
 * @fileoverview **Η ΓΕΝΝΗΣΗ ΤΟΥ ΚΑΔΟΥ ΜΕΣΩΝ ΤΗΣ ΠΕΡΙΗΓΗΣΗΣ** — δηλωμένη κατάσταση + συμφιλίωση (ADR-884 Φ2ζ ζ5 · §12 Δ11.5).
 * @related `config/gcs-buckets` (`GCS_TOUR_MEDIA_BUCKET_CONFIG` — η επιθυμητή κατάσταση) · `tour-media-store.ts` (ο επιλογέας) ·
 *   `scripts/provision-tour-media-bucket.ts` (ο ΜΟΝΟΣ που καλεί το `ensure…`) · `services/listings/public-shelf-provision` (ο
 *   αδελφός για τον **δημόσιο** κάδο — αντίθετη πολιτική, γι' αυτό χωριστός)
 * @module server/spatial-tour/tour-media-provision
 *
 * 🔑 **Πρότυπο IaC (Terraform/Pulumi), όχι «μια εντολή gcloud κάποτε»**: η κατάσταση του κάδου **δηλώνεται** στον κώδικα, ένας
 * **καθαρός κριτής** (`tourMediaDrift`) λέει τι αποκλίνει, και η συμφιλίωση γράφει **μόνο** ό,τι αποκλίνει. Ό,τι αλλάξει κάποιος
 * στην κονσόλα φαίνεται στον επόμενο έλεγχο (ADR-851: «συμφωνεί η κονσόλα με το git;»). Το CORS και ο κανόνας κύκλου ζωής του
 * κανονικού κάδου μπήκαν με το χέρι και ζουν **μόνο** σε ένα ADR — αυτός ο κάδος δεν θα έχει ποτέ αυτό το πρόβλημα.
 *
 * ⚠️ **Περιοχή/κλάση = μόνο στη γέννηση**: η GCS δεν τις αλλάζει σε υπάρχοντα κάδο. Απόκλιση εκεί **αναφέρεται**, δεν «διορθώνεται».
 * ⚠️ **Ο κύκλος ζωής και το CORS ανήκουν ΟΛΑ σε αυτόν τον κάδο** ⇒ γράφονται ως αντικατάσταση (αποκλειστικός κάδος — κανένας
 *   άλλος κανόνας δεν έχει δουλειά εδώ· ένας ξένος κανόνας είναι απόκλιση).
 */

import type { Bucket, BucketMetadata } from '@google-cloud/storage';

import { GCS_TOUR_MEDIA_BUCKET, GCS_TOUR_MEDIA_BUCKET_CONFIG as CONFIG } from '@/config/gcs-buckets';
import { getTourMediaBucket } from '@/lib/firebaseAdmin';
import { canonicalJson } from '@/lib/legal/canonical-json';
import { TOUR_INGEST_ROOT } from '@/lib/spatial-tour/tour-media-path';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('tour-media-provision');

/** Τα πεδία που κρίνονται — με τη σειρά που τα διαβάζει ο άνθρωπος. */
export const TOUR_MEDIA_BUCKET_FIELDS = [
  'location', 'storage-class', 'uniform-access', 'public-access-prevention', 'soft-delete', 'ingest-lifecycle', 'cors',
] as const;
export type TourMediaBucketField = (typeof TOUR_MEDIA_BUCKET_FIELDS)[number];

/** Όσα **δεν** αλλάζουν σε υπάρχοντα κάδο. */
const CREATION_ONLY: ReadonlySet<TourMediaBucketField> = new Set(['location', 'storage-class']);

export interface TourMediaBucketState {
  readonly bucketName: string;
  readonly exists: boolean;
  /** Ό,τι αποκλίνει από τη δήλωση — κενό ⇒ ο κάδος είναι ακριβώς όπως γράφει ο κώδικας. */
  readonly drift: readonly TourMediaBucketField[];
}

/** Το μεταβλητό σχήμα που δέχεται ο πελάτης της Google (δεν δέχεται `readonly`). */
function desiredCors(): NonNullable<BucketMetadata['cors']> {
  const { origin, method, responseHeader, maxAgeSeconds } = CONFIG.cors;
  return [{ origin: [...origin], method: [...method], responseHeader: [...responseHeader], maxAgeSeconds }];
}

function desiredLifecycle(): NonNullable<BucketMetadata['lifecycle']> {
  return { rule: [{ action: { type: 'Delete' }, condition: { age: CONFIG.ingestTtlDays, matchesPrefix: [`${TOUR_INGEST_ROOT}/`] } }] };
}

/** Τα πεδία που **συμφιλιώνονται** σε υπάρχοντα κάδο — και αυτούσια στη γέννηση. */
function desiredMutableMetadata(): BucketMetadata {
  return {
    iamConfiguration: {
      uniformBucketLevelAccess: { enabled: CONFIG.uniformBucketLevelAccess },
      publicAccessPrevention: CONFIG.publicAccessPrevention,
    },
    softDeletePolicy: { retentionDurationSeconds: CONFIG.softDeleteRetentionSeconds },
    lifecycle: desiredLifecycle(),
    cors: desiredCors(),
  };
}

/** Ισότητα **ανεξάρτητη από τη σειρά κλειδιών** — η GCS επιστρέφει τα αντικείμενα με τη δική της σειρά. */
const sameJson = (a: unknown, b: unknown): boolean => canonicalJson(a ?? null) === canonicalJson(b ?? null);

function fieldMatches(field: TourMediaBucketField, actual: BucketMetadata): boolean {
  switch (field) {
    case 'location': return (actual.location ?? '').toUpperCase() === CONFIG.location;
    case 'storage-class': return (actual.storageClass ?? '').toUpperCase() === CONFIG.storageClass;
    case 'uniform-access': return actual.iamConfiguration?.uniformBucketLevelAccess?.enabled === CONFIG.uniformBucketLevelAccess;
    case 'public-access-prevention': return actual.iamConfiguration?.publicAccessPrevention === CONFIG.publicAccessPrevention;
    // Η GCS επιστρέφει τη διάρκεια ως συμβολοσειρά («0»)· πεδίο που λείπει = η προεπιλογή των 7 ημερών, **όχι** 0.
    case 'soft-delete': return actual.softDeletePolicy?.retentionDurationSeconds !== undefined
      && Number(actual.softDeletePolicy.retentionDurationSeconds) === CONFIG.softDeleteRetentionSeconds;
    case 'ingest-lifecycle': return sameJson(actual.lifecycle?.rule, desiredLifecycle().rule);
    case 'cors': return sameJson(actual.cors, desiredCors());
  }
}

/** **Ο κριτής** — καθαρός: τι αποκλίνει ανάμεσα στον κάδο και στη δήλωση. */
export function tourMediaDrift(actual: BucketMetadata): TourMediaBucketField[] {
  return TOUR_MEDIA_BUCKET_FIELDS.filter((field) => !fieldMatches(field, actual));
}

/** **Έλεγχος χωρίς εγγραφή** — ό,τι τρέχει το δίχτυ απόκλισης και το ξηρό της προμήθειας. */
export async function inspectTourMediaBucket(bucket: Bucket = getTourMediaBucket()): Promise<TourMediaBucketState> {
  const [exists] = await bucket.exists();
  if (!exists) return { bucketName: GCS_TOUR_MEDIA_BUCKET, exists: false, drift: [...TOUR_MEDIA_BUCKET_FIELDS] };
  const [metadata] = await bucket.getMetadata();
  return { bucketName: GCS_TOUR_MEDIA_BUCKET, exists: true, drift: tourMediaDrift(metadata) };
}

/**
 * **Φέρε τον κάδο στη δηλωμένη του κατάσταση** — ιδεμπότητο. Λείπει ⇒ γεννιέται με **όλη** τη δήλωση σε ένα αίτημα· υπάρχει ⇒
 * ένα `setMetadata` μόνο αν κάτι αποκλίνει. 🔴 Δημιουργεί πόρο στο GCP: το καλεί **μόνο** το script προμήθειας, με `--apply`.
 */
export async function ensureTourMediaBucket(bucket: Bucket = getTourMediaBucket()): Promise<TourMediaBucketState> {
  const before = await inspectTourMediaBucket(bucket);
  if (!before.exists) {
    await bucket.create({ location: CONFIG.location, storageClass: CONFIG.storageClass, ...desiredMutableMetadata() });
    logger.warn('Ο κάδος μέσων της περιήγησης δημιουργήθηκε', { bucket: GCS_TOUR_MEDIA_BUCKET, location: CONFIG.location });
  } else if (before.drift.some((field) => !CREATION_ONLY.has(field))) {
    await bucket.setMetadata(desiredMutableMetadata());
    logger.warn('Ο κάδος μέσων της περιήγησης συμφιλιώθηκε', { bucket: GCS_TOUR_MEDIA_BUCKET, drift: before.drift });
  }
  return inspectTourMediaBucket(bucket);
}
