'use client';

/**
 * ADR-736 §5 — **ο ιδιοκτήτης της αυτόματης επίλυσης συνημμένων.** Δεν ζωγραφίζει τίποτα.
 *
 * ── Γιατί υπάρχει (μετρημένο στον browser, όχι υποθετικό) ───────────────────────────────────
 * Το `DxfImportModal` καταχωρεί τα συνοδευτικά αρχεία στο `ExternalReferenceCandidatesStore`
 * **πριν** ξεκινήσει το parse, ώστε να είναι εκεί μόλις γεννηθεί η σκηνή. Ο καταναλωτής όμως
 * ζούσε μέσα στο `useExternalReferenceResolution`, και ο **μόνος** καλών του ήταν ο
 * `ExternalReferencesManager` — δηλαδή το περιεχόμενο της παλέτας, που η
 * {@link ./ExternalReferencesPalette} δεν αποδίδει καθόλου όσο είναι κλειστή (`if (!isOpen)
 * return null`). Αποτέλεσμα: ο κατάλογος έμενε γεμάτος και **η αυτόματη επίλυση ξεκινούσε τη
 * στιγμή που ο χρήστης άνοιγε το μητρώο** — ακριβώς η ενέργεια που το χαρακτηριστικό υπόσχεται
 * ότι δεν χρειάζεται. Στο πραγματικό τοπογραφικό Ο.Τ. 47 τα 9 υπόβαθρα έμεναν διακεκομμένα
 * πλαίσια μετά την εισαγωγή, και γέμιζαν μόνο μετά το πρώτο άνοιγμα της παλέτας.
 *
 * Η κλάση του σφάλματος είναι γνώριμη: **δυνατότητα σε container που δεν είναι mounted**
 * (ADR-635 Φ C.18, ADR-736 §3 — ο νεκρός `ImportWizard`). Η θεραπεία είναι πάντα η ίδια: ο
 * κώδικας που πρέπει να τρέξει «μόνος του» δεν επιτρέπεται να κρέμεται από UI που ο χρήστης
 * μπορεί να μην ανοίξει ποτέ.
 *
 * ── Γιατί ξεχωριστό host και όχι «κάλεσε το hook και στην παλέτα» ───────────────────────────
 * Ένας **ρητός** ιδιοκτήτης κύκλου ζωής (N.7.2 #7). Η κατανάλωση γίνεται από ΕΝΑ σημείο, οπότε
 * δεν υπάρχει ερώτημα «ποιος πρόλαβε πρώτος» όταν η παλέτα είναι ανοιχτή. Το
 * `takeExternalReferenceCandidates()` αδειάζει τον κατάλογο, άρα η πράξη είναι ούτως ή άλλως
 * idempotent (N.7.2 #3) — αλλά η idempotency είναι δίχτυ, όχι σχέδιο.
 *
 * @see ../../stores/ExternalReferenceCandidatesStore — η προσφορά (γράφεται από το import modal)
 * @see ../../hooks/useExternalReferenceResolution — η κατάσταση + η ενέργεια (χωρίς side effect)
 */

import { useEffect, useSyncExternalStore } from 'react';
import { useExternalReferenceResolution } from '../../hooks/useExternalReferenceResolution';
import {
  peekExternalReferenceCandidates,
  subscribeExternalReferenceCandidates,
  takeExternalReferenceCandidates,
} from '../../stores/ExternalReferenceCandidatesStore';

export const ExternalReferencesAutoResolveHost: React.FC = () => {
  const { references, canResolve, isResolving, resolve } = useExternalReferenceResolution();

  /**
   * 🔴 **Η προσφορά είναι ΣΗΜΑ, όχι σιωπηλό ερμάρι.** Χωρίς αυτή τη συνδρομή το effect ξυπνά
   * μόνο όταν αλλάξει κάτι *άλλο* — και το «άλλο» ήταν το `references.length`. Δηλαδή η
   * αυτόματη επίλυση δούλευε **μόνο όταν άλλαζε το πλήθος των αναφορών**: εισαγωγή πάνω σε
   * ήδη ανοιχτό σχέδιο με τον ίδιο αριθμό υποβάθρων (10 → 10 — δηλαδή το ΙΔΙΟ σχέδιο ξανά,
   * η πιο συνηθισμένη δοκιμή) άφηνε τα αρχεία στον κατάλογο για πάντα και η οθόνη έλεγε
   * «0 από 10». Μετρημένο στον browser 2026-07-31 (ADR-736 §5.2), όχι υποθετικό.
   *
   * Το store εξήγαγε `subscribe`/`peek` από την πρώτη μέρα και **κανείς δεν τα καλούσε** —
   * η κλασική υπογραφή του «γράφτηκε ο εκπομπός, ξεχάστηκε ο δέκτης».
   */
  const pending = useSyncExternalStore(
    subscribeExternalReferenceCandidates,
    peekExternalReferenceCandidates,
    peekExternalReferenceCandidates,
  );

  /**
   * Καταναλώνει **μία φορά** ό,τι πρόσφερε ο χρήστης, μόλις υπάρξει σκηνή με αναφορές. Ο
   * κατάλογος αδειάζει με το που διαβαστεί, οπότε ούτε επαναλαμβάνεται ούτε διαρρέει στην
   * επόμενη εισαγωγή (ταύτιση διαστάσεων με αρχεία ΑΛΛΟΥ έργου μπορεί κάλλιστα να «πετύχει»).
   *
   * Το `take()` αλλάζει το `pending` σε κενό ⇒ το effect ξανατρέχει **μία** φορά και σταματά
   * αμέσως στον έλεγχο μηδενικού μήκους. Idempotent χωρίς σημαία (N.7.2 #3).
   */
  useEffect(() => {
    if (!canResolve || references.length === 0 || isResolving) return;
    if (pending.length === 0) return;
    const candidates = takeExternalReferenceCandidates();
    if (candidates.length === 0) return;
    void resolve(candidates);
    // `isResolving` σκόπιμα ΕΚΤΟΣ deps: μπαίνει/βγαίνει μέσα στο ίδιο το effect και θα
    // προκαλούσε δεύτερο πέρασμα πάνω σε ήδη άδειο κατάλογο (αβλαβές, αλλά θόρυβος).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canResolve, references.length, resolve, pending]);

  return null;
};
