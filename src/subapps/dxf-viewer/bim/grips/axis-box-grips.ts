/**
 * ADR-363 / ADR-436 — Axis-anchored rotatable-box grip SSoT.
 *
 * The AXIS-anchored consumer of the rotated-rectangle grip SSoT, shared by every
 * LINEAR BIM element whose footprint is a **centre-axis rectangle** defined by an
 * axis (`start`,`end`) + a perpendicular `width`: wall (straight), beam (straight),
 * foundation strip / tie-beam (3 entities). Sibling of `centred-box-grips.ts` (the
 * CENTRE-anchored consumer used by mep-fixture / panel / furniture …). Each entity
 * consumes it through a thin role→kind adapter (N.0.2 Boy-Scout de-duplication —
 * Giorgio 2026-06-11 «παντού ίδιος κώδικας, μηδέν διπλότυπα, 7 λαβές σε τοίχο/δοκό/
 * πεδιλοδοκό»).
 *
 * SSoT layering: the corner/edge GEOMETRY (`rect-frame`) + opposite-element-fixed
 * RESIZE math (`rect-grip-engine`) are the SAME entity-agnostic core the centred
 * box / pad / column use. This module adds ONLY the axis ⇄ `RectFrame` mapping
 * (centre = axis midpoint, local +X = axis direction, local +Y = +perp, halfWidth
 * = ½ axis length, halfLength = width/2 scene) + the 7 grip ROLES + the axis
 * ROTATION transform (anchor-relative swept angle, shared `rotateAxisPointsAboutPivot`).
 *
 * 7-grip layout (Revit/AutoCAD shape-handle parity, mirror straight wall):
 *   - `width-edge`         → resize `width` perpendicular to axis (opposite face fixed).
 *   - `length-edge`        → resize length along axis at the END short edge (start fixed).
 *   - `corner-{start,end}-{pos,neg}` → 2-DOF corner (opposite corner fixed): axial
 *     component changes length on that end, perpendicular grows that side's width.
 *   - `rotation`           → rotate the whole element about its midpoint / a picked pivot.
 *
 * What stays per-entity (NOT here):
 *   - the entity-specific grip-kind STRINGS (`'beam-corner-end-pos'` vs
 *     `'wall-corner-end-pos'`) — they must match the discriminator unions + glyph /
 *     hot-grip / commit registries, so each caller maps role↔kind.
 *   - entity semantics layered on the `{start,end,width}` patch: wall `flip` /
 *     miter clearing / `dna` drop / thickness clamp; beam `depth` / `curveControl`
 *     pass-through; foundation `width` clamp. The caller spreads the patch over its
 *     full params and recomputes geometry at commit time.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. ALL rotation math is
 * the shared SSoT (`rotateAxisPointsAboutPivot` → `sweptAngleDegAboutPivot` +
 * canonical `rotatePoint`, ADR-188) — NO re-implemented cos/sin. `start`/`end` are
 * in scene units (the axis points); `width` is mm, so the perpendicular half-extent
 * scales by `mmScaleFor(params)`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 1C / 5.5
 * @see bim/grips/rect-grip-engine.ts — shared corner/edge SSoT
 * @see bim/grips/centred-box-grips.ts — the centre-anchored sibling consumer
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import { mmScaleFor } from '../../utils/scene-units';
import type { RectFrame, RectCorner, RectSign, RectEdge } from './rect-frame';
import { rectCornerWorld, rectEdgeWorld, rectLocalWorld } from './rect-frame';
import {
  applyRectCornerDrag,
  applyRectEdgeDrag,
  type RectResizeLimits,
} from './rect-grip-engine';
import { rotateAxisPointsAboutPivot } from './grip-math';
import { ROTATION_HANDLE_OFFSET_MM, rotationHandlePerpOffset, rotationHandleMidwayOffset, rotationHandleAxialEastSign } from './rotation-handle-policy';

const DEG_PER_RAD = 180 / Math.PI;

/**
 * Entity-agnostic grip role of an axis-anchored box. Each consuming entity maps
 * these to/from its own grip-kind strings. `pos`/`neg` = +perp / −perp face;
 * `start`/`end` = the corner's nearest axis endpoint.
 */
export type AxisBoxGripRole =
  | 'corner-start-pos'
  | 'corner-start-neg'
  | 'corner-end-pos'
  | 'corner-end-neg'
  | 'width-edge'
  | 'length-edge'
  // Opt-in extra mid-edge handles (Giorgio 2026-06-20 «4 μεσοπλευρικές, parity κολόνας»),
  // emitted only when `getAxisBoxGrips(params, { extraMidEdges: true })`. They are the
  // OPPOSITE faces of the two standard edge handles, so ALL 4 faces carry a midpoint grip:
  //   · `width-edge-far`     → the −`widthFaceSign` perp face (opposite of `width-edge`).
  //   · `length-edge-start`  → the START short edge (opposite of the END `length-edge`).
  // Consumed by wall + beam; foundation stays at the 7-grip default.
  | 'width-edge-far'
  | 'length-edge-start'
  | 'rotation';

/** `corner-*` role → local-axis signs (local +X = axis start→end, +Y = +perp). */
const AXIS_BOX_CORNER_MAP: Readonly<Record<string, RectCorner>> = {
  'corner-end-pos': { sx: 1, sy: 1 },
  'corner-start-pos': { sx: -1, sy: 1 },
  'corner-start-neg': { sx: -1, sy: -1 },
  'corner-end-neg': { sx: 1, sy: -1 },
};

/**
 * The minimal axis-box parameters this SSoT reads. `WallParams` (start/end/thickness
 * via a `width` alias), `BeamParams` (startPoint/endPoint) and the strip/tie-beam
 * foundation params each map their fields into this shape in their thin adapter.
 */
export interface AxisBoxParams {
  readonly start: { readonly x: number; readonly y: number; readonly z?: number };
  readonly end: { readonly x: number; readonly y: number; readonly z?: number };
  /** mm. Footprint extent perpendicular to the axis. */
  readonly width: number;
  /** DXF canvas coordinate unit (mm scalars → canvas units). Defaults to `'mm'`. */
  readonly sceneUnits?: SceneUnits;
  /**
   * Which perpendicular face the `width-edge` + `rotation` handles sit on:
   * `+1` = +perp (default), `-1` = −perp (wall `flip`). The corners are always
   * emitted on both faces, so only the two single-handle grips read this.
   */
  readonly widthFaceSign?: RectSign;
}

/** One emitted grip (role-tagged). The caller wraps it into its own `GripInfo`. */
export interface AxisBoxGrip {
  readonly role: AxisBoxGripRole;
  readonly type: 'vertex' | 'edge';
  readonly position: Point2D;
}

/**
 * The mutated axis fields produced by a grip drag. The caller spreads this over
 * its full params (`{ ...originalParams, start, end, width }`, remapping field
 * names where needed). `null` → no-op (the caller returns `originalParams`
 * referentially unchanged so the commit can short-circuit).
 */
export interface AxisBoxPatch {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly width: number;
}

export interface AxisBoxGripDragInput {
  readonly originalParams: AxisBoxParams;
  /** World-space delta from the grip anchor to the current cursor position. */
  readonly delta: Point2D;
  /** mm — minimum footprint width; corner/edge resize clamps to this. */
  readonly minWidthMm: number;
  /**
   * World cursor position (= grip anchor + `delta`). Required only by the
   * `rotation` role (anchor-relative swept angle); other roles ignore it.
   */
  readonly currentPos?: Point2D;
  /**
   * Rotation pivot for the `rotation` role (AutoCAD ROTATE→Reference 6-click flow).
   * When set the element rotates around this picked centre; absent → axis midpoint.
   */
  readonly pivot?: Point2D;
}

// ─── Axis ⇄ RectFrame mapping (the ONLY axis-specific geometry, shared by all 3) ──

/** Axis midpoint (scene units) of the element. */
function axisMidpoint(params: AxisBoxParams): Point2D {
  return {
    x: (params.start.x + params.end.x) / 2,
    y: (params.start.y + params.end.y) / 2,
  };
}

/**
 * Axis params → centre-axis `RectFrame` (scene units). `local +X` = axis direction
 * (start→end) so `halfWidth` = ½ axis length; `local +Y` = +perp so `halfLength` =
 * width/2 (mm → scene). Generalises the former `wallToRectFrame` (thickness → width).
 */
export function axisToRectFrame(params: AxisBoxParams): RectFrame {
  const dx = params.end.x - params.start.x;
  const dy = params.end.y - params.start.y;
  const len = Math.hypot(dx, dy);
  const s = mmScaleFor(params);
  return {
    center: axisMidpoint(params),
    rotationDeg: Math.atan2(dy, dx) * DEG_PER_RAD,
    halfWidth: len / 2,
    halfLength: (params.width * s) / 2,
  };
}

/**
 * `RectFrame` (post-resize) → axis fields: rebuild `start`/`end` from the new
 * centre ± ½ length along the axis direction, derive `width` from the perpendicular
 * half-extent (scene → mm). Inverse of `axisToRectFrame`. Entity-specific clamps /
 * flip / miter semantics are layered by the caller.
 */
export function rectFrameToAxis(frame: RectFrame, sceneUnits?: SceneUnits): AxisBoxPatch {
  const s = mmScaleFor({ sceneUnits });
  const rad = frame.rotationDeg / DEG_PER_RAD;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const hw = frame.halfWidth;
  return {
    start: { x: frame.center.x - hw * ux, y: frame.center.y - hw * uy },
    end: { x: frame.center.x + hw * ux, y: frame.center.y + hw * uy },
    width: (frame.halfLength * 2) / s,
  };
}

/** Min half-extents (scene units) for the engine clamp = `minWidthMm`. */
function axisBoxResizeLimits(params: AxisBoxParams, minWidthMm: number): RectResizeLimits {
  const half = (minWidthMm * mmScaleFor(params)) / 2;
  return { minHalfWidth: half, minHalfLength: half };
}

/**
 * The 4 EDGE roles → their `RectEdge` (axis + sign), honouring `widthFaceSign` for
 * the two width faces. The single SSoT consumed by BOTH grip emission and the drag,
 * so the opposite-face sign logic lives in exactly one place (no per-entity copy —
 * replaces the former `applyBeamExtraEdgeGrip` / `applyWallExtraEdgeGrip` sign maps).
 * Corner / rotation roles → `null`.
 */
function axisBoxEdgeForRole(role: AxisBoxGripRole, faceSign: RectSign): RectEdge | null {
  const farSign: RectSign = faceSign === 1 ? -1 : 1;
  switch (role) {
    case 'width-edge': return { axis: 'y', sign: faceSign };
    case 'width-edge-far': return { axis: 'y', sign: farSign };
    case 'length-edge': return { axis: 'x', sign: 1 };
    case 'length-edge-start': return { axis: 'x', sign: -1 };
    default: return null;
  }
}

/**
 * Resize ONE rectangle edge (opposite edge fixed) → axis patch. Opposite-element-fixed
 * math + clamp live here in exactly one place; consumed by `applyAxisBoxGripDrag` for
 * every edge role (standard width/length + the opt-in `width-edge-far`/`length-edge-start`).
 */
function applyAxisBoxEdgeDrag(
  params: AxisBoxParams,
  edge: RectEdge,
  delta: Point2D,
  minWidthMm: number,
): AxisBoxPatch {
  return rectFrameToAxis(
    applyRectEdgeDrag(axisToRectFrame(params), edge, delta, axisBoxResizeLimits(params, minWidthMm)),
    params.sceneUnits,
  );
}

/**
 * ADR-363 Slice F — the `'axis-quarter'` rotation-handle world position for a
 * centre-axis `RectFrame`: ON the longitudinal centreline (perp = 0), at ¼ of the
 * axis length toward the EAST-most end (the midpoint between the centre and the
 * east end-face midpoint). The ONE source for this placement — consumed by both
 * `getAxisBoxGrips` (straight wall) AND the plain DXF line rotation grip
 * (`systems/line/line-rotation-grip.ts`), so the wall and the line can never
 * diverge. `frame.halfWidth` = ½ axis length, so `halfWidth / 2` = ¼ length;
 * `rotationHandleAxialEastSign` (the shared policy SSoT) picks the east end.
 */
export function axisQuarterRotationHandleWorld(frame: RectFrame): Point2D {
  return rectLocalWorld(frame, rotationHandleAxialEastSign(frame.rotationDeg) * (frame.halfWidth / 2), 0);
}

// ─── Grip emission ───────────────────────────────────────────────────────────

/**
 * Compute the 7 role-tagged grips of an axis-anchored box. Stable order mirrors
 * the straight wall (`getWallGrips` gripIndex 3..9): width edge, length edge, the
 * four corners (start-pos, start-neg, end-pos, end-neg), rotation. The `width-edge`
 * handle sits on the `widthFaceSign` perp face midpoint; the `rotation` handle stands
 * off the OPPOSITE perp face (shared `rotation-handle-policy` SSoT — never coincident
 * with the width/thickness handle, Revit-style); the corners on both faces.
 *
 * Skips everything on a degenerate axis (`start === end`) — there is no footprint.
 */
export function getAxisBoxGrips(
  params: AxisBoxParams,
  opts: {
    readonly extraMidEdges?: boolean;
    /**
     * Rotation-handle placement policy (shared `rotation-handle-policy` SSoT):
     *   · `'opposite-face'` (default — wall / foundation strip parity): stands ON
     *     the perp face OPPOSITE the `width-edge` dimension handle.
     *   · `'midway-center'` (opt-in — beam, Giorgio 2026-06-26): sits at the
     *     MIDPOINT of the segment centre→opposite-face = −¼ of the perpendicular
     *     extent, mirroring the rectangular COLUMN rotation handle so move-cross /
     *     dimension handle / rotation are cleanly distributed (column parity).
     *   · `'axis-quarter'` (opt-in — wall, Giorgio 2026-06-30): on the LONGITUDINAL
     *     centreline (perp = 0), at ¼ of the axis length toward the EAST-most end —
     *     i.e. the midpoint between the centre and the east end-face midpoint. Moves
     *     the handle off the long-side edge midpoint it used to overlap.
     */
    readonly rotationPlacement?: 'opposite-face' | 'midway-center' | 'axis-quarter';
  } = {},
): AxisBoxGrip[] {
  const dx = params.end.x - params.start.x;
  const dy = params.end.y - params.start.y;
  if (Math.hypot(dx, dy) < 1e-6) return [];

  const frame = axisToRectFrame(params);
  const faceSign: RectSign = params.widthFaceSign ?? 1;
  // Edge positions via the shared role→edge SSoT (honours `widthFaceSign`).
  const edgePos = (role: AxisBoxGripRole): Point2D =>
    rectEdgeWorld(frame, axisBoxEdgeForRole(role, faceSign)!);
  // Rotation handle via the shared rotation-handle policy SSoT. Two placements,
  // both on the perp face OPPOSITE the `width-edge` (never coincident with the
  // dimension handle — Revit rule):
  //   · 'opposite-face' (default) → ON the opposite face (`rotationHandlePerpOffset`);
  //     offset is mm → scaled to scene units to match `frame.halfLength` (also scene).
  //   · 'midway-center' → at −¼ of the perpendicular extent (column parity); the
  //     policy returns the −Y midway offset, `faceSign` flips it to the opposite
  //     face when the element is flipped. `frame.halfLength*2` = full perp extent.
  // 'axis-quarter' (wall) → ON the centreline (perp = 0), at ¼ axis length toward the
  // east-most end. The other two placements keep perp = the policy offset at x = 0.
  const rotationPos = opts.rotationPlacement === 'axis-quarter'
    ? axisQuarterRotationHandleWorld(frame)
    : rectLocalWorld(
        frame,
        0,
        opts.rotationPlacement === 'midway-center'
          ? faceSign * rotationHandleMidwayOffset(frame.halfLength * 2)
          : rotationHandlePerpOffset(
              frame.halfLength,
              faceSign,
              ROTATION_HANDLE_OFFSET_MM * mmScaleFor(params),
            ),
      );

  const grips: AxisBoxGrip[] = [
    // width edge (perpendicular dimension, `widthFaceSign` face midpoint)
    { role: 'width-edge', type: 'edge', position: edgePos('width-edge') },
    // length edge (axial dimension, END short edge midpoint)
    { role: 'length-edge', type: 'edge', position: edgePos('length-edge') },
    // four corners
    { role: 'corner-start-pos', type: 'vertex', position: rectCornerWorld(frame, AXIS_BOX_CORNER_MAP['corner-start-pos']) },
    { role: 'corner-start-neg', type: 'vertex', position: rectCornerWorld(frame, AXIS_BOX_CORNER_MAP['corner-start-neg']) },
    { role: 'corner-end-pos', type: 'vertex', position: rectCornerWorld(frame, AXIS_BOX_CORNER_MAP['corner-end-pos']) },
    { role: 'corner-end-neg', type: 'vertex', position: rectCornerWorld(frame, AXIS_BOX_CORNER_MAP['corner-end-neg']) },
    // rotation handle — on the OPPOSITE perp face midpoint (clean separation from
    // width-edge; the drag is anchor-relative swept angle, so position is click-target only)
    { role: 'rotation', type: 'vertex', position: rotationPos },
  ];

  // Opt-in column-parity extras (Giorgio 2026-06-20): the 2 OPPOSITE mid-edges so all
  // 4 faces carry a midpoint handle. Appended AFTER the 7 standard grips so existing
  // `gripIndex` order stays stable (consumers map array index → grip-kind).
  if (opts.extraMidEdges) {
    grips.push({ role: 'width-edge-far', type: 'edge', position: edgePos('width-edge-far') });
    grips.push({ role: 'length-edge-start', type: 'edge', position: edgePos('length-edge-start') });
  }

  return grips;
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

/**
 * Pure transform: axis-box grip role + drag input → mutated axis fields
 * (`AxisBoxPatch`), or `null` for a no-op (zero delta / degenerate / unknown role).
 *
 * Corner / edge → shared `rect-grip-engine` (opposite-element-fixed) then back to
 * axis via `rectFrameToAxis`. Rotation → anchor-relative swept angle about the
 * pivot / midpoint via the shared `rotateAxisPointsAboutPivot` SSoT (NEVER raw
 * cos/sin). The caller spreads the patch over its full params + recomputes geometry.
 */
export function applyAxisBoxGripDrag(
  role: AxisBoxGripRole,
  input: Readonly<AxisBoxGripDragInput>,
): AxisBoxPatch | null {
  if (input.delta.x === 0 && input.delta.y === 0) return null;
  const { originalParams: p, delta } = input;

  if (role === 'rotation') {
    if (!input.currentPos) return null;
    const centre: Point2D = input.pivot ?? axisMidpoint(p);
    const anchor: Point2D = { x: input.currentPos.x - delta.x, y: input.currentPos.y - delta.y };
    const rotated = rotateAxisPointsAboutPivot(
      [{ x: p.start.x, y: p.start.y }, { x: p.end.x, y: p.end.y }],
      { pivot: centre, anchor, currentPos: input.currentPos },
    );
    if (!rotated) return null;
    return { start: rotated[0], end: rotated[1], width: p.width };
  }

  const corner = AXIS_BOX_CORNER_MAP[role];
  if (corner) {
    return rectFrameToAxis(
      applyRectCornerDrag(axisToRectFrame(p), corner, delta, axisBoxResizeLimits(p, input.minWidthMm)),
      p.sceneUnits,
    );
  }
  // All 4 edge roles (standard `width-edge`/`length-edge` + opt-in `width-edge-far`/
  // `length-edge-start`) → the shared edge SSoT (opposite-element-fixed), same code.
  const faceSign: RectSign = p.widthFaceSign ?? 1;
  const edge = axisBoxEdgeForRole(role, faceSign);
  if (edge) {
    return applyAxisBoxEdgeDrag(p, edge, delta, input.minWidthMm);
  }
  return null;
}

/**
 * Build the inverse `kind → role` lookup from a consumer's `role → kind` map, so
 * each entity declares the mapping ONCE (no hand-written, drift-prone inverse).
 * The `rotation` role is intentionally included; consumers that handle rotation
 * bespoke (e.g. the wall) just omit that kind from their drag dispatch.
 */
export function invertAxisBoxRoleMap<K extends string>(
  roleToKind: Readonly<Record<AxisBoxGripRole, K>>,
): Partial<Record<K, AxisBoxGripRole>> {
  const out: Partial<Record<K, AxisBoxGripRole>> = {};
  (Object.keys(roleToKind) as AxisBoxGripRole[]).forEach((role) => {
    out[roleToKind[role]] = role;
  });
  return out;
}
