/**
 * =============================================================================
 * Η ΜΙΑ ΜΗΧΑΝΗ ΕΚΠΤΩΣΕΩΝ — κανόνας, αλυσίδα, κλίμακες (ADR-923 §5.11 · ADR-330 Phase 5.5)
 * =============================================================================
 *
 * Κοινή σε **κατάλογο προμηθευτή** (ομάδες έκπτωσης × κοινό) και **Συμβάσεις-Πλαίσιο**
 * (προσαρμογέας στο `framework-agreement-discount.ts`). Δεύτερη μηχανή εκπτώσεων = απαγορεύεται.
 *
 * 🔑 **Ποσά σε ακέραια λεπτά** (`MinorAmount`, SSoT `lib/money/money.ts`) και **ποσοστά σε μονάδες
 * βάσης** (52,25% = 5225). Καμία αριθμητική κινητής υποδιαστολής πάνω σε χρήμα.
 *
 * 🔑 **Αλυσίδα «50+10»** (ελληνική/γερμανική χονδρική πρακτική): τα βήματα **πολλαπλασιάζονται**,
 * δεν προστίθενται — 1.000 € «50+10» = 450 €, όχι 400 €. Το γινόμενο υπολογίζεται **ακριβώς**
 * (BigInt) και στρογγυλεύεται **μία** φορά: στρογγύλευση ανά βήμα χάνει λεπτά.
 *
 * 🔑 Στρογγυλεύεται το **ποσό της έκπτωσης** (μισό-προς-τα-πάνω), και καθαρό = μικτό − έκπτωση —
 * όπως η allowance του EN 16931 και όπως η ιστορική `computeFaDiscount`.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 * @module lib/pricing/discount-rule
 */

import type { MinorAmount } from '@/lib/money/money';
import { divideHalfUp, scaledInteger } from './exact-arithmetic';

/** Μονάδες βάσης: 1 = 0,01% · 10.000 = 100%. */
export type BasisPoints = number;

/** 100% σε μονάδες βάσης. */
export const BP_PER_WHOLE = 10_000;

/** Κλίμακα: από `min` (ποσότητα ή λεπτά, συμπεριληπτικά) και πάνω ισχύει η αλυσίδα `steps`. */
export interface DiscountTier {
  readonly min: number;
  readonly steps: readonly BasisPoints[];
}

/** Η βάση στην οποία μετρά μια κλίμακα: ποσότητα γραμμής ή ποσό της σε λεπτά. */
export const DISCOUNT_TIER_BASES = ['quantity', 'amount'] as const;

export type DiscountTierBasis = (typeof DISCOUNT_TIER_BASES)[number];

/** Κανόνας έκπτωσης: σταθερή αλυσίδα, ή κλίμακες πάνω σε ποσότητα / ποσό. */
export type DiscountRule =
  | { readonly kind: 'chain'; readonly steps: readonly BasisPoints[] }
  | {
      readonly kind: 'tiers';
      readonly basis: DiscountTierBasis;
      readonly tiers: readonly DiscountTier[];
    };

export type DiscountRuleKind = DiscountRule['kind'];

/** Τα είδη κανόνα — η ρίζα για ό,τι τα απαριθμεί (επιλογέας)· ο τύπος δήλωσης: είδος που δεν υπάρχει στον κανόνα δεν μεταγλωττίζεται. */
export const DISCOUNT_RULE_KINDS: readonly DiscountRuleKind[] = ['chain', 'tiers'];

/** Αποτέλεσμα εφαρμογής σε λεπτά: `discount + net === gross`, πάντα. */
export interface DiscountApplication {
  readonly discount: MinorAmount;
  readonly net: MinorAmount;
}

function isBasisPoints(value: unknown): value is BasisPoints {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= BP_PER_WHOLE;
}

/** `true` αν κάθε βήμα είναι ακέραιες μονάδες βάσης στο 0..100%. */
export function isDiscountSteps(steps: readonly unknown[]): steps is readonly BasisPoints[] {
  return steps.every(isBasisPoints);
}

/**
 * Ποσοστό (π.χ. από φόρμα, `52.25`) → μονάδες βάσης. `null` για ό,τι δεν είναι 0–100 ή έχει
 * **τρίτο** δεκαδικό — η μηχανή δεν στρογγυλεύει σιωπηλά τη βούληση του ανθρώπου.
 */
export function basisPointsFromPercent(percent: number): BasisPoints | null {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
  return scaledInteger(percent, 100);
}

function assertApplicable(gross: MinorAmount, steps: readonly BasisPoints[]): void {
  if (!Number.isSafeInteger(gross) || gross < 0) {
    throw new RangeError(`Discount base must be a non-negative integer minor amount, got ${gross}`);
  }
  if (!isDiscountSteps(steps)) {
    throw new RangeError(`Discount steps must be integer basis points in 0..${BP_PER_WHOLE}`);
  }
}

/**
 * Εφαρμόζει αλυσίδα βημάτων σε ποσό λεπτών. Έκπτωση = μικτό × (1 − Π(1 − rᵢ)), ακριβώς,
 * στρογγυλεμένη **μία** φορά μισό-προς-τα-πάνω. Ρίχνει `RangeError` σε άκυρη είσοδο — ποτέ `NaN`.
 */
export function applyDiscountSteps(
  gross: MinorAmount,
  steps: readonly BasisPoints[],
): DiscountApplication {
  assertApplicable(gross, steps);
  if (steps.length === 0 || gross === 0) return { discount: 0, net: gross };

  const { numerator: remaining, denominator } = remainingFraction(steps);
  const discountNumerator = BigInt(gross) * (denominator - remaining);
  const discount = Number(divideHalfUp(discountNumerator, denominator));
  return { discount, net: gross - discount };
}

/**
 * Η ενιαία ένδειξη μιας αλυσίδας σε ποσοστό (`[5000, 1000]` ⇒ 55). **Μόνο για προβολή** —
 * η αριθμητική περνά πάντα από {@link applyDiscountSteps}.
 */
export function effectivePercent(steps: readonly BasisPoints[]): number {
  const remaining = steps.reduce((product, step) => product * (1 - step / BP_PER_WHOLE), 1);
  return Math.round((1 - remaining) * 100 * 1e6) / 1e6;
}

/**
 * Τα βήματα που ισχύουν για τη δοσμένη βάση: η αλυσίδα αυτούσια, ή η **υψηλότερη** κλίμακα με
 * `min ≤ basis` (ανεξάρτητα από τη σειρά δήλωσης). Καμία κλίμακα ⇒ `[]`.
 */
export function stepsForBasis(rule: DiscountRule, basis: number): readonly BasisPoints[] {
  if (rule.kind === 'chain') return rule.steps;
  let best: DiscountTier | null = null;
  for (const tier of rule.tiers) {
    if (basis >= tier.min && (best === null || tier.min > best.min)) best = tier;
  }
  return best?.steps ?? [];
}

/** Το γινόμενο Π(1 − rᵢ) ως ακριβές κλάσμα. */
function remainingFraction(steps: readonly BasisPoints[]): { readonly numerator: bigint; readonly denominator: bigint } {
  const whole = BigInt(BP_PER_WHOLE);
  return steps.reduce(
    (fraction, step) => ({ numerator: fraction.numerator * (whole - BigInt(step)), denominator: fraction.denominator * whole }),
    { numerator: 1n, denominator: 1n },
  );
}

/**
 * Σύγκριση **ακριβώς** της συνολικής έκπτωσης δύο αλυσίδων: θετικό αν η `a` δίνει μεγαλύτερη
 * έκπτωση, αρνητικό αν μικρότερη, 0 αν ίση («50+10» ισοδυναμεί με «55»).
 */
export function compareDiscountSteps(a: readonly BasisPoints[], b: readonly BasisPoints[]): number {
  const left = remainingFraction(a);
  const right = remainingFraction(b);
  const difference = right.numerator * left.denominator - left.numerator * right.denominator;
  return difference === 0n ? 0 : difference > 0n ? 1 : -1;
}
