/**
 * Τα πεδία **ταυτότητας εμπορίου** στην πρόταση εισαγωγής (ADR-934 §5.1.7 · Σ1γ): GTIN · MPN · «χωρίς GTIN» στο SKU, μάρκα στο
 * βάθος 0. Καθαρό. Ίδια σύγκριση τριών σημείων (`proposalFieldOf`) με τις ιδιότητες· η **κρίση** (ψηφίο GS1, όρια, «GTIN και
 * χωρίς GTIN») γίνεται **μόνο** από τον κριτή του γραφέα (`validate-trade-identity`, μέσα στο `judgeProposal`), ποτέ εδώ.
 *
 * 🔑 **Ισότητα κατά κλειδί** (`tradeFieldKeyOf`): `4006381333931` ≡ `04006381333931`, «DAIKIN» ≡ «Daikin». Η επανεισαγωγή του
 *    ίδιου αρχείου δεν βγάζει ποτέ «αλλαγή» από μορφή.
 * 🔑 «Χωρίς GTIN» πάνω σε ζωντανό GTIN: η **ίδια** σημασιολογία με τον λόγο απουσίας ιδιότητας (`reasonFieldOf`) — το
 *    `notApplicable` θα έσβηνε τον κωδικό ⇒ απόφαση ανθρώπου· το `unknown` δεν ακυρώνει τη γνώση του καταλόγου.
 * @module subapps/catalog/import/trade-identity-fields
 */

import { tradeFieldKeyOf } from '../derived/trade-keys';
import type { ImportFieldValue, ImportIssue, ImportProposalField, ImportTradeField } from '../types/catalog-import';
import type { CatalogTradeIdentity } from '../types/product';
import { gtinInputOf } from '../values/trade-identity';
import { flagRepeated, type TradeIdentityCell } from './cell-identity';
import { defaultDecisionOf, proposalFieldOf, type ImportValueEquality } from './field-diff';
import { importTargetKey, parseNoValueReasonText, plainValueEquality } from './proposal-values';

/** Η ζωντανή ταυτότητα ενός φορέα (μοντέλο: μόνο μάρκα, τα άλλα `null`). Διαβάζεται **μόνο** με `brandOf` / `tradeIdentityOf`. */
export interface LiveTradeIdentity extends CatalogTradeIdentity {
  readonly brand: string | null;
}

export const EMPTY_LIVE_TRADE_IDENTITY: LiveTradeIdentity = { brand: null, gtin: null, mpn: null, noGtinReason: null };

/** Ό,τι χρειάζεται η διαφορά από τον ζωντανό φορέα και την προηγούμενη εισαγωγή. */
export interface TradeFieldContext {
  readonly holder: { readonly id: string; readonly trade: LiveTradeIdentity } | null;
  /** Ό,τι είχε φέρει η τελευταία εφαρμοσμένη εισαγωγή σε αυτόν τον φορέα, ανά κλειδί στόχου. */
  readonly base: ReadonlyMap<string, ImportFieldValue> | undefined;
}

type TextField = Exclude<ImportTradeField, 'noGtinReason'>;

/** Το κείμενο του κελιού ⇒ η τιμή όπως θα γραφτεί: το GTIN με τον **ίδιο** κανόνα με την οθόνη (`gtinInputOf`). */
function textValueOf(field: TextField, text: string): ImportFieldValue | null {
  const written = field === 'gtin' ? gtinInputOf(text) : text.trim();
  return written === null || written === '' ? null : { type: 'tradeText', text: written };
}

/** Ίδιο κλειδί ⇒ ίδια τιμή. Κείμενο χωρίς κλειδί (άκυρο GTIN) συγκρίνεται αυτούσιο. */
const tradeTextEquality = (field: TextField): ImportValueEquality => (left, right) => {
  if (left.type !== 'tradeText' || right.type !== 'tradeText') return plainValueEquality(left, right);
  const a = tradeFieldKeyOf(field, left.text);
  const b = tradeFieldKeyOf(field, right.text);
  return a !== null && b !== null ? a === b : left.text === right.text;
};

/** Λένε δύο κείμενα πηγής το ίδιο πράγμα για το πεδίο; Η διαφωνία γραμμών για τη μάρκα κρίνεται έτσι, όχι με γράμματα. */
export function sameTradeText(field: ImportTradeField, left: string, right: string): boolean {
  if (field === 'noGtinReason') return left.trim() === right.trim();
  const a = textValueOf(field, left);
  const b = textValueOf(field, right);
  return a !== null && b !== null ? tradeTextEquality(field)(a, b) : left.trim() === right.trim();
}

function liveValueOf(field: ImportTradeField, trade: LiveTradeIdentity): ImportFieldValue | null {
  if (field === 'noGtinReason') return trade.noGtinReason === null ? null : { type: 'noValueReason', reason: trade.noGtinReason };
  const text = trade[field];
  return text === null ? null : { type: 'tradeText', text };
}

function incomingOf(cell: TradeIdentityCell): { readonly value: ImportFieldValue | null; readonly issues: readonly ImportIssue[] } {
  const { field } = cell.target;
  if (field !== 'noGtinReason') return { value: textValueOf(field, cell.text), issues: [] };
  const value = parseNoValueReasonText(cell.text);
  return { value, issues: value ? [] : [{ code: 'noValueReasonUnreadable', path: field }] };
}

/** «Χωρίς GTIN» πάνω σε ζωντανό GTIN — όπως το `reasonFieldOf` για τις ιδιότητες, με τους ίδιους κωδικούς. */
function guardLiveGtin(field: ImportProposalField, cell: TradeIdentityCell, trade: LiveTradeIdentity | null): ImportProposalField {
  const { incoming } = field;
  if (cell.target.field !== 'noGtinReason' || incoming?.type !== 'noValueReason' || (trade?.gtin ?? null) === null || field.live !== null) return field;
  const path = cell.target.field;
  if (incoming.reason === 'unknown') return { ...field, status: 'unchanged', decision: 'reject', issues: [...field.issues, { code: 'unknownKeepsValue', path }] };
  const flagged = { ...field, status: 'conflict' as const, issues: [...field.issues, { code: 'noValueReplacesValue' as const, path }] };
  return { ...flagged, decision: defaultDecisionOf(flagged) };
}

/** Το πεδίο πρότασης ενός κελιού ταυτότητας. */
export function tradeFieldOf(cell: TradeIdentityCell, context: TradeFieldContext): ImportProposalField {
  const { field } = cell.target;
  const trade = context.holder?.trade ?? null;
  const { value, issues } = incomingOf(cell);
  const live = trade ? liveValueOf(field, trade) : null;
  const base = context.base?.get(importTargetKey(cell.target)) ?? null;
  const same = field === 'noGtinReason' ? plainValueEquality : tradeTextEquality(field);
  return guardLiveGtin(proposalFieldOf({ cell, incoming: value, issues, live, base, same }), cell, trade);
}

/**
 * Ένα κελί ανά πεδίο ταυτότητας στη γραμμή (δύο στήλες «EAN»): ίδιο κλειδί ⇒ ένα· διαφορετικό ⇒ το πρώτο, με εύρημα και τις
 * άλλες τιμές στο μήνυμα. Κανένας κανόνας δεν διαλέγει σιωπηλά.
 */
export function settleTradeCells(cells: readonly TradeIdentityCell[]): TradeIdentityCell[] {
  const byField = new Map<ImportTradeField, TradeIdentityCell[]>();
  for (const cell of cells) byField.set(cell.target.field, [...(byField.get(cell.target.field) ?? []), cell]);
  return [...byField.values()].map(([first, ...rest]) => {
    const others = rest.filter((cell) => !sameTradeText(first.target.field, first.text, cell.text));
    if (others.length === 0) return first;
    return flagRepeated(first, first.target.field, others.map((cell) => ({ text: cell.text, anchor: cell.anchor })));
  });
}
