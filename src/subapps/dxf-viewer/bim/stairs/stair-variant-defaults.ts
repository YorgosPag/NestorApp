/**
 * ADR-358 Phase 3d — Variant defaults factory.
 *
 * Pure function: given a target `kind` + current `StairParams` (for context
 * like `stepCount`, `width`, `tread`, `basePoint`), produce a fresh
 * `StairVariantParams` of that kind seeded with sensible defaults so the
 * Kind Selector combobox can switch kinds without dropping the stair into
 * an unbuildable state.
 *
 * Defaults follow industry convention (Revit / ArchiCAD / AutoCAD Architecture
 * Type Selector → fresh variant with derived dims). When the user switches
 * kind, type-specific previous variant fields are discarded — same UX as
 * Revit "Family Type" swap.
 *
 * Imported only by `stair-param-helpers.ts` (bridge) and tests.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.3 §6.2
 */

import type { Point3D } from '../../rendering/types/Types';
import type {
  StairKind,
  StairParams,
  StairVariantParams,
  StairVariantLShapeWinders,
} from '../../bim/types/stair-types';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';

const DEFAULT_SWEEP_DEG = 360;
const HELICAL_SWEEP_DEG = 270;
const ELLIPTICAL_SWEEP_DEG = 180;
const DEFAULT_OPENING_ANGLE_DEG = 90;
const DEFAULT_WINDER_TURN_DEG = 90;
const DEFAULT_V_ARM_ANGLE_DEG = 90;

/**
 * Build a fresh variant of `targetKind` seeded from `prev` context. Returns
 * the existing variant unchanged if `targetKind === prev.variant.kind`
 * (caller is expected to skip the redundant patch upstream).
 */
export function buildDefaultVariantFor(
  targetKind: StairKind,
  prev: Readonly<StairParams>,
): StairVariantParams {
  switch (targetKind) {
    case 'straight':
      return { kind: 'straight' };
    case 'l-shape':
      return {
        kind: 'l-shape',
        cornerStyle: 'landing',
        turnDirection: 'right',
        landingDepth: 'auto',
        flightSplit: splitTwoFlightsWithLanding(prev.stepCount),
      };
    case 'u-shape':
      return {
        kind: 'u-shape',
        turnDirection: 'right',
        landingDepth: 'auto',
        flightSplit: splitTwoFlightsWithLanding(prev.stepCount),
      };
    case 'gamma':
      return {
        kind: 'gamma',
        turnSequence: ['right', 'right'] as const,
        landings: ['auto', 'auto'] as const,
        flightSplit: splitThreeFlightsWithLandings(prev.stepCount),
      };
    case 'multi-flight':
      return {
        kind: 'multi-flight',
        flights: splitTwoFlightsWithLanding(prev.stepCount),
        turns: [
          {
            turnDirection: 'right',
            turnAngleDeg: 90,
            cornerStyle: 'landing',
            landingDepth: 'auto',
          },
        ],
      };
    case 'spiral':
      return {
        kind: 'spiral',
        centerPoint: clonePoint(prev.basePoint),
        innerRadius: 0,
        sweepAngle: DEFAULT_SWEEP_DEG,
        turnDirection: 'cw',
      };
    case 'helical': {
      const innerRadius = Math.max(prev.width, 1);
      return {
        kind: 'helical',
        centerPoint: clonePoint(prev.basePoint),
        innerRadius,
        outerRadius: innerRadius + prev.width,
        sweepAngle: HELICAL_SWEEP_DEG,
        turnDirection: 'cw',
      };
    }
    case 'elliptical': {
      const radius = Math.max(prev.tread * prev.stepCount * 0.5, prev.width);
      return {
        kind: 'elliptical',
        centerPoint: clonePoint(prev.basePoint),
        semiMajor: radius,
        semiMinor: radius * 0.7,
        sweepAngle: ELLIPTICAL_SWEEP_DEG,
        turnDirection: 'cw',
        rotation: 0,
      };
    }
    case 'winder':
      return {
        kind: 'winder',
        turnAngle: DEFAULT_WINDER_TURN_DEG,
        winderCount: Math.max(1, Math.min(3, prev.stepCount - 1)),
        winderMethod: 'equal-going',
      };
    case 'triangular-fan':
      return {
        kind: 'triangular-fan',
        apexPoint: clonePoint(prev.basePoint),
        openingAngle: DEFAULT_OPENING_ANGLE_DEG,
        stepCountPerArc: Math.max(1, prev.stepCount),
        turnDirection: 'cw',
      };
    case 'triangular-outline': {
      const side = Math.max(prev.tread * prev.stepCount, prev.width);
      return {
        kind: 'triangular-outline',
        triangleVertices: [
          clonePoint(prev.basePoint),
          translatePoint(prev.basePoint, { x: side, y: 0 }),
          translatePoint(prev.basePoint, { x: 0, y: side }),
        ] as const,
        entrySide: 0,
        orientation: 'cw',
      };
    }
    case 'sketch': {
      const reach = Math.max(prev.tread * prev.stepCount, prev.width);
      return {
        kind: 'sketch',
        walklinePath: [
          clonePoint(prev.basePoint),
          translatePoint(prev.basePoint, { x: reach, y: 0 }),
        ],
      };
    }
    case 'v-shape':
      return {
        kind: 'v-shape',
        armAngleDeg: DEFAULT_V_ARM_ANGLE_DEG,
        armSplit: splitTwoFlights(prev.stepCount),
      };
    default: {
      const _exhaustive: never = targetKind;
      throw new Error(`buildDefaultVariantFor: unhandled kind ${String(_exhaustive)}`);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function splitTwoFlights(stepCount: number): readonly [number, number] {
  const n = Math.max(2, stepCount);
  const a = Math.max(1, Math.floor(n / 2));
  const b = Math.max(1, n - a);
  return [a, b] as const;
}

function splitThreeFlights(stepCount: number): readonly [number, number, number] {
  const n = Math.max(3, stepCount);
  const a = Math.max(1, Math.floor(n / 3));
  const c = Math.max(1, Math.floor(n / 3));
  const b = Math.max(1, n - a - c);
  return [a, b, c] as const;
}

/**
 * ADR-358 Phase 3e — Split for kinds with 1 landing (l-shape, u-shape). The
 * landing consumes 1 unit of `stepCount` (z-model: landing at `n1·rise`,
 * flight2 starts at `(n1+1)·rise`), so `n1 + 1 + n2 = stepCount`.
 * Convention γ + count conservation across kind switches.
 */
export function splitTwoFlightsWithLanding(
  stepCount: number,
): readonly [number, number] {
  // Reserve 1 unit for the landing → split (stepCount - 1).
  // Clamp to minimum 2 treads (1 per flight) so both flights are buildable.
  return splitTwoFlights(Math.max(2, stepCount - 1));
}

/**
 * ADR-358 Phase 3e — Split for kinds with 2 landings (gamma). Each landing
 * consumes 1 unit of `stepCount` (`(n1+n2+2)·rise` total height), so
 * `n1 + 1 + n2 + 1 + n3 = stepCount` ⇒ `n1+n2+n3 = stepCount - 2`.
 */
export function splitThreeFlightsWithLandings(
  stepCount: number,
): readonly [number, number, number] {
  return splitThreeFlights(Math.max(3, stepCount - 2));
}

/**
 * ADR-358 Phase 3f — Split for l-shape with winders. Winders at the corner
 * are walkable steps (z = (n1+i)·rise), so `n1 + winderCount + n2 = stepCount`
 * ⇒ split (stepCount − winderCount). Clamp ≥1 per flight.
 */
export function splitTwoFlightsForWinders(
  stepCount: number,
  winderCount: number,
): readonly [number, number] {
  return splitTwoFlights(Math.max(2, stepCount - Math.max(1, winderCount)));
}

const DEFAULT_LSHAPE_WINDER_COUNT = 3;          // NOK quarter-turn standard
const DEFAULT_LSHAPE_WINDER_METHOD = 'equal-going' as const; // NOK walkline-preserving

/**
 * ADR-358 Phase 3f — Build a fresh l-shape variant with NOK-compliant
 * winders at the corner. Used by the ribbon bridge when the user toggles
 * `cornerStyle` from 'landing' → 'winders'. `turnDirection` preserved from
 * the previous variant when caller passes one.
 */
export function buildLShapeWindersVariant(
  prev: Readonly<StairParams>,
): StairVariantLShapeWinders {
  const prevTurn =
    prev.variant.kind === 'l-shape' ? prev.variant.turnDirection : 'right';
  const winderCount = DEFAULT_LSHAPE_WINDER_COUNT;
  return {
    kind: 'l-shape',
    cornerStyle: 'winders',
    turnDirection: prevTurn,
    winderCount,
    winderMethod: DEFAULT_LSHAPE_WINDER_METHOD,
    flightSplit: splitTwoFlightsForWinders(prev.stepCount, winderCount),
  };
}

function clonePoint(p: Readonly<Point3D>): Point3D {
  return { x: p.x, y: p.y, z: p.z };
}
