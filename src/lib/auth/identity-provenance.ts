/**
 * =============================================================================
 * Η ΑΥΘΕΝΤΙΑ ΤΗΣ ΠΡΟΕΛΕΥΣΗΣ ΤΑΥΤΟΤΗΤΑΣ — ADR-822
 * =============================================================================
 *
 * Απαντά **δύο** ερωτήματα που μέχρι σήμερα δεν είχαν κάτοχο:
 *
 * 1. *«αυτή την ταυτότητα τη δημιούργησε άνθρωπος;»* → {@link isSyntheticIdentity}
 * 2. *«συμφωνούν τα δύο μητρώα γι' αυτήν;»*          → {@link reconcileIdentity}
 *
 * ⚠️ **ΔΕΝ ΕΙΝΑΙ ΑΔΕΛΦΗ ΤΟΥ `identity-fabrication.ts`.** Εκείνο ρωτά *«επιτρέπεται
 * να ΚΑΤΑΣΚΕΥΑΣΩ ταυτότητα;»* — ερώτημα **προς τα εμπρός**, πριν την πράξη. Αυτό
 * ρωτά *«τι ΑΦΗΣΕ ΠΙΣΩ, και συμφωνούν τα μητρώα;»* — **προς τα πίσω**, μετά την
 * πράξη. Δύο διαφορετικά ερωτήματα ⇒ δύο αυθεντίες (ADR-822 §6). Η συγχώνευσή
 * τους θα ήταν το **αντίστροφο** του ADR-749, όχι η εφαρμογή του.
 *
 * 🔑 **ΚΑΘΑΡΟ, ΜΗΔΕΝ I/O.** Κανένα `firebase-admin`, κανένα `server-only`. Δέχεται
 * ό,τι διάβασε ο καλών και **κρίνει**. Έτσι οι άγκυρες τρέχουν χωρίς rig, και το
 * ίδιο συμπέρασμα βγαίνει από script, από route και από test — **ένα** λεξιλόγιο.
 *
 * @module lib/auth/identity-provenance
 * @see ADR-822 — δύο μητρώα ταυτότητας, μία θεραπεία
 * @see ADR-821 — η γεννήτρια που παρήγαγε το πρώτο αποτύπωμα
 * @see ADR-657 §3.5 — η «ασφαλής τιμή» `external_user`
 * @see ADR-360 — `set-claims-with-mirror.ts`: δηλώνει την ίδια αρχή, **σε σχόλιο**
 */

import type { GlobalRole } from './types';

// ============================================================================
// 1. ΤΟ ΣΥΝΘΕΤΙΚΟ — Η ΕΞΑΓΩΓΗ ΤΟΥ INLINE ΚΑΤΗΓΟΡΗΜΑΤΟΣ
// ============================================================================

/**
 * Η τιμή `authProvider` που **ονομάζει την πηγή του** ένα έγγραφο που κανένας
 * άνθρωπος δεν δημιούργησε.
 *
 * 🔴 **ΕΝΑ ΣΗΜΕΙΟ, ΕΠΙΤΗΔΕΣ.** Μέχρι το ADR-822 η συμβολοσειρά ζούσε **inline**
 * σε ένα φίλτρο του `role-management/users/route.ts`. Δεύτερος έλεγχος αλλού θα
 * σήμαινε **δύο λεξιλόγια** για το ίδιο ερώτημα (ADR-749).
 */
export const SYNTHETIC_AUTH_PROVIDER = 'development-bypass' as const;

/** Το **ελάχιστο** σχήμα εγγράφου που χρειάζεται η κρίση προέλευσης. */
export interface IdentityDocumentFacts {
  readonly authProvider?: string | null;
  readonly status?: string | null;
  readonly globalRole?: string | null;
  readonly loginCount?: number | null;
}

/** Το **ελάχιστο** σχήμα λογαριασμού Auth που χρειάζεται η κρίση. */
export interface IdentityAccountFacts {
  readonly disabled: boolean;
  readonly globalRoleClaim?: string | null;
  readonly mfaEnrolled?: boolean | null;
}

/**
 * *«Το δημιούργησε άνθρωπος;»* — **η μία υλοποίηση**.
 *
 * ⚠️ Ρωτά το **ίδιο το έγγραφο**, όχι το όνομά του. Έλεγχος τύπου
 * `uid === 'dev-admin'` θα ήταν κατηγόρημα **ονόματος**: αστοχεί στο επόμενο
 * συνθετικό όνομα και ψεύδεται μόλις κάποιος μετονομάσει (ADR-821, «ΜΗΝ #5»).
 */
export function isSyntheticIdentity(document: IdentityDocumentFacts): boolean {
  return document.authProvider === SYNTHETIC_AUTH_PROVIDER;
}

// ============================================================================
// 2. ΠΟΙΟ ΜΗΤΡΩΟ ΑΠΑΝΤΑ ΤΙ — Η ΑΣΥΜΜΕΤΡΙΑ ΠΟΥ ΛΕΙΠΕΙ ΑΠΟ ΤΟΥΣ ΜΕΓΑΛΟΥΣ
// ============================================================================

/** Τα **δύο** μητρώα ταυτότητας του συστήματος. */
export type IdentityRegistry = 'firebase-auth' | 'firestore-document';

/** Τα ερωτήματα που κάποιος θέτει για μια ταυτότητα. */
export type IdentityQuestion =
  | 'can-sign-in'
  | 'what-is-permitted'
  | 'has-second-factor'
  | 'how-is-it-displayed'
  | 'when-did-it-last-sign-in';

/**
 * 🏆 **ΠΟΙΟ ΜΗΤΡΩΟ ΕΙΝΑΙ ΑΥΘΕΝΤΙΑ ΓΙΑ ΚΑΘΕ ΕΡΩΤΗΜΑ** (ADR-822 §4.2).
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ, ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΣΗ**: το handoff της 27/08 ρώτησε *«πόσοι
 * `super_admin`;»* στο **έγγραφο** και βρήκε **2**. Η αυθεντία απαντά **3**.
 * **Καμία τιμή δεν διαφωνούσε** — άρα καμία συμμετρική σύγκριση «πεδίο προς
 * πεδίο» (Okta, Google Workspace, OpenIAM) δεν θα το είχε πιάσει. Το εύρημα δεν
 * ήταν ασυμφωνία τιμών· ήταν **ερώτηση στο λάθος μητρώο**.
 *
 * ⚠️ Η αρχή ήταν ήδη γραμμένη — σε **σχόλιο** του `set-claims-with-mirror.ts`
 * (ADR-360: *«Auth claims are the source of truth; the mirror is only a
 * notification channel»*). **Ένα σχόλιο δεν είναι άγκυρα.** Εδώ γίνεται δεδομένο
 * που ο μεταγλωττιστής επιβάλλει και μια δοκιμασία διαβάζει.
 */
export const AUTHORITY_BY_QUESTION: Readonly<Record<IdentityQuestion, IdentityRegistry>> = {
  /** `UserRecord.disabled` — το έγγραφο κρατά αντίγραφο προς εμφάνιση. */
  'can-sign-in': 'firebase-auth',
  /** `customClaims.globalRole` — `firestore.rules:5161`. Το έγγραφο είναι **καθρέφτης χωρίς εξουσία**. */
  'what-is-permitted': 'firebase-auth',
  /** Το `mfaEnrolled` του εγγράφου είναι δηλωμένο, όχι επαληθευμένο. */
  'has-second-factor': 'firebase-auth',
  /** Όνομα, φωτογραφία, επάγγελμα — εδώ το έγγραφο **είναι** η αυθεντία. */
  'how-is-it-displayed': 'firestore-document',
  /** `UserRecord.metadata.lastSignInTime` — το `lastLoginAt` του εγγράφου **παλιώνει**. */
  'when-did-it-last-sign-in': 'firebase-auth',
} as const;

// ============================================================================
// 3. Η ΣΥΜΦΙΛΙΩΣΗ — ΡΗΤΕΣ ΕΤΥΜΗΓΟΡΙΕΣ, ΠΟΤΕ `boolean`
// ============================================================================

/**
 * Η ετυμηγορία της συμφιλίωσης.
 *
 * ⚠️ Ένα `false` δεν λέει **τι** χάλασε. Ο άνθρωπος που βλέπει «απόκλιση» πρέπει
 * να ξεχωρίσει *«έχει εξουσία και είναι αόρατος»* από *«είναι χαρτί»* από
 * *«η θεραπεία σταμάτησε στη μέση»* — **τρεις εντελώς διαφορετικές** επόμενες
 * κινήσεις (ADR-801 §4.4 · ADR-821).
 */
export type ReconciliationVerdict =
  /** Ο **μόνος** καθαρός. */
  | 'consistent'
  /** Λογαριασμός με claims, **χωρίς** έγγραφο: έχει εξουσία και **δεν φαίνεται** πουθενά. */
  | 'account-without-document'
  /** Έγγραφο **χωρίς** λογαριασμό: αποτύπωμα. Δεν συνδέεται, δεν εξουσιοδοτείται. */
  | 'document-without-account'
  /** Ο λογαριασμός απενεργοποιήθηκε, το έγγραφο **δεν το έμαθε ποτέ**. */
  | 'disabled-account-active-document'
  /** Και τα δύο υπάρχουν, αλλά ο ρόλος **διαφωνεί**. Το claim νικά. */
  | 'role-mismatch';

/** Πόσο επείγει. Η σοβαρότητα ακολουθεί την **εξουσία**, όχι τον θόρυβο. */
export type ReconciliationSeverity = 'clean' | 'attention' | 'urgent';

/** Η απάντηση: ετυμηγορία **και** ο λόγος της, ποτέ γυμνή. */
export interface IdentityReconciliation {
  readonly verdict: ReconciliationVerdict;
  readonly severity: ReconciliationSeverity;
  readonly reason: string;
}

/**
 * Ο λόγος κάθε ετυμηγορίας — **πληρότητα επιβαλλόμενη από τον μεταγλωττιστή**
 * (πρότυπο ADR-801 §4.4): έκτη ετυμηγορία **δεν μεταγλωττίζεται** μέχρι να
 * αποκτήσει λόγο **και** σοβαρότητα. Άρνηση χωρίς εξήγηση είναι κενή οθόνη.
 */
const OUTCOME_BY_VERDICT: Readonly<
  Record<ReconciliationVerdict, { readonly severity: ReconciliationSeverity; readonly reason: string }>
> = {
  consistent: {
    severity: 'clean',
    reason: 'Τα δύο μητρώα συμφωνούν.',
  },
  'account-without-document': {
    severity: 'urgent',
    reason:
      'Λογαριασμός Auth χωρίς έγγραφο: κρατά ΠΡΑΓΜΑΤΙΚΗ εξουσία μέσω claims, αλλά ' +
      'δεν εμφανίζεται σε καμία οθόνη διαχείρισης που διαβάζει τη συλλογή users.',
  },
  'document-without-account': {
    severity: 'attention',
    reason:
      'Έγγραφο χωρίς λογαριασμό Auth: δεν μπορεί να συνδεθεί και δεν διαβάζεται από ' +
      'κανέναν φρουρό. Αποτύπωμα, όχι όπλο — αλλά ο ρόλος του παραπλανά κάθε αναγνώστη.',
  },
  'disabled-account-active-document': {
    severity: 'urgent',
    reason:
      'Ο λογαριασμός απενεργοποιήθηκε αλλά το έγγραφο δηλώνει ενεργό: η θεραπεία ' +
      'εφαρμόστηκε σε ΕΝΑ μητρώο. Κάθε οθόνη που διαβάζει το έγγραφο λέει ψέματα.',
  },
  'role-mismatch': {
    severity: 'urgent',
    reason:
      'Ο ρόλος του claim διαφέρει από τον ρόλο του εγγράφου. Το claim ΝΙΚΑ ' +
      '(firestore.rules:5161) — το έγγραφο παραπλανά όποιον το διαβάσει.',
  },
} as const;

/** Η ετυμηγορία κουβαλά τον λόγο της — ένα σημείο κατασκευής, κανένα αντίγραφο. */
function outcome(verdict: ReconciliationVerdict): IdentityReconciliation {
  const { severity, reason } = OUTCOME_BY_VERDICT[verdict];
  return { verdict, severity, reason };
}

/**
 * *«Συμφωνούν τα δύο μητρώα για αυτή την ταυτότητα;»*
 *
 * @param account   Ο λογαριασμός Firebase Auth, ή `null` αν δεν υπάρχει.
 * @param document  Το έγγραφο `users/<uid>`, ή `null` αν δεν υπάρχει.
 *
 * ⚠️ **ΚΑΙ ΤΑ ΔΥΟ `null` ΕΙΝΑΙ ΣΦΑΛΜΑ ΚΑΛΟΥΝΤΑ, ΟΧΙ ΕΥΡΗΜΑ.** Ταυτότητα που δεν
 * υπάρχει σε κανένα από τα δύο μητρώα δεν είναι απόκλιση — είναι ερώτημα για uid
 * που δεν υπάρχει. Ο τύπος το απαγορεύει· η υπογραφή απαιτεί **τουλάχιστον ένα**.
 */
export function reconcileIdentity(
  account: IdentityAccountFacts | null,
  document: IdentityDocumentFacts | null,
): IdentityReconciliation {
  if (account === null && document === null) {
    throw new Error(
      '[identity-provenance] reconcileIdentity κλήθηκε με δύο null. Μια ταυτότητα ' +
        'που λείπει και από τα δύο μητρώα δεν είναι απόκλιση — είναι ανύπαρκτο uid.',
    );
  }

  if (document === null) return outcome('account-without-document');
  if (account === null) return outcome('document-without-account');

  if (account.disabled && document.status === 'active') {
    return outcome('disabled-account-active-document');
  }

  if (rolesDisagree(account.globalRoleClaim, document.globalRole)) {
    return outcome('role-mismatch');
  }

  return outcome('consistent');
}

/**
 * *«Διαφωνούν οι δύο ρόλοι;»*
 *
 * ⚠️ **Το «απών» ΔΕΝ διαφωνεί με το «απών».** Μια ταυτότητα χωρίς ρόλο σε κανένα
 * από τα δύο μητρώα είναι **νόμιμη κατάσταση** (ADR-801: `PROD_NO_ROLE`) — και το
 * `null` σε ένα μητρώο δίπλα σε `undefined` στο άλλο είναι **η ίδια απουσία**
 * γραμμένη δύο φορές, όχι δύο απαντήσεις.
 *
 * 🔑 **ΟΛΗ Η ΔΟΥΛΕΙΑ ΤΗΝ ΚΑΝΕΙ ΤΟ `?? null` — ΚΑΙ ΤΟ ΑΠΕΔΕΙΞΕ ΜΕΤΑΛΛΑΞΗ.** Εδώ
 * υπήρχε και ρητός φρουρός *(«αν και τα δύο είναι `null`, επίστρεψε `false`»)*.
 * Η μετάλλαξη **Μ4** τον έσβησε και **καμία άγκυρα δεν κοκκίνισε** — σωστά: το
 * `null !== null` είναι ήδη `false`, άρα ο φρουρός ήταν **νεκρός κώδικας** που
 * απλώς **έμοιαζε** με άμυνα. Αφαιρέθηκε *(ADR-822, κύκλος μεταλλάξεων)*.
 * ⚠️ Η **κανονικοποίηση** όμως είναι φέρουσα: χωρίς αυτήν, `undefined !== null`
 * θα ήταν `true` και **κάθε** ταυτότητα με ρόλο σε ένα μόνο σχήμα θα έβγαινε
 * ψευδώς `role-mismatch`. Το φυλάει το **Λ3**.
 */
function rolesDisagree(claimRole: string | null | undefined, documentRole: string | null | undefined): boolean {
  return (claimRole ?? null) !== (documentRole ?? null);
}

// ============================================================================
// 4. Η ΑΣΦΑΛΗΣ ΤΙΜΗ — ΕΝΑ ΛΕΞΙΛΟΓΙΟ ΜΕ ΤΟ ADR-657
// ============================================================================

/**
 * Ο ρόλος στον οποίο **υποβαθμίζεται** μια ταυτότητα υπό θεραπεία.
 *
 * 🔑 **ΔΕΝ ΕΠΙΝΟΕΙΤΑΙ ΕΔΩ.** Είναι η τιμή που το **ADR-657 §3.5** ονόμασε ρητά
 * «η ασφαλής», και με την οποία έγινε ο πραγματικός backfill του περιστατικού
 * της 15/07. Δεύτερη «ασφαλής τιμή» θα ήταν δεύτερο λεξιλόγιο.
 */
export const SAFE_DOWNGRADE_ROLE: GlobalRole = 'external_user';
