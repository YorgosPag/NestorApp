/**
 * **Ανάθεση ανά γραμμή (cherry pick)** — παράγεται από τον πίνακα leveling (ADR-327 §8.5 · §17 Q12).
 *
 * Μέχρι 2026-10-28 ταίριαζε γραμμές με `categoryCode`/περιγραφή και σύγκρινε **τιμές μονάδας χωρίς μονάδα**
 * (m με m²) και χωρίς ποσότητα. Τώρα: νικητής γραμμής = η φθηνότερη **συγκρίσιμη** αξία της γραμμής RFQ
 * (`LevelingRow.lowestQuoteId`)· «ολόκληρο πακέτο» = το φθηνότερο **εξισορροπημένο** σύνολο (με τα κενά καλυμμένα).
 *
 * @module subapps/procurement/utils/cherry-pick
 */

import type { BidLevelingResult, LevelingCell, LevelingRow } from '../types/bid-leveling';
import type { CherryPickResult, LineWinner } from '../types/comparison';
import { roundMajor } from '@/lib/money/money';

function comparableCells(row: LevelingRow): LevelingCell[] {
  return row.cells.filter((c) => c.state === 'priced' && !c.unitMismatch && c.leveledAmount !== null);
}

function winnerOf(row: LevelingRow, vendorNames: ReadonlyMap<string, string | null>): LineWinner | null {
  const cells = comparableCells(row);
  const win = cells.find((c) => c.quoteId === row.lowestQuoteId);
  if (!win) return null;
  const winAmount = win.leveledAmount ?? 0;
  const worstAmount = Math.max(...cells.map((c) => c.leveledAmount ?? 0));
  return {
    rfqLineId: row.rfqLineId,
    lineDescription: row.description,
    categoryCode: row.categoryCode,
    winnerQuoteId: win.quoteId,
    winnerVendorName: vendorNames.get(win.quoteId) ?? null,
    winnerUnitPrice: win.unitPrice ?? 0,
    winnerAmount: winAmount,
    savings: roundMajor(worstAmount - winAmount),
    savingsPercent: worstAmount > 0 ? roundMajor(((worstAmount - winAmount) / worstAmount) * 100) : 0,
  };
}

/** `vendorNames`: quoteId → όνομα (από τα entries της σύγκρισης — ΕΝΑΣ resolver ονομάτων). */
export function cherryPickFromLeveling(
  leveling: BidLevelingResult,
  vendorNames: ReadonlyMap<string, string | null>,
): CherryPickResult {
  const lineWinners = leveling.rows
    .map((row) => winnerOf(row, vendorNames))
    .filter((w): w is LineWinner => w !== null);
  const totalCherry = roundMajor(lineWinners.reduce((s, w) => s + w.winnerAmount, 0));
  const totalWhole = leveling.columns.length > 0 ? Math.min(...leveling.columns.map((c) => c.leveledNet)) : 0;
  const savingsFromSplit = Math.max(0, roundMajor(totalWhole - totalCherry));
  return {
    lineWinners,
    uncoveredLines: leveling.rows.length - lineWinners.length,
    totalIfCherryPick: totalCherry,
    totalIfWholePackage: roundMajor(totalWhole),
    savingsFromSplit,
    savingsPercent: totalWhole > 0 ? roundMajor((savingsFromSplit / totalWhole) * 100) : 0,
  };
}
