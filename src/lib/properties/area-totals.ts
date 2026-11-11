/**
 * @fileoverview **ΑΘΡΟΙΣΜΑΤΑ ΕΜΒΑΔΟΥ ΑΝΑ ΕΙΔΟΣ** — ποτέ ένας αριθμός από μικτά και καθαρά (ADR-777 §8.101).
 * @module lib/properties/area-totals
 * @related lib/properties/property-display-area.ts (`measuredAreasOf` — ο ΕΝΑΣ αναγνώστης) ·
 *   lib/properties/price-totals.ts (το ίδιο σχήμα για τιμές) · lib/properties/display-area-label.ts (`areaTotalsView`)
 *
 * 🔴 **ΤΟ ΕΥΡΗΜΑ** (2026-11-11): το «Συν. Εμβαδόν» της καρτέλας Μονάδων κτιρίου άθροιζε το εμβαδόν **οθόνης** κάθε
 * μονάδας — μικτό όπου υπήρχε, αλλιώς **καθαρό**. Δύο κτίρια με τα ίδια ακίνητα έδιναν άλλο σύνολο ανάλογα με το
 * ποιος είχε συμπληρώσει ποιο πεδίο, και ο αριθμός δεν έλεγε ποτέ τι ήταν.
 *
 * 🏆 **ArchiCAD** (Zone schedule): στήλη *Gross* και στήλη *Net*, η καθεμιά με το **δικό της** σύνολο. **Revit**: κάθε
 * πίνακας εμβαδών ανήκει σε **ένα** *Area Scheme* — δεν αθροίζει σχήματα. Εδώ: **ένα υποσύνολο ανά είδος**, το καθένα
 * με το **πλήθος** των μονάδων που το έδωσαν (η κάλυψη του `PricePerArea.measuredCount`), και η απουσία ονομασμένη.
 *
 * 🔑 **Οι κλάσεις ΔΕΝ είναι διαμέριση** — μια μονάδα με μικτό **και** καθαρό μετρά και στις δύο (δύο στήλες, όχι
 *    αλυσίδα). Διαμέριση είναι μόνο το ζεύγος `gross` + `unspecified` (= η βάση σύγκρισης, `resolveGrossBasisArea`):
 *    το παλιό `area` μετρά **μόνο** όπου δεν υπάρχει μικτό — αλλού είναι ο καθρέφτης του και θα διπλομετρούσε.
 * 🔑 `unspecified` μένει **χωριστή** κλάση: η βάση του δεν δηλώθηκε, άρα δεν τη βαφτίζουμε «μικτά» για να βγει ένα
 *    στρογγυλό σύνολο (ίδιος κανόνας με την ετικέτα της οθόνης, ADR-777 §8.100).
 */

import { measuredAreasOf, type DisplayAreaKind, type DisplayAreaSource } from '@/lib/properties/property-display-area';

/** Η σειρά των κλάσεων στην οθόνη: η βάση της αγοράς πρώτη, το καθαρό ονομασμένο, η άγνωστη βάση τελευταία. */
export const AREA_TOTAL_KINDS: readonly DisplayAreaKind[] = ['gross', 'net', 'unspecified'];

/** Το υποσύνολο **ενός** είδους: άθροισμα μόνο όσων το έχουν μετρημένο, και πόσες είναι. */
export interface AreaTotal {
  readonly total: number;
  readonly measuredCount: number;
}

/**
 * **Το εμβαδόν μιας συλλογής — ανά είδος, με την απουσία ονομασμένη.**
 * `Record<DisplayAreaKind, …>`: τέταρτο είδος **δεν μεταγλωττίζεται** μέχρι να δηλωθεί το υποσύνολό του.
 */
export interface AreaTotalsByKind {
  readonly byKind: Readonly<Record<DisplayAreaKind, AreaTotal>>;
  /** Όσες δεν έχουν **κανένα** μετρημένο εμβαδόν — ποτέ μέρος αθροίσματος, ποτέ «0 m²». */
  readonly unmeasuredCount: number;
}

interface Accumulator {
  total: number;
  measuredCount: number;
}

function add(acc: Accumulator, value: number | null): boolean {
  if (value === null) return false;
  acc.total += value;
  acc.measuredCount += 1;
  return true;
}

/** Ένα πέρασμα· ο αναγνώστης (`measuredAreasOf`) μία φορά ανά μονάδα. */
export function totalAreaByKind(items: readonly DisplayAreaSource[]): AreaTotalsByKind {
  const acc: Record<DisplayAreaKind, Accumulator> = {
    gross: { total: 0, measuredCount: 0 },
    net: { total: 0, measuredCount: 0 },
    unspecified: { total: 0, measuredCount: 0 },
  };
  let unmeasuredCount = 0;

  for (const item of items) {
    const { gross, net, legacy } = measuredAreasOf(item);
    const hasGross = add(acc.gross, gross);
    const hasNet = add(acc.net, net);
    const hasLegacy = !hasGross && add(acc.unspecified, legacy);
    if (!hasGross && !hasNet && !hasLegacy) unmeasuredCount += 1;
  }

  return {
    byKind: { gross: { ...acc.gross }, net: { ...acc.net }, unspecified: { ...acc.unspecified } },
    unmeasuredCount,
  };
}
