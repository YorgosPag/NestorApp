/**
 * @fileoverview **ΤΑ ΠΛΑΤΗ ΣΤΑ ΟΠΟΙΑ ΜΕΤΡΙΕΤΑΙ Η ΦΟΡΜΑ** — και γιατί ακριβώς αυτά.
 * @related AddressFieldWidthHarness · address-field-width.e2e.spec.ts · ADR-332 D27 Ζ7
 *
 * 🔑 **ΜΙΑ ΣΤΑΘΕΡΑ, ΔΥΟ ΑΝΑΓΝΩΣΤΕΣ** — το όργανο που αποδίδει και η πύλη που κρίνει.
 * Γραμμένα δύο φορές, θα απέκλιναν στην πρώτη προσθήκη πλάτους και η πύλη θα έκρινε
 * **άλλες** συνθήκες από αυτές που μετρήθηκαν (το μάθημα του `DEDICATED_SPECS`, ADR-749).
 */

/** Το `<script type="application/json">` απ' όπου διαβάζει η πύλη. */
export const RESULTS_ELEMENT_ID = 'address-field-width-results';

/** Σημάδι ότι η μέτρηση **έτρεξε** — χωρίς αυτό, «καθόλου γραμμές» μοιάζει με «όλα καλά». */
export const MEASURED_ATTRIBUTE = 'data-address-field-width-measured';

export interface WidthCase {
  readonly id: string;
  readonly widthPx: number;
  /** Από πού βγαίνει αυτός ο αριθμός. Χωρίς λόγο, ένα πλάτος είναι εικασία. */
  readonly why: string;
}

/**
 * **Πλάτη της ΦΟΡΜΑΣ** (όχι του παραθύρου, όχι του grid του γονέα).
 *
 * ⚠️ Η διάκριση είναι όλο το νόημα του Ζ7: το `lg:` των γονέων κοιτά το **παράθυρο**,
 * ενώ το πρόβλημα ζει στο πλάτος **της στήλης**. Σε παράθυρο 2400 px η φόρμα μπορεί να
 * είναι 216 px — και ήταν.
 *
 * Κάθε τιμή είναι **μετρημένη ζωντανά 2026-09-13**, όχι στρογγυλεμένη στο περίπου.
 */
export const WIDTH_CASES: readonly WidthCase[] = [
  {
    id: 'dialog',
    widthPx: 416,
    why: 'Το περιεχόμενο του `DialogContent sm:max-w-md` (448 − padding) — το πλάτος του '
      + '`FrontageAddressCreateDialog`. 🔴 ΕΙΝΑΙ ΣΤΑΘΕΡΟ: δεν εξαρτάται από το παράθυρο, '
      + 'άρα ό,τι σπάει εδώ είναι σπασμένο σε ΚΑΘΕ οθόνη. Μετρημένο πριν το Ζ7: Τ.Κ. = 0.',
  },
  {
    id: 'narrow-column',
    widthPx: 346,
    why: 'Η στήλη όταν ο γονέας `lg:grid-cols-2` είναι 700 px. Εδώ μετρήθηκε η αιτία: '
      + 'fieldset 122,8 = input 26,5 + badge 90,3 + gap 6.',
  },
  {
    id: 'extreme',
    widthPx: 216,
    why: 'Η στήλη σε γονέα 440 px. Πριν το Ζ7: **και τα τρία** πεδία στο μηδέν. '
      + 'Το κάτω άκρο που πρέπει να παραμένει χρησιμοποιήσιμο, όχι απλώς να μη σκάει.',
  },
  {
    id: 'roomy',
    widthPx: 805,
    why: 'Η στήλη σε γονέα 1618 px — το άνετο. Υπάρχει ως **έλεγχος παλινδρόμησης**: '
      + 'η θεραπεία δεν επιτρέπεται να στενέψει ό,τι ήταν ήδη καλά.',
  },
] as const;

/** Ό,τι γράφει το όργανο και διαβάζει η πύλη. Αλλαγή εδώ σπάει την πύλη — επίτηδες. */
export interface FieldWidthResult {
  readonly caseId: string;
  readonly caseWidthPx: number;
  /** `data-address-field` του πεδίου. */
  readonly field: string;
  /** `clientWidth − padding` — ο χώρος όπου φαίνεται πράγματι κείμενο. */
  readonly usablePx: number;
  /** Πλάτος ενός «0» στη γραμματοσειρά **αυτού** του πεδίου — ο ορισμός του `ch`. */
  readonly charPx: number;
  /** `usablePx / charPx` — **η μονάδα της ερώτησης είναι ο χαρακτήρας**, όχι το pixel. */
  readonly usableChars: number;
  /** Το κείμενο του σήματος κατάστασης δίπλα/κάτω — ποιο badge πλήρωνε τον χώρο. */
  readonly badgeText: string;
  /** Πλάτος του σήματος. Ο ανταγωνιστής του πεδίου, σε αριθμό. */
  readonly badgePx: number;
  /** Ξεχείλισε οριζόντια η γραμμή; Λύση που κρύβει αντί να τυλίγει ΔΕΝ είναι λύση. */
  readonly overflows: boolean;
}
