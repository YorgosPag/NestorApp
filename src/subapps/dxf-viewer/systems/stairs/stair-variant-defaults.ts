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
} from '../../types/stair';

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
        turnDirection: 'right',
        landingDepth: 'auto',
        flightSplit: splitTwoFlights(prev.stepCount),
      };
    case 'u-shape':
      return {
        kind: 'u-shape',
        turnDirection: 'right',
        landingDepth: 'auto',
        flightSplit: splitTwoFlights(prev.stepCount),
      };
    case 'gamma':
      return {
        kind: 'gamma',
        turnSequence: ['right', 'right'] as const,
        landings: ['auto', 'auto'] as const,
        flightSplit: splitThreeFlights(prev.stepCount),
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
          translatePoint(prev.basePoint, side, 0),
          translatePoint(prev.basePoint, 0, side),
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
          translatePoint(prev.basePoint, reach, 0),
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

function clonePoint(p: Readonly<Point3D>): Point3D {
  return { x: p.x, y: p.y, z: p.z };
}

function translatePoint(p: Readonly<Point3D>, dx: number, dy: number): Point3D {
  return { x: p.x + dx, y: p.y + dy, z: p.z };
}
