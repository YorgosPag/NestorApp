/**
 * @fileoverview **Η εκτιμώμενη αξία μιας γραμμής και ενός εγγράφου** (ADR-928 §5.4 · Φ3α-2) — καθαρή, σε λεπτά.
 * @module subapps/procurement/subcontracts/lines/line-amount
 *
 * 🔑 **Ακέραια αριθμητική**: τιμή σε λεπτά × ποσότητα σε χιλιοστά της μονάδας ⇒ στρογγύλευση **μία** φορά, στο λεπτό.
 * 🔑 **Ειλικρινές άθροισμα**: γραμμή τιμής μονάδας χωρίς εκτίμηση ποσότητας (συχνό στα συμφωνητικά επιμέτρησης του
 *    2005–2008) **δεν** έχει αξία· το σύνολο λέει ότι είναι **μερικό** (`unpricedLines`) αντί να τη μετρά ως μηδέν. Ο
 *    Procore δείχνει σε τέτοιο SOV μόνο «Unit/Qty»· εμείς λέμε και πόσες γραμμές λείπουν από τον αριθμό.
 * Το διαβάζει η λίστα ανά έργο (Φ3α-2) και το μοντέλο εγγράφου (Φ3β).
 */

import { sumMinor, type MinorAmount } from '@/lib/money/money';
import type { AgreementLine } from '../types/agreement-line';

/** Χιλιοστά ανά μονάδα — η ποσότητα αποθηκεύεται ακέραια (`estimatedMilliQuantity`). */
const MILLI_PER_UNIT = 1000;

/** Η αξία μιας γραμμής, ή `null` όταν δεν προκύπτει (τιμή μονάδας/ημέρας χωρίς εκτίμηση ποσότητας). */
export function estimatedLineAmount(line: AgreementLine): MinorAmount | null {
  if (line.pricing === 'lump_sum') return line.unitPrice;
  if (line.estimatedMilliQuantity === null) return null;
  return Math.round((line.unitPrice * line.estimatedMilliQuantity) / MILLI_PER_UNIT);
}

export interface EstimatedValue {
  /** Άθροισμα των γραμμών που **έχουν** αξία. */
  readonly amount: MinorAmount;
  /** Γραμμές χωρίς αξία — `> 0` ⇒ το `amount` είναι κατώτατο, όχι σύνολο. */
  readonly unpricedLines: number;
}

/** Η εκτιμώμενη αξία ενός εγγράφου (χωρίς ΦΠΑ). */
export function estimatedAgreementValue(lines: readonly AgreementLine[]): EstimatedValue {
  const amounts = lines.map(estimatedLineAmount);
  const priced = amounts.filter((amount): amount is MinorAmount => amount !== null);
  return { amount: sumMinor(priced), unpricedLines: amounts.length - priced.length };
}
