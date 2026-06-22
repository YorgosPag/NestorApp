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
import { formatAngleLocale } from '../../rendering/entities/shared/distance-label-utils';
import { paintAlignedOverlayDimension } from './ghost-face-dim-paint';
import { drawOverlayLabel } from './overlay-text-style';
import { OVERLAY_LINE_COLORS } from './overlay-line-style';

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

/** Screen-px clearance της dim line / ετικετών πέρα από την παρειά του τοίχου (zoom-constant). */
const DIM_CLEAR_PX = 18;
const LABEL_CLEAR_PX = 16;

/** HUD overlay χρώμα — το ουδέτερο γκρι των tooltips (διακριτό από το cyan των listening dims). */
const HUD_COLOR = OVERLAY_LINE_COLORS.alignment;

/**
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
  const { start, end, lengthMm, angleDeg, thicknessMm, sceneUnits } = meta;
  const dx = end.x - start.x, dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return; // εκφυλισμένος (1ο pixel) — τίποτα να διαστασιολογήσω
  const ux = dx / len, uy = dy / len;
  const px = uy, py = -ux; // μοναδιαία κάθετη
  const wpp = worldPerPixel(transform.scale);
  const halfT = (thicknessMm / 2) * mmToSceneUnits(sceneUnits);
  const dimOff = halfT + DIM_CLEAR_PX * wpp;
  const labelOff = halfT + LABEL_CLEAR_PX * wpp;
  const mid: Point2D = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  // (1) aligned διάσταση μήκους — κάτω από τον τοίχο (πλευρά +κάθετη), reuse κοινού SSoT.
  const dimRef: Point2D = { x: mid.x + px * dimOff, y: mid.y + py * dimOff };
  paintAlignedOverlayDimension(ctx, start, end, dimRef, formatLengthForDisplay(lengthMm), transform, viewport, HUD_COLOR);

  // (2) ετικέτα πάχος · ύψος — αντίθετη πλευρά, στη μέση.
  const specW: Point2D = { x: mid.x - px * labelOff, y: mid.y - py * labelOff };
  const sSpec = CoordinateTransforms.worldToScreen(specW, transform, viewport);
  drawOverlayLabel(ctx, specLabel, sSpec.x, sSpec.y, { textColor: HUD_COLOR, align: 'center' });

  // (3) γωνία ∠θ — κοντά στην αρχή, αντίθετη πλευρά.
  const angW: Point2D = { x: start.x - px * labelOff, y: start.y - py * labelOff };
  const sAng = CoordinateTransforms.worldToScreen(angW, transform, viewport);
  drawOverlayLabel(ctx, `∠ ${formatAngleLocale(angleDeg)}`, sAng.x, sAng.y, { textColor: HUD_COLOR, align: 'center' });
}
