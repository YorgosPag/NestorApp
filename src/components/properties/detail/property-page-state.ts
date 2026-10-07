/**
 * @fileoverview **ΟΙ ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ ΤΗΣ ΚΑΡΤΕΛΑΣ** — καθαρή απόφαση, ελέγξιμη.
 * @related ADR-777 §8.30 · contexts/SharedPropertiesProvider (`hasAnswered`)
 * @module components/properties/detail/property-page-state
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΖΕΙ ΧΩΡΙΣΤΑ ΑΠΟ ΤΟ COMPONENT
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η πρώτη γραφή αυτής της απόφασης ήταν **τρεις τελεστές μέσα στο render** και
 * ήταν **λάθος** — με τρόπο που **καμία** πύλη και **κανένα** test δεν θα έβλεπε,
 * γιατί ο κώδικας ήταν συντακτικά άψογος και σημασιολογικά ψευδής. Το βρήκε
 * **ζωντανή μέτρηση** του HTML που στέλνει ο διακομιστής.
 *
 * Μια απόφαση που μπορεί να είναι σιωπηλά λάθος οφείλει να είναι **καλέσιμη**.
 */

import type { RetiredPropertyLookup } from '@/hooks/useRetiredPropertyRecord';
import type { Property } from '@/types/property-viewer';

/**
 * **Τι δείχνει η καρτέλα.** Κλειστό σύνολο — νέα κατάσταση δεν προσγειώνεται
 * χωρίς να αποφασίσει κάποιος **τι λέει στον άνθρωπο**.
 *
 * ⚠️ Το `absent` **δεν** ξεχωρίζει «διαγράφηκε οριστικά» από «ανήκει σε άλλη εταιρεία»,
 * σκόπιμα: ίδιο συμβόλαιο με το `lookupOwnedPlace`. Ξεχωριστή άρνηση θα
 * **επιβεβαίωνε** ότι η ταυτότητα υπάρχει, και οι ταυτότητες ακινήτων είναι
 * μαντεύσιμες ⇒ απογραφή ξένου χαρτοφυλακίου μέσω μηνυμάτων λάθους.
 *
 * 🗄️ **`retired`** (ADR-329 §3.9): το ακίνητο υπάρχει, είναι **δικό σου**, και βρίσκεται στο αρχείο
 * ή στον κάδο. Η καρτέλα το δείχνει πλήρες και κλειδωμένο — ο σύνδεσμος προς αποσυρμένη εγγραφή
 * οδηγεί **στην εγγραφή**, όχι σε «δεν βρέθηκε» (Notion · Shopify · Figma).
 *
 * 🔴 **`unreachable`**: ο δεύτερος αναγνώστης **δεν μπόρεσε να ρωτήσει**. Δεν είναι `absent`.
 */
export type PropertyPageState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'absent' }
  | { readonly kind: 'unreachable' }
  | { readonly kind: 'found'; readonly property: Property }
  | { readonly kind: 'retired'; readonly property: Property };

export interface PropertyPageStateInput {
  /** Ο ακροατής τρέχει **τώρα**. */
  readonly loading: boolean;
  /**
   * Ο κατάλογος έχει απαντήσει **έστω μία φορά**.
   *
   * 🔴 **ΔΕΝ είναι το `!loading`** — και αυτή η διάκριση **είναι** ολόκληρη η
   * αιτία ύπαρξης του module. Ο `SharedPropertiesProvider` ενεργοποιείται
   * τεμπέλικα και ξεκινά με `isLoading === false`, άρα «δεν φορτώνει» ισχύει
   * **και πριν ρωτήσει κανείς** — μαζί με `properties === []`.
   */
  readonly hasAnswered: boolean;
  /** Το ακίνητο της διαδρομής, αν βρέθηκε στον κατάλογο. */
  readonly property: Property | null | undefined;
  /**
   * Τι απάντησε ο αναγνώστης του αποσυρμένου (`useRetiredPropertyRecord`).
   *
   * ⚠️ **Υποχρεωτικό, επίτηδες**: προαιρετικό πεδίο θα άφηνε έναν καλούντα να το ξεχάσει και να
   * ξαναπεί «δεν βρέθηκε» για ακίνητο του αρχείου — χωρίς σφάλμα και χωρίς ένδειξη.
   */
  readonly retired: RetiredPropertyLookup;
}

/**
 * **Ποια κατάσταση δείχνει η καρτέλα.**
 *
 * 🔑 **Η σειρά των ελέγχων είναι το συμβόλαιο.** Η άγνοια κρίνεται **πρώτη**:
 * όσο δεν έχει απαντήσει ο κατάλογος, καμία άλλη ετυμηγορία δεν είναι βάσιμη.
 * Ένα «δεν βρέθηκε» που στην πραγματικότητα σημαίνει «δεν ρώτησα» δεν είναι
 * ανακριβές — είναι **ψέμα με σιγουριά**, και ο άνθρωπος που έφτασε εδώ από
 * σύνδεσμο email συμπεραίνει ότι το ακίνητό του **διαγράφηκε**.
 *
 * 🔑 **Ο κατάλογος προηγείται ΠΑΝΤΑ του δεύτερου αναγνώστη.** Το ζωντανό ακίνητο έχει έναν
 * αναγνώστη· και όταν ένα αποσυρμένο επανέλθει (από εδώ ή από αλλού), ο κατάλογος το αποκτά και η
 * καρτέλα ξεκλειδώνει μόνη της, όσο μπαγιάτικο κι αν είναι το στιγμιότυπο της απόσυρσης.
 */
export function derivePropertyPageState(
  input: PropertyPageStateInput,
): PropertyPageState {
  if (input.loading || !input.hasAnswered) {
    return { kind: 'loading' };
  }

  if (input.property) {
    return { kind: 'found', property: input.property };
  }

  return stateOfRetiredLookup(input.retired);
}

/** Ο κατάλογος απάντησε χωρίς το ακίνητο: τι λέει ο αναγνώστης του αποσυρμένου. */
function stateOfRetiredLookup(lookup: RetiredPropertyLookup): PropertyPageState {
  switch (lookup.kind) {
    case 'retired':
      return { kind: 'retired', property: lookup.property };
    case 'absent':
      return { kind: 'absent' };
    case 'failed':
      return { kind: 'unreachable' };
    // `idle` = το καρέ πριν ρωτήσει· `loading` = ρωτά. Και τα δύο είναι άγνοια, όχι απουσία.
    case 'idle':
    case 'loading':
      return { kind: 'loading' };
  }
}
