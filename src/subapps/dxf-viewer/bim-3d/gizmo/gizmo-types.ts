/**
 * gizmo-types.ts — gizmo handle taxonomy + constraint derivation.
 *
 * PORTED from GenArc ADR-022 (Gizmo System) — pure types/functions.
 * @related ADR-402 (3D Viewport BIM Element Editing) — GenArc gizmo port.
 */

/** A single world axis. */
export type GizmoAxis = 'x' | 'y' | 'z';
export type GizmoResizeMode = 'normal' | 'mirror';
export type GizmoRotateSpace = 'global' | 'local';

/** A pair of axes defining a plane. */
export type GizmoPlane = 'xy' | 'xz' | 'yz';

/** Which end of a linear element an endpoint handle drives (ADR-408 Φ-D). */
export type GizmoEndpoint = 'start' | 'end';

/** Discriminated union describing which gizmo handle is active. */
export type GizmoHandle =
  | { readonly kind: 'axis';   readonly axis: GizmoAxis }
  | { readonly kind: 'plane';  readonly plane: GizmoPlane }
  | { readonly kind: 'center' }
  | { readonly kind: 'rotate'; readonly axis: GizmoAxis }
  | { readonly kind: 'resize'; readonly axis: GizmoAxis; readonly mode: GizmoResizeMode }
  // ADR-408 Φ-D — per-endpoint shape handle (drag ONE end of a linear MEP segment).
  | { readonly kind: 'endpoint'; readonly endpoint: GizmoEndpoint };

/** Flat string identifier for each individual gizmo handle (used as mesh userData key). */
export type GizmoHandleId =
  | 'axis-x' | 'axis-y' | 'axis-z'
  | 'plane-xy' | 'plane-xz' | 'plane-yz'
  | 'center'
  | 'rotate-x' | 'rotate-y' | 'rotate-z'
  | 'resize-x' | 'resize-y' | 'resize-z'
  | 'resize-m-x' | 'resize-m-y' | 'resize-m-z'
  // ADR-408 Φ-D — endpoint shape handles (start/end of a linear MEP segment).
  | 'endpoint-start' | 'endpoint-end';

/** Hover state broadcast for cursor feedback. */
export interface GizmoHoverState {
  readonly handleId: GizmoHandleId;
}

/** Constraint applied during a gizmo drag operation. */
export type GizmoDragConstraint =
  | { readonly kind: 'axis';   readonly axis: GizmoAxis }
  | { readonly kind: 'plane';  readonly plane: GizmoPlane }
  | { readonly kind: 'free' }
  | { readonly kind: 'rotate'; readonly axis: GizmoAxis }
  | { readonly kind: 'resize'; readonly axis: GizmoAxis; readonly mode: GizmoResizeMode }
  // ADR-408 Φ-D — constrained translation of ONE endpoint (camera-facing plane drag).
  | { readonly kind: 'endpoint'; readonly endpoint: GizmoEndpoint };

/** Map from GizmoHandleId to the parsed GizmoHandle union. */
export function parseHandleId(id: GizmoHandleId): GizmoHandle {
  if (id === 'center')              return { kind: 'center' };
  if (id.startsWith('endpoint-'))   return { kind: 'endpoint', endpoint: id.slice(9) as GizmoEndpoint };
  if (id.startsWith('rotate-'))     return { kind: 'rotate', axis: id.slice(7) as GizmoAxis };
  if (id.startsWith('resize-m-'))   return { kind: 'resize', axis: id.slice(9) as GizmoAxis, mode: 'mirror' };
  if (id.startsWith('resize-'))     return { kind: 'resize', axis: id.slice(7) as GizmoAxis, mode: 'normal' };
  if (id.startsWith('axis-'))       return { kind: 'axis',   axis: id.slice(5) as GizmoAxis };
  return { kind: 'plane', plane: id.slice(6) as GizmoPlane };
}

/** Derive the drag constraint from a GizmoHandle. */
export function handleToConstraint(handle: GizmoHandle): GizmoDragConstraint {
  switch (handle.kind) {
    case 'axis':     return { kind: 'axis',   axis: handle.axis };
    case 'plane':    return { kind: 'plane',  plane: handle.plane };
    case 'center':   return { kind: 'free' };
    case 'rotate':   return { kind: 'rotate', axis: handle.axis };
    case 'resize':   return { kind: 'resize', axis: handle.axis, mode: handle.mode };
    case 'endpoint': return { kind: 'endpoint', endpoint: handle.endpoint };
  }
}
