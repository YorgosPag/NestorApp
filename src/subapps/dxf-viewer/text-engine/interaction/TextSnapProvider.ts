/**
 * ADR-344 Phase 6.B — Text snap provider (Q21).
 *
 * Produces 10 snap points for a DXF TEXT/MTEXT scene entity (full Figma/C4D
 * bounding-box: insertion + 4 corners + centre + 4 edge midpoints — coincides 1:1
 * with the text grips, ADR-378):
 *
 *   1. INSERTION        — entity.position
 *   2. CORNER_TL        — top-left of the bounding box
 *   3. CORNER_TR        — top-right
 *   4. CORNER_BL        — bottom-left
 *   5. CORNER_BR        — bottom-right
 *   6. CENTER           — bounding-box centroid
 *   7. EDGE_TOP_MID     — midpoint of the top edge
 *   8. EDGE_BOTTOM_MID  — midpoint of the bottom edge
 *   9. EDGE_LEFT_MID    — midpoint of the left (west) edge
 *  10. EDGE_RIGHT_MID   — midpoint of the right (east) edge
 *
 * The bounding box is supplied by the caller (typically via
 * `getBoundingBox(node, opts)` from Phase 3) so this module stays
 * font-engine-free and trivially testable. Rotation is applied here:
 * the bounding box is treated as entity-local; every non-insertion
 * point is rotated by `entity.textNode.rotation` around the insertion
 * point so callers do not need to know about rotation in advance.
 *
 * Integration with the global SnapEngine happens in Phase 6.C; this
 * module is intentionally standalone to keep the snap registry
 * untouched (handoff §6.B — "non modificarlo, solo register()").
 */

import type { DxfTextSceneEntity } from '../../core/commands/text/types';
import type { Rect } from '../layout/attachment-point';
import type { Point2D } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../../snapping/extended-types';
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';

// ── Snap point taxonomy ───────────────────────────────────────────────────────

/** Symbolic name for each of the 10 text snap points. */
export type TextSnapKind =
  | 'insertion'
  | 'corner-tl'
  | 'corner-tr'
  | 'corner-bl'
  | 'corner-br'
  | 'center'
  | 'edge-top-mid'
  | 'edge-bottom-mid'
  | 'edge-left-mid'
  | 'edge-right-mid';

export interface TextSnapPoint {
  readonly kind: TextSnapKind;
  readonly point: Point2D;
  /** Pre-rotation local point, useful for debug / overlay rendering. */
  readonly localPoint: Point2D;
  readonly snapType: ExtendedSnapType;
  readonly description: string;
}

// ── Math helpers ──────────────────────────────────────────────────────────────

function rotateAround(p: Point2D, origin: Point2D, radians: number): Point2D {
  if (radians === 0) return p;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function snapTypeFor(kind: TextSnapKind): ExtendedSnapType {
  switch (kind) {
    case 'insertion':
      return ExtendedSnapType.INSERTION;
    case 'center':
      return ExtendedSnapType.CENTER;
    case 'edge-top-mid':
    case 'edge-bottom-mid':
    case 'edge-left-mid':
    case 'edge-right-mid':
      return ExtendedSnapType.MIDPOINT;
    default:
      return ExtendedSnapType.ENDPOINT;
  }
}

function descriptionFor(kind: TextSnapKind, entityType: 'text' | 'mtext'): string {
  const label = entityType.toUpperCase();
  switch (kind) {
    case 'insertion':
      return `${label} insertion`;
    case 'corner-tl':
      return `${label} top-left`;
    case 'corner-tr':
      return `${label} top-right`;
    case 'corner-bl':
      return `${label} bottom-left`;
    case 'corner-br':
      return `${label} bottom-right`;
    case 'center':
      return `${label} center`;
    case 'edge-top-mid':
      return `${label} top-mid`;
    case 'edge-bottom-mid':
      return `${label} bottom-mid`;
    case 'edge-left-mid':
      return `${label} left-mid`;
    case 'edge-right-mid':
      return `${label} right-mid`;
  }
}

// ── Geometry SSoT ─────────────────────────────────────────────────────────────

/** A single text snap point: symbolic `kind`, world `point`, pre-rotation `localPoint`. */
export interface TextSnapGeometryPoint {
  readonly kind: TextSnapKind;
  readonly point: Point2D;
  readonly localPoint: Point2D;
}

/**
 * Pure geometric SSoT for the 10 text snap points (ADR-378 §Step 4).
 *
 * Entity-agnostic: takes the `insertion` anchor, `rotationRad`, and an ABSOLUTE
 * `bbox` (world coords, `x`/`y` = top-left). Every non-insertion point is rotated
 * about `insertion`. This is the ONE place the 10-point layout + rotation lives —
 * shared by `getTextSnapPoints` (scene entity + font-aware bbox) and the registry
 * `TextSnapEngine` (EntityModel + font-free estimated bbox, which passes an absolute
 * bbox anchored at the insertion point).
 */
export function computeTextSnapGeometry(
  insertion: Point2D,
  rotationRad: number,
  bbox: Rect,
): TextSnapGeometryPoint[] {
  const local = {
    'corner-tl': { x: bbox.x, y: bbox.y },
    'corner-tr': { x: bbox.x + bbox.width, y: bbox.y },
    'corner-bl': { x: bbox.x, y: bbox.y + bbox.height },
    'corner-br': { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
    center: { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 },
    'edge-top-mid': { x: bbox.x + bbox.width / 2, y: bbox.y },
    'edge-bottom-mid': { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height },
    'edge-left-mid': { x: bbox.x, y: bbox.y + bbox.height / 2 },
    'edge-right-mid': { x: bbox.x + bbox.width, y: bbox.y + bbox.height / 2 },
  } as const;

  const order: readonly TextSnapKind[] = [
    'insertion',
    'corner-tl',
    'corner-tr',
    'corner-bl',
    'corner-br',
    'center',
    'edge-top-mid',
    'edge-bottom-mid',
    'edge-left-mid',
    'edge-right-mid',
  ];

  return order.map<TextSnapGeometryPoint>((kind) => {
    const localPoint = kind === 'insertion' ? insertion : local[kind];
    const point = kind === 'insertion'
      ? insertion
      : rotateAround(localPoint, insertion, rotationRad);
    return { kind, point, localPoint };
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute the 10 snap points for `entity` given its precomputed `bbox`
 * (absolute world coords). Thin wrapper over `computeTextSnapGeometry` that
 * adds the snap type + description per kind.
 */
export function getTextSnapPoints(
  entity: DxfTextSceneEntity,
  bbox: Rect,
): TextSnapPoint[] {
  const rotationRad = degToRad(entity.textNode.rotation);
  return computeTextSnapGeometry(entity.position, rotationRad, bbox).map<TextSnapPoint>((g) => ({
    kind: g.kind,
    point: g.point,
    localPoint: g.localPoint,
    snapType: snapTypeFor(g.kind),
    description: descriptionFor(g.kind, entity.type),
  }));
}

/**
 * Convert TextSnapPoint[] to the canonical SnapCandidate[] shape used by
 * the global snap pipeline. `cursor` is the world-space cursor position
 * used to compute per-candidate distances.
 */
export function toSnapCandidates(
  points: readonly TextSnapPoint[],
  cursor: Point2D,
  entityId: string,
): SnapCandidate[] {
  return points.map((p) => ({
    point: p.point,
    type: p.snapType,
    description: p.description,
    distance: Math.hypot(p.point.x - cursor.x, p.point.y - cursor.y),
    priority: priorityFor(p.kind),
    entityId,
  }));
}

function priorityFor(kind: TextSnapKind): number {
  switch (kind) {
    case 'insertion':
      return SNAP_ENGINE_PRIORITIES.INSERTION;
    case 'center':
      return SNAP_ENGINE_PRIORITIES.CENTER;
    case 'edge-top-mid':
    case 'edge-bottom-mid':
    case 'edge-left-mid':
    case 'edge-right-mid':
      return SNAP_ENGINE_PRIORITIES.MIDPOINT;
    default:
      return SNAP_ENGINE_PRIORITIES.ENDPOINT;
  }
}
