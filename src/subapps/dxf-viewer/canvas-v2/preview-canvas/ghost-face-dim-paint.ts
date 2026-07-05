/**
 * ghost-face-dim-paint — paints the wall-ghost listening dimensions (ADR-508 §dim) on the
 * PreviewCanvas overlay. Fully SSoT-composed, zero bespoke drawing:
 *   - LINE + extension lines  → `renderPreviewDimension` (ADR-362) with `overlayLineStyle`
 *     (the shared 0.5px dashed [8,5] `overlay-line-style` SSoT). The dim's own text is
 *     suppressed (`userText: ''`).
 *   - NUMBER                  → `drawOverlayLabel` (`overlay-text-style` SSoT — same font/chip
 *     as the tracking + polar tooltips), value via `formatLengthForDisplay` (forced metres).
 *
 * So the listening dims share line-style, text-style AND number-format code with the alignment
 * traces / polar line — one visual language, one SSoT per concern.
 *
 * @see ../../bim/framing/ghost-face-dim-references.ts — produces the measured dims (pure)
 * @see ./preview-dimension-renderer.ts — dim line geometry SSoT (ADR-362)
 * @see ./overlay-line-style.ts · ./overlay-text-style.ts — shared overlay SSoTs
 */

import type { AlignedDimensionEntity } from '../../types/dimension';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { GhostFaceDimensionsMeta } from '../../bim/framing/ghost-face-dim-references';
import { ISO_129_TEMPLATE } from '../../systems/dimensions/dim-style-templates';
import { canvasToMmScaleFor } from '../../utils/scene-units';
import { formatLengthForDisplay } from '../../config/display-length-format';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { arcToPolyline } from '../../utils/geometry/GeometryUtils';
import type { GhostFaceDimension } from '../../bim/framing/ghost-face-dim-references';
import { formatAngleLocale } from '../../rendering/entities/shared/distance-label-utils';
import { renderPreviewDimension } from './preview-dimension-renderer';
import { drawOverlayLabel } from './overlay-text-style';
import { applyOverlayLineStyle, OVERLAY_LINE_COLORS, strokeOverlaySegment } from './overlay-line-style';
// SSoT label clearance: κοινό box-aware push με το wall HUD ώστε ο αριθμός να κάθεται πάντα ΚΑΘΑΡΟΣ
// πέρα από τη dim line (η ΚΟΝΤΙΝΗ ακμή του, όχι το κέντρο) — ίδιο contract για όλα τα overlay numbers.
import { measureOverlayLabelBox, clearanceForBox } from './overlay-label-layout';
import type { OverlayProjector } from './overlay-projector';

/** Projection helper: ο 3D projector όταν δίνεται (ADR-544), αλλιώς το 2D `worldToScreen`. */
function resolveToScreen(
  transform: ViewTransform,
  viewport: { readonly width: number; readonly height: number },
  project: OverlayProjector | undefined,
): (p: Point2D) => Point2D {
  return project ?? ((p) => CoordinateTransforms.worldToScreen(p, transform, viewport));
}

/** Extra screen-px the number sits BEYOND the dim line (so it never overlaps it — no bg chip). */
const LABEL_CLEARANCE_PX = 9;

/** Build a transient aligned dim entity for one along-face measurement. Text is suppressed
 *  (`userText: ''`) — the number is drawn separately via the overlay-text SSoT. */
function toAlignedDim(
  kind: string,
  defPoints: AlignedDimensionEntity['defPoints'],
): AlignedDimensionEntity {
  return {
    id: `__ghost_face_dim_${kind}`,
    type: 'dimension',
    layerId: '',
    dimensionType: 'aligned',
    styleId: ISO_129_TEMPLATE.id,
    defPoints,
    userText: '',
  };
}

/**
 * Paint every dim in `meta` onto `ctx`. Called AFTER the ghost preview so the listening
 * dimensions overlay it (same convention as `drawTrackingAlignment`); the next
 * `drawPreview`/`clear` wipes them.
 */
export function paintGhostFaceDimensions(
  ctx: CanvasRenderingContext2D,
  meta: GhostFaceDimensionsMeta,
  transform: ViewTransform,
  viewport: { readonly width: number; readonly height: number },
  project?: OverlayProjector,
): void {
  const textColor = OVERLAY_LINE_COLORS.listeningDim; // CYAN — distinct mechanism colour
  const mmPerScene = canvasToMmScaleFor({ sceneUnits: meta.sceneUnits }); // SSoT scene→mm scale
  const labelMode = meta.labelMode ?? 'length'; // ADR-398 §3.12 — μήκος / γωνία / και τα δύο (arc gaps)
  for (const d of meta.dims) {
    if (d.arc) paintArcDimension(ctx, d, transform, viewport, mmPerScene, labelMode, textColor, project);
    else paintStraightDimension(ctx, d, transform, viewport, mmPerScene, textColor, project);
  }
}

/**
 * Place the number BEYOND `sRef` along the screen-space outward vector (sRef − sBase). Η απόσταση
 * είναι **box-aware** (SSoT `clearanceForBox`): η ΚΟΝΤΙΝΗ ακμή του αριθμού κάθεται `LABEL_CLEARANCE_PX`
 * πέρα από τη dim line (όχι το κέντρο του) → ο αριθμός δεν ακουμπά ποτέ τη γραμμή, ίδιο contract με
 * το wall HUD spec/γωνία. (Empty outward → fallback μοναδιαία προς τα κάτω.)
 */
function drawLabelBeyond(
  ctx: CanvasRenderingContext2D,
  label: string,
  sRef: Point2D,
  sBase: Point2D,
  textColor: string,
): void {
  const ox = sRef.x - sBase.x, oy = sRef.y - sBase.y;
  const olen = Math.hypot(ox, oy) || 1;
  const ux = olen > 1e-9 ? ox / olen : 0, uy = olen > 1e-9 ? oy / olen : 1;
  const clear = clearanceForBox(ux, uy, measureOverlayLabelBox(ctx, label), LABEL_CLEARANCE_PX);
  drawOverlayLabel(ctx, label, sRef.x + ux * clear, sRef.y + uy * clear, { textColor, align: 'center' });
}

/**
 * SSoT: μία ΕΥΘΕΙΑ aligned overlay dimension (ADR-362 `renderPreviewDimension` με το κοινό
 * 0.5px dashed overlay-line-style + ο αριθμός μέσω `drawOverlayLabel`, τοποθετημένος BEYOND τη
 * dim line). Μοιράζεται από τις listening-dims (ADR-508 §dim) ΚΑΙ το wall HUD (ADR-509 §self-dim)
 * → ένα οπτικό λεξιλόγιο, μηδέν διπλό dim-draw (ADR-508 §wall-hud). Το `label` είναι ΗΔΗ formatted.
 */
export function paintAlignedOverlayDimension(
  ctx: CanvasRenderingContext2D,
  p1: Point2D,
  p2: Point2D,
  dimLineRef: Point2D,
  label: string,
  transform: ViewTransform,
  viewport: { readonly width: number; readonly height: number },
  color: string = OVERLAY_LINE_COLORS.listeningDim,
  project?: OverlayProjector,
): void {
  renderPreviewDimension({
    ctx,
    entity: toAlignedDim('overlay', [p1, p2, dimLineRef]),
    style: ISO_129_TEMPLATE,
    transform,
    viewport,
    opts: { overlayLineStyle: true, color },
    project, // ADR-544 — 3D camera projector (καμία αλλαγή στο 2D path όταν undefined)
  });
  const toScreen = resolveToScreen(transform, viewport, project);
  const sRef = toScreen(dimLineRef);
  const sMid = toScreen({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });
  drawLabelBeyond(ctx, label, sRef, sMid, color);
}

/** ΕΥΘΕΙΑ listening dim (along-face / radius) — delegate στο κοινό `paintAlignedOverlayDimension` SSoT. */
function paintStraightDimension(
  ctx: CanvasRenderingContext2D,
  d: GhostFaceDimension,
  transform: ViewTransform,
  viewport: { readonly width: number; readonly height: number },
  mmPerScene: number,
  textColor: string,
  project: OverlayProjector | undefined,
): void {
  const len = formatLengthForDisplay(d.valueScene * mmPerScene, { unit: 'm' });
  // ADR-508 §neighbor-clearance — «γωνία μόνο σε λοξές»: όταν ο resolver όρισε `angleDeg` (μη-ορθή
  // ένδειξη), προσάρτησέ την ως `/ γωνία°` μέσω του SSoT `formatAngleLocale` (ADR-082, el/en + °).
  const label = d.angleDeg != null ? `${len} / ${formatAngleLocale(d.angleDeg)}` : len;
  paintAlignedOverlayDimension(ctx, d.p1, d.p2, d.dimLineRef, label, transform, viewport, textColor, project);
}

/** Αριθμός δειγμάτων της καμπύλης dim line (πυκνό αρκετά ώστε να φαίνεται ομαλή σε κάθε zoom). */
const ARC_DIM_SEGMENTS = 32;

/** Ετικέτα arc gap κατά `labelMode`: μήκος τόξου (μέτρα) / γωνία (μοίρες) / και τα δύο. */
function formatArcLabel(d: GhostFaceDimension, mmPerScene: number, labelMode: 'length' | 'angle' | 'both'): string {
  const len = formatLengthForDisplay(d.valueScene * mmPerScene, { unit: 'm' });
  const ang = formatAngleLocale(d.sweepDeg ?? 0); // SSoT (ADR-082 locale-aware el/en + °) — μηδέν inline format
  if (labelMode === 'angle') return ang;
  if (labelMode === 'both') return `${len} / ${ang}`;
  return len;
}

/**
 * ADR-398 §3.12 — ΚΑΜΠΥΛΗ listening dim (μήκος τόξου): η dim line **ακολουθεί την περιφέρεια**
 * (sampled μέσω του `arcToPolyline` SSoT) σε ακτίνα `radius + offset`, με ακτινικές extension lines
 * προς τα 2 άκρα + ετικέτα (μήκος/γωνία) στο μεσοτόξιο. Ίδιο 0.5px dashed cyan overlay SSoT με τα ευθεία.
 */
function paintArcDimension(
  ctx: CanvasRenderingContext2D,
  d: GhostFaceDimension,
  transform: ViewTransform,
  viewport: { readonly width: number; readonly height: number },
  mmPerScene: number,
  labelMode: 'length' | 'angle' | 'both',
  textColor: string,
  project: OverlayProjector | undefined,
): void {
  const arc = d.arc;
  if (!arc) return;
  const toScreen = resolveToScreen(transform, viewport, project);
  const dimRadius = Math.hypot(d.dimLineRef.x - arc.center.x, d.dimLineRef.y - arc.center.y);
  const curve = arcToPolyline(
    { center: arc.center, radius: dimRadius, startAngle: arc.startAngleDeg, endAngle: arc.endAngleDeg },
    ARC_DIM_SEGMENTS,
  );
  applyOverlayLineStyle(ctx, OVERLAY_LINE_COLORS.listeningDim);
  if (curve.length >= 2) {
    ctx.beginPath();
    const s0 = toScreen(curve[0]);
    ctx.moveTo(s0.x, s0.y);
    for (let i = 1; i < curve.length; i++) {
      const s = toScreen(curve[i]);
      ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();
    strokeOverlaySegment(ctx, toScreen(d.p1), s0);                  // ακτινική extension στο «from» άκρο
    strokeOverlaySegment(ctx, toScreen(d.p2), toScreen(curve[curve.length - 1])); // στο «to» άκρο
  }
  const sRef = toScreen(d.dimLineRef);
  drawLabelBeyond(ctx, formatArcLabel(d, mmPerScene, labelMode), sRef, toScreen(arc.center), textColor);
}
