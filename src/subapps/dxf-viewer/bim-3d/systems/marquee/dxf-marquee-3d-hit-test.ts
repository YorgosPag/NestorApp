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
 *   3. **near-plane clipping ΑΝΑ ΤΜΗΜΑ** (ADR-717 Φ Γ, `screen-projection-clip`): ό,τι περνά
 *      πίσω από την κάμερα κόβεται στο επίπεδο, δεν ακυρώνει την οντότητα· η απόσταση
 *      (`CAMERA_FAR`) ΔΕΝ είναι λόγος απόρριψης·
 *   4. WINDOW  (L→R): ΟΛΟ το προβεβλημένο σχήμα μέσα στο ορθογώνιο (και τίποτα κομμένο)·
 *      CROSSING (R→L): το ορθογώνιο αγγίζει έστω ένα ορατό τμήμα του.
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
import { dxfPlanToWorld } from '../../viewport/coordinate-transforms';
import { createScreenClipper, type ClipPoint, type ScreenClipper } from '../../viewport/screen-projection-clip';
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

/** Το προβεβλημένο περίγραμμα μιας οντότητας, μετά το near-plane clipping. */
interface ProjectedOutline {
  /** Οι ΟΡΑΤΕΣ διαδρομές σε client px. Ένα τμήμα πίσω από την κάμερα σπάει το πολύγραμμο σε δύο. */
  readonly polys: Point2D[][];
  /** Έπεσε έστω ένα σημείο πίσω από το near plane; (Το WINDOW το χρειάζεται· το CROSSING όχι.) */
  readonly clipped: boolean;
}

/**
 * Οι προβεβλημένες (client px) πολυγραμμές μιας οντότητας, με **near-plane clipping ΑΝΑ ΤΜΗΜΑ**
 * (ADR-717 Φ Γ). `null` μόνο για τύπο χωρίς γραμμική αναπαράσταση.
 *
 * Πριν, ΕΝΑ μη προβαλλόμενο σημείο έριχνε ΟΛΗ την οντότητα (`if (!screen) return null`) — και
 * επειδή ο κοινός projector απέρριπτε και ό,τι ξεπερνούσε το `CAMERA_FAR` (1 km), ένα τοπογραφικό
 * 3 km έδινε 4/4 σημεία εκτός ⇒ **μηδέν επιλογή** (μετρημένο). Δύο ανεξάρτητα σφάλματα στη σειρά:
 * το κατώφλι διορθώθηκε στην πηγή (`screen-projection-clip`), και εδώ φεύγει το «όλα ή τίποτα».
 */
function projectEntityOutline(
  entity: DxfEntityUnion,
  unitToMm: number,
  floorElevationMm: number,
  clipper: ScreenClipper,
): ProjectedOutline | null {
  const outlines = dxfEntityOutlineSegments(entity, unitToMm);
  if (outlines.length === 0) return null;
  const polys: Point2D[][] = [];
  let clipped = false;
  for (const poly of outlines) {
    const clipPts: ClipPoint[] = poly.map((p) =>
      clipper.projectToClip(dxfPlanToWorld(p.x, p.y, floorElevationMm)),
    );
    const result = clipper.clipPolylineToScreen(clipPts);
    if (result.clipped) clipped = true;
    polys.push(...result.runs);
  }
  return { polys, clipped };
}

/**
 * Ικανοποιεί το προβεβλημένο σχήμα το marquee; (window = όλο μέσα, crossing = αγγίζει).
 *
 * Η ασυμμετρία είναι ΣΚΟΠΙΜΗ και είναι το ίδιο το νόημα των δύο τρόπων (ADR-717 Φ Γ):
 *
 *  • **CROSSING** ρωτά «αγγίζει;» — μια θετική απάντηση από ΕΝΑ ορατό τμήμα είναι πλήρης απάντηση.
 *    Ένα αποκομμένο άκρο δεν ακυρώνει τα υπόλοιπα.
 *  • **WINDOW** ρωτά «είναι ΟΛΟ μέσα;» — αυτό δεν απαντιέται από τα ορατά τμήματα μόνο. Αν κάτι
 *    κόπηκε, υπάρχει γεωμετρία που ΔΕΝ προβάλλεται, άρα δεν μπορεί να αποδειχθεί «όλο μέσα».
 *    Χαλάρωσή του θα έπιανε οντότητες που ξεφεύγουν από το πλαίσιο — δηλαδή θα έλεγε ψέματα.
 */
function satisfiesMarquee(
  outline: ProjectedOutline,
  rect: ScreenRect,
  isCrossing: boolean,
  tolerance: number,
): boolean {
  if (isCrossing) {
    return outline.polys.some((poly) => polylineIntersectsRect(poly, isClosedPolyline(poly), rect));
  }
  if (outline.clipped) return false;
  const bounds = screenBounds(outline.polys.flat());
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
  // Ένα rect + ΕΝΑΣ view-projection πίνακας για ΟΛΑ τα σημεία — ποτέ getBoundingClientRect ανά
  // κορυφή (forced layout flush) και ποτέ ξαναχτίσιμο του P·V ανά κορυφή.
  const clipper = createScreenClipper(camera, canvas);

  for (const floor of floors) {
    const unitToMm = dxfSceneUnitToMm(floor.scene);
    for (const entity of floor.scene.entities) {
      scopeIds.add(entity.id);
      if (entity.visible === false) continue; // ίδιο φίλτρο με το single-click pick
      const outline = projectEntityOutline(entity, unitToMm, floor.floorElevationMm, clipper);
      if (!outline) continue; // μη υποστηριζόμενος τύπος (καμία γραμμική αναπαράσταση)
      if (satisfiesMarquee(outline, rect, isCrossing, tolerance)) ids.push(entity.id);
    }
  }

  return { ids, scopeIds, selectionType };
}
