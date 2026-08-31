/**
 * @fileoverview **ΕΠΙΤΡΕΠΕΤΑΙ ΑΥΤΗ Η ΠΡΑΞΗ;** — μία απόφαση, δύο καταναλωτές.
 * @related ADR-777 §8.34 · lib/mandate/mandate-standing.ts · services/mandate/mandate-actions.service.ts
 * @module lib/mandate/mandate-actions
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΜΕΣΑ ΣΤΗΝ ΥΠΗΡΕΣΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ερώτημα *«μπορεί το γραφείο να ξαναστείλει αυτόν τον σύνδεσμο;»* το ρωτούν **δύο**
 * πράγματα: η **οθόνη** (για να ζωγραφίσει ή να μη ζωγραφίσει το κουμπί) και ο
 * **διακομιστής** (για να το επιβάλει). Γραμμένο δύο φορές, θα απέκλινε — και η
 * απόκλιση έχει **δύο κακές μορφές, και οι δύο σιωπηλές**:
 *
 * - κουμπί που **υπάρχει** και ο διακομιστής το αρνείται ⇒ ο μεσίτης πατά και
 *   αποτυγχάνει, χωρίς να καταλαβαίνει γιατί·
 * - κουμπί που **λείπει** ενώ ο διακομιστής θα το δεχόταν ⇒ **δουλειά που δεν γίνεται
 *   ποτέ**, και κανείς δεν το μαθαίνει.
 *
 * ⇒ Η απόφαση ζει **εδώ**, σε καθαρό leaf module χωρίς `server-only`, και την καλούν
 * **και οι δύο**. Δεν είναι «κοινός βοηθός»· είναι **ο ένας κριτής**.
 *
 * ⚠️ **ΔΕΝ αντικαθιστά την εξουσιοδότηση.** Το *«είναι του γραφείου σου;»* και το
 * *«έχει η επαφή email;»* **δεν** προκύπτουν από την κατάσταση της εντολής και μένουν
 * ρητά στον διακομιστή. Εδώ κρίνεται **μόνο** ό,τι η κατάσταση αρκεί να απαντήσει.
 */

import type { MandateStanding } from '@/lib/mandate/mandate-standing';

/** Οι δύο πράξεις, ως **κλειστό σύνολο** — ποτέ ωμή συμβολοσειρά από το δίκτυο. */
export const MANDATE_ACTIONS = ['resend', 'revoke'] as const;

export type MandateAction = (typeof MANDATE_ACTIONS)[number];

export function isMandateAction(value: unknown): value is MandateAction {
  return (MANDATE_ACTIONS as readonly unknown[]).includes(value);
}

/** Γιατί **η κατάσταση** δεν δέχεται την πράξη. */
export const STANDING_REFUSALS = [
  /** Ο ιδιοκτήτης είπε «όχι». Τερματική — το DocuSign λέει το ίδιο για το `Declined`. */
  'declined',
  /** Η συμφωνία τελείωσε· πρόσκληση σε νεκρή εντολή δεν ζητά τίποτα υπαρκτό. */
  'expired',
  /** Ανάκληση σε εντολή που **δεν εκκρεμεί** — κλειδώνει τον ιδιοκτήτη έξω. */
  'not-pending',
  /** Ο σύνδεσμος **είναι ήδη** ανακλημένος· δεν υπάρχει τίποτα να ανακληθεί. */
  'already-revoked',
] as const;

export type StandingRefusal = (typeof STANDING_REFUSALS)[number];

/**
 * **Κάθε λόγος που μια πράξη δεν έγινε** — οι λόγοι της κατάστασης **συν** εκείνοι που
 * μόνο ο διακομιστής μπορεί να δει.
 *
 * 🔑 **Ζει εδώ, στο καθαρό module, και όχι στην υπηρεσία**: τον χρειάζεται η **οθόνη**
 * για να διαλέξει μήνυμα. Ένα `server-only` module σαν τόπος του θα ανάγκαζε κάθε
 * component να κάνει `import type` από αρχείο που **δεν επιτρέπεται** να φορτώσει —
 * δουλεύει (ο τύπος σβήνεται), αλλά δηλώνει λάθος πράγμα για το ποιος ανήκει πού.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΙΝΑΙ **ΠΙΝΑΚΑΣ** ΚΑΙ ΟΧΙ ΣΚΕΤΗ ΕΝΩΣΗ — ADR-834 §6.5.ε
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως τις 2026-08-31 ήταν **μόνο τύπος**: υπήρχε στη μεταγλώττιση και **πουθενά** στην
 * εκτέλεση. Άρα ο πελάτης που δεχόταν τον λόγο **από το δίκτυο** δεν είχε τίποτα να
 * ρωτήσει, και έκανε `as MandateActionRejection` πάνω σε **ωμή συμβολοσειρά** — τυφλό
 * cast που δέχεται **οτιδήποτε**. Ένα κλειστό σύνολο που δεν μπορεί να ερωτηθεί
 * **δεν φυλάει τίποτα**· είναι σχόλιο με σύνταξη τύπου.
 *
 * ⚠️ Το `[...STANDING_REFUSALS, …] as const` **διατηρεί** τη σχέση υποσυνόλου *και* τους
 * literal τύπους ⇒ τα `switch` του {@link verdictFor} μένουν **εξαντλητικά**: νέος λόγος
 * εδώ **δεν μεταγλωττίζεται** μέχρι κάποιος να αποφασίσει τι σημαίνει.
 */
export const MANDATE_ACTION_REJECTIONS = [
  ...STANDING_REFUSALS,
  /** Δεν υπάρχει **για αυτό το γραφείο**. Καλύπτει και «δεν υπάρχει» και «ξένο». */
  'absent',
  /** Υπάρχει, αλλά είναι αγγελία ιδιώτη — δεν έχει εντολή να ξαναστείλεις. */
  'not-brokered',
  /**
   * 🔴 **Η επαφή ΔΕΝ ΕΧΕΙ EMAIL.** Ξεχωριστός λόγος από το `write-failed`, και είναι
   * **η ίδια η θεραπεία** της κατάστασης `never-notified`: το γραφείο πατά
   * «ξαναστείλτε» ακριβώς εκεί, και η απάντηση πρέπει να λέει *«συμπληρώστε email
   * στην επαφή»*, όχι *«δοκιμάστε ξανά»* — η δεύτερη στέλνει τον άνθρωπο να πατά το
   * ίδιο κουμπί για πάντα.
   */
  'no-address',
  /** Δεν ολοκληρώθηκε η γραφή ή η ουρά μηνυμάτων απάντησε αρνητικά. */
  'write-failed',
] as const;

export type MandateActionRejection = (typeof MANDATE_ACTION_REJECTIONS)[number];

/**
 * **Είναι αυτό λόγος άρνησης που ξέρουμε;**
 *
 * 🔴 Ο φρουρός του συνόρου: ο λόγος έρχεται **από το δίκτυο** και καταλήγει **κλειδί σε
 * πίνακα κειμένων**. Χωρίς αυτόν, ένας άγνωστος κωδικός θα ζωγραφιζόταν ως **ωμό
 * κλειδί** στην οθόνη — ή, χειρότερα, ως `undefined`.
 *
 * ⚠️ Ο έλεγχος `typeof` **δεν** είναι περιττός: το `includes` δέχεται `unknown` και θα
 * περνούσε αντικείμενα ή `null` χωρίς παράπονο.
 */
export function isMandateActionRejection(value: unknown): value is MandateActionRejection {
  return (
    typeof value === 'string' &&
    (MANDATE_ACTION_REJECTIONS as readonly string[]).includes(value)
  );
}

export type ActionVerdict =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly refusal: StandingRefusal };

const ALLOWED: ActionVerdict = { allowed: true };

/**
 * **Ξαναστέλνω** — επιτρέπεται παντού εκτός από τις δύο τερματικές καταστάσεις.
 *
 * 🏆 **Ευρύτερο από το DocuSign, και σκόπιμα.** Εκείνο επαναστέλνει μόνο σε όποιον έχει
 * *«an open task»*. Εδώ ο σύνδεσμος **δεν καίγεται μετά τη χρήση** επίτηδες, ώστε ο
 * ιδιοκτήτης να μπορεί να **αλλάξει γνώμη** — άρα η επαναποστολή σε ζωντανή εντολή δεν
 * είναι χαλάρωση, είναι **το να του ξαναδώσουμε τη φωνή του**.
 *
 * 🔴 Και είναι η **μόνη** θεραπεία του `unannounced-live`: αγγελία που διαφημίζεται ήδη
 * ενώ ο ιδιοκτήτης δεν ειδοποιήθηκε ποτέ. Ένας κανόνας «μόνο σε εκκρεμείς» θα άφηνε
 * **ακριβώς** αυτή την περίπτωση χωρίς κουμπί.
 */
function resendVerdict(standing: MandateStanding): ActionVerdict {
  switch (standing) {
    case 'declined':
      return { allowed: false, refusal: 'declined' };
    case 'expired':
    case 'expired-unanswered':
      return { allowed: false, refusal: 'expired' };
    case 'unannounced-live':
    case 'never-notified':
    case 'link-revoked':
    case 'awaiting-view':
    case 'awaiting-decision':
    case 'expiring-soon':
    case 'live':
      return ALLOWED;
  }
}

/**
 * **Ανακαλώ** — **μόνο** όσο εκκρεμεί η απάντηση **και** υπάρχει ζωντανός σύνδεσμος.
 *
 * 🔴 Ο λόγος είναι βαρύτερος από του DocuSign. Σε **εγκεκριμένη** εντολή ο σύνδεσμος
 * δεν είναι πρόσκληση — είναι **η έξοδος του ιδιοκτήτη**. Το
 * `owner-property-write.service.ts` το γράφει ρητά: *«Μια πύλη που τον εμποδίζει να
 * ανακαλέσει τον κλειδώνει έξω από την έξοδο — και εδώ η έξοδος είναι δικαίωμα πάνω
 * στην **περιουσία του**»*. Ανάκληση εκεί θα ήταν το **γραφείο** να κλειδώνει τον
 * **πελάτη** έξω από τα δικά του.
 *
 * ⚠️ Το ίδιο και για `declined`: του κλείναμε τον δρόμο να ξανασκεφτεί.
 *
 * ⚠️ Το `already-revoked` είναι **δικός του λόγος**, όχι `not-pending`: η εντολή
 * **όντως** εκκρεμεί· απλώς δεν υπάρχει σύνδεσμος να πεθάνει. Ένα κοινό μήνυμα θα
 * έλεγε στον μεσίτη κάτι που **δεν ισχύει**.
 */
function revokeVerdict(standing: MandateStanding): ActionVerdict {
  switch (standing) {
    case 'never-notified':
    case 'awaiting-view':
    case 'awaiting-decision':
      return ALLOWED;
    case 'link-revoked':
      return { allowed: false, refusal: 'already-revoked' };
    case 'declined':
      return { allowed: false, refusal: 'declined' };
    case 'expired':
    case 'expired-unanswered':
      return { allowed: false, refusal: 'expired' };
    case 'unannounced-live':
    case 'expiring-soon':
    case 'live':
      return { allowed: false, refusal: 'not-pending' };
  }
}

/**
 * **Ο ένας κριτής.** Εξαντλητικός και στις δύο διαστάσεις — νέα πράξη ή ενδέκατη
 * κατάσταση **δεν μεταγλωττίζεται** μέχρι κάποιος να αποφασίσει τι σημαίνει.
 */
export function verdictFor(
  action: MandateAction,
  standing: MandateStanding,
): ActionVerdict {
  return action === 'resend' ? resendVerdict(standing) : revokeVerdict(standing);
}

/** Οι πράξεις που **έχουν νόημα** σε αυτή την κατάσταση — ό,τι ζωγραφίζει η οθόνη. */
export function allowedActionsFor(
  standing: MandateStanding,
): readonly MandateAction[] {
  return MANDATE_ACTIONS.filter((action) => verdictFor(action, standing).allowed);
}
