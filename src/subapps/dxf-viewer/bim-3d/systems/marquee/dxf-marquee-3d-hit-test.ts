/**
 * dxf-marquee-3d-hit-test.ts — window/crossing hit resolution για το RAW DXF wireframe
 * μέσα στο 3D viewport (ADR-692 Φ2).
 *
 * Αδελφός του `marquee-3d-hit-test` (BIM), αλλά η γεωμετρία έρχεται από ΑΛΛΗ πηγή: το DXF
 * υπόστρωμα ΔΕΝ έχει per-entity meshes — είναι batched `LineSegments` ανά χρώμα, χωρίς
 * `userData` (ίδιος λόγος που το single-click pick, `dxf-wireframe-hit-test`, δουλεύει σε
 * plan-space και όχι με raycast). Άρα εδώ:
 *
 *   1. παίρνουμε το ΙΔΙΟ plan-mm περίγραμμα που ζωγραφίζει το wireframe/hover glow
 *      (`dxfEntityOutlineSegments` — ένας SSoT, μηδέν νέα tessellation)·
 *   2. το ανεβάζουμε στο επίπεδο του ορόφου του (`dxfPlanToWorld` με το floor elevation,
 *      ADR-537 δ «όλοι οι όροφοι») και το προβάλλουμε σε client px·
 *   3. WINDOW  (L→R): ΟΛΟ το προβεβλημένο σχήμα μέσα στο ορθογώνιο·
 *      CROSSING (R→L): το ορθογώνιο αγγίζει έστω ένα τμήμα του.
 *
 * Ίδια σύμβαση με το BIM: select-through (occlusion-agnostic) — το «μόνο ό,τι φαίνεται»
 * είναι ξεχωριστός άξονας (X-ray toggle), όχι ιδιότητα αυτού του test.
 *
 * Η μονάδα κάθε ορόφου (mm/cm/m/in/ft, ADR-537 γ) εφαρμόζεται ΜΙΑ φορά στο περίγραμμα μέσω
 * του `unitToMm` param του SSoT — καμία δεύτερη μετατροπή κάτω από αυτό το σημείο.
 */

import type * as THREE from 'three';
import type { Point2D } from '../../../rendering/types/Types';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';
import {
  getMarqueeSelectionType,
  type MarqueeSelectionType,
} from '../../../systems/selection/marquee-direction';
import { isFullyInsideWithTolerance } from '../../../systems/selection/universal-marquee-geometry';
import { dxfSceneUnitToMm } from '../../../utils/scene-units';
import { dxfEntityOutlineSegments } from '../../grips/dxf-entity-outline';
import type { DxfPickFloor } from '../../grips/dxf-wireframe-hit-test';
import { dxfPlanToWorld, createWorldToScreenProjector } from '../../viewport/coordinate-transforms';
import {
  screenBounds,
  polylineIntersectsRect,
  isClosedPolyline,
  screenRectFromPoints,
  type ScreenRect,
} from './marquee-screen-geometry';

export interface DxfMarqueeHitInput {
  /** Οι όροφοι DXF που «βλέπει» η ενεργή εμβέλεια (`getDxfFloorScope()`). */
  floors: readonly DxfPickFloor[];
  camera: THREE.Camera;
  /** Το WebGL canvas (`manager.getRendererCanvas()`), για το client-rect. */
  canvas: HTMLElement;
  /** Άγκυρα drag + τρέχων δείκτης, CLIENT px. */
  startPt: Point2D;
  endPt: Point2D;
  /** WINDOW slack σε px (μικροσκοπικές οντότητες πέφτουν σε intersect). Default 0.5. */
  tolerance?: number;
}

export interface DxfMarqueeHitResult {
  /** Τα raw DXF entity ids που ικανοποιούν το marquee. */
  ids: string[];
  /**
   * ΟΛΑ τα entity ids της ενεργής εμβέλειας — ο καλών το χρειάζεται για να ξεχωρίσει τα
   * raw-DXF ids από τα BIM ids μέσα στην ΕΝΙΑΙΑ universal επιλογή (και τα δύο ζουν εκεί ως
   * `dxf-entity`), ώστε add/subtract να μη «φάνε» ξένη επιλογή.
   */
  scopeIds: Set<string>;
  selectionType: MarqueeSelectionType;
}

/** Οι προβεβλημένες (client px) πολυγραμμές μιας οντότητας, ή null αν κάποιο σημείο είναι πίσω από την κάμερα. */
function projectEntityOutline(
  entity: DxfEntityUnion,
  unitToMm: number,
  floorElevationMm: number,
  project: (pos: THREE.Vector3) => Point2D | null,
): Point2D[][] | null {
  const outlines = dxfEntityOutlineSegments(entity, unitToMm);
  if (outlines.length === 0) return null;
  const screenPolys: Point2D[][] = [];
  for (const poly of outlines) {
    const pts: Point2D[] = [];
    for (const p of poly) {
      const screen = project(dxfPlanToWorld(p.x, p.y, floorElevationMm));
      if (!screen) return null; // σημείο πίσω από την κάμερα → μη επιλέξιμη σε αυτό το drag
      pts.push(screen);
    }
    if (pts.length > 0) screenPolys.push(pts);
  }
  return screenPolys.length > 0 ? screenPolys : null;
}

/** Ικανοποιεί το προβεβλημένο σχήμα το marquee; (window = όλο μέσα, crossing = αγγίζει). */
function satisfiesMarquee(
  screenPolys: readonly Point2D[][],
  rect: ScreenRect,
  isCrossing: boolean,
  tolerance: number,
): boolean {
  if (isCrossing) {
    return screenPolys.some((poly) => polylineIntersectsRect(poly, isClosedPolyline(poly), rect));
  }
  const bounds = screenBounds(screenPolys.flat());
  return bounds !== null && isFullyInsideWithTolerance(bounds, rect, tolerance);
}

/**
 * Τα raw DXF entity ids που πιάνει το marquee, σε ΟΛΟΥΣ τους ορόφους της ενεργής εμβέλειας.
 * Read-only — ο καλών εφαρμόζει τα ids στην επιλογή (`applyDxfMarqueeSelection`).
 */
export function collectDxfMarqueeHits(input: DxfMarqueeHitInput): DxfMarqueeHitResult {
  const { floors, camera, canvas, startPt, endPt, tolerance = 0.5 } = input;
  const selectionType = getMarqueeSelectionType(startPt.x, endPt.x);
  const isCrossing = selectionType === 'crossing';
  const rect: ScreenRect = screenRectFromPoints(startPt, endPt);

  const ids: string[] = [];
  const scopeIds = new Set<string>();
  // Ένα rect capture για ΟΛΑ τα σημεία — ποτέ getBoundingClientRect ανά κορυφή.
  const project = createWorldToScreenProjector(camera, canvas);

  for (const floor of floors) {
    const unitToMm = dxfSceneUnitToMm(floor.scene);
    for (const entity of floor.scene.entities) {
      scopeIds.add(entity.id);
      if (entity.visible === false) continue; // ίδιο φίλτρο με το single-click pick
      const screenPolys = projectEntityOutline(entity, unitToMm, floor.floorElevationMm, project);
      if (!screenPolys) continue; // μη υποστηριζόμενος τύπος ή σημείο πίσω από την κάμερα
      if (satisfiesMarquee(screenPolys, rect, isCrossing, tolerance)) ids.push(entity.id);
    }
  }

  return { ids, scopeIds, selectionType };
}
