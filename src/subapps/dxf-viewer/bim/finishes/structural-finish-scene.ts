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
import { isWallEntity } from '../../types/entities';
import type { ColumnEntity, ColumnGeometry, ColumnParams } from '../types/column-types';
import type { BeamEntity, BeamParams } from '../types/beam-types';
import type { WallEntity } from '../types/wall-types';
import type { EnvelopeFunction } from '../types/thermal-envelope-types';
import { computeWallGeometry } from '../geometry/wall-geometry';
import { computeBuildingFootprint } from '../geometry/building-footprint';
import { pointToSegmentDistance } from '../../systems/guides';
import { mmToSceneUnits } from '../../utils/scene-units';
import { resolveStructuralFinishFaces, type FinishEdgeClassifier } from './structural-finish-resolver';
import { isFinishActive, type StructuralFinishFaces } from './structural-finish-types';
import type { FinishBoqContribution } from '../services/structural-finish-boq';
import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';

const MM_TO_M = 0.001;
/** Ανοχή (canvas units ανά mm) — 2mm για «πάνω στο εξώτατο όριο». */
const EXTERIOR_EDGE_TOL_MM = 2;

const toPt2 = (p: { x: number; y: number }): Pt2 => ({ x: p.x, y: p.y });

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
  readonly params: Pick<BeamParams, 'finish' | 'sceneUnits' | 'envelopeFunction' | 'startPoint' | 'endPoint'>;
}

/** Wall → plan footprint polygon (outer ακμή + αντίστροφη inner). */
function wallFootprintPolygon(wall: WallFinishObstacle): Pt2[] {
  const g = computeWallGeometry(wall.params, wall.kind);
  const outer = g.outerEdge.points.map(toPt2);
  const inner = [...g.innerEdge.points].reverse().map(toPt2);
  return [...outer, ...inner];
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
function buildStructuralFinishClassifier(
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
): StructuralFinishFaces | undefined {
  const spec = column.params.finish;
  if (!isFinishActive(spec) || coreFootprint.length < 3) return undefined;

  const s = mmToSceneUnits(column.params.sceneUnits ?? 'mm');
  const tol = EXTERIOR_EDGE_TOL_MM * s;
  const classify = buildStructuralFinishClassifier(column.params.envelopeFunction, walls, tol);

  return resolveStructuralFinishFaces({
    coreFootprint: coreFootprint.map(toPt2),
    heightMm,
    spec,
    obstacles: walls.map(wallFootprintPolygon),
    classify,
    unitToMeters: (1 / s) * MM_TO_M,
  });
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
): StructuralFinishFaces | undefined {
  const spec = beam.params.finish;
  if (!isFinishActive(spec) || outline.length < 3) return undefined;
  const axis = beamAxisUnit(beam.params);
  if (!axis) return undefined;

  const s = mmToSceneUnits(beam.params.sceneUnits ?? 'mm');
  const tol = EXTERIOR_EDGE_TOL_MM * s;
  const classify = buildStructuralFinishClassifier(beam.params.envelopeFunction, walls, tol);

  return resolveStructuralFinishFaces({
    coreFootprint: outline.map(toPt2),
    heightMm: depthMm,
    spec,
    obstacles: walls.map(wallFootprintPolygon),
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
  const faces = computeColumnFinishFaces(column, geometry.footprint.vertices, geometry.height, walls);
  if (!faces || (faces.interiorAreaM2 <= 0 && faces.exteriorAreaM2 <= 0)) return undefined;

  return {
    interiorAreaM2: faces.interiorAreaM2,
    exteriorAreaM2: faces.exteriorAreaM2,
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
  const faces = computeBeamFinishFaces(beam, beam.geometry.outline.vertices, beam.params.depth, walls);
  if (!faces || (faces.interiorAreaM2 <= 0 && faces.exteriorAreaM2 <= 0)) return undefined;

  return {
    interiorAreaM2: faces.interiorAreaM2,
    exteriorAreaM2: faces.exteriorAreaM2,
    interiorMaterialId: spec.interiorMaterialId,
    exteriorMaterialId: spec.exteriorMaterialId,
  };
}
