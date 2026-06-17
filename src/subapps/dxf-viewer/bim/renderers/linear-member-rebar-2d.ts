/**
 * ADR-477 Slice 2 — 2Δ σχεδίαση οπλισμού **γραμμικού μέλους** (κάτοψη): SSoT core.
 *
 * Το «σώμα» του πρώην `drawBeamRebar2D` ΜΕΤΑ το resolve — δηλαδή το κομμάτι που
 * δέχεται έτοιμο `BeamRebarLayout` (διαμήκεις + συνδετήρες σε beam-local mm) + τον
 * άξονα (canvas units) και το προβάλλει στην οθόνη μέσω του κοινού
 * `samplePolylineFrame` (path-relative frame). Καταναλώνεται από:
 *   - `beam-rebar-2d.ts` (δοκός) — resolve μέσω beam suggester (geometry.length span).
 *   - `footing-rebar-2d.ts` (συνδετήρια δοκός, ADR-477) — resolve μέσω **footing**
 *     suggester (μεγαλύτερο cover EC2 §4.4.1)· περνά footing-resolved layout εδώ.
 *
 * Γι' αυτό ο core ΔΕΝ ξανα-resolve-άρει οπλισμό — δέχεται `layout` + `stirrupType`
 * έτοιμα (αλλιώς το tie-beam θα έπαιρνε λάθος cover από τον beam suggester). Καθαρά
 * γεωμετρική προβολή — μηδέν store/Firestore. ADR-040: pure draw, ZERO subscriptions.
 *
 * @see ./beam-rebar-2d.ts · ./footing-rebar-2d.ts — οι δύο thin callers
 * @see ../structural/reinforcement/beam-rebar-layout.ts — geometry SSoT (EC8 ζώνες)
 * @see docs/centralized-systems/reference/adrs/ADR-477-tie-beam-reinforcement-unification.md §Slice 2
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import { mmToSceneUnits } from '../../utils/scene-units';
import { samplePolylineFrame } from '../geometry/shared/polyline-frame';
import type { BeamRebarLayout } from '../structural/reinforcement/beam-rebar-layout';
import type { StirrupType } from '../structural/reinforcement/beam-reinforcement-types';
// ADR-471 Slice 6 — χρώμα οπλισμού από το ΕΝΑ SSoT (πρώην inline literal σε 10 αρχεία).
import { REBAR_COLOR_HEX as REBAR_COLOR } from '../structural/rebar-catalog';

/** Ελάχιστο πάχος γραμμής συνδετήρα (px) ώστε να φαίνεται σε μικρό zoom. */
const MIN_STIRRUP_LINE_PX = 0.6;
/** Ελάχιστο πάχος γραμμής διαμήκους ράβδου (px). */
const MIN_BAR_LINE_PX = 0.6;

/** Είσοδος του 2Δ core: άξονας (canvas units) + έτοιμη διάταξη + τύπος συνδετήρα. */
export interface LinearMemberRebar2DInput {
  /** Σημεία άξονα σε **canvas/scene units** (δοκός: axisPolyline· tie-beam: [start,end]). */
  readonly axisPts: readonly Point2D[];
  /** Μονάδα καμβά (για mm→canvas scale· absent ⇒ 'mm'). */
  readonly sceneUnits: SceneUnits | undefined;
  /** Διάταξη οπλισμού σε beam-local mm (resolved από τον caller — geometry SSoT). */
  readonly layout: BeamRebarLayout;
  /** Μορφή συνδετήρα (resolved, defaulted από τον caller) — γάντζοι 135° μόνο `closed-hooked`. */
  readonly stirrupType: StirrupType;
}

/** Μέγιστο |v| (mm) της διαδρομής συνδετήρα — το εγκάρσιο μισό-πλάτος στην κάτοψη. */
function stirrupHalfWidthMm(pathMm: readonly Point2D[]): number {
  let half = 0;
  for (const p of pathMm) half = Math.max(half, Math.abs(p.x));
  return half;
}

/**
 * Ζωγραφίζει τη διάταξη οπλισμού ενός γραμμικού μέλους στην κάτοψη. No-op αν ο
 * άξονας είναι εκφυλισμένος (<2 σημεία). `pxPerMm` = scene-units-per-mm × scale.
 */
export function drawLinearMemberRebar2D(
  ctx: CanvasRenderingContext2D,
  input: LinearMemberRebar2DInput,
  pxPerMm: number,
  worldToScreen: (p: Point2D) => Point2D,
): void {
  const { axisPts, sceneUnits, layout, stirrupType } = input;
  if (axisPts.length < 2) return;

  const s = mmToSceneUnits(sceneUnits ?? 'mm'); // canvas units ανά mm
  // beam-local (u,v) [mm] → screen, μέσω path-relative frame πάνω στον πλήρη άξονα.
  const project = (uMm: number, vMm: number): Point2D | null => {
    const frame = samplePolylineFrame(axisPts, uMm * s);
    if (!frame) return null;
    return worldToScreen({
      x: frame.point.x + vMm * s * frame.normal.x,
      y: frame.point.y + vMm * s * frame.normal.y,
    });
  };

  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = REBAR_COLOR;

  // ── Συνδετήρες: εγκάρσια γραμμή στο cover σε κάθε στάθμη ──
  const halfV = stirrupHalfWidthMm(layout.stirrupSectionPathMm);
  if (halfV > 0) {
    ctx.lineWidth = Math.max(MIN_STIRRUP_LINE_PX, layout.stirrupDiameterMm * pxPerMm);
    for (const u of layout.stirrupLevelsMm) {
      const a = project(u, -halfV);
      const b = project(u, halfV);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  drawLongitudinalBars(ctx, layout, pxPerMm, axisPts.length, project);
  drawStirrupHooks(ctx, layout, stirrupType, pxPerMm, project);

  ctx.restore();
}

/** Διαμήκεις: γραμμές κατά τον άξονα στις εγκάρσιες θέσεις (curve-aware sampling). */
function drawLongitudinalBars(
  ctx: CanvasRenderingContext2D,
  layout: BeamRebarLayout,
  pxPerMm: number,
  axisPtCount: number,
  project: (uMm: number, vMm: number) => Point2D | null,
): void {
  // Ίσιος άξονας (2 σημεία) → 1 τμήμα· καμπύλος → πύκνωση δειγμάτων για ομαλή γραμμή.
  const subdivisions = axisPtCount <= 2 ? 1 : Math.max(8, axisPtCount * 2);
  for (const bar of layout.longitudinalBars) {
    ctx.lineWidth = Math.max(MIN_BAR_LINE_PX, bar.diameterMm * pxPerMm);
    ctx.beginPath();
    let started = false;
    for (let k = 0; k <= subdivisions; k++) {
      const u = bar.uStartMm + ((bar.uEndMm - bar.uStartMm) * k) / subdivisions;
      const p = project(u, bar.vMm);
      if (!p) continue;
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    if (started) ctx.stroke();
  }
}

/** Γάντζοι 135° (μόνο `closed-hooked`) — προβάλλονται στο v στα δύο άκρα στην κάτοψη. */
function drawStirrupHooks(
  ctx: CanvasRenderingContext2D,
  layout: BeamRebarLayout,
  stirrupType: StirrupType,
  pxPerMm: number,
  project: (uMm: number, vMm: number) => Point2D | null,
): void {
  if (stirrupType !== 'closed-hooked' || layout.stirrupLevelsMm.length === 0) return;
  ctx.lineWidth = Math.max(MIN_STIRRUP_LINE_PX, layout.stirrupDiameterMm * pxPerMm);
  // Σχεδιάζουμε τους γάντζους στα δύο άκρα (πρώτη/τελευταία στάθμη) ώστε να φανεί η
  // μορφή χωρίς θόρυβο σε κάθε στάθμη (η κάτοψη δείχνει αντιπροσωπευτικά τα άκρα).
  const ends = [layout.stirrupLevelsMm[0], layout.stirrupLevelsMm[layout.stirrupLevelsMm.length - 1]];
  for (const u of ends) {
    for (const hook of layout.stirrupHookEndsMm) {
      if (hook.length < 2) continue;
      ctx.beginPath();
      let started = false;
      for (const pt of hook) {
        const p = project(u, pt.x);
        if (!p) continue;
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else { ctx.lineTo(p.x, p.y); }
      }
      if (started) ctx.stroke();
    }
  }
}
