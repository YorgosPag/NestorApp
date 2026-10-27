/**
 * =============================================================================
 * ΠΑΓΩΜΑ ΟΡΩΝ PO ΣΤΗΝ ΕΠΕΞΕΡΓΑΣΙΑ — σύμβαση-πηγή ανά γραμμή (ADR-923 §5.11 «3γ», Α9)
 * =============================================================================
 *
 * Μια PO που αποθηκεύτηκε κρατά τους όρους με τους οποίους συμφωνήθηκε. Η επεξεργασία της ΔΕΝ
 * ξαναδιαλέγει συμβάσεις για ό,τι δεν άλλαξε (Oracle: η γραμμή κρατά αναφορά στη σύμβαση-πηγή ·
 * SAP pricing type D/G · commercetools Frozen Cart). Νέα τιμολόγηση όλων = ΜΟΝΟ ρητά (`redetermine`).
 *
 * Εδώ ζει η αντιστοίχιση «γραμμή φόρμας ↔ αποθηκευμένη γραμμή» και η σύγκριση «παγωμένοι vs
 * σημερινοί όροι». Τα μαθηματικά μένουν στη ΜΙΑ μηχανή (`price-purchase-order-pure`).
 *
 * @module lib/procurement/po-pricing-carry
 */

import { majorFromMinor, minorFromMajor } from '@/lib/money/money';
import type { POLineFaDiscount } from '@/types/procurement/purchase-order';
import type { POPricing, POPricingLine } from './price-purchase-order-pure';

/** `carry` = κράτα τους όρους (προεπιλογή) · `redetermine` = ρητή νέα τιμολόγηση (SAP B · Recalculate). */
export const PO_PRICING_MODES = ['carry', 'redetermine'] as const;
export type POPricingMode = (typeof PO_PRICING_MODES)[number];

/**
 * `frozen` = αυτούσιοι οι αποθηκευμένοι όροι · `adjusted` = ίδια σύμβαση-πηγή, νέο ποσό (άλλαξε η
 * βάση της γραμμής ή της ομάδας) · `sourced` = σημερινή επιλογή σύμβασης (νέα γραμμή ή ρητή τιμολόγηση).
 */
export type POLineOrigin = 'frozen' | 'adjusted' | 'sourced';

export interface POStoredLine extends POPricingLine {
  readonly faDiscount?: POLineFaDiscount | null;
}

/** Ό,τι γράφτηκε στη βάση: η κεφαλίδα που αποφασίζει την επιλεξιμότητα + οι γραμμές με τους όρους τους. */
export interface POStoredPricing {
  readonly supplierId: string;
  readonly projectId: string;
  readonly items: readonly POStoredLine[];
}

export interface POCarryInput {
  readonly stored: POStoredPricing;
  readonly mode: POPricingMode;
}

/** Η σχέση μιας γραμμής με την αποθηκευμένη της. `storedIndex: null` ⇒ καμία (νέα/αλλαγμένη ταυτότητα). */
export interface POLineCarry {
  readonly storedIndex: number | null;
  /** Ίδια ταυτότητα **και** ίδια βάση (ποσότητα, τιμή). */
  readonly exact: boolean;
  /** Οι αποθηκευμένοι όροι (`null` = η γραμμή δεν είχε σύμβαση-πηγή). */
  readonly stored: POLineFaDiscount | null;
}

const UNMATCHED: POLineCarry = { storedIndex: null, exact: false, stored: null };

function identityKey(line: POPricingLine): string {
  return JSON.stringify([line.materialId ?? null, line.categoryCode]);
}

function fingerprintKey(line: POPricingLine): string {
  return JSON.stringify([line.materialId ?? null, line.categoryCode, line.quantity, line.unitPrice]);
}

interface CarryHeader {
  readonly supplierId: string | null | undefined;
  readonly projectId: string | null | undefined;
  readonly items: readonly POPricingLine[];
}

/** Μία αντιστοίχιση ανά αποθηκευμένη γραμμή (πολυσύνολο): πρώτα πλήρες αποτύπωμα, μετά ταυτότητα. */
function matchPass(
  items: readonly POPricingLine[],
  stored: POStoredPricing,
  plan: POLineCarry[],
  free: Set<number>,
  exact: boolean,
): void {
  const keyOf = exact ? fingerprintKey : identityKey;
  items.forEach((item, index) => {
    if (plan[index].storedIndex !== null) return;
    const key = keyOf(item);
    const match = [...free].find((storedIndex) => keyOf(stored.items[storedIndex]) === key);
    if (match === undefined) return;
    free.delete(match);
    plan[index] = { storedIndex: match, exact, stored: stored.items[match].faDiscount ?? null };
  });
}

/**
 * Πώς σχετίζεται κάθε γραμμή με την αποθηκευμένη PO. Χωρίς αποθηκευμένη, με ρητή τιμολόγηση ή με
 * άλλο προμηθευτή/έργο (αλλάζει η επιλεξιμότητα) ⇒ καμία γραμμή δεν κρατά όρους.
 */
export function planLineCarry(input: CarryHeader, carry: POCarryInput | null | undefined): POLineCarry[] {
  const plan = input.items.map(() => UNMATCHED);
  if (!carry || carry.mode === 'redetermine') return plan;
  const { stored } = carry;
  if (stored.supplierId !== input.supplierId || stored.projectId !== input.projectId) return plan;
  const free = new Set(stored.items.map((_, index) => index));
  matchPass(input.items, stored, plan, free, true);
  matchPass(input.items, stored, plan, free, false);
  return plan;
}

export interface POPricingDrift {
  /** Γραμμές όπου οι σημερινοί όροι διαφέρουν από αυτούς που κρατά η PO. */
  readonly lineIndexes: readonly number[];
  /** Σημερινό πληρωτέο − πληρωτέο της PO (€). */
  readonly totalDelta: number;
}

function sameTerms(a: POLineFaDiscount | null, b: POLineFaDiscount | null): boolean {
  if (a === null || b === null) return a === b;
  return a.agreementId === b.agreementId && a.discountAmount === b.discountAmount;
}

/** «Τι θα άλλαζε μια Επανατιμολόγηση;» — η σύγκριση πίσω από την ένδειξη μετατόπισης και την προεπισκόπηση. */
export function pricingDrift(kept: POPricing, current: POPricing): POPricingDrift {
  const lineIndexes = kept.lines.flatMap((line, index) =>
    sameTerms(line.faDiscount, current.lines[index]?.faDiscount ?? null) ? [] : [index],
  );
  const deltaMinor = (minorFromMajor(current.totals.total) ?? 0) - (minorFromMajor(kept.totals.total) ?? 0);
  return { lineIndexes, totalDelta: majorFromMinor(deltaMinor) };
}

/**
 * Ο server βγάζει άλλο πληρωτέο από αυτό που έδειξε η φόρμα (άλλαξε σύμβαση ενδιάμεσα). Καμία
 * εγγραφή: ο άνθρωπος βλέπει τη νέα τιμολόγηση και ξαναποφασίζει (compare-and-set στο σύνολο).
 */
export class POPricingConflictError extends Error {
  readonly expectedTotal: number;
  readonly total: number;

  constructor(expectedTotal: number, total: number) {
    super(`Pricing changed: expected total ${expectedTotal}, server computed ${total}`);
    this.name = 'POPricingConflictError';
    this.expectedTotal = expectedTotal;
    this.total = total;
  }
}
