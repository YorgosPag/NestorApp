/**
 * column-hud-paint — ADR-508 §column-hud: «ζωντανές λευκές ενδείξεις» κολόνας κατά το σύρσιμο λαβής
 * (parity με το Wall HUD). Η κολόνα είναι σημείο + σχήμα (όχι τμήμα σαν ο τοίχος):
 *   · **ΟΡΘΟΓΩΝΙΑ / τοιχίο** → δύο aligned διαστάσεις (πλάτος & βάθος), μία σε κάθε παρειά, + ∠ γωνία + ύψος.
 *   · **ΚΥΚΛΙΚΗ** → μία aligned διάσταση **διαμέτρου** (Ø) + ύψος (η γωνία δεν έχει νόημα — συμμετρική).
 *   · **ΠΟΛΥΓΩΝΟ** → διάμετρος περιγεγραμμένου (Ø) + αριθμός πλευρών (N) + ∠ γωνία + ύψος.
 *   · **Γ/Τ/Π/Ι/σύνθετο** → aligned διάσταση σε **ΚΑΘΕ ακμή** του footprint (κάθε υπο-διάσταση
 *     arm/flange/web/leg εμφανίζεται ως μήκος ακμής, μηδέν per-shape mapping) + ∠ γωνία + ύψος.
 * Ίδιοι painters/χρώμα με τον τοίχο (`paintAlignedOverlayDimension` + `drawOverlayLabel`, HUD grey),
 * rotation-aware μέσω `RectFrame` (u/v) / `orientedRectFrame`. Το `heightSpecLabel` έρχεται ΗΔΗ
 * μεταφρασμένο (i18n) από τον caller (N.11-clean).
 *
 * @see ./wall-hud-paint.ts — ο αδελφός Wall HUD (ίδιοι painters)
 * @see ./ghost-face-dim-paint.ts — paintAlignedOverlayDimension (κοινό aligned-dim SSoT)
 * @see ../../bim/framing/rect-frame.ts — RectFrame + isRectFootprint + orientedRectFrame + footprintEdges
 * @see ../../bim/geometry/shared/footprint-face-frame.ts — footprintBounds (SSoT bbox)
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { ColumnParams } from '../../bim/types/column-types';
import { DEFAULT_POLYGON_SIDES } from '../../bim/types/column-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { formatLengthForDisplay, formatSceneLengthForDisplay } from '../../config/display-length-format';
import { formatAngleLocale } from '../../rendering/entities/shared/distance-label-utils';
import { normalizeAngleDeg } from '../../rendering/entities/shared/geometry-angle-utils';
import { paintAlignedOverlayDimension } from './ghost-face-dim-paint';
import { drawOverlayLabel } from './overlay-text-style';
import { OVERLAY_LINE_COLORS } from './overlay-line-style';
import {
  rectFrameFromCorners, rectLocalToWorld, isRectFootprint,
  orientedRectFrame, footprintEdges, type RectFrame,
} from '../../bim/framing/rect-frame';
import { footprintBounds } from '../../bim/geometry/shared/footprint-face-frame';
// SSoT gate «ΜΗΚΟΣ/ΓΩΝΙΑ» (status-bar toggle) — κρύβει καθολικά length (πλάτος/βάθος/Ø/ακμές)
// + angle. Gate ΣΤΟ CALL SITE· ύψος(spec)/N ΜΕΝΟΥΝ πάντα (BIM ταυτότητα, όχι length/angle).
import { isLengthAngleHudVisible } from '../../systems/constraints/length-angle-hud-gate';

/** Viewport που δέχονται οι 2D painters (ίδιο σχήμα με το wall HUD). */
type HudViewport = { readonly width: number; readonly height: number };
/** HUD overlay χρώμα — ΙΔΙΟ ουδέτερο γκρι με τον τοίχο (διακριτό από το cyan των listening dims). */
const HUD_COLOR = OVERLAY_LINE_COLORS.alignment;
/** Screen-px clearance της dim line / ετικετών πέρα από το σχήμα (zoom-constant, ίδιο με wall HUD). */
const DIM_CLEAR_PX = 18;
const LABEL_CLEAR_PX = 16;
/** Ακμές μικρότερες από τόσα screen-px δεν διαστασιολογούνται (anti-clutter σε μικρό zoom). */
const MIN_EDGE_SCREEN_PX = 8;

/** Ετικέτα σε world θέση → screen (μικρό helper, ίδιο idiom με το wall HUD core). */
function labelAt(ctx: CanvasRenderingContext2D, text: string, w: Point2D, t: ViewTransform, vp: HudViewport): void {
  const s = CoordinateTransforms.worldToScreen(w, t, vp);
  drawOverlayLabel(ctx, text, s.x, s.y, { textColor: HUD_COLOR, align: 'center' });
}

/** Κοινό: ∠γωνία (πάνω-αριστερά) + ύψος (πάνω-δεξιά) πάνω από ένα (oriented) πλαίσιο. */
function paintFrameAngleHeight(
  ctx: CanvasRenderingContext2D,
  frame: Readonly<RectFrame>,
  rotationDeg: number,
  heightSpecLabel: string,
  wpp: number,
  t: ViewTransform,
  vp: HudViewport,
): void {
  const lblClr = LABEL_CLEAR_PX * wpp;
  // Gate ΜΟΝΟ τη ∠γωνία (SSoT toggle)· το ύψος (BIM ταυτότητα) ΜΕΝΕΙ πάντα ορατό.
  if (isLengthAngleHudVisible()) {
    labelAt(ctx, `∠ ${formatAngleLocale(normalizeAngleDeg(rotationDeg))}`, rectLocalToWorld(frame, -frame.halfW, frame.halfV + lblClr), t, vp);
  }
  labelAt(ctx, heightSpecLabel, rectLocalToWorld(frame, frame.halfW, frame.halfV + lblClr), t, vp);
}

/** ΟΡΘΟΓΩΝΙΑ κολόνα: aligned πλάτος (παρειά-u) + βάθος (παρειά-v) + ∠γωνία + ύψος (rotation-aware). */
function paintRectColumnHud(
  ctx: CanvasRenderingContext2D,
  rect: Readonly<RectFrame>,
  rotationDeg: number,
  heightSpecLabel: string,
  sceneUnits: SceneUnits,
  t: ViewTransform,
  vp: HudViewport,
): void {
  const wpp = worldPerPixel(t.scale);
  const dimClr = DIM_CLEAR_PX * wpp;
  // (1) πλάτος + (2) βάθος — ενδείξεις ΜΗΚΟΥΣ· gate SSoT toggle (draw + grip-drag, 2D + 3D).
  if (isLengthAngleHudVisible()) {
    // (1) πλάτος κατά την παρειά-u, offset προς τα έξω (−v).
    paintAlignedOverlayDimension(
      ctx, rectLocalToWorld(rect, -rect.halfW, -rect.halfV), rectLocalToWorld(rect, rect.halfW, -rect.halfV),
      rectLocalToWorld(rect, 0, -(rect.halfV + dimClr)), formatSceneLengthForDisplay(rect.halfW * 2, sceneUnits), t, vp, HUD_COLOR,
    );
    // (2) βάθος κατά την παρειά-v, offset προς τα έξω (+u).
    paintAlignedOverlayDimension(
      ctx, rectLocalToWorld(rect, rect.halfW, -rect.halfV), rectLocalToWorld(rect, rect.halfW, rect.halfV),
      rectLocalToWorld(rect, rect.halfW + dimClr, 0), formatSceneLengthForDisplay(rect.halfV * 2, sceneUnits), t, vp, HUD_COLOR,
    );
  }
  // (3) ∠γωνία (πάνω-αριστερά, self-gated) + (4) ύψος (πάνω-δεξιά, πάντα).
  paintFrameAngleHeight(ctx, rect, rotationDeg, heightSpecLabel, wpp, t, vp);
}

/** ΚΥΚΛΙΚΗ κολόνα: aligned διάσταση διαμέτρου (Ø) + ύψος. Γωνία παραλείπεται (συμμετρική). */
function paintCircularColumnHud(
  ctx: CanvasRenderingContext2D,
  footprint: readonly Point2D[],
  heightSpecLabel: string,
  sceneUnits: SceneUnits,
  t: ViewTransform,
  vp: HudViewport,
): void {
  const b = footprintBounds(footprint);
  if (!b) return;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const r = (b.maxX - b.minX) / 2;
  if (!(r > 0)) return;
  const wpp = worldPerPixel(t.scale);
  // Ø ΔΙΑΜΕΤΡΟΣ — ένδειξη ΜΗΚΟΥΣ· gate SSoT toggle. Το ύψος (BIM ταυτότητα) ΜΕΝΕΙ.
  if (isLengthAngleHudVisible()) {
    paintAlignedOverlayDimension(
      ctx, { x: cx - r, y: cy }, { x: cx + r, y: cy },
      { x: cx, y: cy - (r + DIM_CLEAR_PX * wpp) }, `Ø ${formatSceneLengthForDisplay(r * 2, sceneUnits)}`, t, vp, HUD_COLOR,
    );
  }
  labelAt(ctx, heightSpecLabel, { x: cx, y: cy + r + LABEL_CLEAR_PX * wpp }, t, vp);
}

/**
 * ΠΟΛΥΓΩΝΟ (regular N-gon): διάμετρος περιγεγραμμένου (Ø = `widthMm`) κατά τον u-άξονα +
 * αριθμός πλευρών (N) + ∠γωνία + ύψος. Parity με την κυκλική + N (η bbox δεν ισούται με Ø).
 */
function paintPolygonColumnHud(
  ctx: CanvasRenderingContext2D,
  footprint: readonly Point2D[],
  rotationDeg: number,
  widthMm: number,
  sides: number,
  heightSpecLabel: string,
  sceneUnits: SceneUnits,
  t: ViewTransform,
  vp: HudViewport,
): void {
  const frame = orientedRectFrame(footprint, rotationDeg);
  if (!frame) return;
  const wpp = worldPerPixel(t.scale);
  const rScene = (widthMm * mmToSceneUnits(sceneUnits)) / 2; // Ø/2 (περιγεγραμμένη) σε scene units
  if (!(rScene > 0)) return;
  // Ø περιγεγραμμένου — ένδειξη ΜΗΚΟΥΣ· gate SSoT toggle. Το N (αριθμός πλευρών) ΜΕΝΕΙ πάντα.
  if (isLengthAngleHudVisible()) {
    paintAlignedOverlayDimension(
      ctx, rectLocalToWorld(frame, -rScene, 0), rectLocalToWorld(frame, rScene, 0),
      rectLocalToWorld(frame, 0, frame.halfV + DIM_CLEAR_PX * wpp),
      `Ø ${formatLengthForDisplay(widthMm)}`, t, vp, HUD_COLOR,
    );
  }
  labelAt(ctx, `N ${sides}`, rectLocalToWorld(frame, 0, -(frame.halfV + LABEL_CLEAR_PX * wpp)), t, vp);
  paintFrameAngleHeight(ctx, frame, rotationDeg, heightSpecLabel, wpp, t, vp);
}

/**
 * ΣΥΝΘΕΤΟ profile (Γ/Τ/Π/Ι/σύνθετο): aligned διάσταση σε **ΚΑΘΕ ακμή** του footprint — κάθε
 * χαρακτηριστική υπο-διάσταση (arm/flange/web/leg) προκύπτει ως μήκος ακμής, μηδέν per-shape mapping.
 * Η dim line κάθε ακμής μπαίνει προς το ΕΞΩΤΕΡΙΚΟ (winding-aware normal). + ∠γωνία + ύψος.
 */
function paintProfileColumnHud(
  ctx: CanvasRenderingContext2D,
  footprint: readonly Point2D[],
  rotationDeg: number,
  heightSpecLabel: string,
  sceneUnits: SceneUnits,
  t: ViewTransform,
  vp: HudViewport,
): void {
  const wpp = worldPerPixel(t.scale);
  const dimClr = DIM_CLEAR_PX * wpp;
  // Μήκη ακμών footprint — ενδείξεις ΜΗΚΟΥΣ· gate SSoT toggle (draw + grip-drag, 2D + 3D).
  if (isLengthAngleHudVisible()) {
    for (const e of footprintEdges(footprint)) {
      if (e.lengthScene / wpp < MIN_EDGE_SCREEN_PX) continue; // πολύ μικρή ακμή → skip (anti-clutter)
      const midX = (e.p1.x + e.p2.x) / 2, midY = (e.p1.y + e.p2.y) / 2;
      paintAlignedOverlayDimension(
        ctx, e.p1, e.p2, { x: midX + e.nx * dimClr, y: midY + e.ny * dimClr },
        formatSceneLengthForDisplay(e.lengthScene, sceneUnits), t, vp, HUD_COLOR,
      );
    }
  }
  const frame = orientedRectFrame(footprint, rotationDeg);
  if (frame) paintFrameAngleHeight(ctx, frame, rotationDeg, heightSpecLabel, wpp, t, vp);
}

/**
 * ADR-564 §footprint-hud — ελάχιστος **entity-agnostic** περιγραφέας του footprint HUD, ώστε το
 * ΙΔΙΟ SSoT paint να καλείται ΚΑΙ από την κολόνα (`ColumnParams`) ΚΑΙ από το πέδιλο-pad
 * (`FoundationParams`) — μηδέν παράλληλος painter, μηδέν type-lie cast. Τα rect/profile branches
 * είναι ήδη ColumnParams-agnostic (χρειάζονται μόνο `rotationDeg`)· circular χρειάζεται μόνο το
 * footprint· polygon χρειάζεται `widthMm` (Ø) + `polygonSides`.
 */
export interface FootprintHudDescriptor {
  /** Σχήμα διατομής — καθορίζει τον κλάδο (το rect πιάνεται ΠΑΝΤΑ πρώτο από το `isRectFootprint`). */
  readonly kind: 'rectangular' | 'circular' | 'polygon' | 'profile';
  /** Μοίρες CCW — για ∠γωνία + oriented frame (rect/polygon/profile). */
  readonly rotationDeg: number;
  /** mm — Ø περιγεγραμμένου (μόνο polygon). */
  readonly widthMm?: number;
  /** αριθμός πλευρών (μόνο polygon). */
  readonly polygonSides?: number;
}

/**
 * Ζωγραφίζει το live footprint HUD ΑΝΑ τύπο (full parity — entity-agnostic πυρήνας):
 *   · ορθογώνιο/τοιχίο (rect footprint) → 2 aligned δ. στις παρειές + ∠ + ύψος·
 *   · κυκλικό → Ø + ύψος·  · πολύγωνο → Ø + N + ∠ + ύψος·
 *   · Γ/Τ/Π/Ι/σύνθετο → aligned δ. σε κάθε ακμή + ∠ + ύψος.
 * `footprint` = world-baked κορυφές (rotation ήδη μέσα). `heightSpecLabel` = ΗΔΗ μεταφρασμένο.
 */
export function paintFootprintHud(
  ctx: CanvasRenderingContext2D,
  footprint: readonly Point2D[],
  descriptor: FootprintHudDescriptor,
  heightSpecLabel: string,
  sceneUnits: SceneUnits,
  transform: ViewTransform,
  viewport: HudViewport,
): void {
  if (isRectFootprint(footprint)) {
    const rect = rectFrameFromCorners(footprint);
    if (rect) paintRectColumnHud(ctx, rect, descriptor.rotationDeg, heightSpecLabel, sceneUnits, transform, viewport);
    return;
  }
  if (descriptor.kind === 'circular') {
    paintCircularColumnHud(ctx, footprint, heightSpecLabel, sceneUnits, transform, viewport);
    return;
  }
  if (descriptor.kind === 'polygon') {
    paintPolygonColumnHud(
      ctx, footprint, descriptor.rotationDeg,
      descriptor.widthMm ?? 0, descriptor.polygonSides ?? DEFAULT_POLYGON_SIDES,
      heightSpecLabel, sceneUnits, transform, viewport,
    );
    return;
  }
  paintProfileColumnHud(ctx, footprint, descriptor.rotationDeg, heightSpecLabel, sceneUnits, transform, viewport);
}

/**
 * Live HUD κολόνας — thin wrapper πάνω στο entity-agnostic `paintFootprintHud` (μηδέν αλλαγή
 * συμπεριφοράς: map `ColumnParams` → `FootprintHudDescriptor`). Οι column consumers (grip-drag +
 * placement) καλούν αυτό ΑΜΕΤΑΒΛΗΤΑ.
 */
export function paintColumnHud(
  ctx: CanvasRenderingContext2D,
  footprint: readonly Point2D[],
  params: ColumnParams,
  heightSpecLabel: string,
  sceneUnits: SceneUnits,
  transform: ViewTransform,
  viewport: HudViewport,
): void {
  paintFootprintHud(
    ctx, footprint,
    {
      kind: params.kind === 'circular' ? 'circular' : params.kind === 'polygon' ? 'polygon' : 'profile',
      rotationDeg: params.rotation,
      widthMm: params.width,
      polygonSides: params.polygon?.sides,
    },
    heightSpecLabel, sceneUnits, transform, viewport,
  );
}
