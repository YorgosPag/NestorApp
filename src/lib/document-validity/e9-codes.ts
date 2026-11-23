/**
 * =============================================================================
 * Κωδικοί του Πίνακα 1 του Ε9 (ΠΟΛ.1237/11.11.2014) — το ΕΝΑ λεξιλόγιο για Ε9 και πράξη ΕΝΦΙΑ (ADR-949 Α-2 · Α-3)
 * =============================================================================
 *
 * Η ενότητα Δ της πράξης ΕΝΦΙΑ είναι **ανατύπωση** του Πίνακα 1 του Ε9 (μετρημένο στα δείγματα: ίδιες κατηγορίες,
 * ίδιος όροφος «Υ/0/1», ίδια είδη δικαιώματος, ίδιο ποσοστό με πέντε δεκαδικά). Οι δύο αναγνώστες διαβάζουν τα κελιά
 * με τους **ίδιους** κανόνες — ένα σημείο αλλαγής αν η ΑΑΔΕ αλλάξει κωδικό.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις και σταθερές, μηδέν I/O.
 *
 * @module lib/document-validity/e9-codes
 */

import { parseStrictDecimal } from '@/lib/number/locale-number';

/** Όροφος Ε9 (στήλη 11): `Υ` = υπόγειο · `0` = ισόγειο ή ημιυπόγειο · `1` = 1ος ή ημιόροφος · … */
export type E9Floor = { readonly kind: 'basement' } | { readonly kind: 'level'; readonly number: number };

/** «Ειδικών συνθηκών» (στήλη 10) — κωδ. 99: ημιτελές κτίσμα. */
export const E9_UNFINISHED_CONDITION = 99;
/** «Ειδικών συνθηκών» — κωδ. 3: «Διατηρητέο κτίσμα, εφόσον έχει εκδοθεί η σχετική πράξη και έχει δημοσιευθεί σε Φ.Ε.Κ.». */
export const E9_LISTED_CONDITION = 3;
/** «Ειδικών συνθηκών» — κωδ. 1: «υπό αναγκαστική απαλλοτρίωση … ή πρωτόκολλο κατεδάφισης». */
export const E9_EXPROPRIATION_OR_DEMOLITION_CONDITION = 1;
/** «Είδος δικαιώματος» (στήλη 15) — κωδ. 1: πλήρης κυριότητα. */
export const E9_FULL_OWNERSHIP = 1;

/** Κωδικοί οικοπέδων (στήλη 9): δεν είναι κτίσματα — ο υπολογιστής κτισμάτων δεν τους αφορά. */
const PLOT_CATEGORIES: ReadonlySet<number> = new Set([4, 41, 42, 43, 44, 45, 46, 47]);
const BUILDING_CATEGORIES: ReadonlySet<number> = new Set([1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 51, 52]);

const INTEGER = /^\d{1,4}$/;

/** Κατηγορία κτίσματος (στήλη 9) — όχι οικόπεδο, όχι άγνωστος κωδικός. */
export function isE9BuildingCategory(category: number): boolean {
  return !PLOT_CATEGORIES.has(category) && BUILDING_CATEGORIES.has(category);
}

/** Ακέραιος κωδικός ή έτος (έως 4 ψηφία) — ό,τι άλλο ⇒ αδιάβαστο. */
export function parseE9Integer(cell: string | null): number | null {
  return cell !== null && INTEGER.test(cell) ? Number(cell) : null;
}

/**
 * `93,51` → 93.51 · `4.522,00` → 4522 — με την ΜΙΑ γραμματική αριθμού εγγράφου (`parseStrictDecimal`): ό,τι δεν είναι
 * εξ ολοκλήρου αριθμός (`100,` · `Ο.Τ.2`) ⇒ `null`. Επιφάνεια και τιμή δεν είναι ποτέ αρνητικές.
 */
export function parseGreekNumber(cell: string | null): number | null {
  const value = parseStrictDecimal(cell);
  return value === null || value < 0 ? null : value;
}

/** Στήλη 16: ποσοστό στο (0, 100] — ό,τι άλλο ⇒ αδιάβαστο. */
export function parseE9Percent(cell: string | null): number | null {
  const value = parseGreekNumber(cell);
  return value !== null && value > 0 && value <= 100 ? value : null;
}

/** Στήλη 11: `Υ` ⇒ υπόγειο · ακέραιος ⇒ όροφος · ό,τι άλλο ⇒ αδιάβαστο. */
export function parseE9Floor(cell: string | null): E9Floor | null {
  if (cell === 'Υ') return { kind: 'basement' };
  const number = parseE9Integer(cell);
  return number === null ? null : { kind: 'level', number };
}

/** Το ωμό κελί ενός γεγονότος — όπως το βρίσκει ο αναγνώστης του κάθε εγγράφου (`null` = κενό κελί). */
export type E9BuildingCellOf = (fact: keyof E9BuildingFacts) => string | null;

/** Τα γεγονότα μιας γραμμής κτίσματος του Πίνακα 1. `null` = το κελί είναι κενό ή δεν διαβάστηκε με βεβαιότητα. */
export interface E9BuildingFacts {
  readonly specialCondition: number | null;
  readonly floor: E9Floor | null;
  /** Στήλη 12 — τ.μ. κύριων χώρων. */
  readonly mainArea: number | null;
  /** Στήλη 13 — τ.μ. βοηθητικών χώρων που ανήκουν στο κτίσμα. */
  readonly auxArea: number | null;
  readonly constructionYear: number | null;
  /** Στήλη 15 — είδος εμπράγματου δικαιώματος: 1 πλήρης κυριότητα · 2 ψιλή · 3 επικαρπία · 4 επιφανείας · … 13. */
  readonly rightKind: number | null;
  /** Στήλη 16 — ποσοστό συνιδιοκτησίας %, γραμμένο με πέντε δεκαδικά (μπορεί να σπάει σε περισσότερες γραμμές). */
  readonly ownershipPct: number | null;
}

/** **Κελιά → γεγονότα**, με τους ίδιους κανόνες για το Ε9 και την ανατύπωσή του στην πράξη ΕΝΦΙΑ. */
export function e9BuildingFactsOf(cellOf: E9BuildingCellOf): E9BuildingFacts {
  return {
    specialCondition: parseE9Integer(cellOf('specialCondition')),
    floor: parseE9Floor(cellOf('floor')),
    mainArea: parseGreekNumber(cellOf('mainArea')),
    auxArea: parseGreekNumber(cellOf('auxArea')),
    constructionYear: parseE9Integer(cellOf('constructionYear')),
    rightKind: parseE9Integer(cellOf('rightKind')),
    ownershipPct: parseE9Percent(cellOf('ownershipPct')),
  };
}
