/**
 * @fileoverview **ΤΙ ΚΡΙΝΕΙ Ο ΔΕΙΚΤΗΣ ΠΛΗΡΟΤΗΤΑΣ ΤΟΥ ΙΔΙΩΤΗ — ΚΑΙ ΤΙ ΔΕΝ ΔΙΚΑΙΟΥΤΑΙ ΝΑ ΚΡΙΝΕΙ** (ADR-842 §7.7).
 * @related ADR-842 §5 (Α5) · §7.5 (Φ5) · §7.7 · ADR-841 §7 Α2.2 · Α17.4 · ADR-287 (η μηχανή)
 * @module lib/owner-property/owner-completion-subject
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΔΥΟ ΨΕΜΑΤΑ ΠΟΥ ΕΛΕΓΕ Ο ΔΕΙΚΤΗΣ, ΒΡΕΘΗΚΑΝ ΣΤΗΝ **ΟΘΟΝΗ** *(2026-11-28)*
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **«Λείπουν οι φωτογραφίες»** — σε αγγελία που τις είχε δημοσιευμένες. Η σελίδα
 *    έδινε στον δείκτη την **καθαρή προβολή** του browser (`projectListingShape`), που
 *    γράφει `gallery: []` · `floorplans: []` με σημασία *«το ράφι δεν ρωτήθηκε ακόμη»* —
 *    και ο δείκτης τη διάβαζε ως *«δεν έχει»*. Τα μέσα τα ξέρει **μόνο** η δημοσιευμένη
 *    αγγελία, γιατί μόνο ο γραφέας ρώτησε το ράφι.
 * 2. **«Λείπει η κατάσταση διατήρησης»** — σε άνθρωπο που **δεν έχει πού να τη γράψει**.
 *    Έντεκα πεδία της μηχανής δεν έχουν είσοδο στις οθόνες του ιδιώτη *(οι οικογένειες
 *    της Φ4 δεν έχουν χτιστεί)*, αλλά μετρούσαν στον παρονομαστή και προτείνονταν.
 *
 * ⇒ Αυτό το αρχείο απαντά, **μία φορά**, στα δύο ερωτήματα που η μηχανή δεν μπορεί να
 * απαντήσει μόνη της: *«από πού έρχονται τα μέσα;»* και *«τι μπορεί να απαντήσει αυτός ο
 * άνθρωπος;»*. Δεν βαθμολογεί τίποτα (Α5): παραδίδει το υποκείμενο στη μηχανή.
 */

import { FIELD_KEYS, type FieldKey } from '@/constants/field-completion-weights';
import type { PublicListingLookup } from '@/services/realtime/hooks/public-listings-source';
import type { PublicListing } from '@/types/public-listing';

/**
 * **Έχει ο ιδιώτης είσοδο για αυτό το πεδίο;** — `true` μόνο όπου υπάρχει οθόνη που το γράφει.
 *
 * | Πεδίο | Πού απαντιέται |
 * |---|---|
 * | `type` · `areaGross` · `bedrooms` | η φόρμα της αγγελίας (`/offers/new` και η επεξεργασία της) |
 * | `energyClass` | η ενότητα ΠΕΑ της «Βελτίωσε την αγγελία σου» |
 * | `photos` · `floorplan` | το ανέβασμα μέσων της αγγελίας |
 *
 * 🔑 **`Record<FieldKey, boolean>` και όχι λίστα**: νέο `FIELD_KEY` χωρίς απάντηση εδώ
 * είναι **σφάλμα μεταγλώττισης**, όχι σιωπηλή χρέωση του ιδιώτη.
 *
 * ⚠️ **ΟΤΑΝ ΧΤΙΣΤΕΙ ΟΙΚΟΓΕΝΕΙΑ ΤΗΣ Φ4, Η ΓΡΑΜΜΗ ΤΗΣ ΓΥΡΙΖΕΙ ΣΕ `true` ΣΤΟ ΙΔΙΟ COMMIT** —
 * και τότε το ποσοστό κάθε αγγελίας ιδιώτη **πέφτει**, γιατί ο παρονομαστής μεγαλώνει.
 * Είναι η σωστή συμπεριφορά *(τώρα υπάρχει κάτι να συμπληρωθεί)*, όχι παλινδρόμηση.
 */
const OWNER_HAS_ENTRY_FOR: Readonly<Record<FieldKey, boolean>> = {
  type: true,
  areaGross: true,
  bedrooms: true,
  energyClass: true,
  photos: true,
  floorplan: true,

  areaNet: false,
  bathrooms: false,
  orientations: false,
  condition: false,
  heatingType: false,
  coolingType: false,
  windowFrames: false,
  glazing: false,
  flooring: false,
  interiorFeatures: false,
  securityFeatures: false,
};

/** Τα πεδία της μηχανής που ο ιδιώτης **δεν έχει πού να απαντήσει** σήμερα. */
export const OWNER_UNANSWERABLE_COMPLETION_FIELDS: ReadonlySet<FieldKey> = new Set(
  FIELD_KEYS.filter((key) => !OWNER_HAS_ENTRY_FOR[key]),
);

/** Τα μέσα — άγνωστα όσο δεν υπάρχει δημοσιευμένη αγγελία να τα πει. */
const MEDIA_FIELDS: readonly FieldKey[] = ['photos', 'floorplan'];

const OWNER_UNANSWERABLE_WITH_UNKNOWN_MEDIA: ReadonlySet<FieldKey> = new Set([
  ...OWNER_UNANSWERABLE_COMPLETION_FIELDS,
  ...MEDIA_FIELDS,
]);

/** Ό,τι χρειάζεται η μηχανή για να κρίνει την αγγελία ενός ιδιώτη. */
export interface OwnerCompletionSubject {
  /** Η αγγελία προς βαθμολόγηση — χαρακτηριστικά της προβολής, μέσα της δημοσίευσης. */
  readonly listing: PublicListing;
  /** Τα πεδία που εξαιρούνται από παρονομαστή και προτάσεις. */
  readonly unanswerableFields: ReadonlySet<FieldKey>;
}

/**
 * **Το υποκείμενο του δείκτη**, από την προβολή του browser και την ανάγνωση της
 * δημοσιευμένης αγγελίας. Καθαρή συνάρτηση.
 *
 * | Ανάγνωση | Μέσα | Τι λέει ο δείκτης |
 * |---|---|---|
 * | `loading` | — | **τίποτα** (`null`): δεν ζωγραφίζουμε ποσοστό που θα αλλάξει σε ένα καρέ |
 * | `found` | της δημοσιευμένης αγγελίας | την αλήθεια του ραφιού — ό,τι βλέπει ο αγοραστής |
 * | `absent` · `error` | **άγνωστα** | τα μέσα **εξαιρούνται**: «δεν ξέρω» δεν γίνεται «λείπουν» |
 *
 * 🔑 **ΜΟΝΟ τα μέσα έρχονται από τη δημοσίευση.** Τα χαρακτηριστικά μένουν της προβολής:
 * είναι ό,τι **θα** δημοσιευτεί, και ο άνθρωπος που μόλις διόρθωσε τα υπνοδωμάτια
 * βλέπει τον δείκτη να κινείται **αμέσως**, όχι όταν τελειώσει ο γραφέας. Τα δύο πεδία
 * που αντικαθίστανται είναι ακριβώς εκείνα που η προβολή δηλώνει ότι **δεν γνωρίζει**.
 *
 * ⚠️ **Πριν τη δημοσίευση τα μέσα δεν κρίνονται καθόλου** — όχι επειδή δεν μετρούν, αλλά
 * επειδή ο browser δεν ξέρει τι κάθεται στο ράφι. Μια αποσυρμένη αγγελία με δέκα
 * φωτογραφίες δεν θα ακούσει ποτέ «λείπουν οι φωτογραφίες».
 */
export function ownerCompletionSubject(
  projected: PublicListing,
  published: PublicListingLookup,
): OwnerCompletionSubject | null {
  switch (published.state) {
    case 'loading':
      return null;
    case 'found':
      return {
        listing: {
          ...projected,
          gallery: published.listing.gallery,
          floorplans: published.listing.floorplans,
        },
        unanswerableFields: OWNER_UNANSWERABLE_COMPLETION_FIELDS,
      };
    case 'absent':
    case 'error':
      return { listing: projected, unanswerableFields: OWNER_UNANSWERABLE_WITH_UNKNOWN_MEDIA };
  }
}
