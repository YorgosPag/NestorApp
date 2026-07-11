/**
 * `StairRestLandingsSection` pure helpers (ADR-637 Phase 4-B) — array ops over
 * `StairParams.restLandings` (add / remove-by-id / patch-by-id) + stable local
 * id generation.
 *
 * `StairRestLanding.id` is a SUB-OBJECT identity nested inside one stair's
 * params (survives grip drags / edits so a grip can keep targeting "this
 * landing" — see `bim/stairs/stair-grip-rest-landing.ts`). It is NOT a
 * Firestore document id, so `@/services/enterprise-id.service` (CLAUDE.md
 * N.6, scoped to `setDoc()` documents) does not apply. Deterministic `stln_N`
 * suffixes (max existing + 1) keep behaviour reproducible in tests — no
 * clock- or random-based ids.
 */

import type { StairRestLanding } from '../../../bim/types/stair-types';

const ID_PREFIX = 'stln_';

/** Next free `stln_N` id: highest existing numeric suffix + 1 (never collides). */
export function nextRestLandingId(existing: readonly StairRestLanding[]): string {
  let max = 0;
  for (const landing of existing) {
    if (!landing.id.startsWith(ID_PREFIX)) continue;
    const suffix = Number.parseInt(landing.id.slice(ID_PREFIX.length), 10);
    if (Number.isFinite(suffix) && suffix > max) max = suffix;
  }
  return `${ID_PREFIX}${max + 1}`;
}

/**
 * Append a fresh landing at the run midpoint (`at: 0.5`), length/depth left
 * `'auto'` (square landing, matching the stair width — `resolveRestLandingLength`
 * / `resolveRestLandingDepth`). The planner (`planStairRunSegments`) resolves
 * the nearest legal level on recompute, so a mid-run start is always valid.
 */
export function appendRestLanding(
  existing: readonly StairRestLanding[],
): readonly StairRestLanding[] {
  const landing: StairRestLanding = { id: nextRestLandingId(existing), at: 0.5, length: 'auto' };
  return [...existing, landing];
}

/** Return a copy of `existing` without the landing whose `id` matches. */
export function removeRestLandingById(
  existing: readonly StairRestLanding[],
  id: string,
): readonly StairRestLanding[] {
  return existing.filter((landing) => landing.id !== id);
}

/** Immutably patch the landing whose `id` matches (length / depth edits). */
export function patchRestLandingById(
  existing: readonly StairRestLanding[],
  id: string,
  patch: Partial<StairRestLanding>,
): readonly StairRestLanding[] {
  return existing.map((landing) => (landing.id === id ? { ...landing, ...patch } : landing));
}
