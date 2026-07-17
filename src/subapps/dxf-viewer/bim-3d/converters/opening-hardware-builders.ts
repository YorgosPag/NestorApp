/**
 * Parametric 3D opening HARDWARE builders (ADR-672 §8 Α — χειρολαβή/μηχανισμός).
 *
 * Sibling of `opening-mesh-builders.ts`: given the same κάσα-local dims, returns
 * the `BoxSpec[]` for an opening's operable hardware (door lever + rose, sliding
 * pull bar, bi-fold knob, operable-window handle). Pure / side-effect free — the
 * caller (`opening-mesh.ts`) applies basis + placement and stamps the resolved
 * `hardware` material id (`matId`) exactly like the frame/leaf/glass sub-meshes.
 *
 * The hardware material is resolved by `resolveOpeningMaterial().hardware`
 * (default `mat-metal`). ADR-672 §8 drew a bare rose + lever; the 2026-07-18 3D
 * follow-up (Giorgio φωτο) upgrades doors/windows to a real espagnolette/mortise
 * assembly at the same box fidelity as the leaf/frame: a vertical BACKPLATE, a
 * NECK (λαιμός/άξονας) bridging it to the offset lever, a LOCK cylinder (doors), a
 * through SPINDLE joining both faces (doors), and edge HINGES (μεντεσέδες) on the
 * hinge side for every hinged family (SSoT-gated by the take-off catalog). Latch
 * side follows `params.handing` (door-only); families with no user-operable handle
 * (fixed / bay / overhead sectional / revolving) return [].
 *
 * Local coords (identical to `opening-mesh-builders.ts`): +X = host axis,
 * +Y = up, +Z = perp/depth. Handles sit on BOTH leaf faces for doors (interior +
 * exterior), interior face only for windows.
 *
 * @see ./opening-mesh-builders.ts — the leaf/panel sibling + `LEAF_DEPTH_RATIO`
 * @see ../../bim/family-types/resolve-opening-material.ts — resolves `hardware`
 */

import * as THREE from 'three';
import type { OpeningEntity } from '../../bim/types/opening-types';
import {
  isHingedKind,
  isDoubleLeafKind,
  isSlidingKind,
  isFoldingKind,
  isWindowKind,
} from '../../bim/types/opening-types';
import { OPENING_HARDWARE_CATALOG, openingHasOperableHardware } from '../../bim/family-types/opening-hardware-set';
import type { BoxSpec, LeafDims } from './opening-mesh-builders';
import { LEAF_DEPTH_RATIO, openingInnerDims } from './opening-mesh-builders';

const MM_TO_M = 0.001;

// ─── Handle dimensions (mm → m), schematic (Revit symbolic hardware) ──────────
/** Door lever centre height from floor (industry standard ≈ 1050 mm). */
const HANDLE_HEIGHT_M = 1050 * MM_TO_M;
/** Lever bar: length (along host axis) × thickness (vertical) × depth. */
const LEVER_LEN_M = 130 * MM_TO_M;
const LEVER_THICK_M = 24 * MM_TO_M;
const LEVER_BAR_DEPTH_M = 26 * MM_TO_M;
/** Stand-off of the lever bar from the leaf face (bridged by the neck). */
const LEVER_STANDOFF_M = 55 * MM_TO_M;
/** Vertical handle backplate (espagnolette/mortise plate) — W × H × depth vs the leaf face. */
const BACKPLATE_W_M = 36 * MM_TO_M;
const BACKPLATE_H_M = 110 * MM_TO_M; // «ύψος 10-11cm» (Giorgio 2026-07-18 φωτο)
const BACKPLATE_DEPTH_M = 10 * MM_TO_M;
/** Neck (λαιμός/άξονας): square stub bridging the backplate to the offset lever bar. */
const NECK_M = 20 * MM_TO_M;
/** Euro-profile lock cylinder (αφαλός) below the lever, on the plate — body + keyway. */
const LOCK_DROP_M = 46 * MM_TO_M;
const LOCK_W_M = 30 * MM_TO_M;
const LOCK_H_M = 32 * MM_TO_M;
const LOCK_PROJ_M = 8 * MM_TO_M;
const KEYWAY_W_M = 12 * MM_TO_M;
const KEYWAY_H_M = 16 * MM_TO_M;
/** Through spindle (διαμπερής άξονας) square cross-section — joins both leaf faces. */
const SPINDLE_M = 9 * MM_TO_M;
/** Hinge (μεντεσές) barrel: edge projection (host axis) × height × depth (perp). */
const HINGE_W_M = 16 * MM_TO_M;
const HINGE_H_M = 100 * MM_TO_M;
const HINGE_DEPTH_M = 42 * MM_TO_M;
/** Top/bottom hinge offset from the leaf mid-height, as a fraction of the clear height. */
const HINGE_Y_SPREAD = 0.4;
/** Inset of the handle centre from the latch edge, inward toward the leaf body. */
const EDGE_INSET_M = 60 * MM_TO_M;
/** Double-leaf: handle inset from the central meeting stile (either side). */
const MEETING_INSET_M = 55 * MM_TO_M;

/** Sliding pull bar: width × depth, height as a fraction of the clear opening. */
const SLIDE_BAR_W_M = 42 * MM_TO_M;
const SLIDE_BAR_DEPTH_M = 30 * MM_TO_M;
const SLIDE_BAR_H_RATIO = 0.5;
const SLIDE_EDGE_INSET_M = 95 * MM_TO_M;

/** Bi-fold / flush knob square + depth. */
const KNOB_M = 46 * MM_TO_M;
const KNOB_DEPTH_M = 34 * MM_TO_M;

/** Operable-window handle: shorter lever, seated lower on the sash. */
const WIN_LEVER_LEN_M = 90 * MM_TO_M;
const WIN_HANDLE_Y_RATIO = 0.28;

interface HardwareCtx {
  readonly innerW: number;
  readonly innerH: number;
  readonly cyMid: number;
  readonly leafDepth: number;
  /** +1 → latch on +X edge, -1 → latch on -X edge (from `handing`). */
  readonly latchSign: number;
  readonly mat: THREE.Material;
}

/**
 * Build the hardware box specs for an opening (dispatch by family). Returns []
 * for degenerate leaves and for kinds with no user-operable handle.
 */
export function buildHardwareSpecs(
  opening: OpeningEntity,
  dims: LeafDims,
  hardwareMat: THREE.Material,
): BoxSpec[] {
  // SSoT parity guard (ADR-674): the take-off catalog decides which kinds carry
  // operable hardware — the geometry side draws a handle for EXACTLY those kinds,
  // so the two sides can never drift (empty for fixed/bay/overhead/revolving).
  if (!openingHasOperableHardware(opening.kind)) return [];
  const inner = openingInnerDims(dims);
  if (!inner) return [];
  const { innerW, innerH } = inner;
  const handing = opening.params.handing;
  const ctx: HardwareCtx = {
    innerW,
    innerH,
    cyMid: dims.sillM + dims.heightM / 2,
    leafDepth: Math.max(dims.thicknessW * LEAF_DEPTH_RATIO, 1e-4),
    // Hinge on `handing` side → latch on the opposite edge. Default (undefined) → +X.
    latchSign: handing === 'right' ? -1 : 1,
    mat: hardwareMat,
  };
  const { kind } = opening;
  if (isDoubleLeafKind(kind)) return doubleSwingHardware(ctx);
  if (isHingedKind(kind)) return singleSwingHardware(ctx);
  if (isSlidingKind(kind)) return slidingHardware(ctx);
  if (isFoldingKind(kind)) return foldingHardware(ctx);
  if (isWindowKind(kind)) return windowHardware(kind, ctx);
  return [];
}

/** TRUE iff the kind's take-off set carries hinges — the SSoT gate for hinge geometry. */
function kindHasHinges(kind: OpeningEntity['kind']): boolean {
  return OPENING_HARDWARE_CATALOG[kind].some((entry) => entry.component === 'hinge');
}

/**
 * A full lever handle assembly on ONE face of a leaf — a real espagnolette/mortise
 * handle (Giorgio 2026-07-18 φωτο): a vertical backplate + a neck (λαιμός/άξονας)
 * that bridges it to the offset lever bar, + an optional lock cylinder (αφαλός).
 * `faceSign` = +1 (exterior +Z) / -1 (interior -Z). The lever extends from the
 * plate toward the leaf centre (`-latchDir`), like a real lever at rest.
 */
function handleAssembly(
  roseX: number,
  cy: number,
  latchDir: number,
  faceSign: number,
  ctx: HardwareCtx,
  withLock: boolean,
  leverLen: number = LEVER_LEN_M,
): BoxSpec[] {
  const facePlane = faceSign * (ctx.leafDepth / 2);
  // Ο μοχλός ξεκινά από την ΠΛΕΥΡΑ του άξονα (neck), όχι από το κέντρο του: η άκρη
  // του κοντά στον άξονα ευθυγραμμίζεται με τη far-side παρειά του (Giorgio 2026-07-18)
  // ώστε ο άξονας να μη μένει μισο-εκτεθειμένος δίπλα στη λαβή.
  const leverX = roseX - latchDir * ((leverLen - NECK_M) / 2);
  const specs: BoxSpec[] = [
    // Κάθετη πλάκα (backplate) κολλητά στην όψη — «ύψος 10-11cm» (Giorgio).
    {
      cx: roseX, cy, cz: facePlane + faceSign * (BACKPLATE_DEPTH_M / 2),
      sx: BACKPLATE_W_M, sy: BACKPLATE_H_M, sz: BACKPLATE_DEPTH_M, mat: ctx.mat,
    },
    // Λαιμός/άξονας: γεμίζει το standoff, γεφυρώνει πλάκα ↔ λαβή (το «ΑΞΟΝΑΣ» βέλος).
    {
      cx: roseX, cy, cz: facePlane + faceSign * (LEVER_STANDOFF_M / 2),
      sx: NECK_M, sy: NECK_M, sz: LEVER_STANDOFF_M, mat: ctx.mat,
    },
    // Μπάρα-λαβή, offset από την όψη κατά τον λαιμό.
    {
      cx: leverX, cy, cz: facePlane + faceSign * (LEVER_STANDOFF_M + LEVER_BAR_DEPTH_M / 2),
      sx: leverLen, sy: LEVER_THICK_M, sz: LEVER_BAR_DEPTH_M, mat: ctx.mat,
    },
  ];
  if (withLock) specs.push(...lockCylinder(roseX, cy, faceSign, ctx));
  return specs;
}

/** Euro-profile lock cylinder (σώμα + keyway) below the lever, proud of the backplate. */
function lockCylinder(roseX: number, cy: number, faceSign: number, ctx: HardwareCtx): BoxSpec[] {
  const ly = cy - LOCK_DROP_M;
  return [
    {
      cx: roseX, cy: ly, cz: faceSign * (BACKPLATE_DEPTH_M + LOCK_PROJ_M / 2),
      sx: LOCK_W_M, sy: LOCK_H_M, sz: LOCK_PROJ_M, mat: ctx.mat,
    },
    {
      cx: roseX, cy: ly - LOCK_H_M / 2, cz: faceSign * (BACKPLATE_DEPTH_M + LOCK_PROJ_M),
      sx: KEYWAY_W_M, sy: KEYWAY_H_M, sz: LOCK_PROJ_M, mat: ctx.mat,
    },
  ];
}

/** Through spindle (διαμπερής άξονας) joining the levers of both faces (doors). */
function spindleBar(roseX: number, cy: number, ctx: HardwareCtx): BoxSpec {
  return {
    cx: roseX, cy, cz: 0,
    sx: SPINDLE_M, sy: SPINDLE_M, sz: ctx.leafDepth + 2 * LEVER_STANDOFF_M, mat: ctx.mat,
  };
}

/** `count` hinge barrels (μεντεσέδες) on the edge `hingeX`, spread over the leaf height. */
function hingesAt(hingeX: number, ctx: HardwareCtx, count: number): BoxSpec[] {
  const ys = count === 2
    ? [ctx.cyMid - ctx.innerH * HINGE_Y_SPREAD, ctx.cyMid + ctx.innerH * HINGE_Y_SPREAD]
    : [ctx.cyMid - ctx.innerH * HINGE_Y_SPREAD, ctx.cyMid, ctx.cyMid + ctx.innerH * HINGE_Y_SPREAD];
  return ys.map((hy) => ({
    cx: hingeX, cy: hy, cz: 0,
    sx: HINGE_W_M, sy: HINGE_H_M, sz: HINGE_DEPTH_M, mat: ctx.mat,
  }));
}

/** Clamp the handle height inside the leaf's vertical clear span. */
function doorHandleY(ctx: HardwareCtx): number {
  const bottom = ctx.cyMid - ctx.innerH / 2 + BACKPLATE_H_M / 2;
  const top = ctx.cyMid + ctx.innerH / 2 - BACKPLATE_H_M / 2;
  return Math.min(Math.max(HANDLE_HEIGHT_M, bottom), top);
}

/** Single hinged leaf: handle (both faces) + through spindle + 3 hinges (μεντεσέδες). */
function singleSwingHardware(ctx: HardwareCtx): BoxSpec[] {
  const cy = doorHandleY(ctx);
  const roseX = ctx.latchSign * (ctx.innerW / 2 - EDGE_INSET_M);
  return [
    ...handleAssembly(roseX, cy, ctx.latchSign, 1, ctx, false),
    ...handleAssembly(roseX, cy, ctx.latchSign, -1, ctx, true),
    spindleBar(roseX, cy, ctx),
    ...hingesAt(-ctx.latchSign * (ctx.innerW / 2), ctx, 3),
  ];
}

/** Two hinged leaves: handle each side of the meeting stile + spindles + 3 hinges/leaf. */
function doubleSwingHardware(ctx: HardwareCtx): BoxSpec[] {
  const cy = doorHandleY(ctx);
  const leftX = -MEETING_INSET_M;
  const rightX = MEETING_INSET_M;
  return [
    ...handleAssembly(leftX, cy, -1, 1, ctx, false),
    ...handleAssembly(leftX, cy, -1, -1, ctx, false),
    ...handleAssembly(rightX, cy, 1, 1, ctx, false),
    ...handleAssembly(rightX, cy, 1, -1, ctx, true),
    spindleBar(leftX, cy, ctx),
    spindleBar(rightX, cy, ctx),
    ...hingesAt(-ctx.innerW / 2, ctx, 3),
    ...hingesAt(ctx.innerW / 2, ctx, 3),
  ];
}

/** Sliding door: a vertical pull bar near the leading edge, on both faces. */
function slidingHardware(ctx: HardwareCtx): BoxSpec[] {
  const barX = ctx.latchSign * (ctx.innerW / 2 - SLIDE_EDGE_INSET_M);
  const barH = Math.max(ctx.innerH * SLIDE_BAR_H_RATIO, SLIDE_BAR_W_M);
  const pull = (faceSign: number): BoxSpec => ({
    cx: barX, cy: ctx.cyMid,
    cz: faceSign * (ctx.leafDepth / 2 + SLIDE_BAR_DEPTH_M / 2),
    sx: SLIDE_BAR_W_M, sy: barH, sz: SLIDE_BAR_DEPTH_M, mat: ctx.mat,
  });
  return [pull(1), pull(-1)];
}

/** Bi-fold: a knob on the leading panel edge, on both faces. */
function foldingHardware(ctx: HardwareCtx): BoxSpec[] {
  const knobX = ctx.latchSign * (ctx.innerW / 2 - EDGE_INSET_M);
  const cy = doorHandleY(ctx);
  const knob = (faceSign: number): BoxSpec => ({
    cx: knobX, cy,
    cz: faceSign * (ctx.leafDepth / 2 + KNOB_DEPTH_M / 2),
    sx: KNOB_M, sy: KNOB_M, sz: KNOB_DEPTH_M, mat: ctx.mat,
  });
  return [knob(1), knob(-1)];
}

/**
 * Operable windows carry an interior handle (backplate + neck + shorter lever) plus
 * a pair of edge hinges for casement/tilt families; `fixed`/`bay-window` do not (no
 * operable sash). The handle sits low-centre on the interior (-Z) face; no through
 * spindle (single face). Sliding/double-hung sashes carry no hinge (SSoT: catalog).
 */
function windowHardware(kind: OpeningEntity['kind'], ctx: HardwareCtx): BoxSpec[] {
  if (kind === 'fixed' || kind === 'bay-window') return [];
  const cy = ctx.cyMid - ctx.innerH * WIN_HANDLE_Y_RATIO;
  const roseX = Math.max(ctx.innerW / 2 - EDGE_INSET_M, 0);
  const handle = handleAssembly(roseX, cy, 1, -1, ctx, false, WIN_LEVER_LEN_M);
  return kindHasHinges(kind) ? [...handle, ...hingesAt(-ctx.innerW / 2, ctx, 2)] : handle;
}
