/**
 * @fileoverview **Ακέραιο μοντέλο ↔ ανθρώπινη τιμή φόρμας** — ο ΕΝΑΣ κανόνας για ποσά, ποσοστά και ποσότητες
 *   (ADR-928 Φ3γ-2 απόφαση 3 · ADR-706).
 * @module components/ui/numeric-field/scaled-value
 *
 * Το μοντέλο κρατά **ακέραιους**: λεπτά, μονάδες βάσης, χιλιοστά. Ο άνθρωπος γράφει €, %, τ.μ. Η μετατροπή γίνεται
 * **μόνο** με τους μετατροπείς του μοντέλου (`minorFromMajor` · `basisPointsFromPercent` · `milliFromQuantity`).
 *
 * 🔑 **Άκυρη είσοδος περνά ως έχει**, για να τη λέει ο κριτής, όχι για να «διορθωθεί» σιωπηλά. Όταν ο μετατροπέας
 *    αρνείται (π.χ. 5,255% έχει τρίτο δεκαδικό), το μοντέλο παίρνει την **ακριβή κλιμακωμένη** τιμή (`525.5`). Δεν είναι
 *    ακέραιος, άρα ο επικυρωτής (`isBasisPoints` · `isMinorAmount` · ακέραιες ποσότητες) τη λέει άκυρη. Η φόρμα
 *    ξαναδείχνει ακριβώς ό,τι γράφτηκε. Πριν υπήρχαν τρεις ιδιωτικές εφεδρείες (`?? Math.round(x * 100)`, που
 *    στρογγύλευε σιωπηλά, και δύο `?? NaN`, που δεν ξαναδείχνεται).
 */

import { majorFromMinor, minorFromMajor } from '@/lib/money/money';
import { basisPointsFromPercent, percentFromBasisPoints } from '@/lib/pricing/discount-rule';
import { milliFromQuantity, MILLI_PER_UNIT, quantityFromMilli } from '@/lib/uom/milli-quantity';
import { stripFloatNoise } from './numeric-field-core';

export interface ValueScale {
  /** Μοντέλο → φόρμα. */
  readonly toDisplay: (model: number) => number;
  /** Φόρμα → μοντέλο· `null` όταν ο μετατροπέας του μοντέλου αρνείται. */
  readonly exact: (display: number) => number | null;
  /** Μονάδες μοντέλου ανά μονάδα φόρμας — για την ακριβή κλιμακωμένη εφεδρεία. */
  readonly factor: number;
}

export const MONEY_SCALE: ValueScale = { toDisplay: majorFromMinor, exact: minorFromMajor, factor: 100 };
export const PERCENT_SCALE: ValueScale = { toDisplay: percentFromBasisPoints, exact: basisPointsFromPercent, factor: 100 };
export const MILLI_QUANTITY_SCALE: ValueScale = { toDisplay: quantityFromMilli, exact: milliFromQuantity, factor: MILLI_PER_UNIT };

/** Ακέραιο πλήθος (π.χ. ημέρες): ίδιο στην οθόνη και στο μοντέλο· μη ακέραιο ⇒ ο μετατροπέας αρνείται, ο κριτής το λέει. */
export const COUNT_SCALE: ValueScale = { toDisplay: (model) => model, exact: (display) => (Number.isSafeInteger(display) ? display : null), factor: 1 };

/** Μη αρνητική δεκαδική ποσότητα χωρίς κλίμακα (εμβαδά, πρόσωπα, συντελεστές): ίδια στην οθόνη και στο μοντέλο. */
export const DECIMAL_SCALE: ValueScale = { toDisplay: (model) => model, exact: (display) => (Number.isFinite(display) ? display : null), factor: 1 };

/** Η τιμή του μοντέλου για ό,τι έγραψε ο άνθρωπος: ο μετατροπέας, αλλιώς η ακριβής κλιμακωμένη (άκυρη) τιμή. */
export function modelOfDisplay(display: number, scale: ValueScale): number {
  return scale.exact(display) ?? stripFloatNoise(display * scale.factor);
}
