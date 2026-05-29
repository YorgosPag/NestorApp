/**
 * ADR-396 Phase P4 — Envelope (ETICS) 2D canvas drawer.
 *
 * Thin canvas drawer που καταναλώνει το pure `EnvelopeRenderPlan`
 * (`envelope-render-plan.ts`) + transform → ζωγραφίζει στο overlay canvas. ΔΕΝ
 * είναι registered στο `EntityRendererComposite` — το envelope είναι **παράγωγο
 * floor-overlay** (ADR-396 §3 DISPLAY), όχι per-entity entity.
 *
 * Visual (ADR-396 §5):
 *   - insulation **hatch band** (clipped στο δαχτυλίδι μόνωσης)·
 *   - συνεχής **offset polyline** (η εξωτ. όψη της μόνωσης).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3, §5, §7 (P4)
 * @see ./envelope-render-plan (pure plan builder + hatch SSoT reuse)
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { HATCH_STROKE_RGBA } from '../walls/wall-hatch-patterns';
import type { EnvelopeRenderPlan, EnvelopeSlabHatchPlan } from './envelope-render-plan';

export type { EnvelopeRenderPlan, EnvelopeSlabHatchPlan } from './envelope-render-plan';
export {
  buildEnvelopeRenderPlan,
  buildSlabHatchPlan,
  buildRevealBandPlan,
  resolveEnvelopeHatchKey,
} from './envelope-render-plan';

// ─── Visual constants ─────────────────────────────────────────────────────────
/** Insulation hatch line width (px). Reuse-aligned με wall hatch (~0.5). */
const HATCH_LINE_WIDTH_PX = 0.5;
/** Συνεχής όψη μόνωσης — θερμό insulation tint (Revit-style cladding line). */
const ENVELOPE_OUTLINE_RGBA = 'rgba(184, 92, 28, 0.95)';
const ENVELOPE_OUTLINE_WIDTH_PX = 1.2;

export interface EnvelopeRenderViewport {
  readonly width: number;
  readonly height: number;
}

export class EnvelopeRenderer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  render(
    plan: EnvelopeRenderPlan,
    transform: ViewTransform,
    viewport: EnvelopeRenderViewport,
  ): void {
    this.drawHatchBand(plan, transform, viewport);
    this.strokeOuterLoop(plan, transform, viewport);
  }

  /**
   * Z2/Z3 — διαγράμμιση μόνωσης σε ΟΛΟ το footprint μιας εκτεθειμένης πλάκας
   * (clip polygon → hatch lines εντός). Το περίγραμμα της πλάκας το ζωγραφίζει
   * ήδη ο `SlabRenderer` — εδώ μόνο η μόνωση από πάνω.
   */
  renderSlabHatch(
    plan: EnvelopeSlabHatchPlan,
    transform: ViewTransform,
    viewport: EnvelopeRenderViewport,
  ): void {
    if (plan.polygon.length < 3 || plan.hatch.lines.length === 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    const first = this.toScreen(plan.polygon[0], transform, viewport);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < plan.polygon.length; i++) {
      const s = this.toScreen(plan.polygon[i], transform, viewport);
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.clip();

    ctx.strokeStyle = HATCH_STROKE_RGBA;
    ctx.lineWidth = HATCH_LINE_WIDTH_PX;
    ctx.setLineDash([]);
    ctx.beginPath();
    for (const seg of plan.hatch.lines) {
      const a = this.toScreen(seg.start, transform, viewport);
      const b = this.toScreen(seg.end, transform, viewport);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  private toScreen(
    p: { readonly x: number; readonly y: number },
    transform: ViewTransform,
    viewport: EnvelopeRenderViewport,
  ): Point2D {
    return CoordinateTransforms.worldToScreen({ x: p.x, y: p.y }, transform, viewport);
  }

  /** Clip στο band ring, μετά stroke τις hatch lines εντός. */
  private drawHatchBand(
    plan: EnvelopeRenderPlan,
    transform: ViewTransform,
    viewport: EnvelopeRenderViewport,
  ): void {
    if (plan.bandRing.length < 3 || plan.hatch.lines.length === 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    const first = this.toScreen(plan.bandRing[0], transform, viewport);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < plan.bandRing.length; i++) {
      const s = this.toScreen(plan.bandRing[i], transform, viewport);
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.clip();

    ctx.strokeStyle = HATCH_STROKE_RGBA;
    ctx.lineWidth = HATCH_LINE_WIDTH_PX;
    ctx.setLineDash([]);
    ctx.beginPath();
    for (const seg of plan.hatch.lines) {
      const a = this.toScreen(seg.start, transform, viewport);
      const b = this.toScreen(seg.end, transform, viewport);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Συνεχής εξωτ. όψη μόνωσης. */
  private strokeOuterLoop(
    plan: EnvelopeRenderPlan,
    transform: ViewTransform,
    viewport: EnvelopeRenderViewport,
  ): void {
    if (plan.outerLoop.length < 2) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = ENVELOPE_OUTLINE_RGBA;
    ctx.lineWidth = ENVELOPE_OUTLINE_WIDTH_PX;
    ctx.setLineDash([]);
    ctx.beginPath();
    const first = this.toScreen(plan.outerLoop[0], transform, viewport);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < plan.outerLoop.length; i++) {
      const s = this.toScreen(plan.outerLoop[i], transform, viewport);
      ctx.lineTo(s.x, s.y);
    }
    if (plan.outerClosed) ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}
