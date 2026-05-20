/**
 * ADR-366 §A.3 Q3 Phase 7.0B — Active plane derivation for 2D Section Panel.
 *
 * Converts SectionStore state (box bounds + planes list) → SectionPlaneInput
 * (axis 'x'|'y' + position σε world meters) που μπορεί να καταναλώσει το
 * `section-intersect.ts` math.
 *
 * COORDINATE MAPPING — Three.js world ↔ Nestor BIM plan:
 *   Three.js world.X = Nestor plan x  (East)        → section axis='x'
 *   Three.js world.Z = -(Nestor plan y) (North flip)→ section axis='y' με sign flip
 *   Three.js world.Y = vertical (m, height)         → UNSUPPORTED στο Phase 7.0B
 *
 * Plane mode + Box mode share the same output shape (`ActivePlane2D`) — UI
 * presents 4 vertical face options σε box mode (±X, ±Y mapped από ±Z faces).
 *
 * @see ADR-366 §A.3 Q3 — 2D Section Panel decision
 */

import type { SectionBoxBounds, SectionPlaneState } from '../stores/SectionStore';
import type { SectionAxis } from './section-intersect';

/** Active cutting plane derived για το 2D panel. */
export interface ActivePlane2D {
  readonly id: string;
  readonly label: string;
  readonly axis: SectionAxis;
  /** Position σε plan-space meters (Nestor x for axis='x', Nestor y for axis='y'). */
  readonly position: number;
}

const AXIS_EPSILON = 0.95;

/**
 * Box mode face options. Generates ≤4 vertical faces (±world-X + ±world-Z).
 * World-Y faces (horizontal cuts) omitted στο Phase 7.0B.
 */
export function boxFaceOptions(bounds: SectionBoxBounds): ActivePlane2D[] {
  return [
    {
      id: 'box-face-x-min',
      label: '-X (West)',
      axis: 'x',
      position: bounds.min[0],
    },
    {
      id: 'box-face-x-max',
      label: '+X (East)',
      axis: 'x',
      position: bounds.max[0],
    },
    {
      id: 'box-face-z-min',
      label: '-Z (South)',
      axis: 'y',
      position: -bounds.min[2],
    },
    {
      id: 'box-face-z-max',
      label: '+Z (North)',
      axis: 'y',
      position: -bounds.max[2],
    },
  ];
}

/**
 * Plane mode option for ένα SectionPlaneState. Returns null αν το plane είναι
 * οριζόντιο (±Y normal) ή skewed (όχι παράλληλο σε world axis).
 */
export function planeOption(plane: SectionPlaneState): ActivePlane2D | null {
  const [nx, ny, nz] = plane.normal;
  const absNx = Math.abs(nx);
  const absNy = Math.abs(ny);
  const absNz = Math.abs(nz);

  if (absNy >= AXIS_EPSILON) return null;

  if (absNx >= AXIS_EPSILON) {
    const sign = nx >= 0 ? 1 : -1;
    return {
      id: plane.id,
      label: plane.label,
      axis: 'x',
      position: -sign * plane.constant,
    };
  }

  if (absNz >= AXIS_EPSILON) {
    const sign = nz >= 0 ? 1 : -1;
    return {
      id: plane.id,
      label: plane.label,
      axis: 'y',
      position: sign * plane.constant,
    };
  }

  return null;
}

/**
 * Resolves the full list of selectable 2D-panel-compatible planes given the
 * current SectionStore snapshot. Box mode → 4 box faces. Plane mode → only
 * enabled planes that are vertical (±X or ±Z normal).
 */
export function deriveAvailablePlanes(args: {
  readonly mode: 'box' | 'plane';
  readonly boxBounds: SectionBoxBounds | null;
  readonly planes: ReadonlyArray<SectionPlaneState>;
}): ActivePlane2D[] {
  if (args.mode === 'box') {
    return args.boxBounds ? boxFaceOptions(args.boxBounds) : [];
  }
  const out: ActivePlane2D[] = [];
  for (const plane of args.planes) {
    if (!plane.enabled) continue;
    const opt = planeOption(plane);
    if (opt) out.push(opt);
  }
  return out;
}
