/**
 * @fileoverview **ΤΟ ΑΙΤΗΜΑ ΕΠΙΒΕΒΑΙΩΣΗΣ EMAIL ΤΗΣ ΚΑΡΤΑΣ** — λεξιλόγιο (ADR-841 §7 Α21.18).
 * @related services/mandate/showcase-email-confirmation.service.ts (ο γραφέας) ·
 *   lib/agency/showcase-email-confirmation-rules.ts (οι κανόνες) · types/first-contact-invitation.ts (το πρότυπο)
 * @module types/showcase-email-confirmation
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΑΙΤΗΜΑ ΔΕΝ ΕΙΝΑΙ Η ΑΠΟΔΕΙΞΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το αίτημα είναι **εφήμερο**: «σε ποια διεύθυνση στείλαμε ποιον σύνδεσμο, και τι έγινε». Η
 * **απόδειξη** είναι μία ημερομηνία πάνω στο ίδιο το κανάλι (`ShowcaseEmailConfirmation`). Έτσι η
 * κάρτα δεν χρειάζεται ποτέ να ρωτήσει αυτή τη συλλογή για να δείξει σήμα — και η διαγραφή ενός
 * παλιού αιτήματος δεν σβήνει καμία επιβεβαίωση.
 *
 * ⚠️ **Καμία κατάσταση `expired`**: η λήξη κρίνεται από το `expiresAt` **τη στιγμή της ερώτησης**.
 * Κατάσταση που θα έπρεπε να τη γράψει κάποιο cron θα έλεγε ψέματα όσο εκείνο δεν έχει τρέξει.
 *
 * **Layering**: leaf — καθαροί τύποι.
 */

// =============================================================================
// 1. Η ΚΑΤΑΣΤΑΣΗ
// =============================================================================

/** ⚠️ **Ο ΠΙΝΑΚΑΣ ΕΙΝΑΙ Η ΑΥΘΕΝΤΙΑ, Ο ΤΥΠΟΣ ΠΑΡΑΓΕΤΑΙ** — ίδιο μοτίβο με το `FIRST_CONTACT_INVITATION_STATES`. */
export const SHOWCASE_EMAIL_CONFIRMATION_STATES = [
  /** Στάλθηκε· περιμένει πάτημα. Η **μόνη** κατάσταση που αποφασίζεται. */
  'sent',
  /** Ο παραλήπτης πάτησε «Επιβεβαίωση». **Τελική.** */
  'confirmed',
  /** Ο παραλήπτης πάτησε «Δεν το ζήτησα εγώ». **Τελική** — καμία επιβεβαίωση δεν γράφτηκε. */
  'disowned',
  /** Ζητήθηκε νεότερη αποστολή στην ίδια διεύθυνση του ίδιου καταστήματος. **Τελική.** */
  'superseded',
] as const;

export type ShowcaseEmailConfirmationState = (typeof SHOWCASE_EMAIL_CONFIRMATION_STATES)[number];

function isState(value: unknown): value is ShowcaseEmailConfirmationState {
  return typeof value === 'string' && (SHOWCASE_EMAIL_CONFIRMATION_STATES as readonly string[]).includes(value);
}

/**
 * **Ανάγνωση αποθηκευμένης κατάστασης — fail-closed προς `superseded`.**
 *
 * | Αν διαβαστεί ως | Το λάθος είναι |
 * |---|---|
 * | `sent` | **γράφεται σήμα** από έγγραφο που δεν καταλάβαμε |
 * | `superseded` | ο επαγγελματίας στέλνει **νέο** σύνδεσμο — η σωστή επόμενη κίνηση |
 */
export function readStoredConfirmationState(value: unknown): ShowcaseEmailConfirmationState {
  return isState(value) ? value : 'superseded';
}

// =============================================================================
// 2. ΤΟ ΕΓΓΡΑΦΟ — ⛔ ΔΕΝ ΦΤΑΝΕΙ ΠΟΤΕ ΣΕ ΠΕΛΑΤΗ (`deny_all`)
// =============================================================================

export interface ShowcaseEmailConfirmationRequest {
  /** `secf_*` — από το `enterprise-id.service` (N.6). */
  readonly id: string;
  readonly companyId: string;
  /** `sloc_*` — το κατάστημα της κάρτας. */
  readonly locationId: string;
  /** Κανονικοποιημένη με το `normaliseChannelEmail` — ο παραλήπτης **και** το κλειδί σύγκρισης. */
  readonly email: string;
  /** Η ταυτότητα **αυτού** του συνδέσμου — υπογράφεται μέσα του. */
  readonly nonce: string;
  readonly state: ShowcaseEmailConfirmationState;
  /** Ποιος πάτησε «Αποστολή» — για ίχνος, όχι για κρίση. */
  readonly requestedByUid: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  /** Πότε αποφάσισε ο παραλήπτης (`confirmed`/`disowned`) ή πότε αντικαταστάθηκε. */
  readonly settledAt: string | null;
}

/** Το έγγραφο **όπως διαβάζεται** — ο τύπος δεν υπόσχεται εγγύηση που δεν επιβάλλει το Firestore. */
export type ShowcaseEmailConfirmationDocument =
  Omit<ShowcaseEmailConfirmationRequest, 'state'> & { readonly state: string };

// =============================================================================
// 3. Η ΑΠΟΦΑΣΗ ΤΟΥ ΠΑΡΑΛΗΠΤΗ
// =============================================================================

export const SHOWCASE_EMAIL_CONFIRMATION_DECISIONS = ['confirm', 'disown'] as const;

export type ShowcaseEmailConfirmationDecision = (typeof SHOWCASE_EMAIL_CONFIRMATION_DECISIONS)[number];

// =============================================================================
// 4. ΓΙΑΤΙ ΔΕΝ ΑΠΟΦΑΣΙΣΤΗΚΕ — ονομασμένοι λόγοι, ΠΟΤΕ `boolean`
// =============================================================================

/**
 * 🔑 Ο **παραλήπτης** τους διαβάζει, και καθένας τον στέλνει σε άλλη κίνηση: «έληξε» ⇒ ζήτα από το
 * γραφείο νέο · «ήδη επιβεβαιώθηκε» ⇒ **έγινε** · «αντικαταστάθηκε» ⇒ ψάξε το νεότερο μήνυμα ·
 * «το email άλλαξε» ⇒ το γραφείο έβγαλε αυτή τη διεύθυνση από την κάρτα, δεν υπάρχει τίποτα να
 * επιβεβαιωθεί.
 */
export const SHOWCASE_EMAIL_CONFIRMATION_REFUSALS = [
  'link-invalid',
  'request-unknown',
  'expired',
  'already-confirmed',
  'already-disowned',
  'superseded',
  'email-changed',
] as const;

export type ShowcaseEmailConfirmationRefusal = (typeof SHOWCASE_EMAIL_CONFIRMATION_REFUSALS)[number];

export function isShowcaseEmailConfirmationRefusal(value: unknown): value is ShowcaseEmailConfirmationRefusal {
  return typeof value === 'string' && (SHOWCASE_EMAIL_CONFIRMATION_REFUSALS as readonly string[]).includes(value);
}

// =============================================================================
// 5. Η ΑΠΟΣΤΟΛΗ — τι μαθαίνει ο επαγγελματίας
// =============================================================================

/**
 * Γιατί **δεν** στάλθηκε. ⚠️ `send-failed` ≠ `failed`: το πρώτο σημαίνει «το αίτημα γράφτηκε, ο
 * πάροχος αρνήθηκε» — ξαναδοκιμάζεις· το δεύτερο «δεν ξέρουμε» — δεν υπόσχεσαι τίποτα.
 */
export const SHOWCASE_EMAIL_CONFIRMATION_ISSUE_REFUSALS = [
  'without-showcase',
  'email-not-on-card',
  'recipient-quota',
  'send-failed',
  /**
   * ADR-841 §7 Α21.20 — η διεύθυνση **επέστρεψε οριστικά** (hard bounce) και ο άνθρωπος **δεν** δήλωσε ότι
   * τη διόρθωσε. Χωρίς αυτή την άρνηση ο πάροχος θα απέρριπτε **σιωπηλά** την αποστολή (Mailgun 605) και
   * η οθόνη θα έλεγε «στάλθηκε».
   */
  'mailbox-returned',
] as const;

export type ShowcaseEmailConfirmationIssueRefusal = (typeof SHOWCASE_EMAIL_CONFIRMATION_ISSUE_REFUSALS)[number];
