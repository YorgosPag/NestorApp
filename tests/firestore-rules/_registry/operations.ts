/**
 * Firestore Rules Test Coverage — Operations & Outcomes
 *
 * Canonical operation + outcome enums used by the coverage manifest and the
 * matrix-driven test harness. See ADR-298 §3.2.
 *
 * @module tests/firestore-rules/_registry/operations
 * @since 2026-04-11 (ADR-298 Phase A)
 */

/** CRUD operations exercised against Firestore rules. */
export type Operation = 'read' | 'list' | 'create' | 'update' | 'delete';

/** Expected rule outcome for a (persona × operation) cell. */
export type Outcome = 'allow' | 'deny';

/**
 * Deterministic failure reason tag — **ΤΕΚΜΗΡΙΩΣΗ, ΟΧΙ ΕΠΙΚΥΡΩΣΗ.**
 *
 * Δηλώνει **ποιο σκέλος** του κανόνα αναμένεται να κόψει. Χρήσιμο για τον
 * άνθρωπο που διαβάζει τη μήτρα: μια παλινδρόμηση που **εξακολουθεί να αρνείται
 * αλλά για λάθος λόγο** (π.χ. `immutable` αντί για `cross_tenant`) είναι σιωπηλό
 * σπάσιμο συμβολαίου, και το tag είναι το μόνο σημείο όπου η πρόθεση γράφεται.
 *
 * ⛔ **Η ΠΡΟΗΓΟΥΜΕΝΗ ΠΡΟΤΑΣΗ ΕΔΩ ΕΛΕΓΕ ΨΕΜΑΤΑ ΚΑΙ ΑΦΑΙΡΕΘΗΚΕ** *(ADR-298 §8
 * Α21.15/Α21.16)*. Έγραφε *«Reason tags give the harness a lightweight way to
 * assert on intent, not just outcome»*. **Η `assertCell()` δεν διάβασε ΠΟΤΕ το
 * `cell.reason`** — και τα tags είναι **1.654** σε χρόνο εκτέλεσης, δηλαδή
 * **κάθε** κελί άρνησης φέρει ένα, **κανένα** δεν ελέγχεται.
 *
 * 📊 **ΚΑΙ Η ΕΠΙΒΟΛΗ ΜΕΤΡΗΘΗΚΕ ΠΡΙΝ ΑΠΟΡΡΙΦΘΕΙ**: ο κωδικός σφάλματος είναι
 * `permission-denied` για **όλους**· το μήνυμα ξεχωρίζει μόνο τον `anonymous`
 * (`false @ L21` vs `evaluation error at L2390:24`), ενώ `cross_tenant` /
 * `insufficient_role` / `not_owner` δίνουν **ταυτόσημο byte-προς-byte** μήνυμα.
 * ⇒ Επιβλητό είναι **μόνο** το `missing_claim` (**417 από 1.654 = 25%**). Μια
 * μηχανή επιβολής θα έβαφε πράσινο **το εύκολο 25%** και θα έμενε τυφλή στο
 * **75%** που την κίνησε — δηλαδή θα ξανάχτιζε το ίδιο «μοιάζει επικυρωμένο»,
 * με νέο όνομα.
 *
 * ⇒ **Το tag είναι ισχυρισμός για το ΠΟΙΟ ΣΚΕΛΟΣ έκοψε, όχι παρατηρήσιμο
 * γεγονός.** Η μόνη εκτελέσιμη διαδρομή προς επικύρωση που έχει ονομαστεί είναι
 * το δέσιμό του στη **γραμμή** που αρνήθηκε, μέσω του υπάρχοντος location-map
 * (`--map`) — **δεν έχει χτιστεί**, και είναι απόφαση, όχι εκκρεμότητα.
 */
export type Reason =
  | 'missing_claim'         // unauthenticated or no companyId claim
  | 'cross_tenant'          // authed but wrong companyId
  | 'immutable'             // append-only rule blocks update/delete
  | 'field_not_allowlisted' // update with disallowed field
  | 'legacy_fallback'       // legacy doc with no companyId — fallback-leg test
  | 'enum_invalid'          // enum validation (channel/direction/status)
  | 'insufficient_role'     // authed + tenant OK but role below the rule's floor
  | 'not_owner'             // authed + tenant OK, role irrelevant — private doc, only its creator may read (block_library user scope, ADR-652)
  /**
   * ADR-867 §4.2 — πιστοποιημένος, **σωστός μισθωτής, ακόμη και διαχειριστής**, αλλά
   * **δεν έχει ζωντανή γραμμή στο ακροατήριο** του νήματος (καμία γραμμή, ή `until != null`).
   *
   * 🔑 **ΔΕΝ είναι `not_owner`, και η διάκριση δεν είναι λεπτολογία**: το `not_owner`
   * λέει *«ιδιωτικό έγγραφο — μόνο ο συντάκτης του»*, δηλαδή **ΕΝΑΣ** άνθρωπος για
   * πάντα. Εδώ οι αναγνώστες είναι **πολλοί**, **αλλάζουν** (ομάδα πράξης) και το
   * δικαίωμα **σφραγίζεται** όταν φύγει κάποιος — ένα νήμα που επιβιώνει της απουσίας
   * και της αποχώρησης είναι ολόκληρο το ADR-834 §5 Β (ε). Ετικέτα «ιδιοκτήτη» εδώ θα
   * περιέγραφε **άλλο** μοντέλο από αυτό που τρέχει.
   */
  | 'not_audience'
  /**
   * ADR-866 §2.6.11 — ο **κάτοχος** γράφει, αλλά **μόνο** ζευγαρωμένα: η γραμμή δραστηριότητας
   * γίνεται δεκτή **μόνο** μαζί με την αλλαγή αρχείου που περιγράφει, στην ίδια δέσμη.
   *
   * 🔑 **ΔΕΝ είναι `server_only`**: ο πελάτης **γράφει** — η ζευγαρωμένη δέσμη περνά. Μια μεμονωμένη
   * γραφή (αυτό που δοκιμάζει ένα κελί μήτρας) αρνείται επειδή **δεν περιγράφει τίποτα που συνέβη**.
   */
  | 'unpaired_activity'
  | 'server_only';          // client write forbidden (server SDK only)

/** All known operations — iteration helper for matrix loops. */
export const ALL_OPERATIONS: readonly Operation[] = [
  'read',
  'list',
  'create',
  'update',
  'delete',
] as const;

/** Operations that only affect existing documents. */
export const WRITE_OPERATIONS: readonly Operation[] = ['create', 'update', 'delete'] as const;

/** Operations that read documents without mutating. */
export const READ_OPERATIONS: readonly Operation[] = ['read', 'list'] as const;
