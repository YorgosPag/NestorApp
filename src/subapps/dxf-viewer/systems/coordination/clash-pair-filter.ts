/**
 * ADR-435 — legit-connection filter (Slice 0).
 *
 * Two entities that share a `MepSystem` membership (or where one is the system's
 * source) touch *by design* at their connectors — that is NOT a clash. The
 * membership truth lives on `MepSystemEntity.params.members[].entityId` +
 * `sourceEntityId`; the orchestrator folds it into each `ClashEntity.systemIds`.
 */

import type { ClashEntity } from './clash-types';

/** Do two entities belong to a common MepSystem (member or source)? */
export function sharesSystem(a: ClashEntity, b: ClashEntity): boolean {
  if (a.systemIds.length === 0 || b.systemIds.length === 0) return false;
  return a.systemIds.some((id) => b.systemIds.includes(id));
}

/** Skip a candidate pair before narrow-phase (self-pair or legit connection). */
export function shouldSkipPair(a: ClashEntity, b: ClashEntity): boolean {
  if (a.id === b.id) return true;
  return sharesSystem(a, b);
}
