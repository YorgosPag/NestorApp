/**
 * ADR-471 Slice 2 — 2Δ σχεδίαση οπλισμού δοκού (κάτοψη): mirror του `column-rebar-2d`.
 *
 * Σε αντίθεση με την κολόνα (η κάτοψη ΕΙΝΑΙ η διατομή → ράβδες = κουκκίδες), η δοκός
 * είναι **longitudinal**: η κάτοψη δείχνει την άνω παρειά κατά μήκος του άξονα. Άρα:
 *   - **Διαμήκεις** ράβδες = γραμμές **κατά τον άξονα** στις εγκάρσιες θέσεις τους
 *     (η κατακόρυφη θέση w «πέφτει» στην κάτοψη — κάτω/άνω ράβδος ίδιου v προβάλλονται
 *     στην ίδια γραμμή, μελετητική σύμβαση).
 *   - **Συνδετήρες** = **εγκάρσιες** γραμμές στο cover σε κάθε στάθμη (η κλειστή
 *     διαδρομή στο επίπεδο διατομής v-w προβάλλεται σε ευθύγραμμο τμήμα κατά το v).
 *
 * Καταναλώνει το ΙΔΙΟ geometry SSoT (`resolveBeamRebarLayout`) με το 3Δ → ίδιες θέσεις.
 * Η beam-local (u,v) → world μετατροπή γίνεται μέσω του κοινού `samplePolylineFrame`
 * (path-relative frame) πάνω στον **πλήρη** άξονα (`axisPolyline`, ΟΧΙ το trimmed
 * `displayAxisPolyline`) ώστε το arc-length u να συμφωνεί με το span του layout
 * (= `geometry.length`)· ο οπλισμός διατρέχει συνεχώς και τον κόμβο (Revit σύμβαση).
 *
 * ADR-040: pure draw, ZERO subscriptions (ο orchestrator το καλεί στο cached
 * normal-state pass μέσω του `drawMemberReinforcement2D` dispatcher).
 *
 * @see ./column-rebar-2d.ts — ο δίδυμος της κολόνας
 * @see ../structural/reinforcement/beam-rebar-layout.ts — geometry SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-471-unified-member-reinforcement.md §2-3
 */

import type { Point2D } from '../../rendering/types/Types';
import type { BeamEntity } from '../types/beam-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import { buildBeamSectionContext } from '../structural/section-context';
import { resolveActiveBeamReinforcementForEntity } from '../structural/active-reinforcement';
import { resolveBeamRebarLayout } from '../structural/reinforcement/beam-rebar-layout';
import { DEFAULT_STIRRUP_TYPE } from '../structural/reinforcement/beam-reinforcement-types';
import { samplePolylineFrame } from '../geometry/shared/polyline-frame';
// ADR-471 Slice 6 — χρώμα οπλισμού από το ΕΝΑ SSoT (πρώην inline literal σε 10 αρχεία).
import { REBAR_COLOR_HEX as REBAR_COLOR } from '../structural/rebar-catalog';
/** Ελάχιστο πάχος γραμμής συνδετήρα (px) ώστε να φαίνεται σε μικρό zoom. */
const MIN_STIRRUP_LINE_PX = 0.6;
/** Ελάχιστο πάχος γραμμής διαμήκους ράβδου (px). */
const MIN_BAR_LINE_PX = 0.6;

/** Μέγιστο |v| (mm) της διαδρομής συνδετήρα — το εγκάρσιο μισό-πλάτος στην κάτοψη. */
function stirrupHalfWidthMm(pathMm: readonly Point2D[]): number {
  let half = 0;
  for (const p of pathMm) half = Math.max(half, Math.abs(p.x));
  return half;
}

/**
 * Ζωγραφίζει τον οπλισμό μιας δοκού στην κάτοψη. No-op αν δεν έχει ενεργό οπλισμό ή
 * εκφυλισμένη διατομή/άξονα. `pxPerMm` = scene-units-per-mm × scale (ίδιο με κολόνα).
 */
export function drawBeamRebar2D(
  ctx: CanvasRenderingContext2D,
  beam: Pick<BeamEntity, 'params' | 'geometry'>,
  pxPerMm: number,
  worldToScreen: (p: Point2D) => Point2D,
): void {
  // ADR-471 (parity με κολόνα) — auto ⇒ φρέσκο design από την τρέχουσα γεωμετρία· manual ⇒ stored.
  const r = resolveActiveBeamReinforcementForEntity(beam);
  if (!r) return;
  const layout = resolveBeamRebarLayout(buildBeamSectionContext(beam), r);
  if (!layout) return;
  const axisPts = beam.geometry.axisPolyline.points;
  if (axisPts.length < 2) return;

  const s = mmToSceneUnits(beam.params.sceneUnits ?? 'mm'); // canvas units ανά mm
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

  // ── Διαμήκεις: γραμμές κατά τον άξονα στις εγκάρσιες θέσεις (curve-aware sampling) ──
  // Ίσιος άξονας (2 σημεία) → 1 τμήμα· καμπύλος → πύκνωση δειγμάτων για ομαλή γραμμή.
  const subdivisions = axisPts.length <= 2 ? 1 : Math.max(8, axisPts.length * 2);
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

  // ── Γάντζοι 135° (μόνο `closed-hooked`) — προβάλλονται κι αυτοί στο v στην κάτοψη ──
  if ((r.stirrups.type ?? DEFAULT_STIRRUP_TYPE) === 'closed-hooked' && layout.stirrupLevelsMm.length > 0) {
    ctx.lineWidth = Math.max(MIN_STIRRUP_LINE_PX, layout.stirrupDiameterMm * pxPerMm);
    // Σχεδιάζουμε τους γάντζους στα δύο άκρα (πρώτη/τελευταία στάθμη) για να φανεί η
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

  ctx.restore();
}
