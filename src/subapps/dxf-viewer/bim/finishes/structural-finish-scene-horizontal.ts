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
import { isFinishActive, type StructuralFinishSpec } from './structural-finish-types';
import {
  computeHorizontalFinishFace,
  type HorizontalFinishFace,
} from './structural-finish-horizontal';
import { computeFinishedOutline } from './structural-finish-horizontal';
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
    'finish' | 'sceneUnits' | 'topElevation' | 'zOffset' | 'depth' | 'envelopeFunction' | 'startPoint' | 'endPoint'
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

/** Εκτεθειμένες οριζόντιες όψεις, χωρισμένες ανά τύπο (για σωστό 3Δ tag/edges). */
export interface StructuralHorizontalFinishFaces {
  readonly columnFaces: readonly HorizontalFinishFace[];
  readonly beamFaces: readonly HorizontalFinishFace[];
}

/** Έγκυρο footprint (≥3 σημεία) ενός μέλους → Pt2[], αλλιώς `null`. */
function coresOf(verts: readonly { x: number; y: number }[] | undefined): Pt2[] | null {
  return verts && verts.length >= 3 ? verts.map(toPt2) : null;
}

/** Finished outline ενός μέλους ως `PlanObstacle` (core + z) — ή `null` αν εκφυλισμένο. */
function finishedObstacleOf(
  core: Pt2[] | null,
  lateralObstacles: readonly (readonly Pt2[])[],
  spec: StructuralFinishSpec | undefined,
  s: number,
  ext: ZExtent,
): PlanObstacle | null {
  if (!core) return null;
  const thick = isFinishActive(spec) ? spec.thickness : 0;
  const ring = computeFinishedOutline(core, lateralObstacles, thick, s);
  return { footprint: ring, bbox: bboxOf(ring), ...ext };
}

/**
 * SSoT: δομικά μέλη + γείτονες → εκτεθειμένες ΟΡΙΖΟΝΤΙΕΣ όψεις σοβά (κολόνα top/base,
 * δοκάρι top/soffit), building-relative z, χωρισμένες ανά τύπο. Κενά arrays όταν τίποτα εκτεθειμένο.
 *
 * Κάθε όψη χτίζεται στο **finished outline** του μέλους (offset μόνο εκτεθειμένες ακμές —
 * ίδια γεωμετρία με τον κάθετο σοβά) ΚΑΙ αφαιρεί τα finished footprints των **δομικών
 * γειτόνων** (κολόνα↔δοκάρι) → ο σοβάς σταματά flush στο πρόσωπο του γείτονα (μηδέν
 * διείσδυση/overlap στη συμβολή) και φτάνει το πρόσωπο του κάθετου σοβά στα ελεύθερα άκρα.
 */
export function computeStructuralHorizontalFinishFaces(input: HorizontalFinishInput): StructuralHorizontalFinishFaces {
  const { columns, beams, walls, slabs, beamObstacles, floorElevationMm } = input;
  const sceneUnits = columns[0]?.params.sceneUnits ?? beams[0]?.params.sceneUnits ?? 'mm';
  const s = mmToSceneUnits(sceneUnits);
  const unitToMeters = (1 / s) * MM_TO_M;
  const tol = PLANE_TOL_MM;

  const wallFps = walls.map((w) => wallFootprintPolygon(w));
  const columnCores = columns.map((c) => coresOf(c.geometry?.footprint?.vertices));
  const beamCores = beams.map((b) => coresOf(b.geometry?.outline?.vertices));
  const validBeamCores = beamCores.filter((c): c is Pt2[] => c !== null);
  const validColumnCores = columnCores.filter((c): c is Pt2[] => c !== null);

  // z-εμπόδια (κάλυψη). Τοίχοι: attached-top → resolved top = κάτω παρειά δοκαριού (Slice 8b).
  const beamUndersideById = new Map<string, number>();
  for (const b of beamObstacles) beamUndersideById.set(b.id, beamZExtent(b.params).zBotMm);
  const wallObs = walls.map((w) => toPlanObstacle(wallFootprintPolygon(w), wallZExtent(w, beamUndersideById, floorElevationMm)));
  const slabObs = slabs.map((sl) => toPlanObstacle(sl.params.outline.vertices, slabZExtent(sl.params)));

  // Finished outlines (lateral obstacles = ο ΑΛΛΟΣ δομικός τύπος + τοίχοι) — core των όψεων + cross-subtract.
  const columnFinished = columns.map((c, i) =>
    finishedObstacleOf(columnCores[i], [...validBeamCores, ...wallFps], c.params.finish, s, columnZExtent(c, floorElevationMm)),
  );
  const beamFinished = beams.map((b, j) =>
    finishedObstacleOf(beamCores[j], [...validColumnCores, ...wallFps], b.params.finish, s, beamZExtent(b.params)),
  );

  const columnFaces: HorizontalFinishFace[] = [];
  const beamFaces: HorizontalFinishFace[] = [];
  const colCovers: PlanObstacle[] = [...slabObs, ...wallObs, ...beamFinished.filter((o): o is PlanObstacle => o !== null)];
  const beamCovers: PlanObstacle[] = [...slabObs, ...wallObs, ...columnFinished.filter((o): o is PlanObstacle => o !== null)];
  columns.forEach((c, i) => {
    const fin = columnFinished[i];
    if (fin) collectColumnFaces(c, fin, colCovers, unitToMeters, tol, columnFaces);
  });
  beams.forEach((b, j) => {
    const fin = beamFinished[j];
    if (fin) collectBeamFaces(b, fin, beamCovers, unitToMeters, tol, beamFaces);
  });
  return { columnFaces, beamFaces };
}

/** Κατακόρυφη έκταση κολόνας (building-relative mm). */
function columnZExtent(c: HorizontalColumnSource, floorElevationMm: number): ZExtent {
  const zBotMm = floorElevationMm + (c.params.baseOffset ?? 0);
  return { zBotMm, zTopMm: zBotMm + c.params.height };
}

/** Top cap (πάντα candidate) + base cap (μόνο absolute base) μιας κολόνας. */
function collectColumnFaces(
  c: HorizontalColumnSource,
  fin: PlanObstacle,
  covers: readonly PlanObstacle[],
  unitToMeters: number,
  tol: number,
  out: HorizontalFinishFace[],
): void {
  const spec = c.params.finish;
  if (!isFinishActive(spec)) return;
  const classification = classifyHorizontal(c.params.envelopeFunction);

  const cap = computeHorizontalFinishFace({
    coreFootprint: fin.footprint, coverFootprints: coversAtPlane(covers, fin.zTopMm, fin.bbox, tol),
    zMm: fin.zTopMm, direction: 'up', spec, classification, unitToMeters,
  });
  if (cap) out.push(cap);

  // Βάση: σοβατίζεται ΜΟΝΟ στον αέρα (pilotis = baseBinding 'absolute'). Κάλυψη = πλάκα/πέδιλο κάτω.
  if (c.params.baseBinding === 'absolute') {
    const base = computeHorizontalFinishFace({
      coreFootprint: fin.footprint, coverFootprints: coversAtPlane(covers, fin.zBotMm, fin.bbox, tol),
      zMm: fin.zBotMm, direction: 'down', spec, classification, unitToMeters,
    });
    if (base) out.push(base);
  }
}

/** Top (κάλυψη = πλάκα πάνω) + soffit (κάλυψη = τοίχος κάτω) ενός δοκαριού. */
function collectBeamFaces(
  b: HorizontalBeamSource,
  fin: PlanObstacle,
  covers: readonly PlanObstacle[],
  unitToMeters: number,
  tol: number,
  out: HorizontalFinishFace[],
): void {
  const spec = b.params.finish;
  if (!isFinishActive(spec)) return;
  const classification = classifyHorizontal(b.params.envelopeFunction);

  const top = computeHorizontalFinishFace({
    coreFootprint: fin.footprint, coverFootprints: coversAtPlane(covers, fin.zTopMm, fin.bbox, tol),
    zMm: fin.zTopMm, direction: 'up', spec, classification, unitToMeters,
  });
  if (top) out.push(top);

  const soffit = computeHorizontalFinishFace({
    coreFootprint: fin.footprint, coverFootprints: coversAtPlane(covers, fin.zBotMm, fin.bbox, tol),
    zMm: fin.zBotMm, direction: 'down', spec, classification, unitToMeters,
  });
  if (soffit) out.push(soffit);
}
