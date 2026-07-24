/**
 * marquee-3d-apply.ts — ο ΕΝΑΣ ενορχηστρωτής του «σήκωσα το κουμπί, τι επιλέχθηκε;» για το
 * 3D marquee (ADR-692 Φ2). Τρέχει ΜΙΑ φορά ανά mouseup — ποτέ per-frame (ADR-040).
 *
 * Μαζεύει ΚΑΙ τα δύο σύνολα (BIM meshes + raw DXF wireframe, «όλοι οι όροφοι» κατά ADR-537 δ)
 * και τα εφαρμόζει με ΣΥΓΚΕΚΡΙΜΕΝΗ ΣΕΙΡΑ — που είναι το μη-προφανές κομμάτι:
 *
 *   1. φωτογράφισε τα ΗΔΗ επιλεγμένα raw-DXF ids (φιλτραρισμένα στην εμβέλεια),
 *   2. εφάρμοσε ΠΡΩΤΑ το BIM: η εγγραφή στο `Selection3DStore` περνά από τον 3D→universal
 *      bridge, που κάνει `replaceEntitySelection([bimIds])` και ΚΑΘΑΡΙΖΕΙ ολόκληρο τον
 *      `dxf-entity` κουβά (BIM και raw DXF ζουν εκεί με τον ΙΔΙΟ τύπο),
 *   3. εφάρμοσε ΜΕΤΑ το DXF ΠΡΟΣΘΕΤΙΚΑ πάνω στο αποτέλεσμα — έτσι το μεικτό
 *      «άρπαξα τοίχους ΚΑΙ γραμμές κάτοψης» επιβιώνει και στα δύο stores.
 *
 * Αν η σειρά αντιστραφεί, το βήμα 2 σβήνει σιωπηλά ό,τι έγραψε το βήμα 3.
 *
 * Εδώ ζει επίσης ο άξονας «διαμπερής ↔ μόνο ορατά» (X-ray, ADR-692 Φ2): το CPU test μένει
 * ΠΑΝΤΑ occlusion-agnostic και το φίλτρο ορατότητας μπαίνει ΜΕΤΑ, ως τομή με το GPU id-pass —
 * ώστε ο ένας άξονας να μη μολύνει τον άλλο.
 */

import type * as THREE from 'three';
import type { Point2D } from '../../../rendering/types/Types';
import { SelectedEntitiesStore } from '../../../systems/selection/SelectedEntitiesStore';
import { applyDxfMarqueeSelection } from '../../../systems/selection/resolve-dxf-marquee-selection';
import type { MarqueeCombineMode } from '../../../systems/selection/marquee-combine';
import { getDxfFloorScope } from '../../scene/dxf-3d-floor-scope';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';
import { useViewMode3DStore } from '../../stores/ViewMode3DStore';
import { collectBimMarqueeHits } from './marquee-3d-hit-test';
import { collectDxfMarqueeHits } from './dxf-marquee-3d-hit-test';
import { collectVisibleBimIdsInRect } from './marquee-gpu-id-pass';
import { screenRectFromPoints } from './marquee-screen-geometry';

/**
 * Τα BIM ids του marquee, περασμένα (αν χρειάζεται) από το φίλτρο ορατότητας.
 *
 * X-ray ON (default) → select-through: ό,τι βρήκε η CPU προβολή, ακόμη κι αν κρύβεται.
 * X-ray OFF → τομή με το GPU id-pass. Αν το pass ΔΕΝ μπορεί να αποφανθεί (μη υποστηριζόμενη
 * κάμερα / εκφυλισμένο ορθογώνιο) πέφτουμε ΠΙΣΩ σε select-through: καλύτερα το CAD default
 * παρά σιωπηλά άδεια επιλογή.
 */
function resolveBimIds(
  manager: ThreeJsSceneManager,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  startPt: Point2D,
  endPt: Point2D,
): string[] {
  const hits = collectBimMarqueeHits({
    group: manager.bimLayer.group, camera, canvas, startPt, endPt,
  });
  if (useViewMode3DStore.getState().marqueeSelectThrough || hits.ids.length === 0) return hits.ids;

  const visible = collectVisibleBimIdsInRect({
    renderer: manager.renderer,
    camera,
    group: manager.bimLayer.group,
    canvas,
    rect: screenRectFromPoints(startPt, endPt),
  });
  return visible ? hits.ids.filter((id) => visible.has(id)) : hits.ids;
}

/**
 * Ανάλυσε το ορθογώνιο (client px) και εφάρμοσε την επιλογή σε BIM + raw DXF.
 * Ο καλών έχει ήδη εξασφαλίσει ότι πρόκειται για γνήσιο drag πάνω στο scene canvas.
 */
export function resolveAndApplyMarquee3D(
  manager: ThreeJsSceneManager,
  startPt: Point2D,
  endPt: Point2D,
  mode: MarqueeCombineMode,
): void {
  const camera = manager.getCamera();
  const canvas = manager.getRendererCanvas();

  const floors = getDxfFloorScope();
  const dxfHits = floors.length > 0
    ? collectDxfMarqueeHits({ floors, camera, canvas, startPt, endPt })
    : null;
  // ΠΡΙΝ την BIM εγγραφή (βλ. §3 του module header): μόνο τα ids που ανήκουν στην DXF
  // εμβέλεια — έτσι τα BIM ids που κατοικούν στον ίδιο κουβά δεν μπερδεύονται στο add/subtract.
  const previousDxfIds = dxfHits
    ? SelectedEntitiesStore.getSelectedEntityIds().filter((id) => dxfHits.scopeIds.has(id))
    : [];

  manager.applyBimMarqueeSelection(resolveBimIds(manager, camera, canvas, startPt, endPt), mode);

  if (dxfHits) {
    applyDxfMarqueeSelection(previousDxfIds, dxfHits.ids, mode, {
      add: (ids) => SelectedEntitiesStore.addEntities(ids.map((id) => ({ id, type: 'dxf-entity' }))),
      remove: (id) => SelectedEntitiesStore.deselectEntity(id),
    });
  }
}
