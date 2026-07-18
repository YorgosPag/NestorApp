/**
 * ADR-513 §grip-parity — vertex/edge RESHAPE → click-move-click hot-grip entry SSoT resolver.
 *
 * Extends the plain-line endpoint click-move-click flow (`line-endpoint-hotgrip.ts`) to EVERY
 * reshape vertex the user can grab: an ARC start/end endpoint and a POLYLINE vertex OR straight
 * edge-midpoint (a scene RECTANGLE is a projected polyline, so its corner + side grips flow through
 * here too — Giorgio 2026-07-18 «όλες οι vertex λαβές»). Reuses the SAME `wall-hot-grip-fsm` op
 * `'endpoint-stretch'` (terminal `tracking`, 2-click) — no new FSM, no new commit path.
 *
 * With Dynamic Input ON: click the grip (release the button) → it goes HOT (red), the vertex (corner)
 * OR both edge vertices (whole side) follow the cursor button-free, click a «Μήκος»/«Γωνία» wedge,
 * type, then click the canvas to place — OR just click the canvas to drop it there. With Dynamic Input
 * OFF the grip keeps its press-drag path (the caller gates on `cadToggleState.isDynInputOn()` — kept
 * out of here so the resolver stays a pure geometry/kind gate).
 *
 * LINE endpoints are intentionally NOT handled here — they already have their own entry
 * (`resolveLineEndpointHotGrip`) + their own «set line length» typed semantics; this resolver adds
 * ONLY arc + polyline (displacement semantics), so the two gates never double-fire.
 *
 * @see hooks/grips/line-endpoint-hotgrip.ts — the sibling line-endpoint resolver (mirrored)
 * @see hooks/grips/wall-hot-grip-fsm.ts — `'endpoint-stretch'` op (terminal `tracking`)
 * @see systems/dynamic-input/vertex-reshape-lock.ts — the displacement (Model A) lock applied at ghost+commit
 * @see docs/centralized-systems/reference/adrs/ADR-513-radial-command-ring.md §grip-parity
 */

import type { UnifiedGripInfo } from './unified-grip-types';
import { gripKindOf } from '../grip-kinds';

/**
 * Minimal structural view of a grabbed grip + its entity — shared by the entry resolver AND the
 * ghost/commit displacement lock so «which grips are click-armed vertex reshapes» lives in ONE place.
 */
export interface VertexReshapeView {
  /** The RAW scene entity discriminator (grip-mouse-handlers/commit read the raw entity → `'rectangle'`
   *  for a drawn rectangle; the ghost reads the normalized `'polyline'` — both accepted). */
  readonly entityType: string | undefined;
  readonly gripIndex: number | undefined;
  readonly movesEntity: boolean | undefined;
  /** `gripKindOf(grip, 'polyline')` — present for polyline/rectangle grips, `null` for arc/line. */
  readonly polylineKind: string | null;
  /** `grip.type === 'edge'` OR `edgeVertexIndices` present (a straight side-midpoint grip). */
  readonly isEdge: boolean;
}

/**
 * The ONE predicate: is this grip a click-armed vertex/edge RESHAPE (arc endpoint OR polyline
 * vertex/straight-edge, incl. a projected rectangle)? Excludes: whole-entity move/rotation gizmo
 * (`movesEntity` / `*-move` / `*-rotation`), the polyline ARC-apex curvature grip
 * (`polyline-arc-midpoint-*`, its own bulge commit), and LINE (own line-endpoint entry).
 */
export function isVertexReshapeGrip(v: VertexReshapeView): boolean {
  if (v.movesEntity === true) return false;
  // ARC start/end endpoints carry no grip kind → gate on entity type + index (1=start, 2=end).
  if (v.entityType === 'arc') return !v.isEdge && (v.gripIndex === 1 || v.gripIndex === 2);
  // POLYLINE family (incl. a projected rectangle/rect): a vertex OR a STRAIGHT segment midpoint.
  if (
    v.entityType === 'polyline' || v.entityType === 'lwpolyline' ||
    v.entityType === 'rectangle' || v.entityType === 'rect'
  ) {
    const k = v.polylineKind;
    if (!k) return false;
    return k.startsWith('polyline-vertex-') || k.startsWith('polyline-segment-midpoint-');
  }
  return false;
}

/** Minimal structural view of the grabbed entity — keeps the resolver decoupled + pure. */
interface VertexReshapeEntity {
  readonly type?: string;
}

/**
 * Decide whether pressing `grip` (belonging to `entity`) should start the ARC/POLYLINE vertex-reshape
 * click-move-click hot-grip. Returns `false` when it does not qualify (caller keeps press-drag). The
 * Dynamic-Input toggle is checked by the caller (this stays a pure geometry/kind gate).
 */
export function resolveVertexReshapeHotGrip(
  entity: VertexReshapeEntity | null | undefined,
  grip: UnifiedGripInfo | null | undefined,
): boolean {
  if (!entity || !grip) return false;
  if (grip.source !== 'dxf') return false;
  return isVertexReshapeGrip({
    entityType: entity.type,
    gripIndex: grip.gripIndex,
    movesEntity: grip.movesEntity,
    polylineKind: gripKindOf(grip, 'polyline'),
    isEdge: grip.type === 'edge' || grip.edgeVertexIndices != null,
  });
}
