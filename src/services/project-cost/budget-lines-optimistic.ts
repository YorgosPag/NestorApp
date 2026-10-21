/**
 * Budget lines on screen — the optimistic overlay of the Φ3γ editor (ADR-917 Φ3γ · Α29).
 *
 * Pure, client-safe. Two layers, never mixed:
 * - **confirmed** — what the server last said (GET, or the `line` of a write response). The ONLY source of
 *   `expectedRevision`: an editor never invents a revision.
 * - **overlay** — what the human just typed and the server has not answered yet.
 *
 * Shown = overlay over confirmed (Google Docs / Figma: the edit appears instantly). Rollback is DROPPING the
 * overlay entry — there is no «previous value» to remember and get wrong. A conflict keeps what the human
 * wanted (`mine`) next to what the server now holds, so the choice stays theirs.
 *
 * @module services/project-cost/budget-lines-optimistic
 * @see ADR-917 Φ3γ
 */

import { compareCostCodes } from '@/config/cost-taxonomy';

/** The editable part of a line (`null` amount is never sent: an archive is `next: null`). */
export interface BudgetLineValues {
  amount: number;
  note: string | null;
}

/** A confirmed line as the reader returns it (extra stored fields are ignored). */
export interface ConfirmedBudgetLine extends BudgetLineValues {
  costCode: string;
  revision: number;
}

/** `null` ⇒ the human archived it, the server has not confirmed yet */
export type OverlayEntry = BudgetLineValues | null;

export interface BudgetLineDisplay extends BudgetLineValues {
  costCode: string;
  /** The server has not confirmed what is shown */
  pending: boolean;
}

export interface BudgetLinesSnapshot {
  confirmed: ReadonlyMap<string, ConfirmedBudgetLine>;
  overlay: ReadonlyMap<string, OverlayEntry>;
  /** 409: what the human wanted, kept until they choose (the server's version is in `confirmed`) */
  conflicts: ReadonlyMap<string, OverlayEntry>;
}

/** A 409 as the screen shows it: theirs (now confirmed) next to mine (never silently dropped). */
export interface BudgetLineConflict {
  costCode: string;
  mine: OverlayEntry;
  theirs: ConfirmedBudgetLine | null;
}

export const EMPTY_BUDGET_LINES: BudgetLinesSnapshot = { confirmed: new Map(), overlay: new Map(), conflicts: new Map() };

export function fromConfirmed(lines: readonly ConfirmedBudgetLine[]): ReadonlyMap<string, ConfirmedBudgetLine> {
  return new Map(lines.map(line => [line.costCode, line]));
}

/** The revision this editor has SEEN for the code — `0` ⇔ «I believe there is no line» (Λ9). */
export function expectedRevisionOf(snapshot: BudgetLinesSnapshot, costCode: string): number {
  return snapshot.confirmed.get(costCode)?.revision ?? 0;
}

export function withOverlay(snapshot: BudgetLinesSnapshot, costCode: string, entry: OverlayEntry): BudgetLinesSnapshot {
  const overlay = new Map(snapshot.overlay);
  overlay.set(costCode, entry);
  return { ...snapshot, overlay };
}

/** The server answered (changed or unchanged): its line becomes the truth, the overlay goes. */
export function confirm(snapshot: BudgetLinesSnapshot, costCode: string, line: ConfirmedBudgetLine | null): BudgetLinesSnapshot {
  const confirmed = new Map(snapshot.confirmed);
  if (line === null) confirmed.delete(costCode);
  else confirmed.set(costCode, line);
  return { confirmed, overlay: withoutKey(snapshot.overlay, costCode), conflicts: withoutKey(snapshot.conflicts, costCode) };
}

/** The write failed: what is shown returns to the confirmed line. */
export function rollback(snapshot: BudgetLinesSnapshot, costCode: string): BudgetLinesSnapshot {
  return { ...snapshot, overlay: withoutKey(snapshot.overlay, costCode) };
}

/** 409: the overlay leaves the table (it is not the truth) but is KEPT as the human's side of the conflict. */
export function markConflict(snapshot: BudgetLinesSnapshot, costCode: string): BudgetLinesSnapshot {
  if (!snapshot.overlay.has(costCode)) return snapshot;
  const conflicts = new Map(snapshot.conflicts);
  conflicts.set(costCode, snapshot.overlay.get(costCode) ?? null);
  return { ...snapshot, overlay: withoutKey(snapshot.overlay, costCode), conflicts };
}

/** The human chose (keep theirs, or re-sent theirs-revision + mine): the conflict closes. */
export function dismissConflict(snapshot: BudgetLinesSnapshot, costCode: string): BudgetLinesSnapshot {
  return { ...snapshot, conflicts: withoutKey(snapshot.conflicts, costCode) };
}

export function budgetLineConflicts(snapshot: BudgetLinesSnapshot): BudgetLineConflict[] {
  return [...snapshot.conflicts.entries()]
    .map(([costCode, mine]) => ({ costCode, mine, theirs: snapshot.confirmed.get(costCode) ?? null }))
    .sort((a, b) => compareCostCodes(a.costCode, b.costCode));
}

/** A fresh read replaces the confirmed layer; overlays still in flight stay on top. */
export function replaceConfirmed(snapshot: BudgetLinesSnapshot, lines: readonly ConfirmedBudgetLine[]): BudgetLinesSnapshot {
  return { ...snapshot, confirmed: fromConfirmed(lines) };
}

/** What the table shows, in taxonomy order (ΑΤΟΕ → soft). Archived-in-flight lines are hidden. */
export function displayedBudgetLines(snapshot: BudgetLinesSnapshot): BudgetLineDisplay[] {
  const codes = new Set([...snapshot.confirmed.keys(), ...snapshot.overlay.keys()]);
  const shown: BudgetLineDisplay[] = [];
  for (const costCode of codes) {
    const pending = snapshot.overlay.has(costCode);
    const values = pending ? snapshot.overlay.get(costCode) ?? null : snapshot.confirmed.get(costCode) ?? null;
    if (values !== null) shown.push({ costCode, amount: values.amount, note: values.note, pending });
  }
  return shown.sort((a, b) => compareCostCodes(a.costCode, b.costCode));
}

function withoutKey<V>(map: ReadonlyMap<string, V>, key: string): ReadonlyMap<string, V> {
  if (!map.has(key)) return map;
  const next = new Map(map);
  next.delete(key);
  return next;
}
