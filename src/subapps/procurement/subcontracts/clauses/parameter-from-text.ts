/**
 * @fileoverview **«Κάνε το παράμετρο»** — από επιλεγμένο κείμενο σε είδος + προτιμώμενη τιμή (ADR-928 §5.22) — καθαρό.
 * @module subapps/procurement/subcontracts/clauses/parameter-from-text
 *
 * 🔑 Ο άνθρωπος γράφει τη ρήτρα όπως θα τη διάβαζε («κράτηση 5% επί κάθε πιστοποίησης») και μετά μαρκάρει το «5%».
 *    Κανένα σύστημα CLM δεν το κάνει: στο Ironclad/DocuSign το πεδίο ορίζεται πρώτα, σε ξεχωριστή φόρμα.
 * 🔑 **Η μονάδα φεύγει από το κείμενο**: «30 ημέρες» ⇒ `days: 30`, και το chip τυπώνει «30 ημέρες» μόνο του
 *    (`renderParameterValue`). Έτσι δεν ξαναγεννιέται το «ημέρες ημέρες» της §5.20.
 * 🔑 Ο αριθμός διαβάζεται με τον **ίδιο** `evaluateNumericExpression` των αριθμητικών πεδίων, και κλιμακώνεται με τον
 *    **ίδιο** `modelOfDisplay` (ακέραιες μονάδες, ποτέ σιωπηλή στρογγύλευση: 5,255% μένει 525,5 και ο κριτής το λέει).
 *    Ό,τι δεν αναγνωρίζεται γίνεται `text` — ποτέ λάθος είδος.
 */

import { evaluateNumericExpression } from '@/components/ui/numeric-field/numeric-expression';
import { modelOfDisplay, MONEY_SCALE, PERCENT_SCALE } from '@/components/ui/numeric-field/scaled-value';
import type { ClauseParameterKind, ClauseParameterValue } from '../types/clause-parameter';

export interface ParameterGuess {
  readonly kind: ClauseParameterKind;
  readonly preferred: ClauseParameterValue;
}

const PERCENT = /^(.+?)\s*(?:%|τοις εκατό|percent)$/iu;
const MONEY_AFTER = /^(.+?)\s*(?:€|ευρώ|eur|euro)$/iu;
const MONEY_BEFORE = /^€\s*(.+)$/u;
const DAYS = /^(.+?)\s*(?:ημερολογιακές ημέρες|εργάσιμες ημέρες|ημέρες|ημέρα|ημερών|μέρες|days?)$/iu;

function numberIn(text: string): number | null {
  const value = evaluateNumericExpression(text.trim());
  return value !== null && value >= 0 ? value : null;
}

function percentOf(text: string): ParameterGuess | null {
  const match = PERCENT.exec(text);
  const amount = match ? numberIn(match[1]) : null;
  return amount === null ? null : { kind: 'percent', preferred: { kind: 'percent', value: modelOfDisplay(amount, PERCENT_SCALE) } };
}

function moneyOf(text: string): ParameterGuess | null {
  const match = MONEY_AFTER.exec(text) ?? MONEY_BEFORE.exec(text);
  const amount = match ? numberIn(match[1]) : null;
  return amount === null ? null : { kind: 'money', preferred: { kind: 'money', value: modelOfDisplay(amount, MONEY_SCALE) } };
}

function daysOf(text: string): ParameterGuess | null {
  const match = DAYS.exec(text);
  const amount = match ? numberIn(match[1]) : null;
  return amount === null || !Number.isSafeInteger(amount) ? null : { kind: 'days', preferred: { kind: 'days', value: amount } };
}

/** Το επιλεγμένο κείμενο ως είδος + τιμή· ό,τι δεν είναι ποσοστό/ποσό/ημέρες γίνεται σύντομο κείμενο. */
export function parameterFromText(selection: string): ParameterGuess {
  const text = selection.trim().replace(/\s+/gu, ' ');
  return percentOf(text) ?? moneyOf(text) ?? daysOf(text) ?? { kind: 'text', preferred: { kind: 'text', value: text } };
}
