/**
 * Canvas hatch-fill primitives — SSoT (ADR-511 N.0.2 extraction).
 *
 * Low-level «γέμισε ένα clipped path με γραμμές/τελείες σε world-space spacing» — το ίδιο
 * μοτίβο που ήταν copy-pasted ως private μέθοδοι (`drawParallelLines`/`drawDotGrid`) σε
 * πολλούς area renderers (FloorFinish / Slab / Envelope / WallCovering). Εδώ ζει ΜΙΑ φορά.
 *
 * Ο **caller** στήνει το clip (`ctx.save()` → build path → `ctx.clip()`) + στυλ
 * (`strokeStyle`/`fillStyle`/`lineWidth`) και μετά καλεί αυτές τις primitives με τον δικό του
 * `worldToScreen` projector + bbox + spacing. Δηλαδή το hatch **mapping** (ποιο υλικό → ποιο
 * μοτίβο/spacing) μένει per-domain· μόνο η κοινή σχεδίαση κεντρικοποιείται. Pure-ish (γράφει
 * μόνο στο δοθέν 2D context).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-511-wall-finish-per-room.md
 */

import { liveStrokeInk } from '../../../config/adaptive-entity-color';
import { tracePolygonScreenPath } from '../bim-polygon-render';
import { applyLiveStroke } from './live-stroke';

/** Αχνό ουδέτερο μελάνι του μοτίβου επιφάνειας (πλάκα / επίστρωση δαπέδου) — «hint», όχι περίγραμμα. */
export const AREA_HATCH_STROKE_RGBA = 'rgba(0, 0, 0, 0.15)';
/** Πάχος γραμμής του μοτίβου επιφάνειας (CSS px, zoom-invariant). */
export const AREA_HATCH_LINE_WIDTH_PX = 0.5;

/** Μοτίβο επιφάνειας: παράλληλες γραμμές · κάνναβος · πλέγμα τελειών (με την ακτίνα τους σε px). */
export type AreaHatchMotif = 'lines' | 'grid' | { readonly dotRadiusPx: number };

/** World → screen projector (ο renderer δίνει το `this.worldToScreen`). */
export type WorldToScreen = (p: { x: number; y: number }) => { x: number; y: number };

/** Άξονες-aligned bbox σε world coords (z αγνοείται). */
export interface HatchFillBbox {
  readonly min: { readonly x: number; readonly y: number };
  readonly max: { readonly x: number; readonly y: number };
}

/**
 * Παράλληλες γραμμές με world-space `spacingMm` μέσα στο `bbox`, ζωγραφισμένες σε screen-space
 * μέσω `w2s`. Ο caller έχει ήδη κάνει clip + set `strokeStyle`/`lineWidth`. No-op για μη έγκυρο
 * spacing.
 */
export function strokeHatchLines(
  ctx: CanvasRenderingContext2D,
  w2s: WorldToScreen,
  bbox: HatchFillBbox,
  spacingMm: number,
  orientation: 'horizontal' | 'vertical',
): void {
  if (!Number.isFinite(spacingMm) || spacingMm <= 0) return;
  if (orientation === 'horizontal') {
    const startY = Math.ceil(bbox.min.y / spacingMm) * spacingMm;
    for (let y = startY; y <= bbox.max.y; y += spacingMm) {
      const s = w2s({ x: bbox.min.x, y });
      const e = w2s({ x: bbox.max.x, y });
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
    }
  } else {
    const startX = Math.ceil(bbox.min.x / spacingMm) * spacingMm;
    for (let x = startX; x <= bbox.max.x; x += spacingMm) {
      const s = w2s({ x, y: bbox.min.y });
      const e = w2s({ x, y: bbox.max.y });
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
    }
  }
}

/**
 * Ολόκληρο το πέρασμα μοτίβου μιας επιφάνειας (ADR-909 Γ2.6β): clip στο `ring` → μελάνι → μοτίβο → restore.
 * Το ίδιο σώμα ήταν γραμμένο στον `SlabRenderer` και στον `FloorFinishRenderer`· ο καθένας κρατά πλέον μόνο το
 * mapping του (οικογένεια οπλισμού / υλικό → μοτίβο + βήμα).
 *
 * Γραμμές ΚΑΙ τελείες είναι **μελάνι**: οθόνη ⇒ αχνές αυτούσιες· print pass ⇒ πλήρες μελάνι πολιτικής + δάπεδο
 * πάχους (η διαφάνεια γραμμής δεν τυπώνεται). No-op για μη έγκυρο βήμα — χωρίς `save`.
 */
export function paintClippedAreaHatch(
  ctx: CanvasRenderingContext2D,
  w2s: WorldToScreen,
  ring: ReadonlyArray<{ readonly x: number; readonly y: number }>,
  bbox: HatchFillBbox,
  spacingMm: number,
  motif: AreaHatchMotif,
): void {
  if (!Number.isFinite(spacingMm) || spacingMm <= 0) return;
  ctx.save();
  tracePolygonScreenPath(ctx, w2s, ring);
  ctx.clip();
  applyLiveStroke(ctx, AREA_HATCH_STROKE_RGBA, AREA_HATCH_LINE_WIDTH_PX);
  ctx.fillStyle = liveStrokeInk(AREA_HATCH_STROKE_RGBA);
  ctx.setLineDash([]);
  if (typeof motif === 'object') {
    fillHatchDots(ctx, w2s, bbox, spacingMm, motif.dotRadiusPx);
  } else {
    strokeHatchLines(ctx, w2s, bbox, spacingMm, 'horizontal');
    if (motif === 'grid') strokeHatchLines(ctx, w2s, bbox, spacingMm, 'vertical');
  }
  ctx.restore();
}

/**
 * Πλέγμα τελειών με world-space `spacingMm` μέσα στο `bbox`. Ο caller έχει κάνει clip + set
 * `fillStyle`. `radiusPx` = ακτίνα τελείας σε screen px. No-op για μη έγκυρο spacing.
 */
export function fillHatchDots(
  ctx: CanvasRenderingContext2D,
  w2s: WorldToScreen,
  bbox: HatchFillBbox,
  spacingMm: number,
  radiusPx = 1.5,
): void {
  if (!Number.isFinite(spacingMm) || spacingMm <= 0) return;
  const startX = Math.ceil(bbox.min.x / spacingMm) * spacingMm;
  const startY = Math.ceil(bbox.min.y / spacingMm) * spacingMm;
  for (let x = startX; x <= bbox.max.x; x += spacingMm) {
    for (let y = startY; y <= bbox.max.y; y += spacingMm) {
      const s = w2s({ x, y });
      ctx.beginPath();
      ctx.arc(s.x, s.y, radiusPx, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
