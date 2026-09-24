/**
 * **Η όψη της κάρτας ανά βαθμίδα εστίασης** — μία γραφή για κάθε λίστα που δένεται με χάρτη.
 *
 * @related ADR-777 §7 (Α3) · §8.75 · lib/listings/listing-focus.ts
 * @module components/search-results/listing-focus-card
 *
 * 🔴 **ΔΥΟ ΒΑΘΜΙΔΕΣ ΕΝΤΑΣΗΣ, ΚΑΙ ΚΑΜΙΑ ΔΕΝ ΕΙΝΑΙ ΜΟΝΟ ΧΡΩΜΑ** (CHECK 3.41 / WCAG 1.4.1). Το
 * `peeked` αλλάζει **μόνο** το περίγραμμα· το `selected` προσθέτει **δεύτερο κανάλι** — γέμισμα
 * **και** δακτύλιο. Αν η διαφορά ήταν δύο αποχρώσεις του ίδιου χρώματος, θα ήταν αδιάκριτη για
 * όποιον δεν τις ξεχωρίζει και θα εξαφανιζόταν σε ασπρόμαυρη εκτύπωση — το ίδιο σκεπτικό που κάνει
 * τα πέντε σχήματα του χάρτη να διαφέρουν σε **μέγεθος**.
 *
 * 🔑 **Εξήχθη όταν απέκτησε δεύτερο καταναλωτή** (N.0.2): η κάρτα της αναζήτησης (`ListingCard`)
 * και η κάρτα του κατόχου (`OwnerPropertyCard`, §8.75). Δύο αντίγραφα θα σήμαιναν ότι «επιλεγμένο»
 * μοιάζει αλλιώς στην αναζήτηση και αλλιώς στο χαρτοφυλάκιο — ο ίδιος χάρτης, δύο γλώσσες.
 *
 * ⚠️ Μόνο **ένταση**: το σχήμα της κάρτας (ακτίνα, γέμισμα βάσης, padding) μένει στον καταναλωτή.
 */
import type { ListingFocusStrength } from '@/lib/listings/listing-focus';

export const LISTING_FOCUS_CARD_CLASS: Readonly<Record<ListingFocusStrength, string>> = {
  selected: 'border-ring bg-accent ring-2 ring-ring ring-offset-1 ring-offset-background',
  peeked: 'border-ring bg-accent/40',
  none: 'border-border',
};

/**
 * Ο δακτύλιος εστίασης πληκτρολογίου **της κάρτας**, όταν κάποιος σύνδεσμός της έχει εστίαση:
 * ο σύνδεσμος είναι μικρός, άρα τον δακτύλιο τον φοράει το σύνολο.
 */
export const LISTING_CARD_FOCUS_VISIBLE_CLASS =
  'has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-1 has-[a:focus-visible]:ring-offset-background';
