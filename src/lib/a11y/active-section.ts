/**
 * @fileoverview **Ποια ενότητα είναι «η τρέχουσα»** όσο κυλά μια σελίδα με μπάρα ενοτήτων (scrollspy) — ADR-907 Φ2β-1.
 * @module lib/a11y/active-section
 * @related hooks/useActiveSection (η μέτρηση) · components/listing-detail/ListingSectionNav (ο πρώτος καταναλωτής)
 *
 * 🔑 **Καθαρή συνάρτηση, επίτηδες**: το jsdom δεν έχει διάταξη, άρα ό,τι αποφασίζεται *μέσα* σε ακροατή κύλισης δεν
 * δοκιμάζεται ποτέ. Εδώ η απόφαση παίρνει **αριθμούς** και δίνει **δείκτη** — η μέτρηση ζει αλλού.
 *
 * ⛔ **Όχι `IntersectionObserver`** — ίδιος λόγος με το `useListingRevealTracking`: ειδοποιεί μόνο όταν **αλλάζει** η
 * τομή, άρα ένα άλμα (`End`, άγκυρα, επαναφορά κύλισης) που δεν διασχίζει κατώφλι αφήνει λάθος ενότητα τονισμένη.
 */

export interface ActiveSectionInput {
  /** Η πάνω άκρη κάθε ενότητας σε συντεταγμένες παραθύρου, **με τη σειρά του εγγράφου**. */
  readonly tops: readonly number[];
  /** Η γραμμή ανάγνωσης: ό,τι την έχει περάσει προς τα πάνω «έχει αρχίσει». Συνήθως η κάτω άκρη της κολλημένης μπάρας. */
  readonly line: number;
  /** Η κύλιση έφτασε στο τέλος του εγγράφου (και το έγγραφο **κυλά**). */
  readonly atEnd: boolean;
}

/**
 * Ο δείκτης της τρέχουσας ενότητας, ή `-1` όταν δεν υπάρχει καμία.
 *
 * - Η **τελευταία** ενότητα που άρχισε πάνω από τη γραμμή.
 * - Καμία δεν άρχισε ακόμη (ο τίτλος της σελίδας είναι από πάνω) ⇒ η **πρώτη**: η μπάρα δεν μένει ποτέ χωρίς τρέχουσα.
 * - Τέλος εγγράφου ⇒ η **τελευταία**, ακόμη κι αν είναι τόσο κοντή που η κορυφή της δεν φτάνει ποτέ στη γραμμή.
 */
export function activeSectionOf({ tops, line, atEnd }: ActiveSectionInput): number {
  if (tops.length === 0) return -1;
  if (atEnd) return tops.length - 1;
  let active = 0;
  for (let index = 0; index < tops.length; index += 1) {
    if (tops[index] <= line) active = index;
  }
  return active;
}
