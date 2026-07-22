/**
 * generic-solid-plan-outline — SSoT για το **περίγραμμα κάτοψης** κάθε παραμετρικού στερεού
 * (ADR-684 §6 «2D κάτοψη: projected outline»).
 *
 * Big-player faithful (Revit / ArchiCAD / C4D plan view): το στερεό προβάλλεται στην κάτοψη ως το
 * πραγματικό του περίγραμμα — **κύκλος** (σφαίρα/κύλινδρος/δίσκος/κώνος), **κανονικό n-γωνο** (πρίσμα),
 * **ορθογώνιο** (κουτί/πυραμίδα), **δακτύλιος = δύο ομόκεντροι κύκλοι** (κουλούρι/torus) — ΟΧΙ πάντα
 * το ορθογώνιο του bbox (που έκανε τα 7/8 σχήματα να φαίνονται ίδια στη Φ2).
 *
 * Καθαρή SSoT συνάρτηση, μία πηγή για: (α) το `footprint` του `computeGenericSolidGeometry`
 * (→ hit-test/bounds/export), και (β) τον `GenericSolidRenderer` (→ οπτικό περίγραμμα, incl. η τρύπα
 * του torus). Οι κύκλοι tessellate-άρονται σε πολύγωνο (CAD πρακτική) ώστε να μοιράζονται το ΕΝΑ
 * render path (`drawPolygonPath`) με τα ορθογώνια — κανένα `ctx.arc` σε world-space.
 *
 * Reuse (N.18, μηδέν clone): ορθογώνια → `computeCentredBoxFootprint` (ίδιο rotate/translate με έπιπλο/
 * imported-mesh)· περιστροφή → `rotateVector` (→ canonical `rotatePoint`, ADR-188).
 *
 * @see ./generic-solid-geometry — καταναλωτής #1 (footprint = rings[0])
 * @see ../../renderers/GenericSolidRenderer — καταναλωτής #2 (όλα τα rings)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Point3D } from '../../types/bim-base';
import { mmToSceneUnits, type SceneUnits } from '../../../utils/scene-units';
import { computeCentredBoxFootprint } from '../../geometry/shared/centred-box-footprint';
import { rotateVector } from '../../grips/grip-math';
import { MIN_PRISM_SIDES, type GenericSolidShape } from './generic-solid-types';

/** Τμήματα tessellation κύκλου — λείο περίγραμμα κάτοψης (CAD πρακτική). */
const CIRCLE_SEGMENTS = 64;

/** Γωνία (μοίρες) της πρώτης κορυφής πρίσματος — στο +Y (βορράς) ώστε το n-γωνο να «κάθεται» φυσικά. */
const PRISM_FIRST_VERTEX_DEG = 90;

/** Μια εσωτερική χαρακτηριστική ακμή κάτοψης — προβολή πραγματικής 3Δ ακμής, σε canvas units. */
export type GenericSolidPlanEdge = readonly [Point3D, Point3D];

/** Καμία εσωτερική ακμή — μοιραζόμενη σταθερά για τα σχήματα που το περίγραμμα τα περιγράφει πλήρως. */
const NO_EDGES: readonly GenericSolidPlanEdge[] = [];

/** Το περίγραμμα κάτοψης ως κλειστά δαχτυλίδια σε **canvas units**. */
export interface GenericSolidPlanOutline {
  /** `rings[0]` = εξωτερικό όριο· τυχόν επόμενα = τρύπες (μόνο ο torus έχει έναν εσωτερικό δακτύλιο). */
  readonly rings: readonly (readonly Point3D[])[];
  /**
   * Εσωτερικές χαρακτηριστικές ακμές (top-view feature edges) — π.χ. οι 4 ακμές γωνία→κορυφή της
   * πυραμίδας που, ειδωμένες από πάνω, σχηματίζουν το «Χ» (Revit/ArchiCAD/C4D κάτοψη). Κενό για τα
   * σχήματα που το εξωτερικό περίγραμμα (κύκλος/n-γωνο/ορθογώνιο) τα περιγράφει ήδη πλήρως.
   */
  readonly interiorEdges: readonly GenericSolidPlanEdge[];
}

/** Περιστροφή (CCW, μοίρες) περί την αρχή + μεταφορά στο `position` — τοπικό → world. */
function placeRing(
  local: readonly Point2D[],
  position: Readonly<Point3D>,
  rotationDeg: number,
): Point3D[] {
  return local.map((v) => {
    const r = rotateVector(v, rotationDeg);
    return { x: position.x + r.x, y: position.y + r.y, z: 0 };
  });
}

/** Κορυφές κανονικού n-γώνου (κέντρο στην αρχή), circumradius `radiusCanvas`, canvas units. */
function regularPolygonLocal(radiusCanvas: number, sides: number, firstVertexDeg: number): Point2D[] {
  const start = (firstVertexDeg * Math.PI) / 180;
  const step = (2 * Math.PI) / sides;
  const pts: Point2D[] = [];
  for (let i = 0; i < sides; i++) {
    const a = start + i * step;
    pts.push({ x: radiusCanvas * Math.cos(a), y: radiusCanvas * Math.sin(a) });
  }
  return pts;
}

/** Δαχτυλίδι κύκλου ακτίνας `radiusMm` γύρω από το `position`, tessellated σε πολύγωνο. */
function circleRing(
  radiusMm: number,
  s: number,
  position: Readonly<Point3D>,
  rotationDeg: number,
): Point3D[] {
  return placeRing(regularPolygonLocal(radiusMm * s, CIRCLE_SEGMENTS, 0), position, rotationDeg);
}

/** Ορθογώνιο ίχνος (reuse του centred-box SSoT — ίδιο rotate/translate). */
function rectangleRing(
  widthMm: number,
  depthMm: number,
  position: Readonly<Point3D>,
  rotationDeg: number,
  sceneUnits: SceneUnits | undefined,
): readonly Point3D[] {
  return computeCentredBoxFootprint({
    widthMm,
    depthMm,
    heightMm: 0,
    position,
    rotationDeg,
    sceneUnits,
  }).footprint.vertices;
}

/**
 * Το περίγραμμα κάτοψης ενός στερεού. Καθαρή SSoT: κύκλος / n-γωνο / ορθογώνιο / δακτύλιος ανά σχήμα.
 */
export function computeGenericSolidPlanOutline(
  shape: GenericSolidShape,
  position: Readonly<Point3D>,
  rotationDeg: number,
  sceneUnits: SceneUnits | undefined,
): GenericSolidPlanOutline {
  const s = mmToSceneUnits(sceneUnits ?? 'mm');
  switch (shape.kind) {
    case 'box':
      return { rings: [rectangleRing(shape.widthMm, shape.depthMm, position, rotationDeg, sceneUnits)], interiorEdges: NO_EDGES };
    case 'pyramid': {
      const base = rectangleRing(shape.baseWidthMm, shape.baseDepthMm, position, rotationDeg, sceneUnits);
      return { rings: [base], interiorEdges: pyramidApexEdges(base, position) };
    }
    case 'sphere':
      return { rings: [circleRing(shape.radiusMm, s, position, rotationDeg)], interiorEdges: NO_EDGES };
    case 'cylinder':
      return { rings: [circleRing(shape.radiusMm, s, position, rotationDeg)], interiorEdges: NO_EDGES };
    case 'disc':
      return { rings: [circleRing(shape.radiusMm, s, position, rotationDeg)], interiorEdges: NO_EDGES };
    case 'cone':
      return { rings: [circleRing(Math.max(shape.radiusBottomMm, shape.radiusTopMm), s, position, rotationDeg)], interiorEdges: NO_EDGES };
    case 'prism': {
      const sides = Math.max(MIN_PRISM_SIDES, Math.floor(shape.sides));
      const local = regularPolygonLocal(shape.radiusMm * s, sides, PRISM_FIRST_VERTEX_DEG);
      return { rings: [placeRing(local, position, rotationDeg)], interiorEdges: NO_EDGES };
    }
    case 'torus': {
      const outer = circleRing(shape.majorRadiusMm + shape.tubeRadiusMm, s, position, rotationDeg);
      const innerRadiusMm = shape.majorRadiusMm - shape.tubeRadiusMm;
      return innerRadiusMm > 0
        ? { rings: [outer, circleRing(innerRadiusMm, s, position, rotationDeg)], interiorEdges: NO_EDGES }
        : { rings: [outer], interiorEdges: NO_EDGES };
    }
  }
}

/**
 * Οι 4 «ακμές-γωνίες» (hip edges) της πυραμίδας προβεβλημένες στην κάτοψη: η κορυφή κάθεται πάνω από
 * το κέντρο βάσης (= `position`), άρα κάθε ακμή γωνία→κορυφή προβάλλεται σε γωνία→κέντρο. Τα 4 τμήματα
 * (2 πλήρεις διαγώνιοι) = το «Χ» που δείχνει η C4D/Revit όταν κοιτάς την πυραμίδα από πάνω.
 */
function pyramidApexEdges(base: readonly Point3D[], position: Readonly<Point3D>): GenericSolidPlanEdge[] {
  const apex: Point3D = { x: position.x, y: position.y, z: 0 };
  return base.map((corner) => [corner, apex] as const);
}
