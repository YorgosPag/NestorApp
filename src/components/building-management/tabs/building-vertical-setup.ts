/**
 * building-vertical-setup — pure SSoT for the ADR-451 «Quick Setup» floor-stack
 * generator (Revit level-driven building setup).
 *
 * Given a vertical configuration (basements / ground / upper floors + typical
 * storey height), produces the full storey stack basement → roof with consistent
 * elevations. `elevation` is the SSoT (number × typical height, ground = 0) and
 * `height` is the per-storey value the server reconcile keeps derived afterwards.
 *
 * ADR-461 — foundation & stair-penthouse are emitted as **special levels** (own
 * `FloorKind`, Revit «Building Story» OFF) when their toggles are on: the
 * foundation below the lowest storey, the penthouse above the top storey. They
 * are drawable levels but NOT counted storeys (`isBuildingStorey` → false). The
 * structural TYPE of the foundation still lives per-element in the DXF
 * (`floorplan_foundations`, ADR-436/441), not here.
 *
 * @module components/building-management/tabs/building-vertical-setup
 * @see docs/centralized-systems/reference/adrs/ADR-451-building-vertical-setup-floor-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-461-special-levels-foundation-stair-penthouse.md
 */

import type { FloorKind } from '@/utils/floor-naming';
import { inferKindFromNumber } from '@/utils/floor-naming';
import {
  DEFAULT_BUILDING_FOUNDATION_DEPTH_M,
  DEFAULT_BUILDING_STAIR_PENTHOUSE_HEIGHT_M,
} from '@/types/building/elevation.schemas';

/** Residential standard floor-to-floor height (metres) — Greek norm (ADR-369). */
export const DEFAULT_TYPICAL_STOREY_HEIGHT_M = 3.0;

export interface VerticalSetupConfig {
  /** Number of basement levels (0,1,2…) → storeys −basementCount … −1. */
  readonly basementCount: number;
  /** Number of floors above the ground floor → storeys 1 … upperCount. */
  readonly upperCount: number;
  /** Typical floor-to-floor height in metres (default 3.0). */
  readonly typicalHeightM: number;
  /** ADR-461 — emit a foundation special level below the lowest storey. */
  readonly hasFoundation?: boolean;
  /** ADR-461 — METRES — foundation depth (default 1.0). Used when hasFoundation. */
  readonly foundationDepthM?: number;
  /** ADR-461 — emit a stair-penthouse special level above the top storey. */
  readonly hasStairPenthouse?: boolean;
  /** ADR-461 — METRES — stair-penthouse height (default 2.40). */
  readonly stairPenthouseHeightM?: number;
}

export interface GeneratedFloorSpec {
  /** Signed storey index: negative = basement, 0 = ground, positive = upper. */
  readonly number: number;
  /** METRES — FFL above the building base (ground = 0). */
  readonly elevation: number;
  /** METRES — floor-to-floor height (= typical height for a uniform stack). */
  readonly height: number;
  /**
   * ADR-461 — floor kind. Storeys get an inferred kind (ground/basement/standard);
   * special levels get 'foundation' / 'stair-penthouse'. Drives «Building Story».
   */
  readonly kind: FloorKind;
}

function clampCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Generate the full storey stack for a Quick Setup config, ordered low → high so
 * callers create them deterministically. Ground floor (number 0) is always the
 * datum (elevation 0). When their toggles are on (ADR-461) a foundation special
 * level is prepended below the lowest storey and a stair-penthouse special level
 * is appended above the top storey — both NOT counted storeys.
 */
export function generateFloorStack(config: VerticalSetupConfig): GeneratedFloorSpec[] {
  const basements = clampCount(config.basementCount);
  const uppers = clampCount(config.upperCount);
  const h = Number.isFinite(config.typicalHeightM) && config.typicalHeightM > 0
    ? config.typicalHeightM
    : DEFAULT_TYPICAL_STOREY_HEIGHT_M;

  // Counted storeys: basement(s) → ground → upper(s), low → high.
  const storeys: GeneratedFloorSpec[] = [];
  for (let n = -basements; n <= uppers; n++) {
    const number = n === 0 ? 0 : n; // normalise -0 → 0
    storeys.push({ number, elevation: roundM(number * h), height: h, kind: inferKindFromNumber(number) });
  }

  const specs: GeneratedFloorSpec[] = [];

  // Foundation special level — below the lowest storey (ADR-461 §2.2).
  if (config.hasFoundation) {
    const lowest = storeys[0];
    const depth = positiveM(config.foundationDepthM, DEFAULT_BUILDING_FOUNDATION_DEPTH_M);
    specs.push({
      number: lowest.number - 1,
      elevation: roundM(lowest.elevation - depth),
      height: depth,
      kind: 'foundation',
    });
  }

  specs.push(...storeys);

  // Stair-penthouse special level — above the top storey (ADR-461 §2.2).
  if (config.hasStairPenthouse) {
    const top = storeys[storeys.length - 1];
    const penthouseHeight = positiveM(config.stairPenthouseHeightM, DEFAULT_BUILDING_STAIR_PENTHOUSE_HEIGHT_M);
    specs.push({
      number: top.number + 1,
      elevation: roundM(top.elevation + top.height),
      height: penthouseHeight,
      kind: 'stair-penthouse',
    });
  }

  return specs;
}

/** A positive finite metre value, else the given fallback. */
function positiveM(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value as number) > 0 ? (value as number) : fallback;
}

/** Round to millimetre precision (normalising −0 → 0) to avoid float drift. */
function roundM(value: number): number {
  const r = Math.round(value * 1000) / 1000;
  return r === 0 ? 0 : r;
}
