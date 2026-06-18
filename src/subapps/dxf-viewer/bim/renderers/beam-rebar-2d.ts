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
import { buildBeamSectionContext } from '../structural/section-context';
import { resolveActiveBeamReinforcementForEntity, resolveActiveBeamSupportType } from '../structural/active-reinforcement';
import { resolveBeamRebarLayout } from '../structural/reinforcement/beam-rebar-layout';
import { DEFAULT_STIRRUP_TYPE } from '../structural/reinforcement/beam-reinforcement-types';
import { drawLinearMemberRebar2D } from './linear-member-rebar-2d';

/**
 * Ζωγραφίζει τον οπλισμό μιας δοκού στην κάτοψη. No-op αν δεν έχει ενεργό οπλισμό ή
 * εκφυλισμένη διατομή/άξονα. `pxPerMm` = scene-units-per-mm × scale (ίδιο με κολόνα).
 *
 * ADR-477 Slice 2 — thin wrapper: resolve (auto-aware) → SSoT core `drawLinearMemberRebar2D`
 * (το ίδιο core που τροφοδοτεί και η συνδετήρια δοκός — μηδέν διπλότυπο).
 */
export function drawBeamRebar2D(
  ctx: CanvasRenderingContext2D,
  beam: Pick<BeamEntity, 'id' | 'params' | 'geometry'>,
  pxPerMm: number,
  worldToScreen: (p: Point2D) => Point2D,
): void {
  // ADR-471 (parity με κολόνα) — auto ⇒ φρέσκο design από την τρέχουσα γεωμετρία· manual ⇒ stored.
  const r = resolveActiveBeamReinforcementForEntity(beam);
  if (!r) return;
  // ADR-486 — ίδιος topology-aware τύπος στήριξης στο layout (πρόβολος → άνω κύριος οπλισμός).
  const layout = resolveBeamRebarLayout(buildBeamSectionContext(beam, resolveActiveBeamSupportType(beam.id)), r);
  if (!layout) return;
  drawLinearMemberRebar2D(
    ctx,
    {
      axisPts: beam.geometry.axisPolyline.points,
      sceneUnits: beam.params.sceneUnits,
      layout,
      stirrupType: r.stirrups.type ?? DEFAULT_STIRRUP_TYPE,
    },
    pxPerMm,
    worldToScreen,
  );
}
