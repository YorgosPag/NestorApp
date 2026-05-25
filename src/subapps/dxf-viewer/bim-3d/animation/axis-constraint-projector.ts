/**
 * ADR-366 §C.1.b — Axis-constrained drag projection (pure math, no Three.js).
 *
 * Blender pattern: G→X/Y/Z locks the drag to a single world axis.
 * The camera-aligned drag plane remains unchanged; only the emitted
 * position is masked to move along the locked axis only.
 *
 * Math: for a locked axis A, `newPos[A] = raw[A]`, all other components
 * stay at `startPos`. Equivalent to `startPos + dot(raw − startPos, axisDir) * axisDir`
 * but simplified because axis vectors are unit-aligned.
 */

export type AxisLock = 'X' | 'Y' | 'Z';

export const AXIS_COLORS: Record<AxisLock, string> = {
  X: '#FF4444',
  Y: '#44FF44',
  Z: '#4444FF',
};

export const AXIS_COLORS_DIM: Record<AxisLock, string> = {
  X: '#882222',
  Y: '#228822',
  Z: '#222288',
};

interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Project `raw` onto the world axis `axis` passing through `startPos`.
 * Returns the constrained position: only the locked axis component moves.
 */
export function applyAxisConstraint(raw: Vec3, startPos: Vec3, axis: AxisLock): Vec3 {
  return {
    x: axis === 'X' ? raw.x : startPos.x,
    y: axis === 'Y' ? raw.y : startPos.y,
    z: axis === 'Z' ? raw.z : startPos.z,
  };
}
