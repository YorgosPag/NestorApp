/**
 * @fileoverview **ΚΩΔΙΚΟΣ → ΚΛΕΙΔΙ ΚΕΙΜΕΝΟΥ** για τη βιτρίνα του γραφείου.
 * @related ADR-827 §9.10 · §9.13 στ · N.11 · CHECK 3.8
 * @module components/mandate/agency-showcase-labels
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ ``t(`…rejection.${reason}`)``
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το δυναμικό κλειδί θα ήταν μία γραμμή αντί για τρεις. Θα ήταν επίσης **αόρατο στη
 * CHECK 3.8**, που διαβάζει **κυριολεκτικά** ορίσματα του `t()` — κλειδί που λείπει θα
 * προσγειωνόταν πράσινο και θα έβγαινε **ωμό στην οθόνη**.
 *
 * 🔑 **Και ο πίνακας δίνει κάτι που καμία άγκυρα δεν μπορεί**: ο τύπος
 * `Record<AgencyProfileRejection, string>` κάνει τον **τέταρτο** λόγο άρνησης **να μη
 * μεταγλωττίζεται** μέχρι κάποιος να του δώσει κείμενο. Δυναμικό κλειδί θα «δούλευε»
 * και θα ζωγράφιζε `mandate.showcase.rejection.νεος-λογος` στην παραγωγή.
 *
 * ⚠️ **Ο πίνακας ΔΕΝ αντικαθιστά την άγκυρα — τη συμπληρώνει.** Ο μεταγλωττιστής φυλά
 * την **πληρότητα του πίνακα**· μόνο το `form-issue-keys.test.ts` (ομάδα `Μ`) φυλά ότι
 * το κλειδί **έχει λέξεις σε δύο γλώσσες**. Ένας πίνακας που δείχνει σε ανύπαρκτο
 * κλειδί μεταγλωττίζεται μια χαρά.
 */

import type { AgencyProfileRejection } from '@/services/mandate/agency-profile.service';

/** Το namespace της βιτρίνας — **`property-market`**, το ίδιο με τον κατάλογο. */
export const SHOWCASE_NS = 'property-market';

const K = 'property-market:mandate.showcase';

export const SHOWCASE_KEYS = {
  title: `${K}.title`,
  lead: `${K}.lead`,
  aliasLabel: `${K}.aliasLabel`,
  aliasHint: `${K}.aliasHint`,
  nameLabel: `${K}.nameLabel`,
  nameHint: `${K}.nameHint`,
  namePlaceholder: `${K}.namePlaceholder`,
  // ── Η ΕΙΔΙΚΟΤΗΤΑ (Φ6-Β4) ─────────────────────────────────────────────────
  occupationLabel: `${K}.occupationLabel`,
  occupationHint: `${K}.occupationHint`,
  occupationPlaceholder: `${K}.occupationPlaceholder`,
  /** ⚠️ Ελεύθερο κείμενο **δεν** είναι ταξινομημένη ειδικότητα — το λέμε ρητά. */
  occupationUnclassified: `${K}.occupationUnclassified`,
  addOccupation: `${K}.addOccupation`,
  removeOccupation: `${K}.removeOccupation`,
  // ── ΤΟ ΜΗΤΡΩΟ, ΚΑΤΑ ΕΤΥΜΗΓΟΡΙΑ ───────────────────────────────────────────
  /** Η **αρχή** δεν επιλέγεται — ονομάζεται. Το `{{authority}}` έρχεται από τον πίνακα. */
  registryLabel: `${K}.registryLabel`,
  registryHint: `${K}.registryHint`,
  registryPlaceholder: `${K}.registryPlaceholder`,
  chapterLabel: `${K}.chapterLabel`,
  chapterHint: `${K}.chapterHint`,
  chapterPlaceholder: `${K}.chapterPlaceholder`,
  /** 🔑 *«Δεν τηρείται μητρώο. **Δεν σου λείπει τίποτα.**»* — Α9.3, όχι σιωπή. */
  registryNone: `${K}.registryNone`,
  /** 🔑 *«Δεν **έχουμε εξετάσει**…»* — υποκείμενο **εμείς**, ποτέ ο άνθρωπος. */
  registryUnexamined: `${K}.registryUnexamined`,
  placeLabel: `${K}.placeLabel`,
  placeHint: `${K}.placeHint`,
  noChannel: `${K}.noChannel`,
  publish: `${K}.publish`,
  publishing: `${K}.publishing`,
  publishedAt: `${K}.publishedAt`,
  republish: `${K}.republish`,
  withdraw: `${K}.withdraw`,
  withdrawing: `${K}.withdrawing`,
  withdrawHint: `${K}.withdrawHint`,
  statusPublished: `${K}.statusPublished`,
  statusNotPublished: `${K}.statusNotPublished`,
  notAllowed: `${K}.notAllowed`,
  /** Το URI δεν βρέθηκε στην ταξινομία ⇒ *«διάλεξε ξανά»*. */
  occupationUnknown: `${K}.occupationUnknown`,
  /** 🔴 *«Δεν μπορέσαμε να ρωτήσουμε»* ⇒ **ξαναδοκίμασε**, ΠΟΤΕ «διόρθωσε». */
  temporarilyUnavailable: `${K}.temporarilyUnavailable`,
  /** Ο δεσμός δεν δείχνει σε τόπο που υπάρχει. */
  placeNotFound: `${K}.placeNotFound`,
  failed: `${K}.failed`,
} as const;

/**
 * **Κάθε λόγος άρνησης του γραφέα, με το κλειδί του.**
 *
 * 🔴 `Record<…>` πάνω στο **κλειστό σύνολο** — δες το σκεπτικό στην κορυφή.
 */
export const SHOWCASE_REJECTION_KEYS: Record<AgencyProfileRejection, string> = {
  'agency-profile-alias-missing': `${K}.rejection.agency-profile-alias-missing`,
  'agency-profile-name-missing': `${K}.rejection.agency-profile-name-missing`,
  'agency-profile-occupation-missing': `${K}.rejection.agency-profile-occupation-missing`,
  'agency-profile-registration-missing': `${K}.rejection.agency-profile-registration-missing`,
  'agency-profile-chapter-missing': `${K}.rejection.agency-profile-chapter-missing`,
};
