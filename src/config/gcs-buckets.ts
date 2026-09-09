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
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴🔴 `cors` — ΤΟ Ο-21, ΚΑΙ ΓΙΑΤΙ ΤΟ ΕΛΕΙΠΕ ΗΤΑΝ **ΑΟΡΑΤΟ ΣΕ ΚΑΘΕ ΔΙΑΚΟΜΙΣΤΗ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Μετρημένο ζωντανά (2026-09-09)**, το πρώτο μοντέλο που έφτασε σε δημόσια αγγελία:
 *
 * ```
 * curl …/<sha256>.glb                       → HTTP 200, 32.928 bytes          ✅
 * curl -H "Origin: …" …/<sha256>.glb        → 200, ΚΑΜΙΑ Access-Control-Allow-Origin
 * κονσόλα επισκέπτη                          → TypeError: Failed to fetch      🔴
 * ```
 *
 * 🔑 **Η ΚΛΑΣΗ**: το CORS το επιβάλλει **ΜΟΝΟ ο browser**. Κάθε έλεγχος από διακομιστή
 * *(`curl`, `node fetch`, ο ίδιος ο ψήστης, το `inspectPublicShelfBucket`)* βλέπει **200**
 * και συμπεραίνει «δημόσιο». Δηλαδή ο έλεγχος από τον server είναι **δομικά τυφλός** εδώ —
 * το γνωστό *«πράσινο που σημαίνει: κανείς δεν κοίταξε»*, σε νέα μορφή.
 *
 * 🔑 **ΚΑΙ ΓΙ' ΑΥΤΟ ΔΕΝ ΤΟ ΕΙΧΕ ΠΙΑΣΕΙ ΠΟΤΕ Η ΓΚΑΛΕΡΙ**: το `<img>` **δεν** χρειάζεται
 * CORS. Το μοντέλο είναι το **πρώτο** υλικό που κατεβαίνει με `fetch` *(`<model-viewer>`
 * παρσάρει glTF σε JS)*, άρα το πρώτο που χτυπά το φράγμα.
 *
 * 🏆 **`origin: ['*']` — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ, ΟΧΙ ΧΑΛΑΡΩΣΗ.** Το CORS **δεν είναι έλεγχος
 * πρόσβασης** σε κάδο που είναι **ήδη** αναγνώσιμος από τον καθένα με `curl`: μια λίστα
 * επιτρεπτών origins εδώ δεν προστατεύει **τίποτα** — αποφασίζει μόνο **ποιοι ιστότοποι
 * μπορούν να ΑΠΕΙΚΟΝΙΣΟΥΝ** το μοντέλο μας. Και αυτό είναι ακριβώς η **διασπορά αγγελίας**
 * *(portals τύπου Zillow/Idealista, ενσωματώσεις, προεπισκοπήσεις)* — ο λόγος ύπαρξης της
 * δημοσίευσης. Ίδια επιλογή με κάθε δημόσιο CDN.
 * ⛔ Μια λίστα origins εδώ θα έσπαγε τη διασπορά **χωρίς κανένα αντίκρισμα ασφάλειας**.
 *
 * ⚠️ **`Range` ΣΤΑ `responseHeader` — ΜΕΤΡΗΜΕΝΗ ΑΠΑΙΤΗΣΗ, ΟΧΙ ΠΡΟΝΟΙΑ**: ο φορτωτής
 * glTF ζητά εύρη bytes· η τεκμηρίωση της GCS το λέει ρητά — *κάθε* τιμή του
 * `Access-Control-Request-Header` πρέπει να αντιστοιχεί σε `responseHeader`, αλλιώς το
 * preflight αποτυγχάνει. Χωρίς αυτό η θεραπεία θα ήταν **μισή**, και θα φαινόταν πράσινη.
 *
 * ⚠️ **ΤΟ `maxAgeSeconds` ΔΕΝ ΕΙΝΑΙ ΤΟ `max-age` ΤΗΣ ΑΠΟΣΥΡΣΗΣ** *(άγκυρα Κ5)*: εκείνο
 * είναι το edge cache των **bytes** — αυτό είναι το cache του **preflight** στον browser.
 * Η μόνη του συνέπεια: αλλαγή αυτής της πολιτικής αργεί έως μία ώρα να φανεί σε ήδη
 * ανοιχτούς browsers.
 */
export const GCS_PUBLIC_MEDIA_BUCKET_CONFIG = {
  location: 'EUROPE-WEST1',
  storageClass: 'STANDARD' as const,
  uniformBucketLevelAccess: true,
  cors: [
    {
      origin: ['*'],
      method: ['GET', 'HEAD'],
      responseHeader: ['Content-Type', 'Content-Length', 'Content-Range', 'Range', 'ETag'],
      maxAgeSeconds: 3600,
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// Bucket metadata (for auto-creation)
// ---------------------------------------------------------------------------

export const GCS_BACKUP_BUCKET_CONFIG = {
  location: 'EUROPE-WEST1',
  storageClass: 'STANDARD' as const,
} as const;

// (Ο-21) η δήλωση CORS ζει παραπάνω — ο ΜΟΝΟΣ γραφέας της είναι το `reconcileCors`.
