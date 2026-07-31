/**
 * ADR-736 §5.2 — το **αποτέλεσμα της τελευταίας επίλυσης** συνημμένων. Μηδέν React.
 *
 * ## Γιατί store και όχι `useState` μέσα στο hook
 *
 * Το `useExternalReferenceResolution` το καλούν **δύο** components:
 *   · ο {@link ../ui/components/ExternalReferencesAutoResolveHost} — τρέχει την **αυτόματη** επίλυση
 *   · ο {@link ../ui/components/ExternalReferencesManager} — το **περιεχόμενο της παλέτας**
 *
 * Δύο κλήσεις ενός hook = **δύο ανεξάρτητα** `useState`. Όσο το «ποιες αναφορές βγήκαν
 * διφορούμενες» ζούσε σε τοπικό state, το αποτέλεσμα που υπολόγιζε ο host έμενε **μέσα στον
 * host** — ένα component που κάνει `return null`. Η παλέτα ρωτούσε το δικό της, πάντα άδειο,
 * αντίγραφο.
 *
 * 🔴 **Μετρημένο στην οθόνη (2026-07-31, πραγματικό Ο.Τ. 47):** μετά την αυτόματη επίλυση οι
 * τρεις φωτογραφίες αυτοψίας — που είναι **γνήσια** διφορούμενες, και οι τρεις 4000×1800 —
 * εμφανίζονταν ως «**Λείπει**» με κουμπί «Εντοπισμός αρχείου…», σαν να μην τις είχε κοιτάξει
 * κανείς. Ο resolver τις είχε κρίνει σωστά· η κρίση του απλώς δεν έφτανε ποτέ στην οθόνη.
 * Το ίδιο κείμενο άλλαζε σε «Επιλογή» **μόνο** αν ο χρήστης ξανάτρεχε την επίλυση από την
 * παλέτα — δηλαδή η σωστή απάντηση φαινόταν μόνο σε όποιον δεν τη χρειαζόταν.
 *
 * ## Το `isResolving` ανήκει ΕΔΩ, όχι ανά component
 *
 * Δεν είναι καλλωπισμός: όσο ήταν τοπικό, η παλέτα δεν είχε τρόπο να ξέρει ότι ο host **ήδη
 * τρέχει** επίλυση. Ο χρήστης μπορούσε να πατήσει «Εντοπισμός αρχείων…» πάνω σε επίλυση εν
 * εξελίξει και να τρέξουν **δύο** περάσματα που γράφουν και τα δύο τη σκηνή — όποιο τελείωνε
 * τελευταίο κέρδιζε, σβήνοντας τη δουλειά του άλλου. Κοινή σημαία ⇒ και τα δύο κουμπιά
 * απενεργοποιούνται, και η κούρσα δεν υπάρχει (N.7.2 #2).
 *
 * @see ./ExternalReferenceCandidatesStore — η **προσφορά** (η άλλη μισή του ζεύγους)
 * @see ../hooks/useExternalReferenceResolution — ο μοναδικός γραφέας
 */

import { createExternalStore } from './createExternalStore';
import type { ReferenceAmbiguity } from '../io/dxf-external-reference-match';
import type { ResolveReferenceFailure } from '../io/dxf-external-reference-resolver';

export interface ExternalReferenceResolutionOutcome {
  /** Αναφορές με >1 υποψήφιο — ο χρήστης αποφασίζει. Κενό ⇒ καμία εκκρεμής επιλογή. */
  readonly ambiguous: readonly ReferenceAmbiguity[];
  /** Αναφορές που βρέθηκαν αλλά **απέτυχαν** (π.χ. ανέβασμα που έσκασε). Πραγματικό σφάλμα. */
  readonly failures: readonly ResolveReferenceFailure[];
  /** `true` όσο τρέχει επίλυση — από **οποιονδήποτε** δρόμο (αυτόματο ή από την παλέτα). */
  readonly isResolving: boolean;
}

const IDLE: ExternalReferenceResolutionOutcome = {
  ambiguous: [],
  failures: [],
  isResolving: false,
};

const store = createExternalStore<ExternalReferenceResolutionOutcome>(IDLE);

/** Σημειώνει ότι ξεκίνησε επίλυση. Τα προηγούμενα ευρήματα **μένουν** ορατά όσο τρέχει. */
export function markExternalReferenceResolutionStarted(): void {
  store.set({ ...store.get(), isResolving: true });
}

/** Καταγράφει το αποτέλεσμα και σβήνει τη σημαία — η **μόνη** έξοδος από το `isResolving`. */
export function recordExternalReferenceResolutionOutcome(
  outcome: Pick<ExternalReferenceResolutionOutcome, 'ambiguous' | 'failures'>,
): void {
  store.set({ ...outcome, isResolving: false });
}

/**
 * Καθολική αποτυχία (χαμένη σύνδεση): σβήνει **μόνο** τη σημαία. Τα ανά-αναφορά ευρήματα του
 * προηγούμενου περάσματος δεν είναι πια έγκυρα ούτε άκυρα — δεν τα πειράζουμε.
 *
 * Καλείται και από το `finally` του επιτυχημένου δρόμου, όπου η σημαία είναι **ήδη** κάτω:
 * το early return κρατά την πράξη no-op αντί να εκπέμψει περιττή ειδοποίηση σε κάθε
 * συνδρομητή (ίδιο ιδίωμα με το `equals` guard του `createExternalStore`).
 */
export function clearExternalReferenceResolutionFlag(): void {
  const current = store.get();
  if (!current.isResolving) return;
  store.set({ ...current, isResolving: false });
}

export const peekExternalReferenceResolutionOutcome = store.get;
export const subscribeExternalReferenceResolutionOutcome = store.subscribe;

/** Test-only: επαναφορά σε αρχική κατάσταση **χωρίς** ειδοποίηση (jest isolation). */
export function resetExternalReferenceResolutionOutcome(): void {
  store.reset(IDLE);
}
