/**
 * Hatch pick-point region detection (ADR-507 Φ3 — Τρόπος Β).
 *
 * **Ενοποιημένος layered SSoT** — η ΙΔΙΑ ανίχνευση δωματίου με το «Τοποθέτηση χώρου»
 * (thermal-space) + floor-finish + «τοίχος/κολώνα από περίγραμμα». Μία πηγή αλήθειας:
 * γραμμοσκίαση ≡ Place Space δίνουν ίδιο δωμάτιο.
 *
 *   - **Layer 1 (preferred):** room detector `getCachedRegionPerimeters` +
 *     `pickSmallestContainingPerimeter` (`perimeter-from-faces`). Πιάνει δωμάτια από
 *     **LINE + πολυγραμμές + space-separators** (μέσω `extractLineSegments`) — γι' αυτό
 *     αναγνωρίζει double-line τοίχους πραγματικής κάτοψης που ο `auto-area-hit` έχανε.
 *   - **Layer 2 (fallback):** `getAutoAreaHitResult` για **καθαρές κλειστές
 *     πολυγραμμές / ορθογώνια / κύκλους** που δεν σχηματίζουν room-loop.
 *
 * Holes (νησιά) υπολογίζονται με ΕΝΑ SSoT (`collectHoleAreas`) πάνω στο επιλεγμένο
 * `outer`, ανεξάρτητα από το Layer — σωστό AutoCAD island detection σε όλες τις
 * περιπτώσεις (το «ορθογώνιο-με-τρύπα» κρατά την τρύπα ακόμη κι όταν κερδίσει ο
 * room detector). Δεν εφαρμόζεται `isPerimeterOversized` guard: η γραμμοσκίαση γεμίζει
 * δωμάτιο οποιουδήποτε μεγέθους· το `pickSmallestContainingPerimeter` ήδη αποκλείει το
 * εξωτερικό περίγραμμα του κτιρίου (διαλέγει το μικρότερο εμπεριέχον loop).
 *
 * Pure — καμία React/command/store εξάρτηση. Κοινό για το click commit
 * (`buildHatchFromPick`) ΚΑΙ το live ghost (`useAutoAreaMouseMove`) → preview ≡ commit.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 * @see ../walls/perimeter-from-faces.ts (room detector SSoT)
 * @see ../../hooks/drawing/useThermalSpaceTool.ts (πρότυπο click-in-region)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { Overlay } from '../../overlays/types';
import type { SceneUnits } from '../../utils/scene-units';
import { pickRegionPerimeterAt } from '../walls/perimeter-from-faces';
import { collectHoleAreas, getAutoAreaHitResult } from '../../systems/auto-area/auto-area-hit';
import { calculatePolygonArea } from '../../rendering/entities/shared/geometry-polyline-utils';

export interface ResolveHatchPickRegionParams {
  /** Σημείο κλικ/hover (world coords) μέσα στην περιοχή. */
  readonly worldPoint: Point2D;
  /** Οντότητες της ενεργής σκηνής (DXF + BIM). */
  readonly entities: ReadonlyArray<Entity>;
  /** Overlays (χρωματιστά layers) ως πρόσθετες πηγές κλειστών περιοχών (fallback). */
  readonly overlays: ReadonlyArray<Overlay>;
  /** Τρέχον transform scale (pixels ανά world unit) — για snap/gap tolerance. */
  readonly scale: number;
  /** Μονάδες σχεδίου — για την units-aware ανοχή βρόχου (ίδια με Place Space). */
  readonly sceneUnits: SceneUnits;
  /** AutoCAD HPGAPTOL (world units) — γεφυρώνει κενά στις ακμές. */
  readonly gapTolerance: number;
}

/** Εξωτερικός δακτύλιος + νησιά (holes) μιας ανιχνευμένης περιοχής. */
export interface HatchPickRegion {
  readonly outer: Point2D[];
  readonly holes: Point2D[][];
}

/**
 * Επιστρέφει το δωμάτιο/περιοχή κάτω από το `worldPoint` (outer + holes), ή `null`
 * αν δεν βρεθεί κλειστή περιοχή. Layered: room detector πρώτα, auto-area fallback.
 */
export function resolveHatchPickRegion(params: ResolveHatchPickRegionParams): HatchPickRegion | null {
  const { worldPoint, entities, overlays, scale, sceneUnits, gapTolerance } = params;

  // ── Layer 1 — room detector (ΙΔΙΟ SSoT με «Τοποθέτηση χώρου») ───────────────
  const { perimeter: pick } = pickRegionPerimeterAt(worldPoint, entities, sceneUnits);
  if (pick) {
    const outer = pick.polygon.map((p) => ({ x: p.x, y: p.y }));
    const holes = collectHoleAreas(
      outer,
      calculatePolygonArea(outer),
      entities,
      overlays,
      scale,
      gapTolerance,
    ).map((h) => h.polygon);
    return { outer, holes };
  }

  // ── Layer 2 — fallback: καθαρές κλειστές πολυγραμμές/ορθογώνια/κύκλοι + holes ──
  const result = getAutoAreaHitResult(worldPoint, entities, overlays, scale, gapTolerance);
  return result ? { outer: result.polygon, holes: result.holes } : null;
}
