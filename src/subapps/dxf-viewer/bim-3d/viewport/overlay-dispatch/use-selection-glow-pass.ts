'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-555 + ADR-717 BEFORE EDITING
 *
 * use-selection-glow-pass — η ΟΠΤΙΚΗ ΕΠΙΒΕΒΑΙΩΣΗ της επιλογής raw-DXF μέσα στο 3D (ADR-717).
 *
 * ## Γιατί υπάρχει
 *
 * Το raw-DXF υπόστρωμα του 3D είναι batched `THREE.LineSegments` ΑΝΑ ΧΡΩΜΑ
 * (`DxfToThreeConverter.buildColorGroup`): χιλιάδες οντότητες μοιράζονται ένα υλικό και ΔΕΝ
 * φέρουν per-entity `userData`. Άρα — σε αντίθεση με τα BIM meshes, που παίρνουν WebGL
 * silhouette (`SelectionOutlinePass`) — μια επιλεγμένη γραμμή κάτοψης ΔΕΝ μπορεί να αλλάξει
 * χρώμα στο GPU χωρίς να σπάσει το batching.
 *
 * Μέχρι το ADR-717 η ΜΟΝΗ ένδειξη επιλογής ήταν τα grips. Αυτό είχε δύο συνέπειες:
 *   • πολλαπλή επιλογή που τα grips απέρριπταν = **αόρατη** (το σφάλμα που έλυσε το ADR-717
 *     Φάση Α στο `resolveEligibleDxfEntities`)·
 *   • επιλογή πάνω από το AutoCAD `GRIPOBJLIMIT` = **επίσης αόρατη**, ΕΞ ΟΡΙΣΜΟΥ και για πάντα.
 *
 * Το δεύτερο είναι το ενδιαφέρον: το ίδιο το AutoCAD το έχει. Σβήνεις τα grips σε μεγάλη
 * επιλογή για να μη σέρνεται το UI, και ο χρήστης χάνει κάθε ανάδραση για το τι κρατά. Revit,
 * ArchiCAD, Cinema 4D και Figma το λύνουν με ΔΥΟ ΑΝΕΞΑΡΤΗΤΑ ΚΑΝΑΛΙΑ:
 *
 *   **highlight** = «τι κρατάω» — πάντα ορατό, κλιμακώνει σε χιλιάδες·
 *   **handles/grips** = «τι μπορώ να πιάσω» — φραγμένα, γιατί κάθε λαβή είναι hit-target.
 *
 * Αυτό το pass είναι το πρώτο κανάλι. Δεν κοιτά ΠΟΤΕ το `GRIPOBJLIMIT`: το όριο αφορά τις
 * λαβές, όχι την ανάδραση.
 *
 * ## Πώς κλιμακώνει (το μη-προφανές κομμάτι)
 *
 * Ένα αφελές pass θα έλυνε ids → οντότητες και θα ξανα-δειγματολητούσε περιγράμματα ΚΑΘΕ frame
 * όσο η κάμερα γυρίζει. Με 500 επιλεγμένες πολυγραμμές σε σκηνή 2.000 οντοτήτων αυτό είναι
 * O(N·M) αναζήτηση + πλήρης re-tessellation στα 60fps. Αντ' αυτού:
 *
 *   1. **resolve + δειγματοληψία μία φορά ανά ΑΛΛΑΓΗ ΕΠΙΛΟΓΗΣ**, όχι ανά frame — μέσω του
 *      bulk `findDxfEntitiesInScope` (ένα πέρασμα, ADR-717) και του ΚΟΙΝΟΥ
 *      `dxfEntityOutlineSegments` (ο ίδιος sampler που ζωγραφίζει το hover glow και που
 *      ελέγχει το marquee — μηδέν δεύτερη γεωμετρία)·
 *   2. **ομαδοποίηση ανά υψόμετρο ορόφου**, γιατί ο projector είναι ανά επίπεδο (ADR-537 δ):
 *      ένας projector ανά όροφο, όχι ένας ανά οντότητα·
 *   3. **ΕΝΑ `Path2D`-στυλ batch ανά όροφο**: όλα τα πολύγραμμα μπαίνουν στο ΙΔΙΟ
 *      `beginPath()` και φεύγουν με ΕΝΑ `stroke()`. Το κόστος ανά frame πέφτει σε καθαρή
 *      προβολή κορυφών — ένα κλήση stroke αντί για N.
 *
 * ADR-040 micro-leaf: η ΜΟΝΗ συνδρομή είναι το πλήθος επιλεγμένων `dxf-entity` (low-frequency,
 * ανοίγει/κλείνει το RAF). Τα ids διαβάζονται ΕΠΙΤΟΠΟΥ μέσα στο `paint` (getter, όχι snapshot).
 */

import { useRef, useSyncExternalStore, useCallback, useMemo } from 'react';
import type { Point2D } from '../../../rendering/types/Types';
import { UI_COLORS } from '../../../config/color-config';
import { SelectedEntitiesStore, subscribeSelection } from '../../../systems/selection/SelectedEntitiesStore';
import { useSelection3DStore } from '../../stores/Selection3DStore';
// ADR-717 v3 — η ΠΡΑΓΜΑΤΙΚΗ κατάσταση των λαβών, όχι πρόβλεψη του κατωφλίου (βλ. σχόλιο στο `active`).
import { useGrip3DOverlayStore } from '../../stores/Grip3DOverlayStore';
import { makeGripPlanToCanvas } from '../../grips/grip-3d-screen-project';
import { dxfEntityOutlineSegments } from '../../grips/dxf-entity-outline';
import { dxfSceneUnitToMm } from '../../../utils/scene-units';
import { findDxfEntitiesInScope } from '../../scene/dxf-3d-floor-scope';
import type { BimOverlayFrame, BimOverlayPass } from './bim-overlay-pass';

/** Πάχος (px) του highlight. Πάνω από το wireframe ώστε να διαβάζεται χωρίς να το πνίγει. */
const SELECTION_STROKE_PX = 2.5;
/** Διαφάνεια — αφήνει το χρώμα της οντότητας να φαίνεται από κάτω (ArchiCAD/C4D αίσθηση). */
const SELECTION_ALPHA = 0.85;

/** Τα plan-mm πολύγραμμα ΕΝΟΣ επιπέδου ορόφου, έτοιμα για προβολή. */
interface FloorOutlines {
  readonly floorElevationMm: number;
  readonly polylines: readonly Point2D[][];
}

/** Ό,τι χρειάζεται το `paint`, υπολογισμένο μία φορά ανά αλλαγή επιλογής. */
interface OutlineCache {
  readonly signature: string;
  readonly floors: readonly FloorOutlines[];
}

/**
 * Τα περιγράμματα (plan-mm) των επιλεγμένων raw-DXF οντοτήτων, ομαδοποιημένα ανά υψόμετρο.
 * Κάθε οντότητα περνά από τον ΚΟΙΝΟ sampler με τον δικό της συντελεστή μονάδας (ADR-537 γ),
 * ώστε το highlight να κάθεται πάνω στο wireframe σε ΟΠΟΙΑΔΗΠΟΤΕ μονάδα σκηνής.
 */
function buildFloorOutlines(ids: readonly string[]): FloorOutlines[] {
  const byElevation = new Map<number, Point2D[][]>();
  for (const found of findDxfEntitiesInScope(ids)) {
    const segments = dxfEntityOutlineSegments(found.entity, dxfSceneUnitToMm(found.scene));
    if (segments.length === 0) continue; // τύπος χωρίς γραμμική αναπαράσταση — δεν ζωγραφίζεται
    const bucket = byElevation.get(found.floorElevationMm);
    if (bucket) bucket.push(...segments);
    else byElevation.set(found.floorElevationMm, [...segments]);
  }
  return [...byElevation].map(([floorElevationMm, polylines]) => ({ floorElevationMm, polylines }));
}

/**
 * ΕΝΑ batched stroke για όλα τα πολύγραμμα ενός ορόφου: ένα `beginPath()`, N υπο-διαδρομές,
 * ένα `stroke()`. Σημεία πίσω από την κάμερα γυρίζουν `GRIP_OFFSCREEN` από τον projector —
 * η υπο-διαδρομή απλώς φεύγει εκτός πλαισίου, δεν ακυρώνει την υπόλοιπη οντότητα (σε
 * αντίθεση με το marquee test, που είναι ερώτημα ναι/όχι).
 */
function strokeFloor(
  ctx: CanvasRenderingContext2D,
  project: (p: Point2D) => Point2D,
  polylines: readonly Point2D[][],
): void {
  ctx.beginPath();
  for (const poly of polylines) {
    if (poly.length < 2) continue;
    const p0 = project(poly[0]);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < poly.length; i++) {
      const p = project(poly[i]);
      ctx.lineTo(p.x, p.y);
    }
  }
  ctx.stroke();
}

/** Ταυτότητα της τρέχουσας επιλογής — αλλάζει ⇔ πρέπει να ξαναχτιστούν τα περιγράμματα. */
function selectionSignature(ids: readonly string[]): string {
  return ids.join('|');
}

/**
 * Το highlight-layer της επιλεγμένης raw-DXF γεωμετρίας ως dispatch pass.
 *
 * ## `active` — ΜΟΝΟ ως αντικαταστάτης των λαβών (ADR-717 v2, Giorgio 2026-07-27)
 *
 * Η v1 άναβε το highlight σε ΚΑΘΕ επιλογή. Λάθος: στο **2D** μια επιλεγμένη οντότητα **κρατά το
 * δικό της χρώμα** και μιλούν μόνο οι λαβές — άρα το πάντα-αναμμένο highlight έβαφε μπλε ό,τι
 * διάλεγες και **έσπαγε την ισοτιμία 2D↔3D**, που είναι το ίδιο το συμβόλαιο της ενιαίας επιλογής.
 *
 * Το κανάλι υπάρχει για ΕΝΑ πρόβλημα: όταν οι λαβές ΔΕΝ κάθονται, ο χρήστης μένει **χωρίς καμία**
 * ανάδραση (το κενό του AutoCAD, §3 του ADR). Άρα ανάβει ΑΚΡΙΒΩΣ εκεί:
 *
 *   λαβές ορατές  → highlight ΣΒΗΣΤΟ  → η οντότητα κρατά το χρώμα της (ταυτόσημο με το 2D)·
 *   λαβές σβηστές → highlight ΑΝΑΜΜΕΝΟ → «κρατάς αυτά», αντί για σιωπή.
 *
 * ## Το ερώτημα είναι «κάθισαν λαβές;» — ΟΧΙ «θα έπρεπε να καθίσουν;» (ADR-717 v3)
 *
 * Η v2 ρωτούσε `isGripObjLimitExceeded(πλήθος, όριο)` — δηλαδή **προέβλεπε** την απόφαση που το
 * `seatGrips` παίρνει ανεξάρτητα. Δύο υπολογισμοί του ίδιου πράγματος **απέκλιναν** στην πράξη
 * (μετρημένο 2026-07-28: πολλαπλή επιλογή έδειχνε ΚΑΙ λαβές ΚΑΙ μπλε βαφή ταυτόχρονα), γιατί το
 * `seatGrips` κόβει και για λόγους που κανένα κατώφλι δεν εκφράζει: μηδέν παραγόμενα grips, ενεργό
 * drag, ids εκτός εμβέλειας, BIM ιδιοκτησία του grip set.
 *
 * Η μόνη αξιόπιστη πηγή είναι η **κατάσταση**, όχι η πρόβλεψη: το `Grip3DOverlayStore` κρατά τα
 * `dxfGhostEntityIds`, δηλαδή ΑΚΡΙΒΩΣ «ποιες raw-DXF οντότητες έχουν αυτή τη στιγμή λαβές» — η ίδια
 * τιμή με την οποία ο ιδιοκτήτης τους απαντά `ownsGrips()`. Άδειο ⇒ καμία λαβή ⇒ ανάβει το
 * highlight. Ένα ερώτημα, μία απάντηση, δομικά αδύνατο να αποκλίνουν.
 *
 * Καμία BIM επιλογή: εκείνη παίρνει WebGL silhouette — δύο highlight μαζί θα διάβαζαν ως ένα
 * ασαφές. `hideOnMotion=false`: το highlight ΑΚΟΛΟΥΘΕΙ την κάμερα (είναι «τι κρατάω», όχι λαβή).
 */
export function useSelectionGlowPass(): BimOverlayPass {
  const dxfCount = useSyncExternalStore(
    subscribeSelection,
    () => SelectedEntitiesStore.countByType('dxf-entity'),
    () => 0, // SSR: καμία επιλογή
  );
  const bimCount = useSelection3DStore((s) => s.selectedBimIds.length);
  // Η ΚΑΤΑΣΤΑΣΗ των λαβών, όχι πρόβλεψη του κατωφλίου (βλ. §v3 παραπάνω).
  const seatedGripCount = useGrip3DOverlayStore((s) => s.dxfGhostEntityIds.length);
  const active = dxfCount > 0 && bimCount === 0 && seatedGripCount === 0;

  const cacheRef = useRef<OutlineCache | null>(null);

  /** Τα περιγράμματα της ΤΡΕΧΟΥΣΑΣ επιλογής, ξαναχτισμένα μόνο όταν η επιλογή όντως άλλαξε. */
  const outlinesNow = useCallback((): readonly FloorOutlines[] => {
    const ids = SelectedEntitiesStore.getSelectedEntityIds();
    const signature = selectionSignature(ids);
    const cached = cacheRef.current;
    if (cached && cached.signature === signature) return cached.floors;
    const floors = buildFloorOutlines(ids);
    cacheRef.current = { signature, floors };
    return floors;
  }, []);

  const paint = useCallback((frame: BimOverlayFrame): void => {
    const { ctx, camera, canvas } = frame;
    const floors = outlinesNow();
    if (floors.length === 0) return;
    ctx.strokeStyle = UI_COLORS.OVERLAY_GRIP_COLD; // ΤΟ ΙΔΙΟ μπλε με τις λαβές: ένα «χρώμα επιλογής»
    ctx.lineWidth = SELECTION_STROKE_PX;
    ctx.globalAlpha = SELECTION_ALPHA;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    for (const floor of floors) {
      // ADR-537 δ — ένας projector ΑΝΑ ΟΡΟΦΟ (το υψόμετρο είναι σταθερό μέσα στην ομάδα).
      strokeFloor(ctx, makeGripPlanToCanvas(camera, canvas, () => floor.floorElevationMm), floor.polylines);
    }
  }, [outlinesNow]);

  return useMemo(() => ({ active, hideOnMotion: false, paint }), [active, paint]);
}
