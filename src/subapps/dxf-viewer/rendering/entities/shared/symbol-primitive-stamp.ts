/**
 * symbol-primitive-stamp — SSoT stamper για unit-space vector glyph primitives
 * (ADR-583 annotation symbols + ADR-642 Φ3 complex-linetype symbols).
 *
 * Ένα «σύμβολο» (north arrow, φράχτης `×`, batting μόνωση, …) είναι μια λίστα από
 * `AnnotationSymbolPrimitive` σε **unit space** (1.0 = nominal ύψος, +Y = «πάνω»,
 * [0,0] = κέντρο). Ο καλών παρέχει:
 *   - `toScreen(unitPoint)` — unit → screen (κατέχει rotation/scale/Y-flip)· ίδιο shape
 *     με τον annotation renderer (`worldToScreen ∘ (insertion + size·R(rot)·p)`).
 *   - `radiusScale` — unit → screen px linear factor (για radii κύκλων/τόξων + ύψος text).
 *   - `rot` — world-CCW γωνία (rad) του glyph· τα τόξα την προσθέτουν και negate-άρουν
 *     για το canvas Y-flip (mirror `ArcRenderer`), το text την κοιτά για upright.
 *
 * Καθαρή, ctx-only συνάρτηση — καμία `this`/subscription/hover εξάρτηση (ADR-040 safe:
 * cacheable στο bitmap path). Extracted VERBATIM από `AnnotationSymbolRenderer.stampPrimitive`
 * ώστε ΕΝΑ painter να εξυπηρετεί annotation symbols ΚΑΙ linetype symbols (N.18, Boy-Scout).
 *
 * Ο καλών ορίζει `ctx.strokeStyle`/`ctx.fillStyle` πριν (τα solid fills χρησιμοποιούν το
 * τρέχον `fillStyle`) — έτσι το phase-tint μένει ευθύνη του renderer, όχι εδώ.
 */

import type { Point2D } from '../../types/Types';
import type {
  AnnotationSymbolPrimitive,
  AnnotationSymbolPoint,
} from '../../../config/annotation-symbol-catalog';
import type { AnnotationSymbolSvg } from '../../../config/annotation-symbol-svg-types';
import { buildUIFont } from '../../../config/text-rendering-config';

const DEG_TO_RAD = Math.PI / 180;

/** Below this on-screen cap height a baked label is unreadable — skip drawing it. */
export const MIN_LABEL_SCREEN_PX = 4;

/** Everything the stamper needs to place one unit-space glyph into a ctx. */
export interface SymbolStampContext {
  /** unit-space point → screen px (owns rotation + scale + Y-flip). */
  readonly toScreen: (p: AnnotationSymbolPoint) => Point2D;
  /** unit → screen px linear factor (circle/arc radius, text cap height). */
  readonly radiusScale: number;
  /** World-CCW glyph rotation (rad) — arc angle offset + text upright decision. */
  readonly rot: number;
}

/** Stamp ONE unit-space primitive into `ctx` via the shared placement context. */
export function stampSymbolPrimitive(
  ctx: CanvasRenderingContext2D,
  prim: AnnotationSymbolPrimitive,
  sc: SymbolStampContext,
): void {
  switch (prim.kind) {
    case 'line': {
      const a = sc.toScreen(prim.from);
      const b = sc.toScreen(prim.to);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      return;
    }
    case 'polyline': {
      if (prim.points.length === 0) return;
      ctx.beginPath();
      prim.points.forEach((pt, i) => {
        const s = sc.toScreen(pt);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      if (prim.closed) ctx.closePath();
      if (prim.closed && prim.solid) ctx.fill();
      else ctx.stroke();
      return;
    }
    case 'circle': {
      // Uniform world→screen scale keeps a circle circular; radius px = unit radius ×
      // the unit→screen linear factor.
      const c = sc.toScreen(prim.center);
      const radiusPx = Math.abs(prim.radius * sc.radiusScale);
      ctx.beginPath();
      ctx.arc(c.x, c.y, radiusPx, 0, Math.PI * 2);
      if (prim.solid) ctx.fill();
      else ctx.stroke();
      return;
    }
    case 'arc': {
      // World-CCW angles rotate with the glyph (+ rot), then negate for the canvas
      // Y-flip and drop the counterclockwise flag (mirror ArcRenderer: world-CCW sweep
      // → screen-CW, so `counterclockwise = false`).
      const c = sc.toScreen(prim.center);
      const radiusPx = Math.abs(prim.radius * sc.radiusScale);
      const startWorld = prim.startAngle * DEG_TO_RAD + sc.rot;
      const endWorld = prim.endAngle * DEG_TO_RAD + sc.rot;
      ctx.beginPath();
      ctx.arc(c.x, c.y, radiusPx, -startWorld, -endWorld, false);
      ctx.stroke();
      return;
    }
    case 'text': {
      // Anchor rides the glyph rotate+scale; the label itself stays upright by default
      // (readable numbers/letters) — set uprightOnRotate:false to spin it with the glyph,
      // negating the angle for the Y-flip (mirror TextRenderer).
      const anchor = sc.toScreen(prim.at);
      const screenHeight = Math.abs(prim.heightFrac * sc.radiusScale);
      if (screenHeight < MIN_LABEL_SCREEN_PX) return;
      ctx.font = buildUIFont(screenHeight, 'arial', prim.bold ? 'bold' : 'normal');
      ctx.textAlign = prim.align ?? 'center';
      ctx.textBaseline = prim.baseline ?? 'middle';
      if ((prim.uprightOnRotate ?? true) || sc.rot === 0) {
        ctx.fillText(prim.value, anchor.x, anchor.y);
      } else {
        ctx.save();
        ctx.translate(anchor.x, anchor.y);
        ctx.rotate(-sc.rot);
        ctx.fillText(prim.value, 0, 0);
        ctx.restore();
      }
      return;
    }
    case 'svg': {
      stampSvgGlyph(ctx, prim, sc.toScreen);
      return;
    }
    default: {
      const _exhaustive: never = prim;
      void _exhaustive;
    }
  }
}

/**
 * ADR-608 Φ-import-svg — ζωγραφίζει ένα SVG glyph (Bézier paths + circles + lines) με
 * native `Path2D`. Ο affine viewBox→(toScreen output space) υπολογίζεται **εμπειρικά** από
 * τρία σημεία (`toScreen` σε [0,0]/[1,0]/[0,1]) → δουλεύει με ΟΠΟΙΟΔΗΠΟΤΕ `toScreen`
 * (Y-flip/rotation/scale) χωρίς να αναπαράγει την εσωτερική του μορφή. Εφαρμόζεται ως
 * ΣΧΕΤΙΚΟΣ πολλαπλασιασμός (`ctx.transform`) ώστε να συνθέτει με το τρέχον ctx matrix (DPR).
 */
function stampSvgGlyph(
  ctx: CanvasRenderingContext2D,
  prim: AnnotationSymbolSvg,
  toScreen: (p: AnnotationSymbolPoint) => Point2D,
): void {
  if (typeof Path2D === 'undefined') return; // guard (SSR/test env χωρίς canvas)
  // Βάση unit→output-space (affine· διανύσματα +X/+Y από το σημείο εισαγωγής).
  const o = toScreen([0, 0]);
  const xAxis = toScreen([1, 0]);
  const yAxis = toScreen([0, 1]);
  const exx = xAxis.x - o.x, exy = xAxis.y - o.y;
  const eyx = yAxis.x - o.x, eyy = yAxis.y - o.y;
  const [minX, minY, w, h] = prim.viewBox;
  if (h === 0) return;
  const cx = minX + w / 2, cy = minY + h / 2; // viewBox κέντρο → σημείο εισαγωγής
  // svg→output: (Y-flip του SVG-down μέσω −eY· κέντρο viewBox στην αρχή). Βλ. σχόλιο τύπου.
  const a = exx / h, b = exy / h, c = -eyx / h, d = -eyy / h;
  const e = o.x - (cx / h) * exx + (cy / h) * eyx;
  const f = o.y - (cx / h) * exy + (cy / h) * eyy;
  const svgScale = Math.hypot(a, b) || 1;

  ctx.save();
  ctx.transform(a, b, c, d, e, f);
  ctx.lineWidth = ctx.lineWidth / svgScale; // κράτα σταθερό ορατό πάχος (screen px)
  for (const el of prim.elements) {
    if (el.el === 'path') {
      const path = new Path2D(el.d);
      if (el.fill) ctx.fill(path);
      else ctx.stroke(path);
    } else if (el.el === 'circle') {
      ctx.beginPath();
      ctx.arc(el.cx, el.cy, el.r, 0, Math.PI * 2);
      if (el.fill) ctx.fill();
      else ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(el.x1, el.y1);
      ctx.lineTo(el.x2, el.y2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
