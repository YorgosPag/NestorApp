/**
 * =============================================================================
 * GCS BUCKET CONFIGURATION — SSoT
 * =============================================================================
 *
 * Single source of truth for all Google Cloud Storage bucket names and the
 * Firebase project ID fallback. Every service that needs a bucket name or
 * the project ID MUST import from here — no inline construction.
 *
 * Pattern mirrors firestore-collections.ts: env-var with hardcoded fallback.
 *
 * @module config/gcs-buckets
 */

// ---------------------------------------------------------------------------
// Project ID (SSoT)
// ---------------------------------------------------------------------------

/**
 * Firebase / GCP project ID.
 * Server-side: FIREBASE_PROJECT_ID.
 * Client-side: NEXT_PUBLIC_FIREBASE_PROJECT_ID.
 */
export const GCP_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ??
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
  'pagonis-87766';

// ---------------------------------------------------------------------------
// Bucket names
// ---------------------------------------------------------------------------

/** Enterprise backup bucket (ADR-313). Stores NDJSON.gz + manifests. */
export const GCS_BACKUP_BUCKET =
  process.env.GCS_BACKUP_BUCKET ?? `${GCP_PROJECT_ID}-backups`;

/** Default Firebase Storage bucket. */
export const FIREBASE_STORAGE_BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET ??
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
  `${GCP_PROJECT_ID}.firebasestorage.app`;

/**
 * **ΤΟ ΔΗΜΟΣΙΟ ΡΑΦΙ** — ο ΜΟΝΟΣ κάδος που διαβάζει ανώνυμος (ADR-841 §7 Α12).
 *
 * 🔴 **ΓΙΑΤΙ ΔΕΥΤΕΡΟΣ ΚΑΔΟΣ ΚΑΙ ΟΧΙ ΠΡΟΘΕΜΑ ΣΤΟΝ ΥΠΑΡΧΟΝΤΑ — μετρημένο, όχι προτίμηση.**
 *
 * Το built-in edge cache της Cloud Storage απαιτεί, αυτολεξεί, *«The object is publicly
 * accessible»* — δηλαδή `allUsers` σε **επίπεδο IAM**. Ένας κανόνας `allow read: if true`
 * στο `storage.rules` **δεν** το ικανοποιεί: το object παραμένει ιδιωτικό για το IAM,
 * οπότε **κάθε** ανώνυμη ανάγνωση χτυπά origin και πληρώνεται. Το ίδιο ισχύει για signed
 * URLs (URL ανά χρήστη ⇒ ~100% cache miss).
 *
 * 🔑 **Και η ακτίνα έκρηξης γίνεται ΔΟΜΙΚΗ αντί για υπό συνθήκη**: η ερώτηση παύει να
 * είναι *«είναι σωστό το `match`;»* και γίνεται *«σε ποιον κάδο είναι τα bytes;»*.
 * Το `storage.rules` **δεν αγγίζεται** — το ανάλλοιωτό του (**μηδέν** `allow read: if true`
 * σε 673 γραμμές) επιβιώνει, και το φυλάει πλέον άγκυρα.
 *
 * ⚠️ **ΜΗΝ βάλεις εδώ ό,τι δεν δημοσιεύτηκε με ΠΡΑΞΗ.** Ο κάδος είναι δημόσιος
 * **ολόκληρος** (UBLA + `allUsers:objectViewer`): δεν υπάρχει «λιγότερο δημόσιο» object
 * μέσα του, και αυτό είναι το χαρακτηριστικό του — όχι παράλειψη.
 *
 * @see services/upload/utils/storage-path-public-shelf — ο κατασκευαστής κλειδιών
 * @see services/listings/public-shelf.service — ο ΜΟΝΟΣ γραφέας
 */
export const GCS_PUBLIC_MEDIA_BUCKET =
  process.env.GCS_PUBLIC_MEDIA_BUCKET ?? `${GCP_PROJECT_ID}-public-media`;

/**
 * Ρυθμίσεις του δημόσιου ραφιού.
 *
 * ⚠️ **`EUROPE-WEST1` σκόπιμα**: ο κανονικός κάδος μετρήθηκε σε **`US-EAST1`**
 * (2026-09-01) — λάθος ήπειρος για ελληνικό κοινό. Το `GCS_BACKUP_BUCKET_CONFIG` από
 * πάνω δηλώνει ήδη ΕΕ, οπότε αυτή είναι η **γραμμένη** προτίμηση του έργου, όχι νέα.
 *
 * ⚠️ **`uniformBucketLevelAccess` ΕΝΕΡΓΟ**: απενεργοποιεί τα per-object ACL μέσα στον
 * κάδο ⇒ κανένα object δεν μπορεί να αποκλίνει από την πολιτική του κάδου, προς
 * **καμία** κατεύθυνση. Μία επιχορήγηση, ελέγξιμη με μία εντολή.
 */
export const GCS_PUBLIC_MEDIA_BUCKET_CONFIG = {
  location: 'EUROPE-WEST1',
  storageClass: 'STANDARD' as const,
  uniformBucketLevelAccess: true,
} as const;

// ---------------------------------------------------------------------------
// Bucket metadata (for auto-creation)
// ---------------------------------------------------------------------------

export const GCS_BACKUP_BUCKET_CONFIG = {
  location: 'EUROPE-WEST1',
  storageClass: 'STANDARD' as const,
} as const;
