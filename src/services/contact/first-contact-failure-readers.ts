/**
 * @fileoverview **ΠΩΣ ΔΙΑΒΑΖΕΤΑΙ ΜΙΑ ΑΠΟΤΥΧΙΑ** — δύο αναγνώστες, ένας φρουρός.
 * @related ADR-843 · ADR-844 · first-contact.client.ts (ο ΜΟΝΟΣ καταναλωτής)
 * @module services/contact/first-contact-failure-readers
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΦΥΓΑΝ ΑΠΟ ΤΟΝ ΠΕΛΑΤΗ — ΚΑΙ ΓΙΑΤΙ ΟΧΙ ΩΣ «ΚΟΨΙΜΟ ΓΙΑ ΝΑ ΧΩΡΕΣΕΙ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο `first-contact.client.ts` πέρασε τις **500 γραμμές** όταν του προστέθηκε η ενότητα
 * του φιλοξενούμενου (ADR-844). Το όριο του N.7.1 είναι **αφορμή**, όχι λόγος: το
 * ερώτημα *«τι μας είπε ο διακομιστής όταν αρνήθηκε;»* έχει **δύο** πελάτες μέσα στο
 * ίδιο αρχείο — τον `openFirstContactFromScreen` και τον `guestFailureOf` — και ο
 * δεύτερος είναι **ήδη γραμμένος ως εξαγόμενος** με τον λόγο αυτολεξεί: *«εξαγόμενη
 * επειδή τη ρωτούν **δύο**»*. Δηλαδή ο πληθυντικός υπήρχε πριν το όριο.
 *
 * ⚠️ **ΤΟ ΕΝΑΛΛΑΚΤΙΚΟ ΗΤΑΝ ΝΑ ΣΒΗΣΤΕΙ ΣΧΟΛΙΟ ΜΕΧΡΙ ΝΑ ΧΩΡΕΣΕΙ**, και απορρίφθηκε:
 * το αρχείο θα ξαναπερνούσε το όριο στην επόμενη προσθήκη, και η **αιτία** —
 * δύο ερωτήματα σε ένα αρχείο — θα έμενε ανέγγιχτη.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Ο ΚΟΙΝΟΣ ΦΡΟΥΡΟΣ, ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ Ο ΙΔΙΟΣ ΚΑΙ ΣΤΟΥΣ ΔΥΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Και οι δύο ελέγχουν **πρώτα τον διακριτή** (`body.error`) και **μετά** φιλτράρουν την
 * τιμή με τον type guard του λεξιλογίου. Ένας **άγνωστος** κωδικός που θα περνούσε
 * άθικτος θα κατέληγε **ωμό κλειδί στην οθόνη** — το περιστατικό ADR-834 §6.5.ε.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, καμία κλήση δικτύου, κανένα React.
 */

import { apiErrorBodyOf } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import {
  isFirstContactInvariant,
  isFirstContactRejection,
  type FirstContactRejection,
} from '@/services/contact/first-contact-vocabulary';
import type { FirstContactInvariant } from '@/types/first-contact';

const logger = createModuleLogger('first-contact-failure-readers');

/**
 * Ο λόγος άρνησης όπως τον έστειλε ο διακομιστής, ή `null` όταν η αποτυχία ήταν
 * **δικτύου** — δύο πράγματα που η οθόνη πρέπει να πει διαφορετικά.
 *
 * ⚠️ **Ο διακριτής ελέγχεται ΠΡΩΤΟΣ και δεν παρακάμπτεται.** Ένα `reason` χωρίς αυτόν
 * θα σήμαινε ότι διαβάζουμε πεδίο από σχήμα που δεν αναγνωρίσαμε — και ένας άγνωστος
 * κωδικός θα κατέληγε **ωμό κλειδί στην οθόνη**.
 */
export function refusalOf(cause: unknown): FirstContactRejection | null {
  const body = apiErrorBodyOf(cause);
  if (body === null || body.error !== 'CONTACT_REFUSED') return null;

  return isFirstContactRejection(body.reason) ? body.reason : null;
}

/**
 * **Ποια αμετάβλητα έσπασαν** — ή `null` όταν η αποτυχία δεν ήταν αυτού του σχήματος.
 *
 * 🔴 **ΤΟ ΦΙΛΤΡΟ ΔΕΝ ΕΙΝΑΙ ΕΥΠΡΕΠΕΙΑ, ΕΙΝΑΙ Ο ΙΔΙΟΣ ΦΡΟΥΡΟΣ ΜΕ ΤΟΥ `refusalOf`**: ένας
 * **άγνωστος** κωδικός αμετάβλητου θα κατέληγε **ωμό κλειδί στην οθόνη** — ακριβώς το
 * περιστατικό ADR-834 §6.5.ε, που ο αδελφός του αποτρέπει ήδη.
 *
 * ⚠️ **ΚΑΙ ΤΟ ΚΕΝΟ ΑΠΟΤΕΛΕΣΜΑ ΕΠΙΣΤΡΕΦΕΙ `null`, ΟΧΙ `[]`** (N.12): πίνακας που
 * **άδειασε επειδή δεν αναγνωρίσαμε κανέναν** θα έλεγε στην οθόνη *«άκυρο, χωρίς
 * λόγο»* — δηλαδή θα παρουσίαζε την **άγνοιά μας** ως πλήρη απάντηση. Ένα `null` το
 * στέλνει στο `failed`, που είναι **αληθές**: δεν μάθαμε τι έφταιξε.
 */
export function invariantViolationsOf(
  cause: unknown,
): readonly FirstContactInvariant[] | null {
  const body = apiErrorBodyOf(cause);
  if (body === null || body.error !== 'INVALID_CONTACT') return null;
  if (!Array.isArray(body.violations)) return null;

  const known = body.violations.filter(isFirstContactInvariant);
  return known.length > 0 ? known : null;
}

/** Τα τρία σκέλη που **και οι δύο** πελάτες μοιράζονται — και τίποτα άλλο. */
export type CommonFailure =
  | { readonly kind: 'refused'; readonly reason: FirstContactRejection }
  | { readonly kind: 'invalid'; readonly violations: readonly FirstContactInvariant[] }
  | { readonly kind: 'failed' };

/**
 * **Η ΚΟΙΝΗ ΟΥΡΑ ΚΑΘΕ ΑΠΟΤΥΧΙΑΣ** — «άρνηση, ή σπασμένο αμετάβλητο, ή δεν μάθαμε».
 *
 * 🔴 **ΗΤΑΝ ΓΡΑΜΜΕΝΗ ΔΥΟ ΦΟΡΕΣ, ΚΑΙ ΤΟ ΜΕΤΡΗΣΕ ΕΡΓΑΛΕΙΟ ΟΧΙ ΚΡΙΣΗ**: η CHECK 3.28
 * (jscpd, ADR-584) βρήκε **10 γραμμές / 50 tokens** ταυτόσημες ανάμεσα στον
 * `openFirstContactFromScreen` και τον `guestFailureOf` — δύο συναρτήσεις που
 * επιστρέφουν **διαφορετικές** ενώσεις και γι' αυτό δεν έμοιαζαν δίδυμες με το μάτι.
 *
 * 🔑 **Ο τύπος επιστροφής είναι ΤΑ ΤΡΙΑ ΚΟΙΝΑ ΣΚΕΛΗ ΚΑΙ ΜΟΝΟ ΑΥΤΑ.** Και οι δύο
 * καλούντες τα περιέχουν ως **υποσύνολο** των δικών τους ενώσεων, οπότε η ανάθεση
 * ελέγχεται από τη μεταγλώττιση: αν κάποιος αφαιρέσει το `invalid` από τη μία ένωση,
 * **σπάει εδώ**, δεν ξεχνιέται.
 *
 * ⚠️ **Το μήνυμα καταγραφής ΕΙΝΑΙ παράμετρος, επίτηδες.** Τα δύο σημεία λένε
 * διαφορετικά πράγματα *(«η πρώτη επαφή δεν καταγράφηκε» vs «η απόδειξη δεν κατέληξε
 * σε πράξη»)* και **σωστά**: το ημερολόγιο πρέπει να ξεχωρίζει ποια πράξη χάθηκε.
 * Ενοποίησή τους σε ένα γενικό «απέτυχε» θα ήταν κεντρικοποίηση που **αφαιρεί**
 * πληροφορία — ακριβώς ό,τι δεν κάνει μια σωστή SSoT.
 *
 * ⚠️ **Ο καλών ελέγχει ΠΡΩΤΑ τα ΔΙΚΑ ΤΟΥ σκέλη.** Ο `guestFailureOf` ρωτά για
 * `LINK_REFUSED`/`IDENTITY_REFUSED`/`WRITE_FAILED` **πριν** φτάσει εδώ· αυτή η
 * συνάρτηση δεν τα γνωρίζει και δεν πρέπει.
 */
export function commonFailureOf(
  cause: unknown,
  whatWasLost: string,
): CommonFailure {
  const reason = refusalOf(cause);
  if (reason !== null) return { kind: 'refused', reason };

  // ⚠️ **Ο δεύτερος διακριτής, και η σειρά δεν έχει σημασία** — τα δύο σχήματα είναι
  //    **ασύνδετα**: `error` είναι ή `CONTACT_REFUSED` ή `INVALID_CONTACT`, ποτέ και τα
  //    δύο. Ελέγχονται διαδοχικά για να μείνει κάθε φρουρός **μία** ερώτηση.
  const violations = invariantViolationsOf(cause);
  if (violations !== null) return { kind: 'invalid', violations };

  logger.error(whatWasLost, {
    error: cause instanceof Error ? cause.message : String(cause),
  });
  return { kind: 'failed' };
}
