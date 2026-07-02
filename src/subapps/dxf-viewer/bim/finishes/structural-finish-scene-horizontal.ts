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
import { isFinishActive, createDefaultStructuralFinishSpec, type StructuralFinishSpec } from './structural-finish-types';
import {
  computeHorizontalFinishFace,
  mergeCoresToFinishedRings,
  type HorizontalFinishFace,
  type HorizontalFaceDirection,
} from './structural-finish-horizontal';
import { computeFinishedOutline } from './structural-finish-horizontal';
import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';
import { dilatePolygonOutward } from '../geometry/shared/polygon-dilate';
import { toPt2, wallFootprintPolygon, type WallFinishObstacle } from './structural-finish-scene';
import { wallIsFinishMember } from './wall-finish-source';
import { beamFinishOutline, type ColumnVerticalExtentLookup } from './structural-finish-scene-silhouette';

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
  readonly geometry?: {
    readonly outline?: { readonly vertices?: readonly { x: number; y: number }[] };
    /** ADR-449/493 — άξονας (start/end) για επέκταση του outline μέσα στις πλαισιωμένες κολόνες (merged top-cap). */
    readonly axisPolyline?: { readonly points?: readonly { x: number; y: number }[] };
  };
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
  const wallFinished = walls.map((w, i) =>
    wallIsFinishMember(w)
      ? finishedObstacleOf(coresOf(wallFps[i]), [...columnEnvelopes, ...beamEnvelopes], w.params.finish, s, wallZExtent(w, beamUndersideById, floorElevationMm))
      : null,
  );

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
    const fin = wallFinished[i];
    if (fin) collectWallFaces(w, fin, [...slabObs, ...beamObs], unitToMeters, tol, wallFaces);
  });
  return { columnFaces, beamFaces, wallFaces };
}

/**
 * ADR-449 §top-cap-coincidence (Giorgio 2026-07-01) — ΕΝΙΑΙΟ πάνω-καπάκι σοβά (`up`) όλης της
 * δομικής ομάδας από **union των ΠΥΡΗΝΩΝ + μία διαστολή** (mirror του κάθετου silhouette), ώστε
 * η ραφή τοίχου↔κολόνας↔δοκαριού στη συμβολή να ΜΗΝ είναι δοντωτή. Αντικαθιστά (για το render)
 * τα per-member `up` καπάκια των `computeStructuralHorizontalFinishFaces` (που offset-άρουν ανά
 * μέλος → ασυνεπείς γωνίες). Τα `down` καπάκια (soffit/βάση) μένουν per-member (καμία junction).
 *
 * Ένα face ανά (top-plane × disjoint κομμάτι). Γνήσια κάλυψη άνωθεν (πλάκα/δοκάρι) αφαιρείται
 * μέσω `computeHorizontalFinishFace` (associative). `classification:'interior'` — ενιαίο σοβά
 * κέλυφος (mirror silhouette). Κενό όταν κανένα μέλος με ενεργό σοβά.
 */
export function computeMergedStructuralTopCap(input: HorizontalFinishInput): HorizontalFinishFace[] {
  const { columns, beams, walls, slabs, beamObstacles, floorElevationMm, columnExtents } = input;
  const spec = createDefaultStructuralFinishSpec();
  if (!isFinishActive(spec)) return [];
  const sceneUnits = columns[0]?.params.sceneUnits ?? beams[0]?.params.sceneUnits ?? walls[0]?.params.sceneUnits ?? 'mm';
  const s = mmToSceneUnits(sceneUnits);
  const unitToMeters = (1 / s) * MM_TO_M;

  // Δομικά μέλη με ενεργό σοβά + το top-plane z τους (building-relative mm).
  const members: { core: Pt2[]; zTopMm: number }[] = [];
  // ADR-449/493 — footprints των finish-κολόνων· το δοκάρι που πλαισιώνεται στην παρειά τους
  // επεκτείνεται ΜΕΣΑ τους (μόνο για το union) ώστε το καπάκι να συγχωνευτεί σε ΕΝΑ (mirror silhouette).
  const columnFootprints: Pt2[][] = [];
  for (const c of columns) {
    const core = coresOf(c.geometry?.footprint?.vertices);
    if (core && isFinishActive(c.params.finish)) {
      members.push({ core, zTopMm: columnZExtent(c, floorElevationMm, columnExtents).zTopMm });
      columnFootprints.push(core);
    }
  }
  for (const b of beams) {
    if (!isFinishActive(b.params.finish)) continue;
    // Επέκταση του outline μέσα στις πλαισιωμένες κολόνες → πραγματική επικάλυψη → ΕΝΑ ενιαίο καπάκι
    // στη συμβολή (ΙΔΙΟ SSoT `beamFinishOutline` με τον κάθετο silhouette· raw fallback = μηδέν regression).
    const core = coresOf(beamFinishOutline(b, columnFootprints));
    if (core) members.push({ core, zTopMm: beamZExtent(b.params).zTopMm });
  }
  const emptyUnderside = new Map<string, number>();
  for (const w of walls) {
    if (!wallIsFinishMember(w)) continue;
    const core = coresOf(wallFootprintPolygon(w));
    if (core) members.push({ core, zTopMm: wallZExtent(w, emptyUnderside, floorElevationMm).zTopMm });
  }
  if (members.length === 0) return [];

  // Covers ΓΝΗΣΙΑΣ κάλυψης άνωθεν (πλάκες/δοκάρια): κρύβουν το καπάκι όπου φτάνουν το επίπεδο.
  const slabObs = slabs.map((sl) => toPlanObstacle(sl.params.outline.vertices, slabZExtent(sl.params)));
  const beamObs = beamObstacles
    .map((b) => (coresOf(b.geometry?.outline?.vertices) ? toPlanObstacle(b.geometry!.outline!.vertices!, beamZExtent(b.params)) : null))
    .filter((o): o is PlanObstacle => o !== null);

  // Ομαδοποίηση ανά top-plane (μέλη ίδιου z ενώνονται σε ΕΝΑ ενιαίο silhouette).
  const byPlane = new Map<number, Pt2[][]>();
  const planeOf = new Map<number, number>();
  for (const m of members) {
    const key = Math.round(m.zTopMm * 1e3);
    const g = byPlane.get(key);
    if (g) g.push(m.core);
    else { byPlane.set(key, [m.core]); planeOf.set(key, m.zTopMm); }
  }

  const faces: HorizontalFinishFace[] = [];
  for (const [key, cores] of byPlane) {
    const planeZmm = planeOf.get(key) ?? 0;
    // ADR-449/493 — up-cap covers: πλάκες όπως πριν (top-στο-plane = γνήσια κάλυψη άνωθεν), αλλά
    // τα ΔΟΚΑΡΙΑ ΜΟΝΟ όταν εκτείνονται ΑΥΣΤΗΡΑ πάνω από το plane. Ένα δοκάρι με κορυφή ΣΤΟ ΙΔΙΟ
    // plane ΕΙΝΑΙ το ίδιο μέλος αυτού του καπακιού → δεν καλύπτει τον εαυτό του (αλλιώς αφαιρούσε
    // το footprint του → τρύπα «κανένα ενιαίο καπάκι πάνω στο δοκάρι», Giorgio 2026-07-02 screenshot
    // 100928). Δοκάρι ΠΑΝΩ από χαμηλότερη κολόνα (top-plane > cap) καλύπτει κανονικά (μηδέν regression).
    const beamCoversAbove = beamObs.filter((o) => o.zTopMm > planeZmm + PLANE_TOL_MM);
    const covers = [...slabObs, ...beamCoversAbove];
    for (const ring of mergeCoresToFinishedRings(cores, spec.thickness, s)) {
      const face = computeHorizontalFinishFace({
        coreFootprint: ring,
        coverFootprints: coversAtPlane(covers, planeZmm, bboxOf(ring), PLANE_TOL_MM),
        zMm: planeZmm, direction: 'up', spec, classification: 'interior', unitToMeters,
      });
      if (face) faces.push(face);
    }
  }
  return faces;
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
