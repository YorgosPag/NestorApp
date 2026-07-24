/**
 * =============================================================================
 * STORAGE PATH CUSTODY — SSoT κηδεμονίας αρχείων (ADR-694 Απόφαση Α2)
 * =============================================================================
 *
 * Απαντά ΜΙΑ ερώτηση: **«ποιος κατέχει αυτό το αρχείο, και μπορούμε να το
 * αποδείξουμε;»** — με τρεις δυνατές απαντήσεις, όχι δύο:
 *
 *   - `claimed`  → βρέθηκε ζωντανός ιδιοκτήτης. Το αρχείο ζει.
 *   - `orphaned` → **ΘΕΤΙΚΗ απόδειξη ορφανότητας**: ξέρουμε ακριβώς ποιος έπρεπε
 *                  να το κατέχει (ρητός κανόνας custody) και ο ιδιοκτήτης ΔΕΝ
 *                  υπάρχει. Αυτό είναι «dangling reference», όχι «δεν βρήκα».
 *   - `unknown`  → δεν αναγνωρίζουμε το path ή δεν μπορούμε να αποφανθούμε.
 *                  **ΠΟΤΕ δεν οδηγεί σε διαγραφή.**
 *
 * ## Γιατί υπάρχει (ADR-694 §2.3 — 61 νόμιμα αρχεία διαγράφηκαν σε 13 ημέρες)
 *
 * Το προηγούμενο μοντέλο (`file-ownership-resolver`) ρωτούσε «βρίσκω claim;» και
 * αν όχι, ΔΙΕΓΡΑΦΕ. Δύο θανάσιμες υποθέσεις:
 *
 *   1. **«fileId = basename χωρίς κατάληξη»** — ίσχυε σιωπηλά για ΚΑΘΕ path. Για το
 *      `…/bim-material-textures/{materialId}/albedo.jpg` έβγαζε `fileId = "albedo"`,
 *      που φυσικά δεν είναι κλειδί πουθενά → «ορφανό» → διαγραφή.
 *   2. **«απουσία απόδειξης ιδιοκτησίας = απόδειξη ορφανότητας»** — λάθος. Η απουσία
 *      σημαίνει επίσης: νέο υποσύστημα που δεν έχει καταχωρηθεί ακόμη, race με
 *      pending write, ή legacy αρχείο. Και στις τρεις περιπτώσεις η σωστή ενέργεια
 *      είναι **να μην κάνεις τίποτα**.
 *
 * ## Το πρότυπο: Kubernetes garbage collector (`ownerReferences`)
 *
 * Ένα dependent object διαγράφεται **μόνο** όταν το `ownerReference` του δείχνει σε
 * owner που πλέον δεν υπάρχει (σπασμένη αναφορά). Object **χωρίς καμία** owner
 * reference **δεν αγγίζεται ΠΟΤΕ** από τον GC.
 * @see https://kubernetes.io/docs/concepts/architecture/garbage-collection/
 *
 * Το ίδιο λέει και το Google SRE Book για destructive automation: η αρχιτεκτονική
 * οφείλει να «hinder developers from circumventing soft deletion» — δηλαδή το
 * safety net δεν επιτρέπεται να εξαρτάται από το αν ο επόμενος developer θα
 * θυμηθεί να εγγράψει το υποσύστημά του κάπου.
 * @see https://sre.google/sre-book/data-integrity/
 *
 * ## Πώς επεκτείνεται
 *
 * Νέο υποσύστημα που γράφει αρχεία; **Δεν χρειάζεται να κάνει τίποτα** για να είναι
 * ασφαλές — το default είναι `unknown` → ποτέ διαγραφή. Ένας κανόνας προστίθεται εδώ
 * μόνο όταν θέλουμε το GC να μπορεί να **ανακτήσει χώρο** από αυτό το path. Η
 * ξεχασιά κοστίζει αποθηκευτικό χώρο, ποτέ δεδομένα.
 *
 * @module functions/storage/storage-path-custody
 * @enterprise ADR-694 §4 Α2 — fail-safe custody, deny-by-default στη διαγραφή
 * @see ./orphan-cleanup.ts — ο mark-only παρατηρητής
 * @see ./orphan-sweeper.ts — ο μόνος που διαγράφει, και μόνο με `orphaned`
 */

// Type-only: αυτό το module είναι **καθαρό** — δεν αρχικοποιεί ποτέ το Admin SDK, δέχεται
// το `db` injected. Έτσι ελέγχεται με fake Firestore, χωρίς emulator (ίδιο μοτίβο με το
// `file-ownership-resolver`).
import type * as admin from 'firebase-admin';
import { COLLECTIONS } from '../config/firestore-collections';
import { findFileOwner } from '../shared/file-ownership-resolver';

/** Γιατί δεν μπορέσαμε να αποφανθούμε — καταγράφεται ώστε τα κενά να είναι μετρήσιμα. */
export type CustodyUnknownReason =
  | 'not-company-scoped'
  | 'no-custody-rule'
  | 'lookup-failed';

/**
 * Το πόρισμα κηδεμονίας. **Μόνο** το `orphaned` επιτρέπει διαγραφή — και μόνο από
 * τον sweeper, μετά από παράθυρο ημερών και επανέλεγχο.
 */
export type CustodyOutcome =
  | { readonly kind: 'claimed'; readonly rule: string; readonly ownerId: string }
  | { readonly kind: 'orphaned'; readonly rule: string; readonly ownerId: string }
  | { readonly kind: 'unknown'; readonly reason: CustodyUnknownReason };

/**
 * Ένας κανόνας κηδεμονίας: αναγνωρίζει ένα σχήμα path και λέει πού ζει ο ιδιοκτήτης.
 *
 * `ownerIdOf` δέχεται τα segments **μετά** το `companies/{companyId}/` και επιστρέφει
 * το κλειδί ιδιοκτησίας, ή `null` αν το path δεν ταιριάζει σε αυτόν τον κανόνα. Έτσι
 * κάθε path σχήμα δηλώνει ΤΟ ΔΙΚΟ ΤΟΥ κλειδί — τέλος η καθολική υπόθεση «basename».
 */
interface CustodyRule {
  readonly name: string;
  readonly collection: string;
  readonly ownerIdOf: (tail: readonly string[]) => string | null;
  /** Όταν το κλειδί ζει σε **πεδίο** εγγράφου (N οντότητες → 1 αρχείο), όχι στο doc id. */
  readonly queryField?: string;
}

/** Αφαιρεί την κατάληξη ενός filename (`bmat_x.jpg` → `bmat_x`). Πολλαπλές τελείες → η πρώτη. */
function stripExtension(fileName: string): string {
  const dot = fileName.indexOf('.');
  return dot === -1 ? fileName : fileName.slice(0, dot);
}

/**
 * ΤΟ ΜΗΤΡΩΟ. Κάθε εγγραφή = «αυτό το σχήμα path το κατέχει αυτή η collection, με
 * αυτό το κλειδί». Ό,τι δεν ταιριάζει εδώ είναι `unknown` → **αθάνατο** για τον GC.
 */
const CUSTODY_RULES: readonly CustodyRule[] = [
  // 🎨 PBR υφές υλικού (ADR-413 §2D Φ3) — `bim-material-textures/{materialId}/{map}.{ext}`.
  // Το κλειδί είναι ο ΦΑΚΕΛΟΣ, όχι το filename: το basename είναι `albedo`/`normal`/
  // `roughness`/`ao` — το κανάλι, όχι ταυτότητα. ΑΥΤΗ ακριβώς ήταν η ρίζα του ADR-694.
  {
    name: 'bim-material-textures',
    collection: COLLECTIONS.BIM_MATERIALS,
    ownerIdOf: (tail) =>
      tail.length === 3 && tail[0] === 'bim-material-textures' ? tail[1] : null,
  },
  // 🖼️ Μικρογραφία υλικού (ADR-413 §2D Φ2) — `bim-material-thumbnails/{materialId}.{ext}`.
  {
    name: 'bim-material-thumbnails',
    collection: COLLECTIONS.BIM_MATERIALS,
    ownerIdOf: (tail) =>
      tail.length === 2 && tail[0] === 'bim-material-thumbnails'
        ? stripExtension(tail[1])
        : null,
  },
  // 🧱 Γεωμετρία μπλοκ βιβλιοθήκης — `block-library/{blockId}.json`.
  {
    name: 'block-library',
    collection: COLLECTIONS.BLOCK_LIBRARY,
    ownerIdOf: (tail) =>
      tail.length === 2 && tail[0] === 'block-library' ? stripExtension(tail[1]) : null,
  },
  // 🪑 Εισαγόμενα πλέγματα (ADR-683 Φ3) — `projects/{p}/imported-meshes/{uploadId}.glb`.
  // N οντότητες μοιράζονται ΕΝΑ αρχείο μέσω `params.uploadId` → query, όχι doc id.
  {
    name: 'imported-meshes',
    collection: COLLECTIONS.FLOORPLAN_IMPORTED_MESHES,
    queryField: 'params.uploadId',
    ownerIdOf: (tail) =>
      tail.length === 4 && tail[0] === 'projects' && tail[2] === 'imported-meshes'
        ? stripExtension(tail[3])
        : null,
  },
  // 📄 Canonical FileRecord (ADR-031) — οποιοδήποτε path τελειώνει σε `files/{fileId}.{ext}`.
  {
    name: 'files',
    collection: COLLECTIONS.FILES,
    ownerIdOf: (tail) =>
      tail.length >= 2 && tail[tail.length - 2] === 'files'
        ? stripExtension(tail[tail.length - 1])
        : null,
  },
];

/** Υπάρχει έγγραφο με αυτό το id; Σφάλμα → `null` (άγνωστο), ποτέ «όχι». */
async function docExists(
  db: admin.firestore.Firestore,
  collection: string,
  docId: string,
): Promise<boolean | null> {
  try {
    const snap = await db.collection(collection).doc(docId).get();
    return snap.exists;
  } catch {
    return null;
  }
}

/** Υπάρχει έγγραφο με αυτή την τιμή στο πεδίο; Σφάλμα → `null` (άγνωστο). */
async function queryExists(
  db: admin.firestore.Firestore,
  collection: string,
  field: string,
  value: string,
): Promise<boolean | null> {
  try {
    const snap = await db.collection(collection).where(field, '==', value).limit(1).get();
    return !snap.empty;
  } catch {
    return null;
  }
}

/** Ζει ο ιδιοκτήτης που ορίζει ο κανόνας; `null` όταν το ερώτημα απέτυχε. */
async function ownerExists(
  db: admin.firestore.Firestore,
  rule: CustodyRule,
  ownerId: string,
): Promise<boolean | null> {
  return rule.queryField
    ? queryExists(db, rule.collection, rule.queryField, ownerId)
    : docExists(db, rule.collection, ownerId);
}

/** Τα segments μετά το `companies/{companyId}/`, ή `null` αν δεν είναι company-scoped. */
function companyScopedTail(filePath: string): readonly string[] | null {
  const segments = filePath.split('/').filter((s) => s.length > 0);
  if (segments.length < 3 || segments[0] !== 'companies') return null;
  return segments.slice(2);
}

/**
 * Ο πρώτος κανόνας που αναγνωρίζει το path, μαζί με το κλειδί ιδιοκτησίας του.
 * Σειρά = προτεραιότητα: οι ειδικοί κανόνες πριν τον γενικό `files`.
 */
function matchRule(tail: readonly string[]): { rule: CustodyRule; ownerId: string } | null {
  for (const rule of CUSTODY_RULES) {
    const ownerId = rule.ownerIdOf(tail);
    if (ownerId) return { rule, ownerId };
  }
  return null;
}

/**
 * Τελευταία ευκαιρία αναγνώρισης: ο **υπάρχων** `findFileOwner` (ADR-031/ADR-312/ADR-683)
 * με τη legacy σύμβαση «fileId = basename», **αλλά μόνο θετικά**.
 *
 * Αν βρει claim → `claimed`. Αν δεν βρει → επιστρέφει `null`, που ο caller μεταφράζει σε
 * `unknown`, **ΠΟΤΕ** σε `orphaned`. Έτσι διατηρείται ακέραιη η αναγνώριση των παλιών
 * μονοπατιών (μηδέν διπλότυπη υλοποίηση, N.18) χωρίς να κληρονομείται η θανάσιμη
 * υπόθεση «δεν βρήκα ⇒ σβήσε» που κόστισε 61 αρχεία (ADR-694 §2.3).
 */
async function positiveOnlyClaim(
  db: admin.firestore.Firestore,
  tail: readonly string[],
): Promise<CustodyOutcome | null> {
  const fileName = tail[tail.length - 1];
  if (!fileName) return null;
  const fileId = stripExtension(fileName);
  if (!fileId) return null;
  try {
    const claim = await findFileOwner(db, fileId);
    return claim ? { kind: 'claimed', rule: `legacy:${claim.provider}`, ownerId: fileId } : null;
  } catch {
    return null;
  }
}

/**
 * Το πόρισμα κηδεμονίας για ένα αντικείμενο Storage.
 *
 * **Εγγύηση:** επιστρέφει `orphaned` ΜΟΝΟ όταν ένας ρητός κανόνας custody αναγνώρισε
 * το path ΚΑΙ το ερώτημα ιδιοκτησίας απάντησε οριστικά «δεν υπάρχει». Αποτυχία
 * ερωτήματος, άγνωστο σχήμα, ή μη company-scoped path → `unknown` → το αρχείο ζει.
 */
export async function resolveCustody(
  db: admin.firestore.Firestore,
  filePath: string,
): Promise<CustodyOutcome> {
  const tail = companyScopedTail(filePath);
  if (!tail) return { kind: 'unknown', reason: 'not-company-scoped' };

  const matched = matchRule(tail);
  if (!matched) {
    return (await positiveOnlyClaim(db, tail)) ?? { kind: 'unknown', reason: 'no-custody-rule' };
  }

  const { rule, ownerId } = matched;
  const exists = await ownerExists(db, rule, ownerId);
  if (exists === null) return { kind: 'unknown', reason: 'lookup-failed' };
  if (exists) return { kind: 'claimed', rule: rule.name, ownerId };

  // Ο κανόνας αναγνώρισε το path αλλά ο ιδιοκτήτης λείπει. Πριν το χαρακτηρίσουμε
  // ορφανό, δίνουμε στα legacy providers την ευκαιρία να το διεκδικήσουν — ένα αρχείο
  // μπορεί να ταιριάζει σχήμα ΚΑΙ να ανήκει σε FileRecord (σπάνιο, αλλά μη-καταστροφικό).
  const legacy = await positiveOnlyClaim(db, tail);
  if (legacy) return legacy;

  return { kind: 'orphaned', rule: rule.name, ownerId };
}

/** Εξαγωγή για tests — τα ονόματα των ενεργών κανόνων, ώστε να κλειδώνονται σε test. */
export const CUSTODY_RULE_NAMES: readonly string[] = CUSTODY_RULES.map((r) => r.name);
