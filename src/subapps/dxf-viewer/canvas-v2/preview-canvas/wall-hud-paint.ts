/**
 * wall-hud-paint — ADR-508 §wall-hud: «ζωντανή ταυτότητα» του τοίχου-φαντάσματος κατά τη σχεδίαση
 * (awaitingEnd). Ο τοίχος φαίνεται σαν **έτοιμο διαστασιολογημένο αρχιτεκτονικό σχέδιο** ενώ τον
 * τραβάς — κάτι που οι μεγάλοι (AutoCAD/Revit dynamic input) ΔΕΝ δείχνουν (αυτοί: μόνο μικρό πεδίο
 * μήκος/γωνία). Εδώ:
 *   · **aligned διάσταση μήκους** κάτω από τον τοίχο (μεγαλώνει live),
 *   · **γωνία** `∠ θ` στην αρχή,
 *   · ετικέτα **πάχος · ύψος** στη μέση (η BIM ταυτότητα, όχι μόνο γεωμετρία).
 *
 * **FULL SSoT — μηδέν bespoke drawing:** η διάσταση μήκους μέσω του κοινού `paintAlignedOverlayDimension`
 * (ίδιο `renderPreviewDimension` ADR-362 + overlay-line-style με τις listening dims)· οι ετικέτες μέσω
 * `drawOverlayLabel` (overlay-text-style SSoT)· αριθμοί μέσω `formatLengthForDisplay`/`formatAngleLocale`.
 * Το `specLabel` έρχεται ΗΔΗ μεταφρασμένο (i18n) από τον `drawing-hover-handler` (N.11).
 *
 * @see ./ghost-face-dim-paint.ts — paintAlignedOverlayDimension (κοινό aligned-dim SSoT)
 * @see ./overlay-text-style.ts — drawOverlayLabel · ./overlay-line-style.ts — OVERLAY_LINE_COLORS
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { formatLengthForDisplay } from '../../config/display-length-format';
// SSoT γεωμετρίας: ίδια helpers με renderLine/polyline/dimensions — μηδέν inline atan2/hypot/normalize.
import { formatAngleLocale, calculateWorldDistance } from '../../rendering/entities/shared/distance-label-utils';
import { calculateAngle, translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { radToDeg, normalizeAngleDeg } from '../../rendering/entities/shared/geometry-angle-utils';
import { paintAlignedOverlayDimension } from './ghost-face-dim-paint';
import { drawOverlayLabel } from './overlay-text-style';
import { OVERLAY_LINE_COLORS, applyOverlayLineStyle, strokeOverlaySegment } from './overlay-line-style';
// SSoT anti-collision: text-box-aware perpendicular clearance ώστε spec/γωνία να ΜΗΝ διασχίζουν
// ποτέ τον άξονα του τοίχου (κάθετος/λοξός) και να πέφτουν πάνω στη διάσταση μήκους.
import { measureOverlayLabelBox, clearanceForBox, type LabelBox } from './overlay-label-layout';
// SSoT gate «ΜΗΚΟΣ/ΓΩΝΙΑ» (status-bar toggle) — κρύβει καθολικά length+angle HUD ενδείξεις
// (draw + grip-drag, 2D + 3D). Gate ΣΤΟ CALL SITE, όχι μέσα στους shared painters.
import { isLengthAngleHudVisible } from '../../systems/constraints/length-angle-hud-gate';

/** Καθαρά αριθμητικά δεδομένα HUD (κρέμονται στο ghost entity· N.11-clean — καμία μετάφραση εδώ). */
export interface WallHudMeta {
  /** Centerline αρχή/τέλος (scene units, world). */
  readonly start: Point2D;
  readonly end: Point2D;
  /** mm — μήκος άξονα τοίχου. */
  readonly lengthMm: number;
  /** μοίρες (world) — γωνία start→end. */
  readonly angleDeg: number;
  /** mm — πάχος (για το offset της dim line ώστε να μην πέφτει πάνω στο σώμα). */
  readonly thicknessMm: number;
  /** mm — ύψος (στο specLabel). */
  readonly heightMm: number;
  readonly sceneUnits: SceneUnits;
}

/**
 * SSoT factory των αριθμητικών HUD δεδομένων από ΕΝΑ ευθύγραμμο τμήμα (start→end). Ένας
 * υπολογισμός μήκους(mm)/γωνίας για ΚΑΘΕ καταναλωτή του live HUD — τοίχο (`thicknessMm/heightMm`
 * από τα BIM params) ΚΑΙ γραμμή (0 = χωρίς BIM ταυτότητα). N.11-clean: καθαρά νούμερα, καμία
 * μετάφραση/μορφοποίηση εδώ (γίνεται στον renderer/handler).
 *
 * Γεωμετρία ΑΠΟΚΛΕΙΣΤΙΚΑ μέσω των κοινών SSoT: `calculateWorldDistance` (απόσταση),
 * `calculateAngle`→`radToDeg`→`normalizeAngleDeg` (ADR-068 normalization) — η ΙΔΙΑ αλυσίδα με
 * `renderLine`/dimensions, μηδέν inline `Math.atan2`/`hypot`/`%360`.
 */
export function buildSegmentHudMeta(
  start: Point2D,
  end: Point2D,
  sceneUnits: SceneUnits,
  thicknessMm = 0,
  heightMm = 0,
): WallHudMeta {
  return {
    start: { x: start.x, y: start.y },
    end: { x: end.x, y: end.y },
    lengthMm: calculateWorldDistance(start, end) / mmToSceneUnits(sceneUnits),
    angleDeg: normalizeAngleDeg(radToDeg(calculateAngle(start, end))),
    thicknessMm,
    heightMm,
    sceneUnits,
  };
}

/** Screen-px clearance της dim line / ετικετών πέρα από την παρειά του τοίχου (zoom-constant). */
const DIM_CLEAR_PX = 18;
const LABEL_CLEAR_PX = 16;

/** HUD overlay χρώμα — το ουδέτερο γκρι των tooltips (διακριτό από το cyan των listening dims). */
const HUD_COLOR = OVERLAY_LINE_COLORS.alignment;

/**
 * ADR-543 — projection seam ώστε η ΔΙΑΤΑΞΗ του wall HUD (offsets/κάθετη/θέσεις ετικετών) να ζει
 * ΜΙΑ φορά και να ζωγραφίζεται ΚΑΙ στον 2D καμβά (affine transform) ΚΑΙ στο 3D viewport
 * (perspective camera). Ο caller ενίει:
 *   · `toScreen`  : world (scene units) → canvas px,
 *   · `worldPerPixel` : scene units ανά pixel οθόνης (screen-constant clearances),
 *   · `drawAlignedDim`: η aligned διάσταση μήκους μεταξύ 2 world σημείων (2D → ISO-129
 *     `paintAlignedOverlayDimension`· 3D → projected overlay γραμμή `paintProjectedAlignedDim`).
 */
export interface WallHudProjector {
  toScreen(p: Point2D): Point2D;
  readonly worldPerPixel: number;
  drawAlignedDim(p1: Point2D, p2: Point2D, dimRef: Point2D, label: string, color: string): void;
}

/**
 * SSoT διάταξη + ετικέτες του wall HUD, παραμετροποιημένη στον viewport projector. Ένας
 * κώδικας διάταξης για 2D + 3D — μηδέν διπλό HUD-layout (N.0.2).
 */
export function paintWallHudCore(
  ctx: CanvasRenderingContext2D,
  meta: WallHudMeta,
  specLabel: string,
  proj: WallHudProjector,
): void {
  const { start, end, lengthMm, angleDeg, thicknessMm, sceneUnits } = meta;
  const dx = end.x - start.x, dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return; // εκφυλισμένος (1ο pixel) — τίποτα να διαστασιολογήσω
  const ux = dx / len, uy = dy / len;
  const px = uy, py = -ux; // μοναδιαία κάθετη
  const wpp = proj.worldPerPixel;
  const halfT = (thicknessMm / 2) * mmToSceneUnits(sceneUnits);
  const dimOff = halfT + DIM_CLEAR_PX * wpp;
  const mid: Point2D = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  // World→world perpendicular offset (scene units) που η ΚΟΝΤΙΝΗ ακμή του `box` να κάθεται
  // `LABEL_CLEAR_PX` πέρα από την παρειά (`halfT`) του τοίχου. Η box-aware απόσταση (μέσω της
  // SSoT `clearanceForBox`, που αξιοποιεί τις |px|,|py|) εξασφαλίζει ότι το ΠΛΑΤΥ spec-text δεν
  // διασχίζει ποτέ τον άξονα σε κάθετο/λοξό τοίχο — ΜΗΔΕΝ επικάλυψη με τη διάσταση μήκους.
  const perpClearOff = (box: LabelBox): number =>
    halfT + clearanceForBox(px, py, box, LABEL_CLEAR_PX) * wpp;

  // (1) aligned διάσταση μήκους — κάτω από τον τοίχο (πλευρά +κάθετη), μέσω του injected drawer.
  // Gate ΜΗΚΟΣ (SSoT toggle): OFF → παραλείπεται σε draw + grip-drag, 2D + 3D.
  if (isLengthAngleHudVisible()) {
    const dimRef: Point2D = { x: mid.x + px * dimOff, y: mid.y + py * dimOff };
    proj.drawAlignedDim(start, end, dimRef, formatLengthForDisplay(lengthMm), HUD_COLOR);
  }

  // (2) ετικέτα πάχος · ύψος — αντίθετη πλευρά (−κάθετη), στη μέση. Κενό specLabel → η οντότητα
  // δεν έχει BIM ταυτότητα (π.χ. γραμμή: μηδέν πάχος/ύψος) → παραλείπεται· μόνο μήκος + γωνία.
  if (specLabel) {
    const specOff = perpClearOff(measureOverlayLabelBox(ctx, specLabel));
    const specW: Point2D = { x: mid.x - px * specOff, y: mid.y - py * specOff };
    const sSpec = proj.toScreen(specW);
    drawOverlayLabel(ctx, specLabel, sSpec.x, sSpec.y, { textColor: HUD_COLOR, align: 'center' });
  }

  // (3) γωνία ∠θ — κοντά στην αρχή, αντίθετη πλευρά (box-aware, ίδιο SSoT clearance).
  // Gate ΓΩΝΙΑ (SSoT toggle): OFF → παραλείπεται σε draw + grip-drag, 2D + 3D.
  if (isLengthAngleHudVisible()) {
    const angleLabel = `∠ ${formatAngleLocale(angleDeg)}`;
    const angOff = perpClearOff(measureOverlayLabelBox(ctx, angleLabel));
    const angW: Point2D = { x: start.x - px * angOff, y: start.y - py * angOff };
    const sAng = proj.toScreen(angW);
    drawOverlayLabel(ctx, angleLabel, sAng.x, sAng.y, { textColor: HUD_COLOR, align: 'center' });
  }
}

/**
 * 2D adapter (PreviewCanvas) — ΑΜΕΤΑΒΛΗΤΗ συμπεριφορά: ISO-129 aligned dim + affine projection.
 * Ζωγράφισε το HUD πάνω από το ghost (called AFTER `drawPreview`· wiped στο επόμενο
 * `drawPreview`/`clear`). `specLabel` = ΗΔΗ μεταφρασμένο «πάχος X · ύψος Y» (i18n στον handler).
 */
export function paintWallHud(
  ctx: CanvasRenderingContext2D,
  meta: WallHudMeta,
  specLabel: string,
  transform: ViewTransform,
  viewport: { readonly width: number; readonly height: number },
): void {
  paintWallHudCore(ctx, meta, specLabel, {
    toScreen: (p) => CoordinateTransforms.worldToScreen(p, transform, viewport),
    worldPerPixel: worldPerPixel(transform.scale),
    drawAlignedDim: (p1, p2, dimRef, label, color) =>
      paintAlignedOverlayDimension(ctx, p1, p2, dimRef, label, transform, viewport, color),
  });
}

/**
 * ADR-543 — projected aligned διάσταση για viewports ΧΩΡΙΣ affine transform (3D). Reuse των ΚΟΙΝΩΝ
 * overlay SSoTs (`applyOverlayLineStyle` 0.5px dashed + `strokeOverlaySegment` + `drawOverlayLabel`)
 * → ίδιο line-style/χρώμα/αριθμός με τις 2D listening dims / alignment traces. Η ISO-129 μηχανή
 * (arrowheads/extension lines, `renderPreviewDimension`) είναι θεμελιωδώς affine (uniform
 * `transform.scale`) και ΔΕΝ προβάλλεται μέσα από perspective camera, οπότε η 3D dim line είναι η
 * κοινή overlay γραμμή μεταξύ των προβεβλημένων άκρων.
 */
export function paintProjectedAlignedDim(
  ctx: CanvasRenderingContext2D,
  p1: Point2D,
  p2: Point2D,
  dimRef: Point2D,
  label: string,
  toScreen: (p: Point2D) => Point2D,
  color: string,
): void {
  // Η dim line είναι παράλληλη στο p1→p2, μετατοπισμένη κατά (dimRef − mid). Προβάλλουμε 4 γωνίες.
  const mid: Point2D = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const off: Point2D = { x: dimRef.x - mid.x, y: dimRef.y - mid.y };
  const s1 = toScreen(p1), s2 = toScreen(p2);
  const sd1 = toScreen(translatePoint(p1, off));
  const sd2 = toScreen(translatePoint(p2, off));
  applyOverlayLineStyle(ctx, color);
  strokeOverlaySegment(ctx, sd1, sd2); // dim line
  strokeOverlaySegment(ctx, s1, sd1);  // extension line @ start
  strokeOverlaySegment(ctx, s2, sd2);  // extension line @ end
  const sRef = toScreen(dimRef);
  drawOverlayLabel(ctx, label, sRef.x, sRef.y, { textColor: color, align: 'center' });
}
