/**
 * Insert a turn point into a stair (ADR-633) — pure `StairParams` transform.
 *
 * Given a parieta pick (flight + param + side) and an angle, produce a new
 * `StairParams` with the turn inserted:
 *   - `'straight'` → promoted to `'multi-flight'` (the run splits into two
 *     flights at `param`, one turn between them). Tread count is preserved
 *     (`flights` sum = old `stepCount`).
 *   - `'multi-flight'` → the target flight splits in two and a turn is inserted
 *     at that junction.
 *
 * The clicked side maps straight to the turn direction (right parieta → right).
 * Geometry is recomputed downstream by `UpdateStairParamsCommand`.
 *
 * Zero React / DOM deps — 100% testable.
 *
 * @see ./stair-parieta-pick.ts — produces the `flightIndex` / `param` / `side`
 * @see core/commands/entity-commands/UpdateStairParamsCommand.ts — the commit
 */

import type {
  StairParams,
  StairTurnNode,
  StairVariantMultiFlight,
} from '../types/stair-types';

export interface InsertTurnInput {
  readonly flightIndex: number;
  /** Parameter along the target flight, `0` = start, `1` = end. */
  readonly param: number;
  /** Clicked parieta → turn direction. */
  readonly side: 'left' | 'right';
  readonly turnAngleDeg: number;
  /** Phase 1 = `'landing'`; Phase 2 adds `'winders'`. Defaults to `'landing'`. */
  readonly cornerStyle?: 'landing' | 'winders';
  readonly landingDepth?: 'auto' | number;
}

/**
 * Returns the updated `StairParams`, or `null` when the turn cannot be inserted
 * (unsupported variant, or the target flight has fewer than 2 treads so it
 * cannot be split). Callers surface `null` to the user rather than mutating.
 */
export function insertTurnAtParieta(
  params: Readonly<StairParams>,
  input: InsertTurnInput,
): StairParams | null {
  const turn: StairTurnNode = {
    turnDirection: input.side,
    turnAngleDeg: input.turnAngleDeg,
    cornerStyle: input.cornerStyle ?? 'landing',
    landingDepth: input.landingDepth ?? 'auto',
  };
  const v = params.variant;

  if (v.kind === 'straight') {
    const split = splitCount(params.stepCount, input.param);
    if (!split) return null;
    return { ...params, variant: { kind: 'multi-flight', flights: split, turns: [turn] } };
  }

  if (v.kind === 'multi-flight') {
    const variant = insertIntoMultiFlight(v, input.flightIndex, input.param, turn);
    return variant ? { ...params, variant } : null;
  }

  return null;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Split `total` treads at `param` into `[a, b]` (each ≥ 1), or `null` if `total < 2`. */
function splitCount(total: number, param: number): [number, number] | null {
  if (!Number.isFinite(total) || total < 2) return null;
  const a = Math.max(1, Math.min(total - 1, Math.round(param * total)));
  return [a, total - a];
}

function insertIntoMultiFlight(
  v: StairVariantMultiFlight,
  flightIndex: number,
  param: number,
  turn: StairTurnNode,
): StairVariantMultiFlight | null {
  const i = Math.max(0, Math.min(v.flights.length - 1, flightIndex));
  const split = splitCount(v.flights[i], param);
  if (!split) return null;
  const [a, b] = split;
  return {
    kind: 'multi-flight',
    flights: [...v.flights.slice(0, i), a, b, ...v.flights.slice(i + 1)],
    turns: [...v.turns.slice(0, i), turn, ...v.turns.slice(i)],
  };
}
