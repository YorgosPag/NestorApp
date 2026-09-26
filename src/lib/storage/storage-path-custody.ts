/**
 * =============================================================================
 * ΠΟΙΑΝΟΥ ΕΙΝΑΙ ΑΥΤΗ Η ΔΙΑΔΡΟΜΗ; — ο ΕΝΑΣ κριτής (ADR-862 Φ0 Β8)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Το αντικείμενο σε **ΑΥΤΟ** το μονοπάτι του bucket, σε ποιον
 * μισθωτή ανήκει — και είναι **αυτός** ο μισθωτής ο καλών;»*
 * **Ο απαντητής**: αυτό το αρχείο. Κανένα άλλο.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΧΡΕΙΑΣΤΗΚΕ — ΤΟ ΕΡΩΤΗΜΑ ΑΠΑΝΤΙΟΤΑΝ ΗΔΗ, ΑΛΛΑ **ΤΟΠΙΚΑ**
 * ─────────────────────────────────────────────────────────────────────────────
 * Μετρημένο 2026-09-16: ο **μόνος** φρουρός διαδρομής στον κώδικα ζούσε **inline**
 * μέσα σε μία διαδρομή — `api/storage/file/[...path]/route.ts`:
 *
 * ```ts
 * if (segments[0] !== 'companies' || segments[1] !== ctx.companyId) return 403;
 * ```
 *
 * Είναι **σωστός για τη ρίζα του** και **τυφλός για τις άλλες δέκα**: το
 * `owner_properties/{uid}/…` ανήκει σε **άνθρωπο**, όχι σε εταιρεία· το
 * `asset-packs/**` δεν ανήκει σε κανέναν και διαβάζεται **μόνο** από τον proxy.
 *
 * 🔑 Και το **μάθημα είναι ήδη γραμμένο** στο `services/mandate/showcase-mark-publication.ts`:
 * *«ένας τοπικός `startsWith('companies/' + id)` θα ήταν **δεύτερος κριτής** για τη
 * μορφή του μονοπατιού, ελεύθερος να διαφωνήσει με τον πρώτο»*. Αυτό το αρχείο
 * είναι η θεραπεία που το μάθημα ζητούσε, όχι ένας ακόμη τοπικός έλεγχος.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ ΓΙΑΤΙ **ΟΧΙ** ΤΟ `parseStoragePath` — ΜΕΤΡΗΘΗΚΕ ΚΑΙ ΘΑ ΕΚΛΕΙΝΕ ΠΑΡΑΓΩΓΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο πειρασμός είναι να γίνει κριτής ο υπάρχων `parseStoragePath`
 * (`services/upload/utils/storage-path.ts`). **Δεν μπορεί**: απαιτεί το σχήμα
 * `companies/{c}/entities/{τύπος}/…` και επιστρέφει `null` για **οτιδήποτε άλλο**.
 *
 * Μετρημένο στο **ζωντανό** bucket (2026-09-16): κάτω από `companies/{id}/`
 * υπάρχουν **δύο** παιδιά — `entities/` **και** `dxf-external-references/`. Το
 * δεύτερο του γυρίζει `null`. Ο `storage.rules` έχει **22** μπλοκ· ο
 * `parseStoragePath` καλύπτει τα **2**.
 *
 * ⇒ Κριτής χτισμένος πάνω του θα έλεγε «ξένο» για κάθε BIM υλικό, κάθε σφραγίδα
 * μηχανικού, κάθε PDF προμήθειας. **Fail-closed πάνω σε λάθος ερώτηση δεν είναι
 * ασφάλεια — είναι βλάβη με καλή συνείδηση.**
 *
 * Ο `parseStoragePath` μένει ο ΕΝΑΣ αναγνώστης του **κανονικού σχήματος οντοτήτων**·
 * αυτό εδώ απαντά το **ορθογώνιο** ερώτημα της **ρίζας**. Δύο ερωτήματα, δύο
 * απαντητές — ποτέ ο ένας ντυμένος τον άλλον.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🏛️ Η ΑΥΘΕΝΤΙΑ ΕΙΝΑΙ ΤΟ `storage.rules`, ΚΑΙ Η ΑΓΚΥΡΑ ΤΟ ΕΠΙΒΑΛΛΕΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο {@link STORAGE_ROOT_CUSTODY} είναι **κάτοπτρο** των `match` μπλοκ (23 στις 2026-09-17), όχι
 * δεύτερη αλήθεια. Η άγκυρα (`storage-path-custody-anchor.test.ts`) **διαβάζει το
 * ίδιο το `storage.rules`** και απαιτεί: κάθε ρίζα που εμφανίζεται εκεί να έχει
 * γραμμή εδώ. Νέα ρίζα στους κανόνες **χωρίς** γραμμή ⇒ **κόκκινο**.
 *
 * ⚠️ Το αντίστροφο **δεν** ελέγχεται ως σφάλμα: γραμμή εδώ χωρίς μπλοκ εκεί είναι
 * απλώς ρίζα που δεν έχει (ακόμη) κανόνα — και ο κριτής της λέει ήδη «άγνωστη».
 *
 * @module lib/storage/storage-path-custody
 * @see services/upload/utils/storage-path — ο αναγνώστης του σχήματος **οντοτήτων**
 * @see services/mandate/showcase-mark-publication — το γραμμένο μάθημα του «δεύτερου κριτή»
 * @see storage.rules — η αυθεντία των ριζών
 */

// =============================================================================
// ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΗΣ ΘΕΜΑΤΟΦΥΛΑΚΗΣ
// =============================================================================

/**
 * Ποιος **κατέχει** μια ρίζα του bucket.
 *
 * 🔑 Κατοπτρίζει το `StoragePathPattern` του
 * `tests/storage-rules/_registry/coverage-manifest.ts` — **την ταξινόμηση που το
 * έργο έχει ήδη κάνει**, συμπτυγμένη στον έναν άξονα που αφορά τη λήψη:
 *
 * | `StoragePathPattern` των κανόνων | εδώ |
 * |---|---|
 * | `company_scoped_with_project` · `company_scoped_no_project` · `company_scoped_authoring` | `company` |
 * | `owner_based` · `owner_based_no_superadmin` · `authenticated_read_owner_write` | `user` |
 * | *(οι τρεις βιβλιοθήκες + `system/`)* | `shared` |
 * | `server_only_read_superadmin_curation` · `server_only_sealed` | `server-only` |
 */
export type StorageCustodyKind = 'company' | 'user' | 'shared' | 'server-only';

/**
 * Η θεματοφυλακή μιας **συγκεκριμένης** διαδρομής, όπως διαβάστηκε.
 *
 * ⚠️ **Ονομασμένη ένωση, ποτέ `boolean`** — ίδιο δόγμα με τις ετυμηγορίες του Β5:
 * ένα `false` δεν λέει **αν** η ρίζα είναι άγνωστη ή **ποιος** είναι ο ξένος
 * κάτοχος, οπότε ο καλών ούτε να το εξηγήσει μπορεί ούτε να το καταγράψει.
 */
export type StoragePathCustody =
  /** `companies/{companyId}/…` · `topo-surfaces/{companyId}/…` */
  | { readonly kind: 'company'; readonly root: string; readonly companyId: string }
  /** `users/{uid}/…` · `owner_properties/{uid}/…` · `cad/{uid}/…` · `temp/{uid}/…` */
  | { readonly kind: 'user'; readonly root: string; readonly uid: string }
  /** Κοινόχρηστος κατάλογος — **κανένας** μισθωτής, ανάγνωση για κάθε ταυτότητα. */
  | { readonly kind: 'shared'; readonly root: string }
  /** `allow read: if false` — τα bytes περνούν **μόνο** από τον διακομιστή. */
  | { readonly kind: 'server-only'; readonly root: string }
  /**
   * 🔴 Ρίζα **εκτός** του κλειστού συνόλου, ή μονοπάτι χωρίς αναγνωριστικό
   * μισθωτή εκεί που η ρίζα το απαιτεί ⇒ **fail-closed**.
   *
   * ⚠️ Δεν είναι σφάλμα — είναι **απάντηση**. Ένα νέο δέντρο στο bucket που κανείς
   * δεν δήλωσε **δεν** πρέπει να γίνεται προσιτό επειδή ο κριτής δεν το ήξερε.
   */
  | { readonly kind: 'unknown'; readonly root: string; readonly why: StorageCustodyGap };

/** Γιατί η διαδρομή δεν απέδωσε κάτοχο. **Κλειστό σύνολο, ονομασμένο.** */
export type StorageCustodyGap =
  /** Κενή ή ανώμαλη διαδρομή (π.χ. μόνο κάθετοι). */
  | 'path-not-a-path'
  /** Η ρίζα δεν έχει γραμμή στον πίνακα — άγνωστο δέντρο. */
  | 'root-not-declared'
  /** Η ρίζα απαιτεί αναγνωριστικό μισθωτή στο δεύτερο τμήμα, και λείπει. */
  | 'tenant-segment-missing';

// =============================================================================
// Ο ΠΙΝΑΚΑΣ ΤΩΝ ΡΙΖΩΝ — ΔΕΔΟΜΕΝΑ, ΚΑΤΟΠΤΡΟ ΤΩΝ ΚΑΝΟΝΩΝ
// =============================================================================

/**
 * Πώς κρίνεται κάθε ρίζα — **κάτοπτρο** των μπλοκ του `storage.rules` (ADR-864 §19 `mandate-evidence` · ADR-884 `tour-ingest`/`tour-tiles`).
 *
 * 🔑 `'company'`/`'user'` σημαίνει **«ο μισθωτής είναι το 2ο τμήμα»**· `'shared'`
 * και `'server-only'` δεν έχουν μισθωτή στη διαδρομή.
 *
 * 🌐 **ΟΙ ΤΡΕΙΣ ΒΙΒΛΙΟΘΗΚΕΣ ΕΙΝΑΙ `shared` ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ ΤΩΝ ΚΑΝΟΝΩΝ, ΟΧΙ ΔΙΚΗ
 * ΜΑΣ**: `allow read: if isAuthenticated()` με σχόλιο *«shared catalog»* — είναι ο
 * content server του Revit, εκφρασμένος σε κανόνες. Το ίδιο το `system/block-library`.
 *
 * 🔴 **ΤΟ `asset-packs/` ΕΙΝΑΙ `server-only`, ΚΑΙ ΤΟ ΛΕΝΕ ΟΙ ΙΔΙΟΙ ΟΙ ΚΑΝΟΝΕΣ**:
 * `allow read: if false` με σχόλιο *«Μόνο ο authenticated proxy (Admin SDK)»*.
 * Δηλαδή ο proxy **δεν είναι παράκαμψη των κανόνων — είναι ο σχεδιασμένος δρόμος
 * τους**, και αυτό το αρχείο είναι η πύλη που εκείνο το σχόλιο υπονοεί.
 *
 * ⚠️ **ΤΟ `users/` ΕΙΝΑΙ `user` ΕΔΩ, ΠΑΡΟΤΙ ΟΙ ΚΑΝΟΝΕΣ ΤΟ ΔΙΝΟΥΝ ΣΕ ΚΑΘΕ ΤΑΥΤΟΤΗΤΑ**
 * (`allow read: if isAuthenticated()`, ADR-798 §16 — τα avatar εμφανίζονται σε
 * λίστες όπου ο θεατής δεν είναι ο ιδιοκτήτης). Ο proxy είναι **αυστηρότερος** από
 * τους κανόνες εδώ, και αυτό είναι **σκόπιμο**: μια λήψη δεν είναι προβολή avatar
 * σε λίστα. Αν κάποια οθόνη χρειαστεί ξένο avatar **μέσω proxy**, η θεραπεία είναι
 * ρητή γραμμή — όχι χαλάρωση αυτής.
 */
const STORAGE_ROOT_CUSTODY: Readonly<Record<string, StorageCustodyKind>> = {
  // ── εταιρικά (12 μπλοκ) ────────────────────────────────────────────────────
  companies: 'company',
  'topo-surfaces': 'company',
  // ── προσωπικά (5 μπλοκ) ────────────────────────────────────────────────────
  users: 'user',
  owner_properties: 'user',
  cad: 'user',
  temp: 'user',
  // ADR-866 2α — προσωπικά αρχεία οντοτήτων (`people/{userId}/entities/…`, `canonical_personal`).
  people: 'user',
  // ── κοινόχρηστοι κατάλογοι (4 μπλοκ) ───────────────────────────────────────
  system: 'shared',
  'furniture-library': 'shared',
  'bim-mesh-library': 'shared',
  'bim-texture-library': 'shared',
  // ── μόνο διακομιστής (2 μπλοκ) ─────────────────────────────────────────────
  'asset-packs': 'server-only',
  // ADR-864 §19 — το παγωμένο αποδεικτικό ανήκει στη σχέση: `allow read, write: if false` για ΚΑΘΕ client.
  'mandate-evidence': 'server-only',
  // ADR-884 Φ0.8 — η ΚΑΡΑΝΤΙΝΑ των πανοραμάτων (`tour-ingest/{tourId}/{uploadId}`): γράφεται μόνο μέσω συνεδρίας που
  //   άνοιξε ο διακομιστής αφού έκρινε, διαβάζεται μόνο από την ολοκλήρωση· `read, write: if false` για κάθε client.
  //   Χρέος του Κ2α (οι κανόνες μπήκαν χωρίς γραμμή εδώ) — κλείστηκε στο Κ3α, όταν η καραντίνα απέκτησε καταναλωτή.
  'tour-ingest': 'server-only',
  // ADR-884 Φ0.4 — τα ιδιωτικά πλακίδια (`on-request`/`link-only`): μόνο πίσω από κουπόνι θέασης του διακομιστή (Κ3β).
  'tour-tiles': 'server-only',
};

/**
 * ⚠️ **Εξάγεται ΜΟΝΟ για την άγκυρα** — που διασταυρώνει τις ρίζες με το
 * `storage.rules`.
 *
 * ⛔ **ΜΗΝ τον διαβάσεις για να πάρεις απόφαση**: η απόφαση έχει **έναν** απαντητή,
 * τον {@link storagePathCustody}. Πίνακας διαβασμένος αλλού είναι ο δεύτερος
 * κριτής που όλο αυτό το αρχείο υπάρχει για να μην γεννηθεί.
 */
export const STORAGE_ROOT_CUSTODY_TABLE = STORAGE_ROOT_CUSTODY;

// =============================================================================
// Ο ΚΡΙΤΗΣ
// =============================================================================

/** Οι ρίζες όπου ο μισθωτής **είναι** το δεύτερο τμήμα της διαδρομής. */
const TENANT_IN_PATH: readonly StorageCustodyKind[] = ['company', 'user'];

/**
 * **Ποιανού είναι αυτή η διαδρομή;** — καθαρή συνάρτηση, κανένα I/O.
 *
 * @param storagePath Το object name **όπως ζει στο bucket**, χωρίς αρχική κάθετο.
 *
 * @example
 * storagePathCustody('companies/comp_1/entities/contact/c_1/…')
 * // → { kind: 'company', root: 'companies', companyId: 'comp_1' }
 */
export function storagePathCustody(storagePath: string): StoragePathCustody {
  if (typeof storagePath !== 'string' || storagePath.trim().length === 0) {
    return { kind: 'unknown', root: '', why: 'path-not-a-path' };
  }

  // ⚠️ Η κανονικοποίηση είναι **ελάχιστη επίτηδες**: η προστασία από `..` ζει στον
  //    `sanitizeStoragePath` (ADR-252 SV-C1) και **δεν αντιγράφεται εδώ**. Αυτό το
  //    αρχείο απαντά «ποιανού;», όχι «είναι ασφαλές το σχήμα;» — δύο ερωτήματα.
  const segments = storagePath.split('/').filter(segment => segment.length > 0);
  const root = segments[0];

  if (root === undefined) {
    return { kind: 'unknown', root: '', why: 'path-not-a-path' };
  }

  const kind = STORAGE_ROOT_CUSTODY[root];
  if (kind === undefined) {
    return { kind: 'unknown', root, why: 'root-not-declared' };
  }

  if (!TENANT_IN_PATH.includes(kind)) {
    return kind === 'shared' ? { kind: 'shared', root } : { kind: 'server-only', root };
  }

  const tenant = segments[1];
  if (tenant === undefined || tenant.length === 0) {
    // 🔴 `companies/` σκέτο **δεν** είναι «όλες οι εταιρείες» — είναι διαδρομή που
    //    δεν ονομάζει μισθωτή, άρα δεν μπορεί να αποδοθεί σε κανέναν.
    return { kind: 'unknown', root, why: 'tenant-segment-missing' };
  }

  return kind === 'company'
    ? { kind: 'company', root, companyId: tenant }
    : { kind: 'user', root, uid: tenant };
}

// =============================================================================
// Η ΕΡΩΤΗΣΗ ΠΟΥ ΚΑΝΕΙ Ο PEP
// =============================================================================

/** Ποιος ρωτά — ταυτότητα **ήδη επαληθευμένη** (`withAuth`). */
export interface StorageCustodyCaller {
  readonly uid: string;
  readonly companyId: string;
}

/**
 * Η ετυμηγορία της διαδρομής. **Ονομασμένη**, ποτέ `boolean`.
 *
 * ⚠️ Το `shared-catalog` είναι **ξεχωριστό** από το `own-company`/`own-user` και
 * **δεν** ισοπεδώνεται: μια μελλοντική πύλη που θα θέλει να μετρήσει «πόσες λήψεις
 * αφορούν κοινόχρηστο περιεχόμενο» δεν πρέπει να χρειαστεί δεύτερη ανάγνωση.
 */
export type StorageCustodyVerdict =
  | 'own-company'
  | 'own-user'
  | 'shared-catalog'
  | 'server-mediated'
  | 'foreign-company'
  | 'foreign-user'
  | 'undeclared-root';

/** Οι ετυμηγορίες που **επιτρέπουν** στον διακομιστή να σερβίρει τα bytes. */
const SERVABLE_VERDICTS: readonly StorageCustodyVerdict[] = [
  'own-company',
  'own-user',
  'shared-catalog',
  'server-mediated',
];

/** Επιτρέπει αυτή η ετυμηγορία τη λήψη; */
export function isStorageCustodyServable(verdict: StorageCustodyVerdict): boolean {
  return SERVABLE_VERDICTS.includes(verdict);
}

/**
 * **Δικαιούται ΑΥΤΟΣ ο καλών τα bytes ΑΥΤΗΣ της διαδρομής;**
 *
 * 🔴 **Είναι φρουρός ΜΙΣΘΩΤΗ, όχι φρουρός ΔΟΧΕΙΟΥ.** Απαντά *«είναι του σπιτιού
 * μου;»* — **όχι** *«επιτρέπεται να το δω μέσα στο σπίτι μου;»*. Το δεύτερο το
 * απαντά ο κριτής ορατότητας του Β5 (`lib/auth/container-access`), και **πρέπει**
 * να κληθεί κι εκείνος όπου υπάρχει `FileRecord`. Ένας φρουρός στη θέση δύο είναι
 * ακριβώς το θέατρο που το Β8 υπάρχει για να τελειώσει.
 *
 * ⚠️ **Καμία παράκαμψη για `super_admin`**, και είναι απόφαση: ο υπερδιαχειριστής
 * έχει ήδη τη δική του διαδρομή στους κανόνες όπου του ανήκει (`cad/`, `users/`),
 * ενώ στο `owner_properties/` οι ίδιοι οι κανόνες τον **αποκλείουν ρητά**
 * (*«το αρχείο είναι η κάτοψη του σπιτιού ενός ανθρώπου»*). Ένα bypass εδώ θα
 * έδινε μέσω proxy ό,τι οι κανόνες αρνούνται — δηλαδή θα ακύρωνε τον κανόνα.
 */
export function judgeStorageCustody(
  storagePath: string,
  caller: StorageCustodyCaller,
): StorageCustodyVerdict {
  const custody = storagePathCustody(storagePath);

  switch (custody.kind) {
    case 'company':
      return custody.companyId === caller.companyId ? 'own-company' : 'foreign-company';
    case 'user':
      return custody.uid === caller.uid ? 'own-user' : 'foreign-user';
    case 'shared':
      return 'shared-catalog';
    case 'server-only':
      return 'server-mediated';
    case 'unknown':
      return 'undeclared-root';
  }
}
