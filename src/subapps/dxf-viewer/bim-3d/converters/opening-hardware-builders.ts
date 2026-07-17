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
 * (default `mat-metal`) — until now it was resolved but had NO geometry (ADR-672
 * §8 open item). This closes that: the handle is a schematic box assembly at the
 * same fidelity as the leaf/frame boxes (Revit symbolic hardware, not a detailed
 * lock body). Latch side follows `params.handing` (door-only); families with no
 * user-operable handle (fixed / bay / overhead sectional / revolving) return [].
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
/** Stand-off of the lever bar from the leaf face (the lever's neck length). */
const LEVER_STANDOFF_M = 55 * MM_TO_M;
/** Rose (backplate) square + its thin depth against the leaf face. */
const ROSE_M = 55 * MM_TO_M;
const ROSE_DEPTH_M = 12 * MM_TO_M;
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

/**
 * A lever handle (rose backplate + offset lever bar) on ONE face of a leaf.
 * `faceSign` = +1 (exterior +Z) / -1 (interior -Z). The lever extends from the
 * rose toward the leaf centre (`-latchDir`), like a real door lever at rest.
 */
function leverHandle(
  roseX: number,
  cy: number,
  latchDir: number,
  faceSign: number,
  ctx: HardwareCtx,
): BoxSpec[] {
  const facePlane = faceSign * (ctx.leafDepth / 2);
  const leverX = roseX - latchDir * (LEVER_LEN_M / 2);
  return [
    {
      cx: roseX, cy, cz: facePlane + faceSign * (ROSE_DEPTH_M / 2),
      sx: ROSE_M, sy: ROSE_M, sz: ROSE_DEPTH_M, mat: ctx.mat,
    },
    {
      cx: leverX, cy, cz: facePlane + faceSign * (LEVER_STANDOFF_M + LEVER_BAR_DEPTH_M / 2),
      sx: LEVER_LEN_M, sy: LEVER_THICK_M, sz: LEVER_BAR_DEPTH_M, mat: ctx.mat,
    },
  ];
}

/** Clamp the handle height inside the leaf's vertical clear span. */
function doorHandleY(ctx: HardwareCtx): number {
  const bottom = ctx.cyMid - ctx.innerH / 2 + ROSE_M / 2;
  const top = ctx.cyMid + ctx.innerH / 2 - ROSE_M / 2;
  return Math.min(Math.max(HANDLE_HEIGHT_M, bottom), top);
}

/** Single hinged leaf: lever near the latch edge, on both faces. */
function singleSwingHardware(ctx: HardwareCtx): BoxSpec[] {
  const cy = doorHandleY(ctx);
  const roseX = ctx.latchSign * (ctx.innerW / 2 - EDGE_INSET_M);
  return [
    ...leverHandle(roseX, cy, ctx.latchSign, 1, ctx),
    ...leverHandle(roseX, cy, ctx.latchSign, -1, ctx),
  ];
}

/** Two hinged leaves: a lever near each side of the central meeting stile, both faces. */
function doubleSwingHardware(ctx: HardwareCtx): BoxSpec[] {
  const cy = doorHandleY(ctx);
  const leftX = -MEETING_INSET_M;
  const rightX = MEETING_INSET_M;
  return [
    ...leverHandle(leftX, cy, -1, 1, ctx),
    ...leverHandle(leftX, cy, -1, -1, ctx),
    ...leverHandle(rightX, cy, 1, 1, ctx),
    ...leverHandle(rightX, cy, 1, -1, ctx),
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
 * Operable windows carry an interior handle; `fixed` and `bay-window` do not
 * (no operable sash). The lever sits low-centre on the interior (-Z) face.
 */
function windowHardware(kind: OpeningEntity['kind'], ctx: HardwareCtx): BoxSpec[] {
  if (kind === 'fixed' || kind === 'bay-window') return [];
  const cy = ctx.cyMid - ctx.innerH * WIN_HANDLE_Y_RATIO;
  const roseX = Math.max(ctx.innerW / 2 - EDGE_INSET_M, 0);
  // Reuse the lever assembly but with the shorter window lever length.
  const facePlane = -(ctx.leafDepth / 2);
  return [
    {
      cx: roseX, cy, cz: facePlane - ROSE_DEPTH_M / 2,
      sx: ROSE_M, sy: ROSE_M, sz: ROSE_DEPTH_M, mat: ctx.mat,
    },
    {
      cx: roseX - WIN_LEVER_LEN_M / 2, cy,
      cz: facePlane - (LEVER_STANDOFF_M + LEVER_BAR_DEPTH_M / 2),
      sx: WIN_LEVER_LEN_M, sy: LEVER_THICK_M, sz: LEVER_BAR_DEPTH_M, mat: ctx.mat,
    },
  ];
}
