/**
 * ADR-449 Slice 11 — Horizontal Structural Finish scene adapter.
 *
 * Γέφυρα ανάμεσα στον pure `structural-finish-horizontal` και τη σκηνή: συγκεντρώνει
 * τα **cover footprints** (πλάκες/δοκάρια από πάνω, τοίχοι από κάτω) στη σωστή στάθμη
 * z και παράγει τις εκτεθειμένες οριζόντιες όψεις σοβά ανά δομικό στοιχείο:
 *   - **Κολόνα**: top cap (z = κορυφή· κάλυψη = πλάκα/δοκάρι από πάνω) + base cap
 *     **μόνο** όταν `baseBinding === 'absolute'` (pilotis/στον αέρα· κάλυψη = πλάκα/
 *     πέδιλο από κάτω). `storey-floor`/`attached` βάση = κάθεται σε στάθμη/θεμέλιο → ΠΟΤΕ σοβάς.
 *   - **Δοκάρι**: top (κάλυψη = πλάκα από πάνω) + soffit (κάλυψη = τοίχος από κάτω).
 *
 * Coverage = **ΓΕΩΜΕΤΡΙΚΗ** (vertical span φτάνει το επίπεδο + plan overlap)· η αφαίρεση
 * γίνεται στον pure builder (`safeDifference`) → associative, partial-aware. z's είναι
 * **building-relative mm** (ίδια σύμβαση με τη silhouette· ο 3Δ builder προσθέτει
 * `buildingBaseElevationM`). Reuse: `wallFootprintPolygon` + attached-top wall resolution
 * (Slice 8b) → ένας τοίχος-στήριγμα έχει κορυφή = κάτω παρειά δοκαριού (= το soffit του).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 */

import type { ColumnParams } from '../types/column-types';
import type { BeamParams } from '../types/beam-types';
import type { SlabParams } from '../types/slab-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import { isFinishActive } from './structural-finish-types';
import {
  computeHorizontalFinishFace,
  type HorizontalFinishFace,
} from './structural-finish-horizontal';
import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';
import { toPt2, wallFootprintPolygon, type WallFinishObstacle } from './structural-finish-scene';

const MM_TO_M = 0.001;
/** Ανοχή (mm) κατακόρυφης εγγύτητας στο επίπεδο μιας οριζόντιας όψης. */
const PLANE_TOL_MM = 1;

// ─── Minimal sources (BIM + Dxf entity· μηδέν cast) ─────────────────────────────

export interface HorizontalColumnSource {
  readonly params: Pick<
    ColumnParams,
    'finish' | 'sceneUnits' | 'baseOffset' | 'height' | 'baseBinding' | 'envelopeFunction'
  >;
  readonly geometry?: { readonly footprint?: { readonly vertices?: readonly { x: number; y: number }[] } };
}

export interface HorizontalBeamSource {
  readonly params: Pick<
    BeamParams,
    'finish' | 'sceneUnits' | 'topElevation' | 'zOffset' | 'depth' | 'envelopeFunction'
  >;
  readonly geometry?: { readonly outline?: { readonly vertices?: readonly { x: number; y: number }[] } };
}

export interface HorizontalSlabObstacle {
  readonly params: Pick<SlabParams, 'outline' | 'levelElevation' | 'heightOffsetFromLevel' | 'thickness'>;
}

/** Δοκάρι ως οριζόντιο εμπόδιο (πάνω από κολόνα). */
export interface HorizontalBeamObstacle {
  readonly id: string;
  readonly params: Pick<BeamParams, 'topElevation' | 'zOffset' | 'depth'>;
  readonly geometry?: { readonly outline?: { readonly vertices?: readonly { x: number; y: number }[] } };
}

interface ZExtent {
  readonly zBotMm: number;
  readonly zTopMm: number;
}

interface PlanObstacle extends ZExtent {
  readonly footprint: readonly Pt2[];
  readonly bbox: Bbox;
}

interface Bbox {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

function bboxOf(pts: readonly { x: number; y: number }[]): Bbox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

function bboxOverlap(a: Bbox, b: Bbox): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

/** `true` όταν η κατακόρυφη έκταση [zBot,zTop] φτάνει το επίπεδο `planeZ` (± tol). */
function spanReachesPlane(ext: ZExtent, planeZmm: number, tolMm: number): boolean {
  return ext.zBotMm <= planeZmm + tolMm && ext.zTopMm >= planeZmm - tolMm;
}

/** Footprints obstacles που (α) φτάνουν κατακόρυφα το επίπεδο & (β) bbox-overlap το core. */
function coversAtPlane(
  obstacles: readonly PlanObstacle[],
  planeZmm: number,
  coreBbox: Bbox,
  tolMm: number,
): (readonly Pt2[])[] {
  const out: (readonly Pt2[])[] = [];
  for (const o of obstacles) {
    if (spanReachesPlane(o, planeZmm, tolMm) && bboxOverlap(coreBbox, o.bbox)) out.push(o.footprint);
  }
  return out;
}

function slabZExtent(p: HorizontalSlabObstacle['params']): ZExtent {
  const zTopMm = p.levelElevation + (p.heightOffsetFromLevel ?? 0);
  return { zBotMm: zTopMm - p.thickness, zTopMm };
}

function beamZExtent(p: { topElevation: number; zOffset?: number; depth: number }): ZExtent {
  const zTopMm = p.topElevation + (p.zOffset ?? 0);
  return { zBotMm: zTopMm - p.depth, zTopMm };
}

/**
 * Κατακόρυφη έκταση τοίχου-εμποδίου. **Attached-top** τοίχος-στήριγμα έχει resolved top =
 * κάτω παρειά του δοκαριού που κρατά (Slice 8b) — ώστε να καλύπτει ΑΚΡΙΒΩΣ το soffit του.
 */
function wallZExtent(
  wall: WallFinishObstacle,
  beamUndersideById: ReadonlyMap<string, number>,
  floorElevationMm: number,
): ZExtent {
  const zBotMm = floorElevationMm + (wall.params.baseOffset ?? 0);
  if (wall.params.topBinding === 'attached' && wall.params.attachTopToIds?.length) {
    let top = Infinity;
    for (const id of wall.params.attachTopToIds) {
      const u = beamUndersideById.get(id);
      if (u !== undefined && u < top) top = u;
    }
    if (Number.isFinite(top)) return { zBotMm, zTopMm: top };
  }
  return { zBotMm, zTopMm: zBotMm + wall.params.height };
}

function toPlanObstacle(footprint: readonly { x: number; y: number }[], ext: ZExtent): PlanObstacle {
  const fp = footprint.map(toPt2);
  return { footprint: fp, bbox: bboxOf(fp), ...ext };
}

interface HorizontalFinishInput {
  readonly columns: readonly HorizontalColumnSource[];
  readonly beams: readonly HorizontalBeamSource[];
  readonly walls: readonly WallFinishObstacle[];
  readonly slabs: readonly HorizontalSlabObstacle[];
  /** Δοκάρια ως οριζόντια εμπόδια καπακιού κολόνας (συνήθως === beams). */
  readonly beamObstacles: readonly HorizontalBeamObstacle[];
  readonly floorElevationMm: number;
}

/** envelopeFunction → classification (exterior μόνο όταν ρητά εξωτερική όψη). */
function classifyHorizontal(envelopeFunction: string | undefined): 'interior' | 'exterior' {
  return envelopeFunction === 'exterior' ? 'exterior' : 'interior';
}

/**
 * SSoT: δομικά μέλη + γείτονες → εκτεθειμένες ΟΡΙΖΟΝΤΙΕΣ όψεις σοβά (κολόνα top/base,
 * δοκάρι top/soffit), building-relative z. `[]` όταν κανένα εκτεθειμένο.
 */
export function computeStructuralHorizontalFinishFaces(input: HorizontalFinishInput): HorizontalFinishFace[] {
  const { columns, beams, walls, slabs, beamObstacles, floorElevationMm } = input;
  const sceneUnits = columns[0]?.params.sceneUnits ?? beams[0]?.params.sceneUnits ?? 'mm';
  const s = mmToSceneUnits(sceneUnits);
  const unitToMeters = (1 / s) * MM_TO_M;
  const tol = PLANE_TOL_MM;

  const slabObs = slabs.map((sl) => toPlanObstacle(sl.params.outline.vertices, slabZExtent(sl.params)));
  const beamCapObs = beamObstacles
    .filter((b) => b.geometry?.outline?.vertices && b.geometry.outline.vertices.length >= 3)
    .map((b) => toPlanObstacle(b.geometry!.outline!.vertices!, beamZExtent(b.params)));
  const aboveColumnObs = [...slabObs, ...beamCapObs];

  const beamUndersideById = new Map<string, number>();
  for (const b of beamObstacles) beamUndersideById.set(b.id, beamZExtent(b.params).zBotMm);
  const wallObs = walls.map((w) => toPlanObstacle(wallFootprintPolygon(w), wallZExtent(w, beamUndersideById, floorElevationMm)));

  const faces: HorizontalFinishFace[] = [];
  for (const c of columns) collectColumnFaces(c, floorElevationMm, aboveColumnObs, slabObs, unitToMeters, tol, faces);
  for (const b of beams) collectBeamFaces(b, slabObs, wallObs, unitToMeters, tol, faces);
  return faces;
}

/** Top cap (πάντα candidate) + base cap (μόνο absolute base) μιας κολόνας. */
function collectColumnFaces(
  c: HorizontalColumnSource,
  floorElevationMm: number,
  aboveObs: readonly PlanObstacle[],
  belowObs: readonly PlanObstacle[],
  unitToMeters: number,
  tol: number,
  out: HorizontalFinishFace[],
): void {
  const spec = c.params.finish;
  const fp = c.geometry?.footprint?.vertices;
  if (!isFinishActive(spec) || !fp || fp.length < 3) return;
  const core = fp.map(toPt2);
  const coreBbox = bboxOf(core);
  const classification = classifyHorizontal(c.params.envelopeFunction);
  const zBotMm = floorElevationMm + (c.params.baseOffset ?? 0);
  const zTopMm = zBotMm + c.params.height;

  const cap = computeHorizontalFinishFace({
    coreFootprint: core, coverFootprints: coversAtPlane(aboveObs, zTopMm, coreBbox, tol),
    zMm: zTopMm, direction: 'up', spec, classification, unitToMeters,
  });
  if (cap) out.push(cap);

  // Βάση: σοβατίζεται ΜΟΝΟ όταν στον αέρα (pilotis = baseBinding 'absolute'). Κάλυψη = πλάκα/πέδιλο κάτω.
  if (c.params.baseBinding === 'absolute') {
    const base = computeHorizontalFinishFace({
      coreFootprint: core, coverFootprints: coversAtPlane(belowObs, zBotMm, coreBbox, tol),
      zMm: zBotMm, direction: 'down', spec, classification, unitToMeters,
    });
    if (base) out.push(base);
  }
}

/** Top (κάλυψη = πλάκα πάνω) + soffit (κάλυψη = τοίχος κάτω) ενός δοκαριού. */
function collectBeamFaces(
  b: HorizontalBeamSource,
  slabObs: readonly PlanObstacle[],
  wallObs: readonly PlanObstacle[],
  unitToMeters: number,
  tol: number,
  out: HorizontalFinishFace[],
): void {
  const spec = b.params.finish;
  const outline = b.geometry?.outline?.vertices;
  if (!isFinishActive(spec) || !outline || outline.length < 3) return;
  const core = outline.map(toPt2);
  const coreBbox = bboxOf(core);
  const classification = classifyHorizontal(b.params.envelopeFunction);
  const { zBotMm, zTopMm } = beamZExtent(b.params);

  const top = computeHorizontalFinishFace({
    coreFootprint: core, coverFootprints: coversAtPlane(slabObs, zTopMm, coreBbox, tol),
    zMm: zTopMm, direction: 'up', spec, classification, unitToMeters,
  });
  if (top) out.push(top);

  const soffit = computeHorizontalFinishFace({
    coreFootprint: core, coverFootprints: coversAtPlane(wallObs, zBotMm, coreBbox, tol),
    zMm: zBotMm, direction: 'down', spec, classification, unitToMeters,
  });
  if (soffit) out.push(soffit);
}
