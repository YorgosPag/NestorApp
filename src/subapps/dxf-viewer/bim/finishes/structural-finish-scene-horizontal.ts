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
  type HorizontalFaceDirection,
} from './structural-finish-horizontal';
import { computeFinishedOutline } from './structural-finish-horizontal';
import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';
import { dilatePolygonOutward } from '../geometry/shared/polygon-dilate';
import { toPt2, wallFootprintPolygon, type WallFinishObstacle } from './structural-finish-scene';
// ADR-458 §top-cap-cutback — ΙΔΙΟ SSoT με το core mesh: ο top-cap σοβά τοίχου κόβεται στην παρειά κολώνας.
import { computeMemberCutbackOutline } from '../geometry/member-column-cutback';
import { wallIsFinishMember } from './wall-finish-source';
import type { ColumnVerticalExtentLookup } from './structural-finish-scene-silhouette';

const MM_TO_M = 0.001;
/** Ανοχή (mm) κατακόρυφης εγγύτητας στο επίπεδο μιας οριζόντιας όψης. */
const PLANE_TOL_MM = 1;

// ─── Minimal sources (BIM + Dxf entity· μηδέν cast) ─────────────────────────────

export interface HorizontalColumnSource {
  /** ADR-449 — id για lookup του pre-resolved (storey-aware) zExtent. Προαιρετικό: tests το παραλείπουν → legacy `params.height`. */
  readonly id?: string;
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
  /** ADR-449 — pre-resolved (storey-aware) zExtents κολώνας ανά id, ΙΔΙΑ SSoT με τον πυρήνα. */
  readonly columnExtents?: ColumnVerticalExtentLookup;
}

/** envelopeFunction → classification (exterior μόνο όταν ρητά εξωτερική όψη). */
function classifyHorizontal(envelopeFunction: string | undefined): 'interior' | 'exterior' {
  return envelopeFunction === 'exterior' ? 'exterior' : 'interior';
}

/** Εκτεθειμένες οριζόντιες όψεις, χωρισμένες ανά τύπο (για σωστό 3Δ tag/edges). */
export interface StructuralHorizontalFinishFaces {
  readonly columnFaces: readonly HorizontalFinishFace[];
  readonly beamFaces: readonly HorizontalFinishFace[];
  /** ADR-449 Slice X4/E — top-cap **ελεύθερης κορυφής** τοίχου (χωρίς πλάκα/δοκάρι από πάνω). */
  readonly wallFaces: readonly HorizontalFinishFace[];
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

/** Plaster envelope ενός γείτονα = core dilated έξω κατά το πάχος του (ΟΧΙ boolean). */
function plasterEnvelope(core: Pt2[] | null, spec: StructuralFinishSpec | undefined, s: number): Pt2[] | null {
  if (!core || core.length < 3) return null;
  const thick = isFinishActive(spec) ? spec.thickness : 0;
  return thick > 0 ? dilatePolygonOutward(core, thick * s) : core;
}

/**
 * SSoT: δομικά μέλη + γείτονες → εκτεθειμένες ΟΡΙΖΟΝΤΙΕΣ όψεις σοβά (κολόνα top/base,
 * δοκάρι top/soffit), building-relative z, χωρισμένες ανά τύπο. Κενά arrays όταν τίποτα εκτεθειμένο.
 *
 * Κάθε όψη χτίζεται στο **finished outline** του μέλους: offset προς τα έξω ΜΟΝΟ στις
 * εκτεθειμένες ακμές (ίδια γεωμετρία με τον κάθετο σοβά). Οι **δομικοί γείτονες** (κολόνα↔
 * δοκάρι) περνούν ως **plaster-envelope obstacles** στον resolver (interval-based κοπή ακμής)
 * → ο σοβάς σταματά flush στο πρόσωπο του σοβά του γείτονα **ΧΩΡΙΣ boolean difference** (που
 * παρήγαγε διαγώνιες slivers στις flush/coincident συμβολές). Boolean (`safeDifference`) μένει
 * ΜΟΝΟ για **γνήσια** οριζόντια κάλυψη (πλάκα από πάνω / τοίχος από κάτω — πραγματικό overlap).
 */
export function computeStructuralHorizontalFinishFaces(input: HorizontalFinishInput): StructuralHorizontalFinishFaces {
  const { columns, beams, walls, slabs, beamObstacles, floorElevationMm, columnExtents } = input;
  // ADR-449 X4/E — sceneUnits fallback σε τοίχο (όροφος με ΜΟΝΟ τοίχους· mirror X3.1 silhouette fix).
  const sceneUnits = columns[0]?.params.sceneUnits ?? beams[0]?.params.sceneUnits ?? walls[0]?.params.sceneUnits ?? 'mm';
  const s = mmToSceneUnits(sceneUnits);
  const unitToMeters = (1 / s) * MM_TO_M;
  const tol = PLANE_TOL_MM;

  const wallFps = walls.map((w) => wallFootprintPolygon(w));
  const columnCores = columns.map((c) => coresOf(c.geometry?.footprint?.vertices));
  const beamCores = beams.map((b) => coresOf(b.geometry?.outline?.vertices));
  // Plaster envelopes (dilated cores) — lateral obstacles ώστε ο resolver να κόβει την ακμή
  // στο πρόσωπο του σοβά του γείτονα (interval-based, μηδέν sliver).
  const columnEnvelopes = columns
    .map((c, i) => plasterEnvelope(columnCores[i], c.params.finish, s))
    .filter((e): e is Pt2[] => e !== null && e.length >= 3);
  const beamEnvelopes = beams
    .map((b, j) => plasterEnvelope(beamCores[j], b.params.finish, s))
    .filter((e): e is Pt2[] => e !== null && e.length >= 3);

  // z-εμπόδια ΓΝΗΣΙΑΣ κάλυψης. Τοίχοι: attached-top → resolved top = κάτω παρειά δοκαριού (Slice 8b).
  const beamUndersideById = new Map<string, number>();
  for (const b of beamObstacles) beamUndersideById.set(b.id, beamZExtent(b.params).zBotMm);
  const wallObs = walls.map((w) => toPlanObstacle(wallFootprintPolygon(w), wallZExtent(w, beamUndersideById, floorElevationMm)));
  const slabObs = slabs.map((sl) => toPlanObstacle(sl.params.outline.vertices, slabZExtent(sl.params)));
  // ADR-449 Slice X4/E — δοκάρια ως οριζόντια εμπόδια κάλυψης της κορυφής τοίχου (αν δοκάρι
  // από πάνω → η κορυφή καλύπτεται → κανένα top-cap). Reuse beamZExtent + footprint.
  const beamObs = beamObstacles
    .map((b) => (coresOf(b.geometry?.outline?.vertices) ? toPlanObstacle(b.geometry!.outline!.vertices!, beamZExtent(b.params)) : null))
    .filter((o): o is PlanObstacle => o !== null);

  // Finished outline: lateral obstacles = plaster envelopes του ΑΛΛΟΥ δομικού τύπου + τοίχοι.
  const columnFinished = columns.map((c, i) =>
    finishedObstacleOf(columnCores[i], [...beamEnvelopes, ...wallFps], c.params.finish, s, columnZExtent(c, floorElevationMm, columnExtents)),
  );
  const beamFinished = beams.map((b, j) =>
    finishedObstacleOf(beamCores[j], [...columnEnvelopes, ...wallFps], b.params.finish, s, beamZExtent(b.params)),
  );

  // ADR-449 Slice X4/E — finished outlines τοίχων-finish-members (core + σοβάς skin), lateral
  // obstacles = δομικοί γείτονες (κολόνα/δοκάρι envelopes) ώστε το top-cap να σταματά flush.
  // ADR-449 §top-cap-cutback (Giorgio 2026-07-01) — ο πυρήνας του τοίχου κόβεται στην παρειά
  // κολώνας (column wins, ADR-458)· το οριζόντιο top-cap ΠΡΕΠΕΙ να ακολουθεί τον ΚΟΜΜΕΝΟ πυρήνα,
  // αλλιώς ζωγραφιζόταν πάνω από το πλήρες footprint → ο σοβάς προεξείχε ΜΕΣΑ στην κολώνα («οι
  // σοβάδες δεν αποδίδονται σωστά»). ΙΔΙΟ SSoT `computeMemberCutbackOutline` με το core mesh:
  // `null` → καμία τομή → πλήρες footprint (μηδέν regression)· `[]` → τοίχος όλος μέσα σε κολώνα
  // → κανένα cap· πολλά κομμάτια (κολώνα χωρίζει τον τοίχο) → ένα finished cap ανά κομμάτι.
  const columnCutters = columnCores.filter((c): c is Pt2[] => c !== null && c.length >= 3);
  const wallFinished: PlanObstacle[][] = walls.map((w, i) => {
    if (!wallIsFinishMember(w)) return [];
    const cut = columnCutters.length > 0 ? computeMemberCutbackOutline(wallFps[i], columnCutters) : null;
    const pieces = cut ?? [wallFps[i]];
    const z = wallZExtent(w, beamUndersideById, floorElevationMm);
    return pieces
      .map((piece) => finishedObstacleOf(coresOf(piece), [...columnEnvelopes, ...beamEnvelopes], w.params.finish, s, z))
      .filter((o): o is PlanObstacle => o !== null);
  });

  const columnFaces: HorizontalFinishFace[] = [];
  const beamFaces: HorizontalFinishFace[] = [];
  const wallFaces: HorizontalFinishFace[] = [];
  columns.forEach((c, i) => {
    const fin = columnFinished[i];
    if (fin) collectColumnFaces(c, fin, slabObs, unitToMeters, tol, columnFaces);
  });
  beams.forEach((b, j) => {
    const fin = beamFinished[j];
    if (fin) collectBeamFaces(b, fin, slabObs, wallObs, unitToMeters, tol, beamFaces);
  });
  walls.forEach((w, i) => {
    for (const fin of wallFinished[i]) collectWallFaces(w, fin, [...slabObs, ...beamObs], unitToMeters, tol, wallFaces);
  });
  return { columnFaces, beamFaces, wallFaces };
}

/**
 * Κατακόρυφη έκταση κολόνας (building-relative mm). ADR-449: pre-resolved extent
 * (ΙΔΙΑ SSoT με τον πυρήνα, storey-aware) όταν δίνεται· αλλιώς legacy `params.height`.
 */
function columnZExtent(c: HorizontalColumnSource, floorElevationMm: number, extents?: ColumnVerticalExtentLookup): ZExtent {
  const resolved = c.id ? extents?.get(c.id) : undefined;
  if (resolved) return resolved;
  const zBotMm = floorElevationMm + (c.params.baseOffset ?? 0);
  return { zBotMm, zTopMm: zBotMm + c.params.height };
}

/**
 * ADR-449 Slice 11 — **SSoT** emission ΜΙΑΣ οριζόντιας όψης σοβά σε επίπεδο `planeZmm`:
 * cover-subtracted (`coversAtPlane` + `computeHorizontalFinishFace`) → push αν εκτεθειμένη.
 * ΕΝΑ σημείο για όλα τα caps/soffits (κολόνα top/base, δοκάρι top/soffit, τοίχος top) — μηδέν
 * επανάληψη του `computeHorizontalFinishFace({...}) + if push` boilerplate ανά τύπο μέλους.
 */
function pushHorizontalCap(
  out: HorizontalFinishFace[],
  fin: PlanObstacle,
  covers: readonly PlanObstacle[],
  planeZmm: number,
  direction: HorizontalFaceDirection,
  spec: StructuralFinishSpec,
  classification: 'interior' | 'exterior',
  unitToMeters: number,
  tol: number,
): void {
  const face = computeHorizontalFinishFace({
    coreFootprint: fin.footprint,
    coverFootprints: coversAtPlane(covers, planeZmm, fin.bbox, tol),
    zMm: planeZmm, direction, spec, classification, unitToMeters,
  });
  if (face) out.push(face);
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
  const cls = classifyHorizontal(c.params.envelopeFunction);
  pushHorizontalCap(out, fin, covers, fin.zTopMm, 'up', spec, cls, unitToMeters, tol);
  // Βάση: σοβατίζεται ΜΟΝΟ στον αέρα (pilotis = baseBinding 'absolute'). Κάλυψη = πλάκα/πέδιλο κάτω.
  if (c.params.baseBinding === 'absolute') {
    pushHorizontalCap(out, fin, covers, fin.zBotMm, 'down', spec, cls, unitToMeters, tol);
  }
}

/** Top (κάλυψη = πλάκα πάνω) + soffit (κάλυψη = τοίχος κάτω) ενός δοκαριού. */
function collectBeamFaces(
  b: HorizontalBeamSource,
  fin: PlanObstacle,
  slabCovers: readonly PlanObstacle[],
  wallCovers: readonly PlanObstacle[],
  unitToMeters: number,
  tol: number,
  out: HorizontalFinishFace[],
): void {
  const spec = b.params.finish;
  if (!isFinishActive(spec)) return;
  const cls = classifyHorizontal(b.params.envelopeFunction);
  pushHorizontalCap(out, fin, slabCovers, fin.zTopMm, 'up', spec, cls, unitToMeters, tol);
  pushHorizontalCap(out, fin, wallCovers, fin.zBotMm, 'down', spec, cls, unitToMeters, tol);
}

/**
 * ADR-449 Slice X4/E — top-cap **ελεύθερης κορυφής** τοίχου (Giorgio: ελεύθερος τοίχος →
 * σοβάς ΚΑΙ στην πάνω πλευρά). Κάλυψη = πλάκα/δοκάρι από πάνω → ο geometric resolver αφαιρεί
 * το καλυμμένο κομμάτι· πλήρως καλυμμένος → κανένα cap. Μόνο `up` (η βάση κάθεται σε στάθμη).
 */
function collectWallFaces(
  w: WallFinishObstacle,
  fin: PlanObstacle,
  covers: readonly PlanObstacle[],
  unitToMeters: number,
  tol: number,
  out: HorizontalFinishFace[],
): void {
  const spec = w.params.finish;
  if (!isFinishActive(spec)) return;
  const cls = classifyHorizontal(w.params.envelopeFunction);
  pushHorizontalCap(out, fin, covers, fin.zTopMm, 'up', spec, cls, unitToMeters, tol);
}
