/**
 * building-vertical-setup — pure SSoT for the ADR-451 «Quick Setup» floor-stack
 * generator (Revit level-driven building setup).
 *
 * Given a vertical configuration (basements / ground / upper floors + typical
 * storey height), produces the full storey stack basement → roof with consistent
 * elevations. `elevation` is the SSoT (number × typical height, ground = 0) and
 * `height` is the per-storey value the server reconcile keeps derived afterwards.
 *
 * The foundation is an auto-derived **datum** below the lowest storey — NOT a
 * counted storey here (ADR-451 §3); it is persisted building-level
 * (`hasFoundation` + `foundationDepth`), and its structural TYPE lives per-element
 * in the DXF (`floorplan_foundations`, ADR-436/441).
 *
 * @module components/building-management/tabs/building-vertical-setup
 * @see docs/centralized-systems/reference/adrs/ADR-451-building-vertical-setup-floor-ssot.md
 */

/** Residential standard floor-to-floor height (metres) — Greek norm (ADR-369). */
export const DEFAULT_TYPICAL_STOREY_HEIGHT_M = 3.0;

export interface VerticalSetupConfig {
  /** Number of basement levels (0,1,2…) → storeys −basementCount … −1. */
  readonly basementCount: number;
  /** Number of floors above the ground floor → storeys 1 … upperCount. */
  readonly upperCount: number;
  /** Typical floor-to-floor height in metres (default 3.0). */
  readonly typicalHeightM: number;
}

export interface GeneratedFloorSpec {
  /** Signed storey index: negative = basement, 0 = ground, positive = upper. */
  readonly number: number;
  /** METRES — FFL above the building base (ground = 0). */
  readonly elevation: number;
  /** METRES — floor-to-floor height (= typical height for a uniform stack). */
  readonly height: number;
}

function clampCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Generate the full storey stack (basement → roof) for a Quick Setup config.
 * Ground floor (number 0) is always included as the datum (elevation 0). Storeys
 * are returned ordered low → high so callers can create them deterministically.
 */
export function generateFloorStack(config: VerticalSetupConfig): GeneratedFloorSpec[] {
  const basements = clampCount(config.basementCount);
  const uppers = clampCount(config.upperCount);
  const h = Number.isFinite(config.typicalHeightM) && config.typicalHeightM > 0
    ? config.typicalHeightM
    : DEFAULT_TYPICAL_STOREY_HEIGHT_M;

  const specs: GeneratedFloorSpec[] = [];
  for (let n = -basements; n <= uppers; n++) {
    const number = n === 0 ? 0 : n; // normalise -0 → 0
    specs.push({ number, elevation: roundM(number * h), height: h });
  }
  return specs;
}

/** Round to millimetre precision (normalising −0 → 0) to avoid float drift. */
function roundM(value: number): number {
  const r = Math.round(value * 1000) / 1000;
  return r === 0 ? 0 : r;
}
