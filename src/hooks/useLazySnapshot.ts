/**
 * @fileoverview SSoT — **το μισό που ξέρει από React** για ένα {@link LazyJsonSnapshot}:
 * ζητά τη φόρτωση μία φορά και **ξαναχτίζει την ταυτότητα** όταν φτάσουν τα δεδομένα.
 * @related lib/data/lazy-json-snapshot.ts (το μισό που δεν ξέρει) · ADR-846 Φ2.5
 * @module hooks/useLazySnapshot
 *
 * 🔴 **ΤΟ ΣΤΙΓΜΙΟΤΥΠΟ ΤΑΞΙΔΕΥΕΙ ΑΠΟ `useState` — ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΟΛΟ ΤΟ ΝΟΗΜΑ.**
 * Ένας αναγνώστης χτισμένος πάνω σε **μεταβλητή module** έχει ταυτότητα που **δεν
 * αλλάζει ποτέ**, ενώ τα δεδομένα του αλλάζουν **μία** φορά. Κάθε
 * `useMemo(…, [εκείνον τον αναγνώστη])` παγώνει τότε στο **κενό** — και η οθόνη
 * παρουσιάζει το *«δεν ξέρω»* ως *«δεν υπάρχει»*.
 *
 * ⚠️ **Δεν ήταν θεωρητικό** *(ADR-846, §6.2)*: ο επιλογέας περιοχής δεν εμφάνιζε **καμία**
 * από τις 20.721 οντότητες σε κρύο φόρτωμα και έγραφε *«Καμία περιοχή δεν ταιριάζει»*.
 * Δύο από τους τρεις καταναλωτές είχαν θυμηθεί τη σωστή λίστα εξαρτήσεων· ο τρίτος όχι.
 * **Ένας κανόνας που πρέπει να τον θυμάται κάθε σημείο κλήσης δεν είναι κανόνας.**
 * ⛔ **ΜΗΝ** «σταθεροποιήσεις» τις εξαρτήσεις σε `[]`.
 */

import { useEffect, useState } from 'react';

import type { LazyJsonSnapshot } from '@/lib/data/lazy-json-snapshot';

/**
 * Το στιγμιότυπο, ή `null` όσο **δεν ξέρουμε ακόμη**.
 *
 * 🔑 **Η αποτυχία δίνει το `emptySnapshot`, ΟΧΙ `null` για πάντα.** Η διάκριση είναι
 * ορατή στην οθόνη: `null` σημαίνει *«φορτώνω»* — και μια οθόνη που λέει «φορτώνω» για
 * πάντα είναι σπασμένη. Το κενό στιγμιότυπο σταματά την αναμονή, ενώ οι αναγνώστες
 * απαντούν *«δεν ξέρω»* με κενό. Το cache του {@link LazyJsonSnapshot} μένει `null`,
 * ώστε η **επόμενη** προσάρτηση να ξαναδοκιμάσει.
 *
 * 🔑 **ΑΛΛΑΓΗ ΠΗΓΗΣ = ΝΕΑ ΕΡΩΤΗΣΗ** *(ADR-883)*. Ως τις 2026-09-25 η πηγή έπρεπε να είναι
 * σταθερής ταυτότητας: η κατάσταση κρατούσε το στιγμιότυπο της **πρώτης**, οπότε ένας
 * καλών με πηγή **ανά κλειδί** *(το όριο ενός δήμου: άλλος δήμος, άλλη πηγή)* θα έβλεπε το
 * **παλιό** όριο για πάντα. Τώρα η κατάσταση θυμάται **σε ποια πηγή** απαντά, και μια
 * απάντηση άλλης πηγής αγνοείται. Για σταθερή πηγή η συμπεριφορά είναι **ταυτόσημη**.
 *
 * @param source — ο τεμπέλης αναγνώστης (singleton, ή ένας ανά κλειδί)
 * @param emptySnapshot — η ονομασμένη κατάσταση «ρώτησα και δεν έμαθα»
 */
export function useLazySnapshot<TSnapshot>(
  source: LazyJsonSnapshot<TSnapshot>,
  emptySnapshot: TSnapshot,
): TSnapshot | null {
  const [answer, setAnswer] = useState<{ source: LazyJsonSnapshot<TSnapshot>; snapshot: TSnapshot | null }>(
    () => ({ source, snapshot: source.peek() }),
  );
  const snapshot = answer.source === source ? answer.snapshot : source.peek();

  useEffect(() => {
    if (snapshot !== null) return;

    let alive = true;
    void source.load().then(() => {
      if (alive) setAnswer({ source, snapshot: source.peek() ?? emptySnapshot });
    });

    return () => {
      alive = false;
    };
  }, [snapshot, source, emptySnapshot]);

  return snapshot;
}
