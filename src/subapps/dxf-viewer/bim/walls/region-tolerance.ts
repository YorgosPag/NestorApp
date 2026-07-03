/**
 * ADR-419 — Region/perimeter loop-detection tolerance SSoT (Layer 2).
 *
 * Boy-scout (N.0.2): κεντρικοποιεί το διπλό `regionTol` callback που υπήρχε ΚΑΙ
 * στο `use-column-perimeter-commit.ts` ΚΑΙ στο `use-wall-region-clicks.ts`
 * (`SNAP_DEFAULT / transform.scale`), και προσθέτει το **gap-closure floor**:
 * μικρά κενά στις παρειές που σχεδιάστηκαν χωρίς snap κλείνουν αυτόματα (Revit
 * auto-trim/extend), ανεξάρτητα από το zoom.
 *
 * Η ανοχή εκφράζεται σε **world/scene units** = max(pixel-based, mm-based floor):
 *   - pixel-based: `SNAP_DEFAULT / scale` (όπως πριν — κλιμακώνεται με το zoom).
 *   - mm-based floor: `REGION_PERIMETER_LIMITS.LOOP_JOIN_TOLERANCE_MM × mmToScene`
 *     (φυσική απόσταση στο σχέδιο, ανεξάρτητη zoom· mirror PIPE_JOIN_TOLERANCE_MM).
 *
 * @see ./perimeter-from-faces.ts (consumer — closed-loop detection)
 * @see ../../config/tolerance-config.ts (REGION_PERIMETER_LIMITS SSoT)
 */

import { TOLERANCE_CONFIG, REGION_PERIMETER_LIMITS } from '../../config/tolerance-config';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

/**
 * Ανοχή ένωσης άκρων / hit-test για region/perimeter detection (world units).
 * Live: διαβάζει το τρέχον transform.scale στο event time (ίδιος κανόνας με πριν).
 *
 * ⚠️ Αυτό είναι το **gap-closure floor** (`max(pixel, 50mm)`) — σωστό ως γενικός
 * geometric epsilon (shape classification, open-chain reach, corner-graph hit-test)
 * ΚΑΙ ως gap-closure tolerance, αλλά **ΛΑΘΟΣ ως node-merge** (καταρρέει μικρά features
 * με ακμή < tol). Για το closed-loop detection χρησιμοποίησε
 * {@link resolveRegionLoopTolerances} που διαχωρίζει node-merge από gap-closure.
 */
export function resolveRegionLoopTolWorld(sceneUnits: SceneUnits): number {
  const pixelTol = TOLERANCE_CONFIG.SNAP_DEFAULT / getImmediateTransform().scale;
  const gapFloor = REGION_PERIMETER_LIMITS.LOOP_JOIN_TOLERANCE_MM * mmToSceneUnits(sceneUnits);
  return Math.max(pixelTol, gapFloor);
}

/** Διαχωρισμένες ανοχές closed-loop detection (ADR-419 §region-tolerance / ADR-507 §5β). */
export interface RegionLoopTolerances {
  /**
   * Node-merge (κόμβοι που συμπίπτουν) — **ιδιότητα των ΔΕΔΟΜΕΝΩΝ, ΟΧΙ του zoom**.
   * `min(pixel, 50mm)` (CAP): σε χαμηλό zoom ΔΕΝ διογκώνεται ώστε να ΜΗΝ καταρρέει
   * μικρά features (κουτί με ακμή < 50mm εξαφανιζόταν). Mirror `auto-area-hit.ts`.
   */
  readonly mergeTol: number;
  /**
   * Gap-closure (AutoCAD HPGAPTOL) — 50mm floor, zoom-independent. Γεφυρώνει ΑΝΟΙΧΤΑ
   * κενά ορίου (παρειές χωρίς snap) **ΠΡΟΣΘΕΤΟΝΤΑΣ** ακμή, ΧΩΡΙΣ να καταρρέει κόμβους —
   * γι' αυτό το μικρό feature επιβιώνει ενώ τα κενά των μεγάλων τοίχων κλείνουν.
   */
  readonly gapTol: number;
}

/**
 * Ανοχές για το closed-loop detection του region/perimeter path, με τον node-merge
 * **ΔΙΑΧΩΡΙΣΜΕΝΟ** από το gap-closure (ADR-419 §region-tolerance). Ευθυγραμμίζει το
 * region path με το ήδη-δοκιμασμένο auto-area SSoT (`auto-area-hit.ts`, ADR-507 §5β.3):
 * το `resolveRegionLoopTolWorld` (`max`) διόγκωνε το node-merge σε χαμηλό zoom και
 * κατέρρεε μικρά κλειστά features (ακμή < tol) — ενώ το gap-closure πρέπει να μένει
 * γενναιόδωρο. Node-merge = `min(pixel, 50mm)` (CAP)· gap-closure = `50mm` floor.
 */
export function resolveRegionLoopTolerances(sceneUnits: SceneUnits): RegionLoopTolerances {
  const pixelTol = TOLERANCE_CONFIG.SNAP_DEFAULT / getImmediateTransform().scale;
  const gapFloor = REGION_PERIMETER_LIMITS.LOOP_JOIN_TOLERANCE_MM * mmToSceneUnits(sceneUnits);
  return { mergeTol: Math.min(pixelTol, gapFloor), gapTol: gapFloor };
}
