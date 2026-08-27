/**
 * =============================================================================
 * Η ΑΥΘΕΝΤΙΑ ΤΗΣ ΘΕΡΑΠΕΙΑΣ — ΚΑΘΕ ΠΡΑΞΗ ΓΕΝΝΑ ΤΗΝ ΑΝΤΙΣΤΡΟΦΗ ΤΗΣ (ADR-822 §4.5)
 * =============================================================================
 *
 * Το {@link ./identity-provenance} απαντά *«τι ΕΙΝΑΙ;»*. Αυτό απαντά
 * *«τι ΠΡΑΞΗ, και πώς την παίρνω πίσω;»* — και τα δύο **πριν** γίνει οτιδήποτε.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🏆 ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ «REMEDIATION SCRIPT» — ΚΑΙ ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η βιομηχανία *(AWS, Okta, Google Workspace)* γράφει **δύο** αρχεία: το
 * migration και, δίπλα του, ένα **rollback script γραμμένο από άνθρωπο**. Δύο
 * κείμενα που πρέπει να συμφωνούν — και **παλιώνουν χωριστά**.
 *
 * Τα εργαλεία που θέλουμε να ξεπεράσουμε *(Revit · ArchiCAD · Cinema 4D ·
 * Figma)* **δεν έχουν rollback script**. Έχουν **undo**: η πράξη **παράγει η
 * ίδια** την αντίστροφή της, από την **πραγματική κατάσταση που μόλις διάβασε**.
 * Κανείς δεν τη γράφει· άρα κανείς δεν μπορεί να τη γράψει λάθος.
 *
 * Αυτό το module κάνει το δεύτερο: {@link planRemediation} επιστρέφει το
 * **ζεύγος** `{ forward, inverse }` — και η `inverse` κατασκευάζεται από τις
 * **τιμές που διαβάστηκαν**, ποτέ από υπόθεση.
 *
 * 🔑 **ΚΑΙ ΕΝΑ ΑΚΟΜΑ ΠΟΥ ΟΙ ΜΕΓΑΛΟΙ ΔΕΝ ΚΑΝΟΥΝ — `precondition`**: το remediation
 * των IAM πλατφορμών γράφει **τυφλά**. Εδώ κάθε πράξη κουβαλά την **ταυτότητα
 * της κατάστασης που είδε** *(`expectedUpdatedAtMs`)*. Αν το έγγραφο άλλαξε στο
 * μεταξύ — από άλλον διαχειριστή, από άλλη καρτέλα — η γραφή **αρνείται**, δεν
 * υπεργράφει. *Γραφή πάνω σε κατάσταση που δεν διάβασες είναι δομικά αδύνατη.*
 * Ίδιο μοτίβο compare-and-swap με το ADR-769 — **ένα** λεξιλόγιο, όχι δεύτερο.
 *
 * ⚠️ **ΜΗΔΕΝ I/O, ΜΗΔΕΝ Firebase.** Καθαρή συνάρτηση: δέχεται ό,τι διαβάστηκε,
 * επιστρέφει **περιγραφή** πράξεων. Ποιος τις εκτελεί — και αν — είναι απόφαση
 * αλλού, ανθρώπου.
 *
 * @module lib/auth/identity-remediation
 * @see ADR-822 §4.4 (η εισήγηση ανά εύρημα) · §4.5 (η αντιστρεψιμότητα)
 * @see ADR-657 §3.5 — η «ασφαλής τιμή» `external_user`
 * @see ADR-244 — η υπάρχουσα διαδρομή αλλαγής ρόλου (και το τυφλό της σημείο)
 */

import { USER_STATUSES, type UserStatus } from '@/auth/types/auth.types';

import {
  SAFE_DOWNGRADE_ROLE,
  type IdentityDocumentFacts,
  type ReconciliationVerdict,
} from './identity-provenance';

// 🔑 ADR-822 §4.7 — η **υλοποίηση** εγγράφου ζει σε δικό της αρχείο: είναι η
//    ΜΟΝΗ μη-αναστρέψιμη πράξη, και το ξεχωριστό όνομα το κάνει ορατό. Εδώ
//    μόνο επανεξάγεται, ώστε ο καταναλωτής να έχει **ένα** σημείο εισόδου.
export {
  explainNoMaterialisation,
  planMaterialisation,
  MATERIALISED_FIELDS,
  OMITTED_FIELDS,
} from './identity-materialisation';
export type {
  AuthProfileFacts,
  MaterialisationOutcome,
  MaterialisationPlan,
  NoMaterialisationReason,
} from './identity-materialisation';

// ============================================================================
// 1. ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΗΣ ΚΑΤΑΣΤΑΣΗΣ — ΔΑΝΕΙΣΜΕΝΟ, ΟΧΙ ΕΠΙΝΟΗΜΕΝΟ
// ============================================================================

/**
 * Οι **μόνες** τιμές που επιτρέπεται να πάρει το `status` ενός εγγράφου χρήστη.
 *
 * 🔴 **ΓΙΑΤΙ ΕΙΝΑΙ ΕΔΩ, ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟ ΛΑΘΟΣ ΠΟΥ ΠΑΡΑΛΙΓΟ ΝΑ ΓΡΑΦΤΕΙ**:
 * η πρώτη εισήγηση του ADR-822 §4.4 πρότεινε `status: 'disabled'`. **Το
 * `'disabled'` ΔΕΝ ΥΠΑΡΧΕΙ** στο λεξιλόγιο *(`auth.types.ts:211` δηλώνει
 * `'active' | 'inactive' | 'suspended' | 'pending'`)*. Η «θεραπεία» θα έγραφε
 * στην παραγωγή **τιμή εκτός λεξιλογίου** — δηλαδή **ακριβώς την κλάση βλάβης
 * που καθαρίζει** *(το `globalRole: 'admin'` του ADR-801 §4.3)*.
 *
 * ✅ **ΚΑΙ ΠΛΕΟΝ ΕΙΝΑΙ ΑΠΟΔΕΙΓΜΕΝΑ ΔΑΝΕΙΣΜΕΝΟ** (2026-08-27): το `satisfies` παρακάτω κάνει
 * τον **μεταγλωττιστή** να επιβάλλει ότι κάθε τιμή εδώ ανήκει στο `UserStatus`.
 * *Πριν από αυτό ήταν **μερικό αντίγραφο** — δύο από τις τέσσερις τιμές, χωρίς
 * καμία σύνδεση με τη ρίζα, ενώ δήλωνε «δανεισμένο».*
 *
 * ⚠️ Η σωστή τιμή είναι **`'suspended'`** — η ίδια που ήδη χρησιμοποιεί η
 * διαχείριση χρηστών *(`normalizeMembership`, ADR-787)*. **Ένα λεξιλόγιο.**
 */
export const REMEDIATION_STATUS = {
  /** Ενεργός — η τιμή που **επιστρέφει** η αντίστροφη πράξη. */
  active: 'active',
  /** Ανενεργός **με πρόθεση**: το πρότυπο «deactivate before delete» (Okta). */
  suspended: 'suspended',
} as const satisfies Readonly<Record<string, UserStatus>>;


// ============================================================================
// 2. Η ΠΡΑΞΗ — ΚΑΙ Η ΑΝΤΙΣΤΡΟΦΗ ΤΗΣ
// ============================================================================

/**
 * Τα πεδία που η θεραπεία επιτρέπεται **ποτέ** να αγγίξει. Τίποτα άλλο.
 *
 * 🔑 **ΓΙΑΤΙ `| null`**: το `null` **δεν είναι απουσία** σε αυτά τα έγγραφα —
 * είναι **ζωντανή τιμή** *(μετρημένο: `globalRole: null` σε πραγματικό έγγραφο
 * της παραγωγής)*. Χωρίς αυτό, μια αναίρεση που πρέπει να επαναφέρει σε `null`
 * **παρέλειπε σιωπηλά το πεδίο** — δηλαδή δεν αναιρούσε.
 *
 * ⚠️ Το `status` δέχεται **ολόκληρο** το `UserStatus`, όχι μόνο όσα γράφει η
 * θεραπεία: η **αναίρεση** μπορεί να χρειαστεί να επαναφέρει `'pending'` ή
 * `'inactive'`. Πριν, αυτή η περίπτωση περνούσε με **cast**.
 */
export interface RemediationPatch {
  readonly globalRole?: string | null;
  readonly status?: UserStatus | null;
}

/**
 * Μια πράξη θεραπείας: **τι** γράφεται, **πού**, και **υπό ποια προϋπόθεση**.
 *
 * 🔑 Το `expectedUpdatedAtMs` είναι η **ταυτότητα της κατάστασης που είδαμε**.
 * `null` σημαίνει *«το έγγραφο δεν είχε `updatedAt` όταν διαβάστηκε»* — νόμιμο,
 * και **επίσης** ελέγξιμο: αν στο μεταξύ αποκτήσει, κάποιος το έγραψε.
 */
export interface RemediationOperation {
  readonly uid: string;
  readonly patch: RemediationPatch;
  readonly expectedUpdatedAtMs: number | null;
  /** Τι λέει ο άνθρωπος ότι κάνει — σε **ανθρώπινη** γλώσσα, για το audit. */
  readonly summary: string;
}

/**
 * Το **ζεύγος**: η πράξη και η ακριβής αναίρεσή της.
 *
 * ⚠️ Η `inverse` **δεν** κουβαλά `expectedUpdatedAtMs`: τη στιγμή που θα
 * χρειαστεί, το έγγραφο θα έχει **ήδη** αλλάξει από την `forward`. Ο έλεγχος
 * που την προστατεύει είναι **άλλος** — ότι οι τιμές είναι ακριβώς αυτές που
 * διαβάστηκαν **πριν**. Δηλώνεται ρητά ώστε κανείς να μη «διορθώσει» το κενό.
 */
export interface RemediationPlan {
  readonly verdict: ReconciliationVerdict;
  readonly forward: RemediationOperation;
  readonly inverse: Omit<RemediationOperation, 'expectedUpdatedAtMs'>;
}

/**
 * Γιατί μια απόκλιση **δεν** έχει σχέδιο. Ρητός λόγος, ποτέ σιωπηλό `null`.
 */
export type NoPlanReason =
  /** Τα δύο μητρώα συμφωνούν — δεν υπάρχει τι να θεραπευτεί. */
  | 'nothing-to-remediate'
  /**
   * 🔴 Ο λογαριασμός **υπάρχει και έχει εξουσία**· λείπει το έγγραφο. Καμία
   * αυτόματη πράξη: το «ποιος είναι αυτός ο άνθρωπος;» **δεν είναι ερώτημα
   * κώδικα**. Η δημιουργία εγγράφου θα **επινοούσε** ταυτότητα — ADR-821.
   */
  | 'requires-human-identification'
  /** Η ετυμηγορία δεν αντιστοιχεί σε καμία επιθυμητή κατάσταση. */
  | 'no-actionable-fields'
  /**
   * 🏆 Το έγγραφο είναι **ΗΔΗ** στον προορισμό — το «No changes» του
   * Terraform. **ΔΕΝ ΕΙΝΑΙ ΣΦΑΛΜΑ**: είναι η σωστή απάντηση σε δεύτερη
   * εκτέλεση, και η αιτία που καμία επανάληψη δεν μπορεί να χαλάσει
   * την αναίρεση της πρώτης *(μετρημένο σφάλμα, 2026-08-27)*.
   */
  | 'already-in-desired-state';

/** Η απάντηση: σχέδιο **ή** ονομασμένος λόγος που δεν υπάρχει. */
export type RemediationOutcome =
  | { readonly kind: 'plan'; readonly plan: RemediationPlan }
  | { readonly kind: 'none'; readonly reason: NoPlanReason };

// ============================================================================
// 3. Η ΕΠΙΘΥΜΗΤΗ ΚΑΤΑΣΤΑΣΗ — ΤΟ «ΤΙ», ΠΟΤΕ ΤΟ «ΑΠΟ ΠΟΥ ΠΡΟΣ ΠΟΥ»
// ============================================================================

/**
 * 🏆 **Η ΕΠΙΘΥΜΗΤΗ ΚΑΤΑΣΤΑΣΗ ανά ετυμηγορία — ΕΝΑ σημείο, καθαρά δηλωτικό.**
 *
 * 🔴 **ΓΙΑΤΙ ΑΛΛΑΞΕ ΤΟ ΕΡΩΤΗΜΑ, ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟ (2026-08-27)**: μέχρι σήμερα
 * εδώ ζούσε το `plannedPatch`, που ρωτούσε **«τι ΜΕΤΑΒΑΣΗ κάνω;»** και κουβαλούσε
 * **τρεις χειροποίητους φρουρούς** ιδεμποτικότητας — έναν ανά δρόμο, και **ο
 * τρίτος ρωτούσε άλλο πράγμα από τους δύο πρώτους**:
 *
 * | δρόμος | φρουρός | ρωτούσε |
 * |---|---|---|
 * | `disabled-account-active-document` | `status !== active` | «είμαι στον στόχο;» ✅ |
 * | `role-mismatch` | `previousRole === SAFE_DOWNGRADE_ROLE` | «είμαι στον στόχο;» ✅ |
 * | `document-without-account` | `previousRole === null && status !== active` | **άλλο** ❌ |
 *
 * Ο τρίτος **δεν έπιασε** το ήδη-θεραπευμένο `dev-admin` *(ρόλος `external_user`,
 * κατάσταση `suspended`)*, οπότε το εργαλείο ξαναπρότεινε την ίδια πράξη με
 * `patch === inverse === {external_user, suspended}` — δηλαδή **αναίρεση που δεν
 * αναιρεί**. Η δεύτερη εκτέλεση θα είχε **καταστρέψει** τη μοναδική πραγματική
 * αναίρεση (`super_admin, active`), ακυρώνοντας την υπόσχεση του §4.5.
 *
 * 🏆 **Η ΑΠΑΝΤΗΣΗ ΤΩΝ ΜΕΓΑΛΩΝ — ΜΗΝ ΔΙΟΡΘΩΣΕΙΣ ΤΟΝ ΦΡΟΥΡΟ, ΑΛΛΑΞΕ ΤΟ ΕΡΩΤΗΜΑ.**
 * Ο Kubernetes είναι *level-triggered*: ο reconciler **δεν** μαθαίνει «γιατί»
 * κλήθηκε, μόνο **ποια είναι η τρέχουσα κατάσταση** — γι' αυτό το
 * `controller-runtime` επίτηδες δεν περνά τον τύπο γεγονότος στο `Reconcile()`.
 * Ο Terraform τυπώνει *«No changes»* και **δεν ανοίγει καν συναλλαγή**. Το
 * Figma/Revit/C4D **δεν σπρώχνουν no-op στη στοίβα undo** — αλλιώς το Ctrl+Z
 * κολλάει σε κενά βήματα.
 *
 * ⇒ Εδώ δηλώνεται **μόνο ο προορισμός**. Η διαφορά υπολογίζεται από το
 * {@link narrowToChanges}. **Καμία επανάληψη δεν μπορεί να γεννήσει no-op, και
 * καμία αναίρεση δεν μπορεί να είναι λάθος — δομικά, χωρίς φρουρό.**
 *
 * ⚠️ Ο πίνακας είναι `Partial`: ετυμηγορία **χωρίς** γραμμή σημαίνει «δεν
 * θεραπεύεται από εδώ» — π.χ. το `account-without-document` το πιάνει ο καλών
 * *(υλοποίηση, ADR-822 §4.7)* και το `consistent` κόβεται πριν φτάσει.
 */
const DESIRED_STATE_BY_VERDICT: Partial<Record<ReconciliationVerdict, RemediationPatch>> = {
  // Δρόμος Γ: **ανίκανο ΚΑΙ ορατό**. Τίποτα δεν σβήνεται.
  'document-without-account': {
    globalRole: SAFE_DOWNGRADE_ROLE,
    status: REMEDIATION_STATUS.suspended,
  },
  // Το έγγραφο **μαθαίνει** ό,τι ξέρει ήδη το Auth. Καμία αλλαγή ρόλου.
  'disabled-account-active-document': {
    status: REMEDIATION_STATUS.suspended,
  },
  // ⚠️ Το claim ΝΙΚΑ (`firestore.rules:5161`). Ευθυγράμμιση **ΠΡΟΣ ΤΑ ΚΑΤΩ**:
  //    το να ανέβαινε το έγγραφο στο claim θα ήταν **κλιμάκωση**.
  'role-mismatch': {
    globalRole: SAFE_DOWNGRADE_ROLE,
  },
};

/**
 * Η **ανθρώπινη** περιγραφή της πράξης, για το audit.
 *
 * ⚠️ Συνάρτηση και όχι σταθερά: χρειάζεται το **ΠΡΙΝ** *(«υποβάθμιση από τι;»)*,
 * που ζει στο έγγραφο. Ο προορισμός είναι δηλωτικός· η **αφήγηση** δεν είναι.
 */
const SUMMARY_BY_VERDICT: Partial<
  Record<ReconciliationVerdict, (document: IdentityDocumentFacts) => string>
> = {
  'document-without-account': (document) =>
    `Υποβάθμιση '${document.globalRole ?? '—'}' → '${SAFE_DOWNGRADE_ROLE}' και ` +
    `αναστολή: έγγραφο χωρίς λογαριασμό Auth (ADR-822 §4.4 δρόμος Γ).`,
  'disabled-account-active-document': () =>
    'Ευθυγράμμιση με το Auth: ο λογαριασμός είναι disabled ενώ το έγγραφο ' +
    'δηλώνει ενεργό (ADR-822 §4.4 #3). ΚΑΜΙΑ διαγραφή — αποδεικτικό υλικό.',
  'role-mismatch': (document) =>
    `Ο ρόλος του εγγράφου ('${document.globalRole ?? '—'}') διαφωνεί με το claim. ` +
    `Ευθυγράμμιση ΠΡΟΣ ΤΑ ΚΑΤΩ σε '${SAFE_DOWNGRADE_ROLE}' — ποτέ προς τα πάνω.`,
};

// ============================================================================
// 4. Ο ΣΧΕΔΙΑΣΤΗΣ
// ============================================================================

/** Ο λόγος κάθε «δεν υπάρχει σχέδιο» — πληρότητα από τον μεταγλωττιστή. */
const NO_PLAN_EXPLANATION: Readonly<Record<NoPlanReason, string>> = {
  'nothing-to-remediate': 'Τα δύο μητρώα συμφωνούν.',
  'requires-human-identification':
    'Λογαριασμός με ενεργά claims και χωρίς έγγραφο. Η δημιουργία εγγράφου θα ' +
    'ΕΠΙΝΟΟΥΣΕ ταυτότητα (ADR-821). Χρειάζεται άνθρωπος να πει ποιος είναι.',
  'no-actionable-fields':
    'Η ετυμηγορία δεν αντιστοιχεί σε καμία επιθυμητή κατάσταση που ξέρει η θεραπεία.',
  'already-in-desired-state':
    'Το έγγραφο είναι ΗΔΗ στην επιθυμητή κατάσταση. Καμία πράξη — και καμία ' +
    'εγγραφή στο audit: μια πράξη που δεν αλλάζει τίποτα δεν είναι πράξη.',
};

/** Η ανθρώπινη εξήγηση ενός «δεν υπάρχει σχέδιο». */
export function explainNoPlan(reason: NoPlanReason): string {
  return NO_PLAN_EXPLANATION[reason];
}

/**
 * Διαβάζει το `status` του εγγράφου **επικυρωμένο**, ή `null` αν είναι εκτός
 * λεξιλογίου.
 *
 * 🔑 **ΧΩΡΙΣ `as`**: το `find` πάνω στον πίνακα-αυθεντία {@link USER_STATUSES}
 * επιστρέφει ήδη `UserStatus | undefined`. Ένα cast εδώ θα δήλωνε ψευδώς ότι
 * μια αυθαίρετη συμβολοσειρά από τη Firestore **είναι** έγκυρη κατάσταση.
 */
function readStatus(document: IdentityDocumentFacts): UserStatus | null {
  return USER_STATUSES.find((value) => value === document.status) ?? null;
}

/** Μεταβλητή όψη — **μόνο** για την κατασκευή· η έξοδος είναι readonly. */
type MutablePatch = { -readonly [K in keyof RemediationPatch]: RemediationPatch[K] };

/**
 * 🏆 **ΤΟ ΣΤΕΝΕΜΑ**: κρατά **μόνο** τα πεδία που ΟΝΤΩΣ διαφέρουν από τον
 * προορισμό — και γεννά ταυτόχρονα την **ακριβή** αναίρεσή τους.
 *
 * @returns `null` όταν **τίποτα** δεν διαφέρει. Αυτό είναι το «No changes» του
 *   Terraform: όχι σφάλμα, όχι πράξη — **απουσία πράξης**.
 *
 * 🔑 Η αναίρεση κρατά και το **`null`**: αν ο ρόλος ήταν `null`, η επαναφορά
 * γράφει `null` — τιμή που **υπάρχει** στα ζωντανά έγγραφα. Η προηγούμενη
 * εκδοχή **παρέλειπε** το πεδίο, δηλαδή σιωπηλά **δεν το επανέφερε**.
 */
function narrowToChanges(
  desired: RemediationPatch,
  document: IdentityDocumentFacts,
): { forward: RemediationPatch; inverse: RemediationPatch } | null {
  const forward: MutablePatch = {};
  const inverse: MutablePatch = {};
  let changed = false;

  if (desired.globalRole !== undefined) {
    const current = document.globalRole ?? null;
    if (current !== desired.globalRole) {
      forward.globalRole = desired.globalRole;
      inverse.globalRole = current;
      changed = true;
    }
  }

  if (desired.status !== undefined) {
    const current = readStatus(document);
    if (current !== desired.status) {
      forward.status = desired.status;
      inverse.status = current;
      changed = true;
    }
  }

  return changed ? { forward, inverse } : null;
}

/**
 * *«Τι πράξη θεραπεύει αυτή την απόκλιση — και πώς την παίρνω πίσω;»*
 *
 * 🔑 **Ιδεμποτεντικό εξ ορισμού** (N.7.2 #3): δεύτερη κλήση πάνω σε ήδη
 * θεραπευμένο έγγραφο επιστρέφει `already-in-desired-state`, **όχι** σχέδιο.
 * Δεν υπάρχει φρουρός να ξεχαστεί — η ιδιότητα προκύπτει από τη **μορφή**.
 *
 * @param uid       Η ταυτότητα υπό θεραπεία.
 * @param verdict   Η ετυμηγορία της {@link ./identity-provenance}.
 * @param document  Το έγγραφο **όπως διαβάστηκε**, ή `null` αν δεν υπάρχει.
 * @param updatedAtMs Το `updatedAt` του εγγράφου σε ms — η **ταυτότητα** της
 *                    κατάστασης που είδαμε.
 */
export function planRemediation(
  uid: string,
  verdict: ReconciliationVerdict,
  document: IdentityDocumentFacts | null,
  updatedAtMs: number | null,
): RemediationOutcome {
  if (verdict === 'consistent') return { kind: 'none', reason: 'nothing-to-remediate' };
  if (document === null) return { kind: 'none', reason: 'requires-human-identification' };

  const desired = DESIRED_STATE_BY_VERDICT[verdict];
  const describe = SUMMARY_BY_VERDICT[verdict];
  if (desired === undefined || describe === undefined) {
    return { kind: 'none', reason: 'no-actionable-fields' };
  }

  const changes = narrowToChanges(desired, document);
  if (changes === null) return { kind: 'none', reason: 'already-in-desired-state' };

  const summary = describe(document);
  return {
    kind: 'plan',
    plan: {
      verdict,
      forward: { uid, patch: changes.forward, expectedUpdatedAtMs: updatedAtMs, summary },
      // 🔑 Η αναίρεση κατασκευάζεται από τις **διαβασμένες** τιμές, ποτέ από
      //    προεπιλογή — και **μόνο** για τα πεδία που όντως αλλάζουν.
      inverse: { uid, patch: changes.inverse, summary: `Αναίρεση: ${summary}` },
    },
  };
}
