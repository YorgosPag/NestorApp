/**
 * =============================================================================
 * ΔΙΑΦΟΡΑ ΕΚΔΟΣΕΩΝ — «τι άλλαξε» και ο φράχτης δημοσίευσης (ADR-923 §5.11 · §18)
 * =============================================================================
 *
 * Γραμμές ταιριάζονται με το **υποκείμενο** (όχι με id ή θέση). Η μεταβολή τιμής μετριέται
 * στην τιμή **ανά μονάδα** — 84 € «ανά 100» → 0,90 € «ανά 1» είναι +7,14%, όχι −98,9%.
 *
 * 🔑 Φράχτης (§18): μεταβολή με απόλυτη τιμή **πάνω** από το όριο, ή τιμή από/προς **μηδέν**,
 * ⇒ η γραμμή «κρατείται για επιβεβαίωση». Το ERP που χάνει ένα μηδενικό δεν δημοσιεύει σιωπηλά.
 *
 * @module subapps/catalog/pricing/diff-price-versions
 */

import type { MinorAmount } from '@/lib/money/money';
import { BP_PER_WHOLE, type BasisPoints } from '@/lib/pricing/discount-rule';
import { divideHalfUp } from '@/lib/pricing/exact-arithmetic';
import type { PriceListLineDefinition } from '../types/price-list';
import { PRICE_CHANGE_FENCE_BP } from '../vocabulary/pricing';
import { priceLineSubjectKey } from './price-line-subject';

export type PriceLineChangeKind = 'added' | 'removed' | 'changed';

export interface PriceLineChange {
  readonly kind: PriceLineChangeKind;
  readonly subjectKey: string;
  readonly before: PriceListLineDefinition | null;
  readonly after: PriceListLineDefinition | null;
  /** Μεταβολή τιμής ανά μονάδα σε μονάδες βάσης· `null` αν δεν ορίζεται (νέα/διαγραμμένη/από μηδέν). */
  readonly unitPriceChangeBp: BasisPoints | null;
  readonly exceedsFence: boolean;
}

export interface PriceVersionDiff {
  readonly changes: readonly PriceLineChange[];
  readonly unchanged: number;
  readonly fenced: number;
}

/**
 * Μεταβολή ανά μονάδα: (νέα/qν − παλιά/qπ) / (παλιά/qπ), σε μονάδες βάσης — ακριβώς (BigInt),
 * στρογγυλεμένη μισό-μακριά-από-το-μηδέν ώστε +x και −x να είναι συμμετρικά.
 */
export function unitPriceChangeBp(
  before: { readonly netPrice: MinorAmount; readonly priceQuantity: number },
  after: { readonly netPrice: MinorAmount; readonly priceQuantity: number },
): BasisPoints | null {
  if (before.netPrice === 0) return after.netPrice === 0 ? 0 : null;
  const scaled =
    (BigInt(after.netPrice) * BigInt(before.priceQuantity) - BigInt(before.netPrice) * BigInt(after.priceQuantity)) *
    BigInt(BP_PER_WHOLE);
  const magnitude = divideHalfUp(scaled < 0n ? -scaled : scaled, BigInt(before.netPrice) * BigInt(after.priceQuantity));
  return Number(scaled < 0n ? -magnitude : magnitude);
}

function sameLineContent(a: PriceListLineDefinition, b: PriceListLineDefinition): boolean {
  return (
    a.netPrice === b.netPrice &&
    a.priceQuantity === b.priceQuantity &&
    a.unitCode === b.unitCode &&
    a.discountGroupId === b.discountGroupId &&
    JSON.stringify(a.breakdown) === JSON.stringify(b.breakdown)
  );
}

function changedLine(before: PriceListLineDefinition, after: PriceListLineDefinition, fenceBp: BasisPoints): PriceLineChange {
  const changeBp = unitPriceChangeBp(before, after);
  const exceedsFence = changeBp === null || Math.abs(changeBp) > fenceBp;
  return { kind: 'changed', subjectKey: priceLineSubjectKey(after.subject), before, after, unitPriceChangeBp: changeBp, exceedsFence };
}

function indexBySubject(lines: readonly PriceListLineDefinition[]): Map<string, PriceListLineDefinition> {
  return new Map(lines.map((line) => [priceLineSubjectKey(line.subject), line]));
}

/** Η διαφορά `before → after`, σε σταθερή σειρά κλειδιού υποκειμένου. */
export function diffPriceVersions(
  before: readonly PriceListLineDefinition[],
  after: readonly PriceListLineDefinition[],
  fenceBp: BasisPoints = PRICE_CHANGE_FENCE_BP,
): PriceVersionDiff {
  const previous = indexBySubject(before);
  const next = indexBySubject(after);
  const keys = [...new Set([...previous.keys(), ...next.keys()])].sort();
  const changes: PriceLineChange[] = [];
  let unchanged = 0;
  for (const subjectKey of keys) {
    const was = previous.get(subjectKey) ?? null;
    const is = next.get(subjectKey) ?? null;
    if (was === null && is !== null) {
      changes.push({ kind: 'added', subjectKey, before: null, after: is, unitPriceChangeBp: null, exceedsFence: false });
    } else if (was !== null && is === null) {
      changes.push({ kind: 'removed', subjectKey, before: was, after: null, unitPriceChangeBp: null, exceedsFence: false });
    } else if (was !== null && is !== null) {
      if (sameLineContent(was, is)) unchanged++;
      else changes.push(changedLine(was, is, fenceBp));
    }
  }
  return { changes, unchanged, fenced: changes.filter((change) => change.exceedsFence).length };
}
