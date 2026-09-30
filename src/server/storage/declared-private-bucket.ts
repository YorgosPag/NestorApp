import 'server-only';

/**
 * @fileoverview **Ο ΔΗΛΩΜΕΝΟΣ ΙΔΙΩΤΙΚΟΣ ΚΑΔΟΣ** — δηλωμένη κατάσταση + καθαρός κριτής + συμφιλίωση, για **κάθε** ιδιωτικό κάδο
 * (ADR-895 Α5 · γενίκευση του ADR-884 Φ2ζ ζ5 / Δ11.5).
 * @related `private-bucket-registry` (οι δηλώσεις) · `config/gcs-buckets` (οι τιμές) · `scripts/provision-private-bucket.ts`
 *   (ο ΜΟΝΟΣ που καλεί το `ensure…`) · `lib/cron/jobs/storage-bucket-drift.job` (το δίχτυ) · `services/listings/public-shelf-provision`
 *   (ο **δημόσιος** κάδος — αντίθετη πολιτική, γι' αυτό χωριστός)
 * @module server/storage/declared-private-bucket
 *
 * 🔑 **Πρότυπο IaC (Terraform/Pulumi), όχι «μια εντολή gcloud κάποτε»**: η κατάσταση **δηλώνεται** στον κώδικα, ο κριτής
 * (`privateBucketDrift`) λέει τι αποκλίνει, η συμφιλίωση γράφει **μόνο** ό,τι αποκλίνει. Ό,τι αλλάξει κάποιος στην κονσόλα
 * φαίνεται στον επόμενο έλεγχο (ADR-851). Νέος ιδιωτικός κάδος = **μία δήλωση**, όχι τρίτο αντίγραφο αυτού του αρχείου.
 *
 * 🔒 **Τα αναλλοίωτα ΔΕΝ είναι πεδία της δήλωσης** (`PRIVATE_BUCKET_INVARIANTS`): ένας ιδιωτικός κάδος **δεν μπορεί** να
 * δηλωθεί με UBLA κλειστό ή χωρίς Public Access Prevention — δεν υπάρχει καν το πεδίο για να το γράψει κανείς.
 *
 * ⚠️ **Μόνο στη γέννηση** (η GCS δεν τα αλλάζει σε υπάρχοντα κάδο): περιοχή · κλάση · hierarchical namespace. Απόκλιση εκεί
 *   **αναφέρεται**, δεν «διορθώνεται». 🔴 HNS: «Object holds are not supported for buckets that use hierarchical namespace»
 *   ⇒ κάδος HNS θα έσπαγε **σιωπηλά** κάθε `temporaryHold` (νομική δέσμευση, ADR-864).
 * ⚠️ **Object Retention Lock = μόνο αναφορά**: ενεργοποιείται αλλά **δεν απενεργοποιείται ποτέ** — καμία αυτόματη πράξη.
 * ⚠️ **Κύκλος ζωής και CORS ανήκουν ΟΛΑ στον κάδο** ⇒ αντικατάσταση· ένας ξένος κανόνας είναι απόκλιση.
 */

import type { Bucket, BucketMetadata, CreateBucketRequest, LifecycleRule } from '@google-cloud/storage';

import { canonicalJson } from '@/lib/legal/canonical-json';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('declared-private-bucket');

/** Ό,τι **είναι** κάθε ιδιωτικός κάδος — όχι επιλογή της δήλωσης. */
export const PRIVATE_BUCKET_INVARIANTS = {
  uniformBucketLevelAccess: true,
  publicAccessPrevention: 'enforced',
  hierarchicalNamespace: false,
  versioning: false,
  objectRetention: false,
} as const;

export interface PrivateBucketCors {
  readonly origin: readonly string[];
  readonly method: readonly string[];
  readonly responseHeader: readonly string[];
  readonly maxAgeSeconds: number;
}

/** **Η δήλωση** — ό,τι διαφέρει από κάδο σε κάδο. */
export interface DeclaredPrivateBucket {
  readonly id: string;
  readonly bucketName: string;
  readonly getBucket: () => Bucket;
  readonly location: string;
  readonly storageClass: string;
  readonly softDeleteRetentionSeconds: number;
  /** Κενό ⇒ **κανένας** κανόνας (ό,τι βρεθεί είναι απόκλιση). */
  readonly lifecycleRules: readonly LifecycleRule[];
  readonly cors: PrivateBucketCors;
}

/** Τα πεδία που κρίνονται — με τη σειρά που τα διαβάζει ο άνθρωπος. */
export const PRIVATE_BUCKET_FIELDS = [
  'location', 'storage-class', 'hierarchical-namespace', 'object-retention', 'uniform-access', 'public-access-prevention',
  'soft-delete', 'versioning', 'lifecycle', 'cors',
] as const;
export type PrivateBucketField = (typeof PRIVATE_BUCKET_FIELDS)[number];

/** Όσα **δεν** γράφει ποτέ η συμφιλίωση: τα τρία μόνο-στη-γέννηση + το μη αναστρέψιμο retention. */
const NEVER_RECONCILED: ReadonlySet<PrivateBucketField> = new Set([
  'location', 'storage-class', 'hierarchical-namespace', 'object-retention',
]);

export interface PrivateBucketState {
  readonly bucketName: string;
  readonly exists: boolean;
  /** Ό,τι αποκλίνει από τη δήλωση — κενό ⇒ ο κάδος είναι ακριβώς όπως γράφει ο κώδικας. */
  readonly drift: readonly PrivateBucketField[];
}

/** Το μεταβλητό σχήμα που δέχεται ο πελάτης της Google (δεν δέχεται `readonly`). */
function desiredCors(decl: DeclaredPrivateBucket): NonNullable<BucketMetadata['cors']> {
  const { origin, method, responseHeader, maxAgeSeconds } = decl.cors;
  return [{ origin: [...origin], method: [...method], responseHeader: [...responseHeader], maxAgeSeconds }];
}

const desiredRules = (decl: DeclaredPrivateBucket): LifecycleRule[] => decl.lifecycleRules.map((rule) => ({ ...rule }));

/** Τα πεδία που **συμφιλιώνονται** σε υπάρχοντα κάδο. `lifecycle: null` = «κανένας κανόνας» (η GCS τον αφαιρεί). */
function desiredMutableMetadata(decl: DeclaredPrivateBucket): BucketMetadata {
  const rules = desiredRules(decl);
  return {
    iamConfiguration: {
      uniformBucketLevelAccess: { enabled: PRIVATE_BUCKET_INVARIANTS.uniformBucketLevelAccess },
      publicAccessPrevention: PRIVATE_BUCKET_INVARIANTS.publicAccessPrevention,
    },
    softDeletePolicy: { retentionDurationSeconds: decl.softDeleteRetentionSeconds },
    versioning: { enabled: PRIVATE_BUCKET_INVARIANTS.versioning },
    lifecycle: rules.length > 0 ? { rule: rules } : null,
    cors: desiredCors(decl),
  };
}

/** Ισότητα **ανεξάρτητη από τη σειρά κλειδιών** — η GCS επιστρέφει τα αντικείμενα με τη δική της σειρά. */
const sameJson = (a: unknown, b: unknown): boolean => canonicalJson(a ?? null) === canonicalJson(b ?? null);

function fieldMatches(decl: DeclaredPrivateBucket, field: PrivateBucketField, actual: BucketMetadata): boolean {
  switch (field) {
    case 'location': return (actual.location ?? '').toUpperCase() === decl.location;
    case 'storage-class': return (actual.storageClass ?? '').toUpperCase() === decl.storageClass;
    case 'hierarchical-namespace': return (actual.hierarchicalNamespace?.enabled === true) === PRIVATE_BUCKET_INVARIANTS.hierarchicalNamespace;
    case 'object-retention': return (actual.objectRetention?.mode === 'Enabled') === PRIVATE_BUCKET_INVARIANTS.objectRetention;
    case 'uniform-access': return actual.iamConfiguration?.uniformBucketLevelAccess?.enabled === PRIVATE_BUCKET_INVARIANTS.uniformBucketLevelAccess;
    case 'public-access-prevention': return actual.iamConfiguration?.publicAccessPrevention === PRIVATE_BUCKET_INVARIANTS.publicAccessPrevention;
    // Η GCS επιστρέφει τη διάρκεια ως συμβολοσειρά («0»)· πεδίο που λείπει = άγνωστο ⇒ απόκλιση (η συμφιλίωση το γράφει ρητά).
    case 'soft-delete': return actual.softDeletePolicy?.retentionDurationSeconds !== undefined
      && Number(actual.softDeletePolicy.retentionDurationSeconds) === decl.softDeleteRetentionSeconds;
    case 'versioning': return (actual.versioning?.enabled === true) === PRIVATE_BUCKET_INVARIANTS.versioning;
    // Κάδος χωρίς κύκλο ζωής: η GCS παραλείπει το πεδίο ⇒ απόν ≡ κανένας κανόνας.
    case 'lifecycle': return sameJson(actual.lifecycle?.rule ?? [], desiredRules(decl));
    case 'cors': return sameJson(actual.cors, desiredCors(decl));
  }
}

/** **Ο κριτής** — καθαρός: τι αποκλίνει ανάμεσα στον κάδο και στη δήλωση. */
export function privateBucketDrift(decl: DeclaredPrivateBucket, actual: BucketMetadata): PrivateBucketField[] {
  return PRIVATE_BUCKET_FIELDS.filter((field) => !fieldMatches(decl, field, actual));
}

/** **Έλεγχος χωρίς εγγραφή** — ό,τι τρέχει το δίχτυ απόκλισης και το ξηρό της προμήθειας. */
export async function inspectPrivateBucket(
  decl: DeclaredPrivateBucket,
  bucket: Bucket = decl.getBucket(),
): Promise<PrivateBucketState> {
  const [exists] = await bucket.exists();
  if (!exists) return { bucketName: decl.bucketName, exists: false, drift: [...PRIVATE_BUCKET_FIELDS] };
  const [metadata] = await bucket.getMetadata();
  return { bucketName: decl.bucketName, exists: true, drift: privateBucketDrift(decl, metadata) };
}

/** Η γέννηση: **όλη** η δήλωση σε ένα αίτημα (κενός κύκλος ζωής = το πεδίο απλώς δεν στέλνεται). */
function creationRequest(decl: DeclaredPrivateBucket): CreateBucketRequest {
  const { lifecycle, versioning: _mutableShape, ...mutable } = desiredMutableMetadata(decl);
  return {
    location: decl.location,
    storageClass: decl.storageClass,
    hierarchicalNamespace: { enabled: PRIVATE_BUCKET_INVARIANTS.hierarchicalNamespace },
    enableObjectRetention: PRIVATE_BUCKET_INVARIANTS.objectRetention,
    versioning: { enabled: PRIVATE_BUCKET_INVARIANTS.versioning },
    ...mutable,
    ...(lifecycle ? { lifecycle } : {}),
  };
}

/**
 * **Φέρε τον κάδο στη δηλωμένη του κατάσταση** — ιδεμπότητο. Λείπει ⇒ γεννιέται με όλη τη δήλωση· υπάρχει ⇒ ένα
 * `setMetadata` μόνο αν αποκλίνει κάτι που **επιτρέπεται** να γραφτεί. 🔴 Δημιουργεί πόρο στο GCP: το καλεί **μόνο** το
 * script προμήθειας, με `--apply`.
 */
export async function ensurePrivateBucket(
  decl: DeclaredPrivateBucket,
  bucket: Bucket = decl.getBucket(),
): Promise<PrivateBucketState> {
  const before = await inspectPrivateBucket(decl, bucket);
  if (!before.exists) {
    await bucket.create(creationRequest(decl));
    logger.warn('Ιδιωτικός κάδος δημιουργήθηκε', { id: decl.id, bucket: decl.bucketName, location: decl.location });
  } else if (before.drift.some((field) => !NEVER_RECONCILED.has(field))) {
    await bucket.setMetadata(desiredMutableMetadata(decl));
    logger.warn('Ιδιωτικός κάδος συμφιλιώθηκε', { id: decl.id, bucket: decl.bucketName, drift: before.drift });
  }
  return inspectPrivateBucket(decl, bucket);
}
