/**
 * ADR-449 — Structural Finish scene adapter (σοβάς κολόνας): scene → contribution.
 *
 * Γέφυρα ανάμεσα στον pure `structural-finish-resolver` και τη σκηνή. Χτίζει:
 *   - obstacles = footprints τοίχων (ποιες παρειές καλύπτονται),
 *   - classifier = exterior/interior ανά εκτεθειμένη υπο-ακμή, βασισμένο στο
 *     building footprint (ADR-396 SSoT) + ρητό `envelopeFunction` override.
 *
 * Classifier λογική (Slice 1):
 *   1. ρητό `column.params.envelopeFunction` → 'exterior'/'interior' υπερισχύει.
 *   2. αλλιώς γεωμετρικά: μια παρειά είναι **exterior** όταν το midpoint της
 *      βρίσκεται πάνω στο εξώτατο όριο (outer ring) ενός component που ΠΕΡΙΚΛΕΙΕΙ
 *      χώρο (holes.length>0 = πραγματικό περίγραμμα κτιρίου). Έτσι μια ΜΕΜΟΝΩΜΕΝΗ
 *      εσωτερική κολόνα (δικό της component χωρίς holes) → όλες οι παρειές interior
 *      (Knauf), σωστά. ETICS-grade per-element exterior detection = Slice μετέπειτα.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 */

import type { SceneModel } from '../../types/entities';
import { isWallEntity, isColumnEntity, isBeamEntity } from '../../types/entities';
import type { ColumnEntity, ColumnGeometry, ColumnParams } from '../types/column-types';
import type { BeamEntity, BeamParams } from '../types/beam-types';
import type { WallEntity } from '../types/wall-types';
import type { Point3D } from '../types/bim-base';
import type { EnvelopeFunction } from '../types/thermal-envelope-types';
import { computeWallGeometry } from '../geometry/wall-geometry';
import { computeBuildingFootprint } from '../geometry/building-footprint';
import { pointToSegmentDistance } from '../../systems/guides';
import { mmToSceneUnits } from '../../utils/scene-units';
import { resolveStructuralFinishFaces, type FinishEdgeClassifier } from './structural-finish-resolver';
import { isFinishActive, type StructuralFinishFaces } from './structural-finish-types';
import type { FinishBoqContribution } from '../services/structural-finish-boq';
import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';
import { dilatePolygonAlongAxis } from '../geometry/shared/polygon-dilate';

export const MM_TO_M = 0.001;
/** Ανοχή (canvas units ανά mm) — 2mm για «πάνω στο εξώτατο όριο». */
export const EXTERIOR_EDGE_TOL_MM = 2;
/**
 * ADR-449 Slice 6 — Revit join tolerance (mm) για τα cross-structural obstacles
 * (δοκάρι→κολόνα). Dilation του obstacle footprint ώστε μια **flush** διεπαφή
 * (born-from-grid framing: το δοκάρι κόβεται στην παρειά, μηδέν overlap) να μετράει
 * ως καλυμμένη — το `coveredIntervals` απαιτεί midpoint ΑΥΣΤΗΡΑ μέσα στο obstacle.
 * Tunable· οι τοίχοι ΔΕΝ dilate-άρονται (υπάρχουσα browser-verified συμπεριφορά).
 *
 * ADR-449 Slice 9 — **directional**: εφαρμόζεται μόνο στο **δοκάρι-obstacle** και ΜΟΝΟ
 * κατά τον **άξονά** του (`dilatePolygonAlongAxis`). Το isotropic `dilatePolygonOutward`
 * μεγάλωνε ΚΑΙ εγκάρσια → «έτρωγε» 10mm από το remnant σοβά της κολόνας ΚΑΘΕ πλευρά → το
 * chamfer του remnant προσγειωνόταν μακριά από του δοκαριού → ΟΡΑΤΟ ΚΕΝΟ στη γωνιακή
 * συμβολή (Giorgio 2026-06-13, screenshots· Firestore-verified flush, drift=0). Κατά τον
 * άξονα μόνο: το άκρο του δοκαριού περνά την παρειά (flush bridge) ΧΩΡΙΣ εγκάρσια
 * συρρίκνωση → remnant φτάνει ΑΚΡΙΒΩΣ την παρειά → μηδέν κενό. Η **κολόνα-obstacle** στο
 * δοκάρι = ΧΩΡΙΣ dilation (flush → δεν επικαλύπτει την πλάγια όψη· πραγματικό overlap →
 * κόβει σωστά χωρίς tolerance). 10mm = robust margin και για ήπια manual near-flush.
 */
export const STRUCTURAL_JOIN_TOL_MM = 10;

/**
 * ADR-449 Slice 8 — ανοχή (mm) κατακόρυφης επικάλυψης τοίχου↔ζώνης βάθους δοκαριού.
 * Ένας τοίχος-στήριγμα κάτω από το δοκάρι έχει κορυφή ≈ κάτω παρειά δοκαριού· με την
 * ανοχή αυτή θεωρείται «κάτω, όχι μέσα στη ζώνη» → δεν καλύπτει τις πλάγιες όψεις.
 */
const WALL_BEAM_BAND_TOL_MM = 1;

export const toPt2 = (p: { x: number; y: number }): Pt2 => ({ x: p.x, y: p.y });

/** Κατακόρυφη ζώνη βάθους δοκαριού (building-relative mm): κρέμεται `depth` κάτω από top. */
function beamDepthBandMm(
  params: { readonly topElevation: number; readonly zOffset?: number; readonly depth: number },
): { zBotMm: number; zTopMm: number } {
  const zTopMm = params.topElevation + (params.zOffset ?? 0);
  return { zBotMm: zTopMm - params.depth, zTopMm };
}

/**
 * ADR-449 Slice 8 — **height-aware wall coverage** για δοκάρια. Κρατά μόνο τους τοίχους
 * που επικαλύπτονται **κατακόρυφα** με τη ζώνη βάθους του δοκαριού `[top−depth, top]`. Ένας
 * τοίχος-**στήριγμα από κάτω** (κορυφή ≤ κάτω παρειά δοκαριού) βρίσκεται **κάτω** από το
 * δοκάρι → ΟΧΙ obstacle → ο σοβάς εμφανίζεται **και στις 2 πλάγιες όψεις** (η όψη είναι
 * πάνω από τον τοίχο, ορατή). Ένας τοίχος που **διασταυρώνεται** στο ίδιο ύψος → παραμένει
 * obstacle (κόβει σωστά, μηδέν διπλο-σοβάτισμα). Η coverage ήταν 2D-only (κάτοψη) → ένας
 * collinear support wall κάλυπτε ασύμμετρα τη μία όψη (Giorgio 2026-06-13). `floorElevationMm`
 * = FFL ορόφου (anchor του wall `baseOffset`)· default 0 = active-level scene (BOQ/2D convention).
 */
export function wallsOverlappingBeamBand(
  walls: readonly WallFinishObstacle[],
  beamParams: { readonly topElevation: number; readonly zOffset?: number; readonly depth: number },
  floorElevationMm: number,
): WallFinishObstacle[] {
  const band = beamDepthBandMm(beamParams);
  return walls.filter((w) => {
    // ADR-449 Slice 8b — **attached-top wall = στήριγμα**: η κορυφή του κουμπώνει στην ΚΑΤΩ
    // παρειά ενός δοκαριού (`topBinding:'attached'` + `attachTopToIds`), άρα ο πραγματικός
    // top = beam underside (ΟΧΙ το nominal `baseOffset+height` που το υπερεκτιμά). Το δοκάρι
    // είναι ΟΛΟΚΛΗΡΟ από πάνω → ΔΕΝ καλύπτει τις πλάγιες όψεις. Χωρίς αυτόν τον έλεγχο, ένας
    // collinear support wall με ίδιο πλάτος (παρειές συμπίπτουν με του δοκαριού) «έτρωγε»
    // ασύμμετρα ΤΗ ΜΙΑ όψη (point-in-polygon boundary convention· Giorgio 2026-06-13 Firestore).
    if (w.params.topBinding === 'attached') return false;
    const wallBotMm = floorElevationMm + (w.params.baseOffset ?? 0);
    const wallTopMm = wallBotMm + w.params.height;
    return wallTopMm > band.zBotMm + WALL_BEAM_BAND_TOL_MM && wallBotMm < band.zTopMm - WALL_BEAM_BAND_TOL_MM;
  });
}

/**
 * Minimal structural shape ενός τοίχου-εμποδίου για τον σοβά. Το ικανοποιούν ΚΑΙ
 * το BIM `WallEntity` ΚΑΙ το canvas `DxfWall` (direct entity· δεν δηλώνει `ifcType`,
 * άρα δεν είναι assignable στο `WallEntity`). Εξαρτόμαστε από το ελάχιστο που
 * διαβάζεται (id/kind/params) → μηδέν cast και στους δύο pipelines (3D & 2D).
 */
export interface WallFinishObstacle {
  readonly id: string;
  readonly kind: WallEntity['kind'];
  readonly params: WallEntity['params'];
}

/**
 * ADR-449 Slice 6 — minimal structural shape ενός **δοκαριού-εμποδίου** για τον σοβά
 * κολόνας: plan outline (κορυφές) + `depth` (structural depth = κατακόρυφη έκταση
 * της σύνδεσης· καθορίζει τη ζώνη ύψους που αφαιρείται από την παρειά της κολόνας —
 * height-aware junction). Το ικανοποιούν ΚΑΙ το BIM `BeamEntity` ΚΑΙ το canvas `DxfBeam`
 * → μηδέν cast σε 3D & BOQ.
 */
export interface BeamFinishObstacle {
  readonly id: string;
  // ADR-449 Slice 9 — `startPoint`/`endPoint` → άξονας δοκαριού για **directional**
  // dilation (γεφύρωμα flush μόνο κατά τον άξονα). BIM `BeamEntity` + canvas `DxfBeam`
  // τα έχουν ήδη (ίδιο pattern με `BeamFinishSource`) → μηδέν cast.
  readonly params: { readonly depth: number; readonly startPoint: Point3D; readonly endPoint: Point3D };
  readonly geometry: { readonly outline: { readonly vertices: readonly Point3D[] } };
}

/**
 * ADR-449 Slice 6 — minimal structural shape μιας **κολόνας-εμποδίου** για τον σοβά
 * δοκαριού: μόνο το plan footprint. Ικανοποιείται από BIM `ColumnEntity` + canvas
 * `DxfColumn`.
 */
export interface ColumnFinishObstacle {
  readonly id: string;
  readonly geometry: { readonly footprint: { readonly vertices: readonly Point3D[] } };
}

/** Minimal structural shape μιας κολόνας για face-resolution (BIM + Dxf entity). */
export interface ColumnFinishSource {
  readonly params: Pick<ColumnParams, 'finish' | 'sceneUnits' | 'envelopeFunction'>;
}

/**
 * Minimal structural shape ενός δοκαριού για face-resolution (BIM + Dxf entity).
 * Χρειάζεται επιπλέον `startPoint`/`endPoint` ώστε να βγει η κατεύθυνση άξονα →
 * `includeEdge` predicate (κρατά μόνο τις πλάγιες όψεις ∥ άξονα).
 */
export interface BeamFinishSource {
  readonly params: Pick<
    BeamParams,
    'finish' | 'sceneUnits' | 'envelopeFunction' | 'startPoint' | 'endPoint' | 'topElevation' | 'depth' | 'zOffset'
  >;
}

/** Wall → plan footprint polygon (outer ακμή + αντίστροφη inner). */
export function wallFootprintPolygon(wall: WallFinishObstacle): Pt2[] {
  const g = computeWallGeometry(wall.params, wall.kind);
  const outer = g.outerEdge.points.map(toPt2);
  const inner = [...g.innerEdge.points].reverse().map(toPt2);
  return [...outer, ...inner];
}

/** Μοναδιαία κατεύθυνση άξονα δοκαριού-obstacle (start→end) στο plan. `null` αν εκφυλισμένη. */
function beamObstacleAxis(beam: BeamFinishObstacle): Pt2 | null {
  const dx = beam.params.endPoint.x - beam.params.startPoint.x;
  const dy = beam.params.endPoint.y - beam.params.startPoint.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  return { x: dx / len, y: dy / len };
}

/**
 * ADR-449 Slice 9 — beam-obstacle polygon για το resolve της κολόνας: το outline του
 * δοκαριού, **directional-dilated ΜΟΝΟ κατά τον άξονά του** κατά την join tolerance ώστε
 * το flush άκρο να γεφυρώνεται (η παρειά κολόνας να μετράει καλυμμένη) ΧΩΡΙΣ εγκάρσια
 * συρρίκνωση του remnant σοβά (δες `STRUCTURAL_JOIN_TOL_MM`). `dCanvas` = tol × scale.
 * Εκφυλισμένος άξονας → raw outline (μηδέν dilation· degenerate beam = no-op).
 */
function beamObstaclePolygon(beam: BeamFinishObstacle, dCanvas: number): Pt2[] {
  const pts = beam.geometry.outline.vertices.map(toPt2);
  const axis = beamObstacleAxis(beam);
  return axis ? dilatePolygonAlongAxis(pts, axis, dCanvas) : pts;
}

/** Εξώτατες ακμές components που περικλείουν χώρο (holes>0) → exterior reference. */
function collectExteriorEdges(walls: readonly WallFinishObstacle[]): Array<[Pt2, Pt2]> {
  const fp = computeBuildingFootprint(
    walls.map((w) => ({ id: w.id, kind: w.kind, params: w.params })),
  );
  const edges: Array<[Pt2, Pt2]> = [];
  for (const comp of fp.components) {
    if (comp.holes.length === 0) continue; // open-structure → όχι exterior boundary
    const pts = comp.outer.points.points; // FootprintRing.points = Polyline3D → .points = Point3D[]
    for (let i = 0; i < pts.length; i++) {
      edges.push([toPt2(pts[i]), toPt2(pts[(i + 1) % pts.length])]);
    }
  }
  return edges;
}

/**
 * Build classifier για δομικό στοιχείο (κολόνα/δοκάρι): override-aware + geometric
 * outer-ring test. Entity-agnostic — μόνο `envelopeFunction` + walls + tol. ΕΝΑ SSoT
 * για κολόνες ΚΑΙ δοκάρια (πρώην `buildColumnClassifier`).
 */
export function buildStructuralFinishClassifier(
  envelopeFunction: EnvelopeFunction | undefined,
  walls: readonly WallFinishObstacle[],
  tol: number,
): FinishEdgeClassifier {
  if (envelopeFunction === 'exterior') return () => 'exterior';
  if (envelopeFunction === 'interior') return () => 'interior';
  const exteriorEdges = collectExteriorEdges(walls);
  return (mid) => {
    for (const [a, b] of exteriorEdges) {
      if (pointToSegmentDistance(mid, a, b) <= tol) return 'exterior';
    }
    return 'interior';
  };
}

/**
 * SSoT για το «ποιες παρειές, πόσο εκτεθειμένες, τι υλικό» μιας κολόνας: χτίζει
 * obstacles (footprints τοίχων) + classifier (exterior/interior) και καλεί τον pure
 * resolver. Επιστρέφει τα DERIVED `StructuralFinishFaces` (segments + εμβαδά). ΕΝΑ
 * σημείο — το διαβάζουν ΚΑΙ το BOQ (`computeColumnFinishContribution`) ΚΑΙ το 3D
 * (`buildColumnFinishSkin`). `undefined` όταν ο σοβάς είναι ανενεργός ή το footprint
 * εκφυλισμένο.
 *
 * `coreFootprint`/`heightMm` δίνονται ρητά (όχι από το `column.geometry`) ώστε ο
 * BOQ feed να περνά profile-aware effective geometry, ενώ το 3D τα δικά του.
 */
export function computeColumnFinishFaces(
  column: ColumnFinishSource,
  coreFootprint: readonly { x: number; y: number }[],
  heightMm: number,
  walls: readonly WallFinishObstacle[],
  beams: readonly BeamFinishObstacle[] = [],
): StructuralFinishFaces | undefined {
  const spec = column.params.finish;
  if (!isFinishActive(spec) || coreFootprint.length < 3) return undefined;

  const s = mmToSceneUnits(column.params.sceneUnits ?? 'mm');
  const tol = EXTERIOR_EDGE_TOL_MM * s;
  const classify = buildStructuralFinishClassifier(column.params.envelopeFunction, walls, tol);

  // ADR-449 Slice 6/9 — mutual obstacles: οι τοίχοι (no dilation) + τα δοκάρια που
  // καρφώνονται (**directional**-dilated ΜΟΝΟ κατά τον άξονά τους) κόβουν την παρειά κάτω
  // από τη σύνδεση ΧΩΡΙΣ εγκάρσια συρρίκνωση του remnant (μηδέν κενό στη γωνιακή συμβολή).
  // Cross-type → κανένα beam δεν είναι «εαυτός» της κολόνας (μηδέν self-filter).
  const dCanvas = STRUCTURAL_JOIN_TOL_MM * s;
  return resolveStructuralFinishFaces({
    coreFootprint: coreFootprint.map(toPt2),
    heightMm,
    spec,
    obstacles: [
      ...walls.map(wallFootprintPolygon),
      ...beams.map((b) => beamObstaclePolygon(b, dCanvas)),
    ],
    classify,
    unitToMeters: (1 / s) * MM_TO_M,
  });
}

/**
 * ADR-449 Slice 6 — μια κατακόρυφη ζώνη σοβά κολόνας: plan faces + το z-διάστημα (mm,
 * σχετικά με τη βάση της κολόνας) στο οποίο ισχύουν. Επιτρέπει **height-aware junction**:
 * κάτω ζώνη = πλήρης παρειά (μόνο τοίχοι)· πάνω ζώνη (ζώνη δοκαριού) = junction cut.
 */
export interface ColumnFinishBand {
  readonly faces: StructuralFinishFaces;
  readonly zBottomMm: number;
  readonly zTopMm: number;
}

interface Bbox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
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

function bboxOverlap(a: Bbox, b: Bbox, pad: number): boolean {
  return a.minX - pad <= b.maxX && b.minX <= a.maxX + pad && a.minY - pad <= b.maxY && b.minY <= a.maxY + pad;
}

/**
 * Ύψος της ζώνης σύνδεσης (mm) = max structural depth ανάμεσα στα δοκάρια που πραγματικά
 * αγγίζουν την κολόνα (bbox overlap, με join-tolerance pad). Υπόθεση v1: το δοκάρι κάθεται
 * στην **κορυφή** της κολόνας (beam top ≈ column top — τυπικό frame) → ζώνη = top `depth`.
 * Ακριβής elevation-based banding (sloped/offset beams) = DEFER.
 */
function junctionBandHeightMm(footprintBbox: Bbox, beams: readonly BeamFinishObstacle[], pad: number): number {
  let maxDepth = 0;
  for (const b of beams) {
    if (bboxOverlap(footprintBbox, bboxOf(b.geometry.outline.vertices), pad)) {
      maxDepth = Math.max(maxDepth, b.params.depth);
    }
  }
  return maxDepth;
}

/**
 * ADR-449 Slice 6 — **height-aware** σοβάς κολόνας ως κατακόρυφες ζώνες. Η αφαίρεση
 * λόγω δοκαριών ισχύει ΜΟΝΟ στη ζώνη ύψους του δοκαριού (πάνω), όχι σε όλο το ύψος —
 * αλλιώς η παρειά έμενε γυμνή για 3000mm ενώ το δοκάρι πιάνει μόνο ~500mm. Κάτω ζώνη =
 * walls-only (πλήρης παρειά)· πάνω ζώνη = walls + beams (junction cut). Το διαβάζουν 3D
 * (ένα prism ανά ζώνη) + BOQ (banded area). `undefined` όταν ο σοβάς είναι ανενεργός.
 */
export function computeColumnFinishBands(
  column: ColumnFinishSource,
  coreFootprint: readonly { x: number; y: number }[],
  heightMm: number,
  walls: readonly WallFinishObstacle[],
  beams: readonly BeamFinishObstacle[] = [],
): ColumnFinishBand[] | undefined {
  const full = computeColumnFinishFaces(column, coreFootprint, heightMm, walls);
  if (!full) return undefined;
  if (beams.length === 0) return [{ faces: full, zBottomMm: 0, zTopMm: heightMm }];

  const s = mmToSceneUnits(column.params.sceneUnits ?? 'mm');
  const bandHeightMm = junctionBandHeightMm(bboxOf(coreFootprint), beams, STRUCTURAL_JOIN_TOL_MM * s);
  const bandBottomMm = heightMm - bandHeightMm;
  // Κανένα framing beam (bandHeight 0) ή δοκάρι ψηλότερο από την κολόνα → πλήρης παρειά.
  if (bandHeightMm <= 0 || bandBottomMm <= 0) {
    const junctionFull = computeColumnFinishFaces(column, coreFootprint, heightMm, walls, beams);
    return [{ faces: junctionFull ?? full, zBottomMm: 0, zTopMm: heightMm }];
  }
  const junction = computeColumnFinishFaces(column, coreFootprint, heightMm, walls, beams);
  if (!junction) return [{ faces: full, zBottomMm: 0, zTopMm: heightMm }];
  return [
    { faces: full, zBottomMm: 0, zTopMm: bandBottomMm },
    { faces: junction, zBottomMm: bandBottomMm, zTopMm: heightMm },
  ];
}

/** Σ (plan-length × band-height) ανά classification — banded εμβαδά για BOQ. */
function bandedFinishAreasM2(bands: readonly ColumnFinishBand[]): { interiorAreaM2: number; exteriorAreaM2: number } {
  let interiorAreaM2 = 0;
  let exteriorAreaM2 = 0;
  for (const band of bands) {
    const hM = Math.max(0, band.zTopMm - band.zBottomMm) * MM_TO_M;
    for (const seg of band.faces.segments) {
      const area = seg.lengthM * hM;
      if (seg.classification === 'exterior') exteriorAreaM2 += area;
      else interiorAreaM2 += area;
    }
  }
  return { interiorAreaM2, exteriorAreaM2 };
}

/** Μοναδιαία κατεύθυνση άξονα δοκαριού στο plan (start→end). `null` αν εκφυλισμένη. */
function beamAxisUnit(params: BeamFinishSource['params']): Pt2 | null {
  const dx = params.endPoint.x - params.startPoint.x;
  const dy = params.endPoint.y - params.startPoint.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  return { x: dx / len, y: dy / len };
}

/**
 * ADR-449 Slice 4 — SSoT για τις finish faces ενός **δοκαριού**: mirror του
 * `computeColumnFinishFaces` αλλά `heightMm = depth` (structural depth = ύψος της
 * πλάγιας όψης) και `includeEdge` που κρατά **μόνο τις πλάγιες όψεις** (ακμές ∥
 * άξονα). Τα **άκρα** (ακμές ⊥ άξονα) είναι δομική σύνδεση/frame-into → ποτέ
 * σοβατισμένα. Η πάνω όψη (πλάκα) + κάτω όψη (soffit/κορυφές τοίχων) είναι ΟΡΙΖΟΝΤΙΕΣ
 * → εκτός του vertical-band μοντέλου του resolver (bottom-coverage = DEFER). Walls =
 * obstacles (κόβουν πλάγια όψη που καλύπτεται) + exterior/interior classifier. ΕΝΑ
 * σημείο — το διαβάζουν BOQ + 3D + 2D. `undefined` όταν σοβάς ανενεργός / εκφυλισμένο.
 */
export function computeBeamFinishFaces(
  beam: BeamFinishSource,
  outline: readonly { x: number; y: number }[],
  depthMm: number,
  walls: readonly WallFinishObstacle[],
  columns: readonly ColumnFinishObstacle[] = [],
  floorElevationMm = 0,
): StructuralFinishFaces | undefined {
  const spec = beam.params.finish;
  if (!isFinishActive(spec) || outline.length < 3) return undefined;
  const axis = beamAxisUnit(beam.params);
  if (!axis) return undefined;

  const s = mmToSceneUnits(beam.params.sceneUnits ?? 'mm');
  const tol = EXTERIOR_EDGE_TOL_MM * s;
  // ADR-449 Slice 8 — height-aware wall coverage: οι τοίχοι-στηρίγματα κάτω από το δοκάρι
  // (κορυφή ≤ κάτω παρειά) ΔΕΝ καλύπτουν τις πλάγιες όψεις (είναι πάνω τους, ορατές). Ο
  // classifier τρέχει στο ΠΛΗΡΕΣ wall set (exterior/interior boundary = building footprint).
  const coveringWalls = wallsOverlappingBeamBand(walls, beam.params, floorElevationMm);
  const classify = buildStructuralFinishClassifier(beam.params.envelopeFunction, walls, tol);

  // ADR-449 Slice 6/9 — mutual obstacles: οι τοίχοι (no dilation) + οι κολόνες (**ΧΩΡΙΣ
  // dilation**) κόβουν το τμήμα της πλάγιας όψης μέσα στη σύνδεση. Σε flush framing η
  // κολόνα ΔΕΝ επικαλύπτει την πλάγια όψη (κάθετη, ακουμπά μόνο τη γωνία) → μηδέν trim →
  // η όψη φτάνει τη γωνία· σε πραγματικό overlap (manual) → coveredIntervals κόβει σωστά
  // χωρίς tolerance. (Η isotropic dilation εδώ «έτρωγε» 10mm από την όψη → κενό.)
  // Cross-type → καμία κολόνα δεν είναι «εαυτός» του δοκαριού (μηδέν self-filter).
  return resolveStructuralFinishFaces({
    coreFootprint: outline.map(toPt2),
    heightMm: depthMm,
    spec,
    obstacles: [
      ...coveringWalls.map(wallFootprintPolygon),
      ...columns.map((c) => c.geometry.footprint.vertices.map(toPt2)),
    ],
    classify,
    unitToMeters: (1 / s) * MM_TO_M,
    // Κράτα μόνο ακμές ∥ άξονα (πλάγιες όψεις)· απόκλεισε τα άκρα (⊥ άξονα).
    includeEdge: (a, b) => {
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const elen = Math.hypot(ex, ey);
      if (elen < 1e-9) return false;
      return Math.abs((ex / elen) * axis.x + (ey / elen) * axis.y) > 0.5;
    },
  });
}

/**
 * Καθαρό derived contribution σοβά μιας κολόνας (interior/exterior εμβαδά + υλικά),
 * έτοιμο για το BOQ bridge. `undefined` όταν ο σοβάς είναι ανενεργός ή η σκηνή λείπει.
 * `geometry` = profile-aware (από τον feed) ώστε ύψος/footprint να είναι τα effective.
 */
export function computeColumnFinishContribution(
  column: ColumnEntity,
  geometry: ColumnGeometry,
  scene: SceneModel | null,
): FinishBoqContribution | undefined {
  const spec = column.params.finish;
  if (!isFinishActive(spec) || !scene) return undefined;

  const walls = scene.entities.filter(isWallEntity);
  // ADR-449 Slice 6 — τα δοκάρια ως mutual obstacles → το BOQ δεν μετρά την εμβυθισμένη
  // διεπαφή κολόνας↔δοκαριού (Revit join), αλλά **height-aware**: η αφαίρεση ισχύει μόνο
  // στη ζώνη ύψους του δοκαριού (κάτω ζώνη = πλήρης παρειά). Ίδιο banding με το 3D.
  const beams = scene.entities.filter(isBeamEntity);
  const bands = computeColumnFinishBands(column, geometry.footprint.vertices, geometry.height, walls, beams);
  if (!bands) return undefined;
  const { interiorAreaM2, exteriorAreaM2 } = bandedFinishAreasM2(bands);
  if (interiorAreaM2 <= 0 && exteriorAreaM2 <= 0) return undefined;

  return {
    interiorAreaM2,
    exteriorAreaM2,
    interiorMaterialId: spec.interiorMaterialId,
    exteriorMaterialId: spec.exteriorMaterialId,
  };
}

/**
 * ADR-449 Slice 4 — καθαρό derived contribution σοβά **δοκαριού** (πλάγιες όψεις,
 * εμβαδά interior/exterior + υλικά) έτοιμο για το BOQ bridge. Mirror του
 * `computeColumnFinishContribution`. `undefined` όταν σοβάς ανενεργός ή σκηνή λείπει.
 */
export function computeBeamFinishContribution(
  beam: BeamEntity,
  scene: SceneModel | null,
): FinishBoqContribution | undefined {
  const spec = beam.params.finish;
  if (!isFinishActive(spec) || !scene) return undefined;

  const walls = scene.entities.filter(isWallEntity);
  // ADR-449 Slice 6 — οι κολόνες ως mutual obstacles → το BOQ κόβει το τμήμα της πλάγιας
  // όψης δοκαριού μέσα στη σύνδεση (ίδιο obstacle set με 2D/3D, ένας resolver).
  const columns = scene.entities.filter(isColumnEntity);
  const faces = computeBeamFinishFaces(beam, beam.geometry.outline.vertices, beam.params.depth, walls, columns);
  if (!faces || (faces.interiorAreaM2 <= 0 && faces.exteriorAreaM2 <= 0)) return undefined;

  return {
    interiorAreaM2: faces.interiorAreaM2,
    exteriorAreaM2: faces.exteriorAreaM2,
    interiorMaterialId: spec.interiorMaterialId,
    exteriorMaterialId: spec.exteriorMaterialId,
  };
}

// ADR-449 Slice 7 — Merged structural silhouette (scene adapter) μετακινήθηκε στο
// `structural-finish-scene-silhouette.ts` (Google file-size SSoT, N.7.1).
export { computeStructuralFinishSilhouette } from './structural-finish-scene-silhouette';
