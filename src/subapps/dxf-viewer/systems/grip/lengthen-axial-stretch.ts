/**
 * LENGTHEN AXIAL STRETCH — ADR-349 SSoT (Phase 1b.1)
 *
 * Pure math for axial-length extension of LINE / ARC endpoints.
 * Invoked from the grip multifunctional menu (Phase 1b.2) — no inline math elsewhere.
 *
 * Modes:
 *   - 'delta': add ±Δ to current length (positive = extend, negative = shorten)
 *   - 'total': set new absolute length, sign-preserved
 *
 * @see ADR-349 §Multifunctional Grip Menu — LENGTHEN minimal scope
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity, LineEntity, ArcEntity } from '../../types/entities';
import type { SceneEntity } from '../../core/commands/interfaces';

export type LengthenEndpoint = 'start' | 'end';
export type LengthenMode = 'delta' | 'total';

// ── LINE ──────────────────────────────────────────────────────────────────────

export function lineLength(line: LineEntity): number {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Move LINE endpoint along the line's own direction so total length becomes target.
 * Fixed endpoint stays put.
 */
export function lengthenLineEndpoint(
  line: LineEntity,
  which: LengthenEndpoint,
  value: number,
  mode: LengthenMode,
): Partial<LineEntity> {
  const oldLen = lineLength(line);
  if (oldLen < 1e-10) return {};
  const newLen = mode === 'total' ? value : oldLen + value;
  if (newLen <= 0) return {};

  const scale = newLen / oldLen;
  if (which === 'end') {
    return {
      end: {
        x: line.start.x + (line.end.x - line.start.x) * scale,
        y: line.start.y + (line.end.y - line.start.y) * scale,
      },
    };
  }
  // 'start': move start away from end so that new length = newLen
  return {
    start: {
      x: line.end.x + (line.start.x - line.end.x) * scale,
      y: line.end.y + (line.start.y - line.end.y) * scale,
    },
  };
}

// ── ARC ───────────────────────────────────────────────────────────────────────

export function arcLength(arc: ArcEntity): number {
  return Math.abs(arc.radius * normalizeArcSweep(arc.startAngle, arc.endAngle, arc.counterclockwise));
}

/**
 * Extend ARC endpoint along its tangent — equivalent to changing the angular sweep.
 * Center + radius preserved; only the moving endpoint's angle changes.
 */
export function lengthenArcEndpoint(
  arc: ArcEntity,
  which: LengthenEndpoint,
  value: number,
  mode: LengthenMode,
): Partial<ArcEntity> {
  if (arc.radius < 1e-10) return {};
  const oldLen = arcLength(arc);
  const newLen = mode === 'total' ? value : oldLen + value;
  if (newLen <= 0) return {};

  const newSweep = newLen / arc.radius;
  const ccw = arc.counterclockwise ?? false;
  const sign = ccw ? -1 : 1;

  if (which === 'end') {
    return { endAngle: arc.startAngle + sign * newSweep };
  }
  return { startAngle: arc.endAngle - sign * newSweep };
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

/**
 * Apply lengthen to a LINE or ARC. Other entity types return {}.
 */
export function applyLengthen(
  entity: Entity,
  which: LengthenEndpoint,
  value: number,
  mode: LengthenMode,
): Partial<SceneEntity> {
  switch (entity.type) {
    case 'line':
      return lengthenLineEndpoint(entity, which, value, mode) as Partial<SceneEntity>;
    case 'arc':
      return lengthenArcEndpoint(entity, which, value, mode) as Partial<SceneEntity>;
    default:
      return {};
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeArcSweep(startAngle: number, endAngle: number, counterclockwise?: boolean): number {
  const TAU = Math.PI * 2;
  let sweep = endAngle - startAngle;
  if (counterclockwise) sweep = -sweep;
  while (sweep < 0) sweep += TAU;
  while (sweep > TAU) sweep -= TAU;
  return sweep;
}

/**
 * Compute arc endpoint coordinates from center + radius + angle.
 * Re-exported helper (used by callers for hit-testing midpoint grip etc.)
 */
export function arcEndpointXY(center: Point2D, radius: number, angleRad: number): Point2D {
  return {
    x: center.x + radius * Math.cos(angleRad),
    y: center.y + radius * Math.sin(angleRad),
  };
}
