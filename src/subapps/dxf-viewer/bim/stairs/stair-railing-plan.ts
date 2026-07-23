/**
 * Stair → Railing PLANNER — ADR-407 Φ7 (pure diff SSoT).
 *
 * Mirror of `planStairwellOpenings`: reads the current stairs + the already-materialised
 * auto railings and returns a **diff plan** (create / update / delete) so the coordinator
 * mutates the scene idempotently. Every desired railing has a **deterministic** id keyed on
 * `(stairId, side)` → a re-run over an unchanged scene yields zero creates/deletes (only
 * geometry-refresh updates, which the coordinator no-ops when nothing moved).
 *
 * PURE — no scene mutation, no IO, no factory calls. The coordinator owns materialisation.
 *
 * @see bim/stairs/stair-railing-coordinator.ts — applies this plan
 * @see bim/geometry/stairs/stairwell-opening-plan.ts — the pattern it mirrors
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md §Φ7
 */

import { generateDeterministicRailingId } from '@/services/enterprise-id-convenience';
import type { StairEntity } from '../types/stair-types';
import type { RailingEntity } from '../types/railing-types';
import { stairRailingSides, type StairRailingSide } from './stair-railing-host';

/** One auto railing the scene SHOULD contain (a stair side with an active handrail). */
export interface DesiredStairRailing {
  readonly railingId: string;
  readonly stairId: string;
  readonly side: StairRailingSide;
}

/** An auto railing the scene ALREADY contains (hosted on a stair), keyed back to its host. */
export interface ManagedStairRailing {
  readonly railingId: string;
  readonly stairId: string;
  readonly side: StairRailingSide;
}

export interface StairRailingPlan {
  readonly creates: readonly DesiredStairRailing[];
  /** Existing auto railings whose stair is still present → refresh baked path + geometry. */
  readonly updates: readonly DesiredStairRailing[];
  readonly deletes: readonly { readonly railingId: string }[];
}

const EMPTY_PLAN: StairRailingPlan = { creates: [], updates: [], deletes: [] };

/** SSoT seed for the deterministic id (stable across sessions → idempotent re-run). */
export function stairRailingPairKey(stairId: string, side: StairRailingSide): string {
  return `${stairId}::${side}`;
}

/** Deterministic railing id for a stair side (N.6 enterprise-id, stable per `(stairId, side)`). */
export function stairRailingId(stairId: string, side: StairRailingSide): string {
  return generateDeterministicRailingId(stairRailingPairKey(stairId, side));
}

/**
 * Resolve an auto (stair-hosted) railing back to its `(stairId, side)`. `null` for a user
 * sketch railing or a non-stair host — those are NEVER touched by the cascade.
 */
export function managedStairRailingRef(railing: RailingEntity): ManagedStairRailing | null {
  const src = railing.params.pathSource;
  if (src.kind !== 'hosted' || src.hostType !== 'stair' || !src.side) return null;
  return { railingId: railing.id, stairId: src.hostId, side: src.side };
}

/**
 * Diff the desired auto railings (one per active handrail side of every stair) against the
 * existing managed railings. Deterministic ids make the set-membership comparison exact.
 */
export function planStairRailings(
  stairs: readonly StairEntity[],
  existingManaged: readonly ManagedStairRailing[],
): StairRailingPlan {
  if (stairs.length === 0 && existingManaged.length === 0) return EMPTY_PLAN;

  const desired = new Map<string, DesiredStairRailing>();
  for (const stair of stairs) {
    for (const side of stairRailingSides(stair)) {
      const railingId = stairRailingId(stair.id, side);
      desired.set(railingId, { railingId, stairId: stair.id, side });
    }
  }

  const existingIds = new Set(existingManaged.map((e) => e.railingId));
  const creates: DesiredStairRailing[] = [];
  const updates: DesiredStairRailing[] = [];
  for (const d of desired.values()) {
    (existingIds.has(d.railingId) ? updates : creates).push(d);
  }

  const deletes = existingManaged
    .filter((e) => !desired.has(e.railingId))
    .map((e) => ({ railingId: e.railingId }));

  return { creates, updates, deletes };
}
