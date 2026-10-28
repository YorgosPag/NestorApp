/**
 * **Bid leveling** (ADR-327 §8.5) — ο πίνακας «γραμμή RFQ × προσφορά», καθαρός (χωρίς I/O).
 *
 * Τι κάνει που η σύγκριση συνόλων δεν μπορεί:
 * 1. **Ενώνει με `rfqLineId`**, όχι με περιγραφή (ρητό δέσιμο από την πύλη· συμπέρασμα — σημαδεμένο — για σάρωση,
 *    χειροκίνητη και παλιές προσφορές, `inferRfqLineId`).
 * 2. **Ίδια βάση για όλους**: αξία = τιμή μονάδας × ποσότητα **του RFQ**· απόκλιση ποσότητας και διαφορετική μονάδα
 *    (`resolveUom`: m ≠ m²) σημαδεύονται αντί να «συγκρίνονται».
 * 3. **Τα κενά δεν κερδίζουν**: «εξαιρείται»/αναπάντητο καλύπτεται με ποσό **ορατής πηγής** — εκτίμηση PM, αλλιώς
 *    η υψηλότερη συγκρίσιμη τιμή άλλου (συντηρητικό). Ο Procore/BuildingConnected το αφήνουν σε χειροκίνητο plug·
 *    εδώ το εξισορροπημένο σύνολο είναι δίκαιο **από την πρώτη ματιά** — και ο PM ΕΠΙΠΛΕΟΝ ορίζει δικό του ποσό
 *    (`manual`, με σημείωση), που υπερισχύει αλλά κρατά δίπλα την αυτόματη για σύγκριση.
 * 4. Εναλλακτικές μένουν **δίπλα** στη γραμμή που αντικαθιστούν — ποτέ μέσα στο σύνολο.
 *
 * @module subapps/procurement/utils/bid-leveling
 * @enterprise ADR-327 §8.5
 */

import { normalizeUomText, resolveUom } from '@/lib/uom/uom-registry';
import type { Quote, QuoteLine, RfqScopeResponse } from '../types/quote';
import type { InternalRfqLine } from '../types/rfq-line';
import type {
  BidLevelingResult,
  LevelingAlternate,
  LevelingBinding,
  LevelingCell,
  LevelingColumn,
  LevelingPlug,
  LevelingRow,
  LevelingRowCoverage,
} from '../types/bid-leveling';
import { inferRfqLineId } from './rfq-line-binding';
import { roundMajor } from '@/lib/money/money';

type LevelingQuote = Pick<Quote, 'id' | 'lines' | 'alternates' | 'scopeResponses' | 'totals' | 'quotedTotal' | 'levelingPlugs'>;

interface QuoteAnswerIndex {
  quote: LevelingQuote;
  base: Map<string, { line: QuoteLine; binding: LevelingBinding }>;
  scope: Map<string, RfqScopeResponse>;
  alternates: Map<string, QuoteLine[]>;
  additional: QuoteLine[];
  inferred: number;
  lumpSum: boolean;
  /** Οι καλύψεις κενού που όρισε ο PM για ΑΥΤΗ την προσφορά, ανά γραμμή RFQ. */
  manualPlugs: Map<string, LevelingPlug>;
}

/** Προσφορά του §8.5: δηλώνει ρητά τις απαντήσεις της (η πύλη γράφει ΠΑΝΤΑ `scopeResponses`, έστω `[]`). */
function isExplicitlyBound(quote: LevelingQuote): boolean {
  return Array.isArray(quote.scopeResponses) || quote.lines.some((l) => typeof l.rfqLineId === 'string');
}

/** Συνολικό ποσό χωρίς τιμές γραμμών (σάρωση) — ο Procore μοντελοποιεί το lump sum ως «όλα περιλαμβάνονται». */
function isLumpSum(quote: LevelingQuote): boolean {
  const linesNet = quote.lines.reduce((s, l) => s + l.lineTotal, 0);
  return linesNet === 0 && quote.quotedTotal != null && quote.quotedTotal > 0;
}

function groupAlternates(quote: LevelingQuote): Map<string, QuoteLine[]> {
  const out = new Map<string, QuoteLine[]>();
  for (const alt of quote.alternates ?? []) {
    if (!alt.rfqLineId) continue;
    out.set(alt.rfqLineId, [...(out.get(alt.rfqLineId) ?? []), alt]);
  }
  return out;
}

function indexManualPlugs(quote: LevelingQuote, known: ReadonlySet<string>): Map<string, LevelingPlug> {
  const out = new Map<string, LevelingPlug>();
  for (const plug of quote.levelingPlugs ?? []) {
    if (!known.has(plug.rfqLineId) || !Number.isFinite(plug.amount) || plug.amount < 0) continue;
    out.set(plug.rfqLineId, { amount: roundMajor(plug.amount), source: 'manual', note: plug.note });
  }
  return out;
}

function indexQuote(quote: LevelingQuote, rfqLines: readonly InternalRfqLine[]): QuoteAnswerIndex {
  const known = new Set(rfqLines.map((l) => l.id));
  const explicit = isExplicitlyBound(quote);
  const base = new Map<string, { line: QuoteLine; binding: LevelingBinding }>();
  const additional: QuoteLine[] = [];
  let inferred = 0;
  for (const line of quote.lines) {
    const id = explicit ? line.rfqLineId ?? null : inferRfqLineId(line, rfqLines);
    if (id && known.has(id) && !base.has(id)) {
      base.set(id, { line, binding: explicit ? 'explicit' : 'inferred' });
      if (!explicit) inferred++;
    } else {
      additional.push(line);
    }
  }
  const scope = new Map((quote.scopeResponses ?? []).map((r) => [r.rfqLineId, r] as const));
  return {
    quote, base, scope, alternates: groupAlternates(quote), additional, inferred, lumpSum: isLumpSum(quote),
    manualPlugs: indexManualPlugs(quote, known),
  };
}

// ============================================================================
// CELLS
// ============================================================================

function unitKey(unit: string | null): string | null {
  if (!unit) return null;
  return resolveUom(unit) ?? normalizeUomText(unit);
}

function toAlternate(line: QuoteLine): LevelingAlternate {
  return {
    lineId: line.id, description: line.description, quantity: line.quantity, unit: line.unit,
    unitPrice: line.unitPrice, lineTotal: line.lineTotal, notes: line.notes,
  };
}

function emptyCell(quoteId: string, rfqLineId: string, alternates: QuoteLine[]): LevelingCell {
  return {
    quoteId, rfqLineId, state: 'unanswered', binding: null, quantity: null, unit: null, unitPrice: null,
    lineTotal: null, leveledAmount: null, unitMismatch: false, quantityDeviation: null, note: null, plug: null,
    alternates: alternates.map(toAlternate),
  };
}

function pricedCell(cell: LevelingCell, line: QuoteLine, binding: LevelingBinding, rfqLine: InternalRfqLine): LevelingCell {
  const rfqUnit = unitKey(rfqLine.unit);
  const unitMismatch = rfqUnit !== null && unitKey(line.unit) !== rfqUnit;
  const sameBasis = !unitMismatch && rfqLine.quantity != null;
  return {
    ...cell, state: 'priced', binding, quantity: line.quantity, unit: line.unit, unitPrice: line.unitPrice,
    lineTotal: line.lineTotal, note: line.notes, unitMismatch,
    leveledAmount: roundMajor(sameBasis ? line.unitPrice * (rfqLine.quantity ?? 0) : line.lineTotal),
    quantityDeviation: sameBasis ? line.quantity - (rfqLine.quantity ?? 0) : null,
  };
}

function answerCell(index: QuoteAnswerIndex, rfqLine: InternalRfqLine): LevelingCell {
  const cell = emptyCell(index.quote.id, rfqLine.id, index.alternates.get(rfqLine.id) ?? []);
  if (index.lumpSum) return { ...cell, state: 'included', leveledAmount: 0 };
  const priced = index.base.get(rfqLine.id);
  if (priced) return pricedCell(cell, priced.line, priced.binding, rfqLine);
  const scope = index.scope.get(rfqLine.id);
  if (!scope) return cell;
  return {
    ...cell, state: scope.response, binding: 'explicit', note: scope.note,
    leveledAmount: scope.response === 'included' ? 0 : null,
  };
}

// ============================================================================
// ROWS — plugs + coverage
// ============================================================================

function isComparablePrice(cell: LevelingCell): boolean {
  return cell.state === 'priced' && !cell.unitMismatch && cell.leveledAmount !== null;
}

function plugFor(rfqLine: InternalRfqLine, cells: readonly LevelingCell[]): LevelingPlug | null {
  if (rfqLine.estimateUnitPrice != null && rfqLine.quantity != null) {
    return { amount: roundMajor(rfqLine.estimateUnitPrice * rfqLine.quantity), source: 'estimate', note: null };
  }
  const prices = cells.filter(isComparablePrice).map((c) => c.leveledAmount ?? 0);
  return prices.length > 0 ? { amount: Math.max(...prices), source: 'highest_bid', note: null } : null;
}

/** Η κάλυψη ΕΝΟΣ κενού: του PM για αυτή την προσφορά (κρατά δίπλα την αυτόματη) → αλλιώς η αυτόματη της γραμμής. */
function gapPlug(index: QuoteAnswerIndex | undefined, rfqLineId: string, automatic: LevelingPlug | null): LevelingPlug | null {
  const manual = index?.manualPlugs.get(rfqLineId);
  return manual ? { ...manual, automatic } : automatic;
}

function rowCoverage(cells: readonly LevelingCell[]): LevelingRowCoverage {
  const covered = cells.filter((c) => c.state === 'priced' || c.state === 'included').length;
  if (covered === cells.length) return 'full';
  return covered === 0 ? 'none' : 'partial';
}

function lowestOf(cells: readonly LevelingCell[]): string | null {
  const comparable = cells.filter(isComparablePrice);
  if (comparable.length === 0) return null;
  return comparable.reduce((a, b) => ((b.leveledAmount ?? 0) < (a.leveledAmount ?? 0) ? b : a)).quoteId;
}

function buildRow(rfqLine: InternalRfqLine, indexes: readonly QuoteAnswerIndex[]): LevelingRow {
  const answered = indexes.map((index) => answerCell(index, rfqLine));
  const automatic = plugFor(rfqLine, answered);
  const byQuote = new Map(indexes.map((index) => [index.quote.id, index] as const));
  const cells = answered.map((c) => (c.state === 'excluded' || c.state === 'unanswered'
    ? { ...c, plug: gapPlug(byQuote.get(c.quoteId), rfqLine.id, automatic) }
    : c));
  return {
    rfqLineId: rfqLine.id, description: rfqLine.description, categoryCode: rfqLine.categoryCode,
    quantity: rfqLine.quantity, unit: rfqLine.unit, cells,
    lowestQuoteId: lowestOf(cells), coverage: rowCoverage(cells),
  };
}

// ============================================================================
// COLUMNS — leveled totals
// ============================================================================

function buildColumn(index: QuoteAnswerIndex, rows: readonly LevelingRow[]): LevelingColumn {
  const cells = rows.map((r) => r.cells.find((c) => c.quoteId === index.quote.id)).filter((c): c is LevelingCell => !!c);
  const pricedAmount = roundMajor(cells.reduce((s, c) => s + (c.state === 'priced' ? c.leveledAmount ?? 0 : 0), 0));
  const gaps = cells.filter((c) => c.state === 'excluded' || c.state === 'unanswered');
  const plugged = gaps.filter((c) => c.plug !== null);
  const plugAmount = roundMajor(plugged.reduce((s, c) => s + (c.plug?.amount ?? 0), 0));
  const additionalAmount = roundMajor(index.additional.reduce((s, l) => s + l.lineTotal, 0));
  const submittedNet = roundMajor(index.quote.totals.subtotal);
  return {
    quoteId: index.quote.id,
    submittedNet,
    pricedAmount,
    additionalItems: { count: index.additional.length, amount: additionalAmount },
    plugs: { count: plugged.length, amount: plugAmount },
    unpluggedGaps: gaps.length - plugged.length,
    inferredBindings: index.inferred,
    lumpSum: index.lumpSum,
    leveledNet: index.lumpSum ? submittedNet : roundMajor(pricedAmount + plugAmount + additionalAmount),
  };
}

/**
 * Ο πίνακας leveling ενός RFQ. Χωρίς γραμμές RFQ ⇒ κενός (η σύγκριση μένει στα σύνολα).
 * `rfqLines` = `readRfqLines(rfq)` (PM side, με την εκτίμηση) — **ποτέ** η δημόσια προβολή.
 */
export function buildBidLeveling(
  rfqLines: readonly InternalRfqLine[],
  quotes: readonly LevelingQuote[],
): BidLevelingResult {
  if (rfqLines.length === 0 || quotes.length === 0) return { rows: [], columns: [] };
  const indexes = quotes.map((q) => indexQuote(q, rfqLines));
  const rows = rfqLines.map((line) => buildRow(line, indexes));
  return { rows, columns: indexes.map((index) => buildColumn(index, rows)) };
}
