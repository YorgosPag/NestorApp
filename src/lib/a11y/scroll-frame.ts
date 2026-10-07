/**
 * @fileoverview **Μέτρηση θέσης όσο κυλά η οθόνη** — μία φορά ανά καρέ, για κάθε πηγή κύλισης (ADR-907 Φ2β-1).
 * @module lib/a11y/scroll-frame
 * @related hooks/listings/useListingRevealTracking (δείκτης άκρης) · hooks/useActiveSection (τρέχουσα ενότητα)
 *
 * 🔑 **`scroll` στο `document` με `capture`**: τα `scroll` δεν αναδύονται, αλλά **περνούν** από το `document` στη φάση
 * σύλληψης ⇒ **ένας** ακροατής ακούει τη σελίδα **και** κάθε πρόγονο που κυλά. Συν `resize`: στενότερο παράθυρο
 * μετακινεί περιεχόμενο χωρίς καμία κύλιση.
 *
 * 🔑 **`requestAnimationFrame`, όχι χρονόμετρο**: η μέτρηση **επιβάλλει διάταξη** — μία φορά ανά καρέ, αλλιώς layout
 * thrashing στο νήμα που κυλά την οθόνη.
 *
 * ⛔ **Όχι `IntersectionObserver`** (απορρίφθηκε με λόγο): ειδοποιεί μόνο όταν **αλλάζει** η τομή. Άλμα που δεν διασχίζει
 * κατώφλι (`End`, `Home`, άγκυρα) θα άφηνε την προηγούμενη απάντηση ως την επόμενη κίνηση.
 */

/**
 * Τρέχει το `measure` **τώρα** και ξανά σε κάθε καρέ όπου κάτι κύλησε ή άλλαξε μέγεθος το παράθυρο.
 * @returns η αποδέσμευση — για το `return` ενός `useEffect`.
 */
export function onScrollFrame(measure: () => void): () => void {
  let pending = 0;
  const run = (): void => {
    pending = 0;
    measure();
  };
  const schedule = (): void => {
    if (pending === 0) pending = requestAnimationFrame(run);
  };

  measure();
  const listen = { capture: true, passive: true } as const;
  document.addEventListener('scroll', schedule, listen);
  window.addEventListener('resize', schedule, { passive: true });
  return () => {
    document.removeEventListener('scroll', schedule, listen);
    window.removeEventListener('resize', schedule);
    if (pending !== 0) cancelAnimationFrame(pending);
  };
}
