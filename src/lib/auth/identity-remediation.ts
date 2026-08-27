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
 * ⚠️ Η σωστή τιμή είναι **`'suspended'`** — η ίδια που ήδη χρησιμοποιεί η
 * διαχείριση χρηστών *(`normalizeMembership`, ADR-787)*. **Ένα λεξιλόγιο.**
 */
export const REMEDIATION_STATUS = {
  /** Ενεργός — η τιμή που **επιστρέφει** η αντίστροφη πράξη. */
  active: 'active',
  /** Ανενεργός **με πρόθεση**: το πρότυπο «deactivate before delete» (Okta). */
  suspended: 'suspended',
} as const;

export type RemediationStatus = (typeof REMEDIATION_STATUS)[keyof typeof REMEDIATION_STATUS];

// ============================================================================
// 2. Η ΠΡΑΞΗ — ΚΑΙ Η ΑΝΤΙΣΤΡΟΦΗ ΤΗΣ
// ============================================================================

/** Τα πεδία που η θεραπεία επιτρέπεται **ποτέ** να αγγίξει. Τίποτα άλλο. */
export interface RemediationPatch {
  readonly globalRole?: string;
  readonly status?: RemediationStatus;
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
  /** Το έγγραφο δεν φέρει τίποτα από όσα η θεραπεία ξέρει να αλλάξει. */
  | 'no-actionable-fields';

/** Η απάντηση: σχέδιο **ή** ονομασμένος λόγος που δεν υπάρχει. */
export type RemediationOutcome =
  | { readonly kind: 'plan'; readonly plan: RemediationPlan }
  | { readonly kind: 'none'; readonly reason: NoPlanReason };

// ============================================================================
// 3. Ο ΣΧΕΔΙΑΣΤΗΣ
// ============================================================================

/** Ο λόγος κάθε «δεν υπάρχει σχέδιο» — πληρότητα από τον μεταγλωττιστή. */
const NO_PLAN_EXPLANATION: Readonly<Record<NoPlanReason, string>> = {
  'nothing-to-remediate': 'Τα δύο μητρώα συμφωνούν.',
  'requires-human-identification':
    'Λογαριασμός με ενεργά claims και χωρίς έγγραφο. Η δημιουργία εγγράφου θα ' +
    'ΕΠΙΝΟΟΥΣΕ ταυτότητα (ADR-821). Χρειάζεται άνθρωπος να πει ποιος είναι.',
  'no-actionable-fields':
    'Το έγγραφο δεν φέρει ούτε ρόλο προς υποβάθμιση ούτε κατάσταση προς διόρθωση.',
};

/** Η ανθρώπινη εξήγηση ενός «δεν υπάρχει σχέδιο». */
export function explainNoPlan(reason: NoPlanReason): string {
  return NO_PLAN_EXPLANATION[reason];
}

/**
 * *«Τι πράξη θεραπεύει αυτή την απόκλιση — και πώς την παίρνω πίσω;»*
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

  const patch = plannedPatch(verdict, document);
  if (patch === null) return { kind: 'none', reason: 'no-actionable-fields' };

  return {
    kind: 'plan',
    plan: {
      verdict,
      forward: {
        uid,
        patch: patch.forward,
        expectedUpdatedAtMs: updatedAtMs,
        summary: patch.summary,
      },
      // 🔑 Η αναίρεση κατασκευάζεται από τις **διαβασμένες** τιμές, ποτέ από
      //    προεπιλογή. Αν το έγγραφο δεν είχε ρόλο, η αναίρεση **δεν** βάζει
      //    ρόλο — ούτε καν «τον προηγούμενο που μάλλον ήταν».
      inverse: {
        uid,
        patch: patch.inverse,
        summary: `Αναίρεση: ${patch.summary}`,
      },
    },
  };
}

/** Το ζεύγος τιμών ανά ετυμηγορία — **η μόνη** γνώση του «τι αλλάζει». */
function plannedPatch(
  verdict: ReconciliationVerdict,
  document: IdentityDocumentFacts,
): { forward: RemediationPatch; inverse: RemediationPatch; summary: string } | null {
  if (verdict === 'document-without-account') {
    // Δρόμος Γ: **ανίκανο ΚΑΙ ορατό**. Υποβάθμιση + αναστολή, τίποτα δεν σβήνεται.
    const previousRole = document.globalRole ?? null;
    if (previousRole === null && document.status !== REMEDIATION_STATUS.active) return null;
    return {
      forward: { globalRole: SAFE_DOWNGRADE_ROLE, status: REMEDIATION_STATUS.suspended },
      inverse: {
        ...(previousRole === null ? {} : { globalRole: previousRole }),
        status: (document.status as RemediationStatus) ?? REMEDIATION_STATUS.active,
      },
      summary:
        `Υποβάθμιση '${previousRole ?? '—'}' → '${SAFE_DOWNGRADE_ROLE}' και ` +
        `αναστολή: έγγραφο χωρίς λογαριασμό Auth (ADR-822 §4.4 δρόμος Γ).`,
    };
  }

  if (verdict === 'disabled-account-active-document') {
    // Το έγγραφο **μαθαίνει** ό,τι ξέρει ήδη το Auth. Καμία αλλαγή ρόλου.
    if (document.status !== REMEDIATION_STATUS.active) return null;
    return {
      forward: { status: REMEDIATION_STATUS.suspended },
      inverse: { status: REMEDIATION_STATUS.active },
      summary:
        'Ευθυγράμμιση με το Auth: ο λογαριασμός είναι disabled ενώ το έγγραφο ' +
        'δηλώνει ενεργό (ADR-822 §4.4 #3). ΚΑΜΙΑ διαγραφή — αποδεικτικό υλικό.',
    };
  }

  if (verdict === 'role-mismatch') {
    // ⚠️ Το claim ΝΙΚΑ (firestore.rules:5161). Το έγγραφο **δεν** το ανεβάζει
    //    κανείς εδώ: αυτό θα ήταν κλιμάκωση. Ευθυγραμμίζεται προς τα **κάτω**,
    //    στην ασφαλή τιμή, και ο άνθρωπος αποφασίζει το υπόλοιπο.
    const previousRole = document.globalRole ?? null;
    if (previousRole === SAFE_DOWNGRADE_ROLE) return null;
    return {
      forward: { globalRole: SAFE_DOWNGRADE_ROLE },
      inverse: previousRole === null ? {} : { globalRole: previousRole },
      summary:
        `Ο ρόλος του εγγράφου ('${previousRole ?? '—'}') διαφωνεί με το claim. ` +
        `Ευθυγράμμιση ΠΡΟΣ ΤΑ ΚΑΤΩ σε '${SAFE_DOWNGRADE_ROLE}' — ποτέ προς τα πάνω.`,
    };
  }

  // `account-without-document` το πιάνει ο καλών πριν φτάσει εδώ.
  return null;
}
