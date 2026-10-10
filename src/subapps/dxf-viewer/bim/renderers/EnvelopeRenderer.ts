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
import { paintMaterialHatchSegments } from './shared/material-hatch-paint';
import { applyLiveStroke } from './shared/live-stroke';
import type { HatchLineSegment } from '../geometry/shared/hatch-pattern-geometry';
import type { EnvelopeOpeningCut } from '../geometry/envelope-opening-cuts';
import type { EnvelopeRenderPlan, EnvelopeSlabHatchPlan } from './envelope-render-plan';

export type { EnvelopeRenderPlan, EnvelopeSlabHatchPlan } from './envelope-render-plan';
export {
  buildEnvelopeRenderPlan,
  buildSlabHatchPlan,
  buildRevealJambPlans,
} from './envelope-render-plan';

// ─── Visual constants ─────────────────────────────────────────────────────────
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
    if (plan.polygon.length < 3 || plan.hatch.length === 0) return;
    // ADR-507 Φ7 — τα segments έρχονται ήδη clipped στο footprint (μηδέν `ctx.clip()`).
    this.paintHatch(plan.hatch, transform, viewport);
  }

  /**
   * ADR-909 Γ2.6β — η γραμμοσκίαση μόνωσης ζωγραφίζεται από τον ΕΝΑ painter γραμμοσκίασης υλικού
   * (`paintMaterialHatchSegments`: ίδιο χρώμα, ίδιο πάχος, ρωτά την πολιτική εκτύπωσης). Πριν, το σώμα του ήταν
   * γραμμένο εδώ δύο φορές (πλάκα + ζώνη).
   */
  private paintHatch(
    segments: readonly HatchLineSegment[],
    transform: ViewTransform,
    viewport: EnvelopeRenderViewport,
  ): void {
    paintMaterialHatchSegments(this.ctx, segments, (p) => this.toScreen(p, transform, viewport));
  }

  /**
   * ADR-396 — «τρυπάει» τα ανοίγματα στο band μόνωσης (`destination-out`): η Z1
   * δεν σκεπάζει πόρτες/παράθυρα. Καλείται ΜΕΤΑ το `render` του ίδιου chain, ΠΡΙΝ
   * τα Z4 reveals (ώστε τα περβάζια να μην σβήνονται). Ίδιο SSoT band sub-quad με
   * το 3D (`computeEnvelopeOpeningCuts`) → 2D⟷3D parity.
   */
  renderOpeningCuts(
    cuts: readonly EnvelopeOpeningCut[],
    transform: ViewTransform,
    viewport: EnvelopeRenderViewport,
  ): void {
    if (cuts.length === 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    // Μάσκα σβησίματος, όχι μελάνι: με `destination-out` μετρά μόνο η αδιαφάνεια — δεν ρωτά την πολιτική (ADR-909 Γ2.6β).
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    for (const cut of cuts) {
      const q = cut.bandQuad;
      if (q.length < 3) continue;
      ctx.beginPath();
      const first = this.toScreen(q[0], transform, viewport);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < q.length; i++) {
        const s = this.toScreen(q[i], transform, viewport);
        ctx.lineTo(s.x, s.y);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * ADR-396 — Κλείνει το προφίλ της μόνωσης στα άκρα κάθε opening cut με τις 2
   * **κάθετες απολήξεις** (small brown lines): `[O_a→F_a]` (bandQuad 0→3) και
   * `[O_b→F_b]` (bandQuad 1→2). Όπως η συνεχής `strokeOuterLoop` κλείνει την εξωτ.
   * όψη, αυτές κλείνουν την τομή του πάχους μόνωσης στο άνοιγμα (ευθυγραμμισμένες με
   * την παρειά τοίχου/Z4). Καλείται **ΜΕΤΑ** το `renderOpeningCuts` (`destination-out`)
   * ώστε να μη σβηστούν. Ίδιο `bandQuad` SSoT → 2D⟷3D parity.
   */
  strokeOpeningCutCaps(
    cuts: readonly EnvelopeOpeningCut[],
    transform: ViewTransform,
    viewport: EnvelopeRenderViewport,
  ): void {
    if (cuts.length === 0) return;
    const ctx = this.ctx;
    ctx.save();
    applyLiveStroke(ctx, ENVELOPE_OUTLINE_RGBA, ENVELOPE_OUTLINE_WIDTH_PX);
    ctx.setLineDash([]);
    ctx.beginPath();
    for (const cut of cuts) {
      const q = cut.bandQuad;
      if (q.length < 4) continue;
      this.strokeSegment(q[0], q[3], transform, viewport); // O_a → F_a
      this.strokeSegment(q[1], q[2], transform, viewport); // O_b → F_b
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Προσθέτει ένα τμήμα `a→b` στο τρέχον path (ο caller έχει κάνει beginPath/stroke). */
  private strokeSegment(
    a: { readonly x: number; readonly y: number },
    b: { readonly x: number; readonly y: number },
    transform: ViewTransform,
    viewport: EnvelopeRenderViewport,
  ): void {
    const pa = this.toScreen(a, transform, viewport);
    const pb = this.toScreen(b, transform, viewport);
    this.ctx.moveTo(pa.x, pa.y);
    this.ctx.lineTo(pb.x, pb.y);
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
    if (plan.bandRing.length < 3 || plan.hatch.length === 0) return;
    // ADR-507 Φ7 — segments ήδη clipped στο band ring (μηδέν `ctx.clip()`).
    this.paintHatch(plan.hatch, transform, viewport);
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
    applyLiveStroke(ctx, ENVELOPE_OUTLINE_RGBA, ENVELOPE_OUTLINE_WIDTH_PX);
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
