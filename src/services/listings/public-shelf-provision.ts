/**
 * @fileoverview **Η ΓΕΝΝΗΣΗ ΤΟΥ ΔΗΜΟΣΙΟΥ ΚΑΔΟΥ** — πράξη, ποτέ παρενέργεια (ADR-841 §7 Α12.4).
 * @related ADR-841 §7 Α12.4 · config/gcs-buckets · public-shelf.service
 * @module services/listings/public-shelf-provision
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴🔴 ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΚΑΝΕΙ BYTES ΟΡΑΤΑ ΣΕ ΟΛΟΝ ΤΟΝ ΚΟΣΜΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Είναι το **μόνο** σημείο του δέντρου που χορηγεί `allUsers`. Απομονώθηκε από τον
 * γραφέα ({@link module:services/listings/public-shelf.service}) επίτηδες: μια
 * δημιουργία δημόσιου κάδου **δεν** επιτρέπεται να συμβεί επειδή κάποιος πάτησε
 * «αποθήκευση». Ο γραφέας **προϋποθέτει** τον κάδο και αποτυγχάνει θορυβωδώς αν λείπει.
 *
 * 🔑 **ΓΙΑΤΙ Η ΕΠΙΧΟΡΗΓΗΣΗ ΕΙΝΑΙ ΣΕ ΕΠΙΠΕΔΟ ΚΑΔΟΥ ΚΑΙ ΟΧΙ ΑΝΑ ΑΝΤΙΚΕΙΜΕΝΟ.**
 * Η τεκμηρίωση της Google ονομάζει το per-object ACL ως **την κλάση προβλήματος** που
 * το uniform bucket-level access υπάρχει για να εξαλείψει: *«ένα object μπορεί να είναι
 * δημόσια αναγνώσιμο ακόμη κι όταν η πολιτική IAM του κάδου είναι εντελώς ιδιωτική»*.
 * Με **UBLA ενεργό** εδώ, κανένα αντικείμενο δεν μπορεί να αποκλίνει από την πολιτική
 * του κάδου προς **καμία** κατεύθυνση ⇒ η δημοσιότητα γίνεται **μία** δηλωμένη
 * ιδιότητα, ελέγξιμη με μία εντολή, αντί για ιδιότητα κάθε γραφής ξεχωριστά.
 *
 * ⛔ **ΜΗΝ το καλέσεις για τον κανονικό κάδο.** Ο `FIREBASE_STORAGE_BUCKET` κρατά
 * κατόψεις, σφραγίδες και συμβόλαια· το `storage.rules` τον φυλάει με **μηδέν**
 * δημόσιες αναγνώσεις σε 673 γραμμές, και αυτό είναι ανάλλοιωτο που φυλάει άγκυρα.
 */

import type { Bucket } from '@google-cloud/storage';

import { GCS_PUBLIC_MEDIA_BUCKET, GCS_PUBLIC_MEDIA_BUCKET_CONFIG } from '@/config/gcs-buckets';
import { getAdminStorage } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('public-shelf-provision');

/**
 * Ο ρόλος που δίνει **ανάγνωση αντικειμένου** — και **ΟΧΙ απαρίθμηση**.
 *
 * 🔴 **ΜΕΤΡΗΜΕΝΟ ΠΕΡΠΑΤΩΝΤΑΣ (2026-09-01), και ανέτρεψε την πρώτη επιλογή.** Είχα
 * χορηγήσει `roles/storage.objectViewer`. Ανώνυμο `curl`:
 *
 * ```
 * PUT / POST object            → 403 / 401   ✅ οι εγγραφές κλειστές
 * GET  https://storage.googleapis.com/<κάδος>  → HTTP 200   🔴 ΑΠΑΡΙΘΜΗΣΗ ΟΛΟΥ ΤΟΥ ΡΑΦΙΟΥ
 * ```
 *
 * Ο `objectViewer` είναι `objects.get` **+ `objects.list`**. Η σελίδα όμως **ποτέ** δεν
 * απαριθμεί: ζητά **ακριβές URL** που έμαθε από την αγγελία. Άρα το `list` ήταν
 * **αυστηρά περισσότερο απ' όσο χρειάζεται** — και το επιπλέον δεν είναι θεωρητικό:
 * δίνει σε οποιονδήποτε **πλήρες, φθηνό ευρετήριο** κάθε δημοσιευμένου αρχείου,
 * **χωρίς να αγγίξει την εφαρμογή μας**, παρακάμπτοντας κάθε rate limit και κάθε
 * μέτρηση που έχουμε.
 *
 * ⚠️ **Το `legacy` στο όνομα ΔΕΝ σημαίνει παρωχημένο** — είναι ο ρόλος που αντιστοιχεί
 * στο παλιό ACL «reader» και είναι **ο μόνος προκαθορισμένος** που δίνει `get` χωρίς
 * `list`. Είναι η **ελάχιστη** χορήγηση που κάνει τη δουλειά (least privilege, η ίδια
 * αρχή που δηλώνει η κεφαλίδα του `storage.rules`).
 *
 * ⛔ **ΜΗΝ το γυρίσεις σε `objectViewer` «για ευκολία».** Άγκυρα το φυλάει.
 */
const PUBLIC_READER_ROLE = 'roles/storage.legacyObjectReader';

/**
 * Ρόλοι που **δεν επιτρέπεται** να κρατά ο `allUsers` σε αυτόν τον κάδο.
 *
 * Η προμήθεια δεν **προσθέτει** μόνο — **συμφιλιώνει**: αν μια προηγούμενη εκτέλεση
 * *(ή ένας άνθρωπος στην κονσόλα)* άφησε ευρύτερη χορήγηση, αυτή **αφαιρείται**. Ίδιο
 * ιδίωμα με το ράφι: **επιθυμητή κατάσταση**, όχι εφαρμογή διαφορών.
 */
const FORBIDDEN_PUBLIC_ROLES: readonly string[] = [
  'roles/storage.objectViewer',
  'roles/storage.objectUser',
  'roles/storage.objectAdmin',
  'roles/storage.admin',
  'roles/storage.legacyBucketReader',
  'roles/storage.legacyBucketWriter',
  'roles/storage.legacyBucketOwner',
  'roles/storage.legacyObjectOwner',
];

/** Το «όλοι, ακόμη και χωρίς λογαριασμό» της Google. */
const ALL_USERS = 'allUsers';

/** Τι βρήκε ο έλεγχος — **παρατήρηση**, χωρίς καμία αλλαγή. */
export interface PublicShelfBucketState {
  readonly bucketName: string;
  readonly exists: boolean;
  readonly location: string | null;
  readonly uniformAccess: boolean;
  readonly publiclyReadable: boolean;
}

function shelfBucket(): Bucket {
  return getAdminStorage().bucket(GCS_PUBLIC_MEDIA_BUCKET);
}

/**
 * **Τι ισχύει τώρα** — καθαρή παρατήρηση, ασφαλής να τρέξει οποτεδήποτε.
 *
 * Υπάρχει ώστε η δημοσιότητα να **επαληθεύεται** αντί να θεωρείται: το «ο κάδος είναι
 * δημόσιος» είναι ισχυρισμός που πρέπει να μπορεί να ελεγχθεί χωρίς να αλλάξει τίποτα.
 */
export async function inspectPublicShelfBucket(): Promise<PublicShelfBucketState> {
  const bucket = shelfBucket();
  const [exists] = await bucket.exists();

  if (!exists) {
    return {
      bucketName: GCS_PUBLIC_MEDIA_BUCKET,
      exists: false,
      location: null,
      uniformAccess: false,
      publiclyReadable: false,
    };
  }

  const [metadata] = await bucket.getMetadata();
  const [policy] = await bucket.iam.getPolicy({ requestedPolicyVersion: 3 });

  const publiclyReadable = (policy.bindings ?? []).some(
    (binding) => binding.role === PUBLIC_READER_ROLE && (binding.members ?? []).includes(ALL_USERS),
  );

  return {
    bucketName: GCS_PUBLIC_MEDIA_BUCKET,
    exists: true,
    location: metadata.location ?? null,
    uniformAccess: metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled === true,
    publiclyReadable,
  };
}

/**
 * Δημιουργεί τον κάδο αν λείπει — **ιδεμπόταντ**.
 *
 * `EUROPE-WEST1` επειδή ο κανονικός κάδος μετρήθηκε σε `US-EAST1` (λάθος ήπειρος για
 * ελληνικό κοινό) και το `GCS_BACKUP_BUCKET_CONFIG` δηλώνει ήδη ΕΕ.
 */
async function createIfMissing(bucket: Bucket): Promise<boolean> {
  const [exists] = await bucket.exists();
  if (exists) return false;

  await bucket.create({
    location: GCS_PUBLIC_MEDIA_BUCKET_CONFIG.location,
    storageClass: GCS_PUBLIC_MEDIA_BUCKET_CONFIG.storageClass,
    iamConfiguration: {
      uniformBucketLevelAccess: {
        enabled: GCS_PUBLIC_MEDIA_BUCKET_CONFIG.uniformBucketLevelAccess,
      },
    },
  });

  logger.info('Ο δημόσιος κάδος δημιουργήθηκε', {
    bucket: GCS_PUBLIC_MEDIA_BUCKET,
    location: GCS_PUBLIC_MEDIA_BUCKET_CONFIG.location,
  });
  return true;
}

/**
 * Φέρνει τη δημόσια χορήγηση στην **επιθυμητή** της κατάσταση: `allUsers` κρατά
 * **ακριβώς** τον {@link PUBLIC_READER_ROLE} και **κανέναν** από τους
 * {@link FORBIDDEN_PUBLIC_ROLES}.
 *
 * ⚠️ **Συμφιλίωση, όχι προσθήκη** — και ο λόγος είναι μετρημένος: η πρώτη εκτέλεση
 * χορήγησε `objectViewer`, που επιτρέπει **απαρίθμηση όλου του κάδου** σε ανώνυμο. Μια
 * συνάρτηση που μόνο **προσθέτει** δεν θα μπορούσε ποτέ να το πάρει πίσω — θα άφηνε την
 * ευρύτερη χορήγηση ζωντανή δίπλα στη στενότερη, και η **ένωση** των δύο νικά.
 *
 * ⚠️ **Δεν γράφει πολιτική από το μηδέν**: κρατά κάθε binding που **δεν** αφορά τον
 * `allUsers`. Μια πολιτική γραμμένη από την αρχή θα έσβηνε τους ρόλους του service
 * account και θα κλείδωνε τον γραφέα **έξω από το ίδιο του το ράφι**.
 */
async function reconcilePublicGrant(bucket: Bucket): Promise<boolean> {
  const [policy] = await bucket.iam.getPolicy({ requestedPolicyVersion: 3 });
  const bindings = policy.bindings ?? [];

  const hasIntended = bindings.some(
    (binding) => binding.role === PUBLIC_READER_ROLE && (binding.members ?? []).includes(ALL_USERS),
  );
  const hasForbidden = bindings.some(
    (binding) =>
      FORBIDDEN_PUBLIC_ROLES.includes(binding.role ?? '') &&
      (binding.members ?? []).includes(ALL_USERS),
  );
  if (hasIntended && !hasForbidden) return false;

  // Βγάζουμε τον `allUsers` από ΚΑΘΕ binding, κρατώντας τα υπόλοιπα μέλη άθικτα·
  // ό,τι μείνει χωρίς μέλη φεύγει. Μετά προσθέτουμε τη ΜΙΑ χορήγηση που θέλουμε.
  const withoutPublic = bindings
    .map((binding) => ({
      ...binding,
      members: (binding.members ?? []).filter((member) => member !== ALL_USERS),
    }))
    .filter((binding) => binding.members.length > 0);

  await bucket.iam.setPolicy({
    ...policy,
    bindings: [...withoutPublic, { role: PUBLIC_READER_ROLE, members: [ALL_USERS] }],
  });

  logger.warn('🔴 Η δημόσια χορήγηση συμφιλιώθηκε — ανάγνωση ΧΩΡΙΣ απαρίθμηση', {
    bucket: GCS_PUBLIC_MEDIA_BUCKET,
    role: PUBLIC_READER_ROLE,
    removedBroaderGrant: hasForbidden,
  });
  return true;
}

/**
 * **Φέρε τον δημόσιο κάδο στη δηλωμένη του κατάσταση** — ιδεμπόταντ, ασφαλές να
 * ξανατρέξει.
 *
 * 🔴 **Πράξη με συνέπειες**: μετά από αυτό, κάθε byte μέσα στον κάδο είναι ορατό σε
 * ανώνυμο επισκέπτη. Καλείται από **προμήθεια**, ποτέ από διαδρομή αιτήματος.
 */
export async function ensurePublicShelfBucket(): Promise<PublicShelfBucketState> {
  const bucket = shelfBucket();

  await createIfMissing(bucket);
  await reconcilePublicGrant(bucket);

  return inspectPublicShelfBucket();
}
