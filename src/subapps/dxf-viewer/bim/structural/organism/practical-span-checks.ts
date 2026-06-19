/**
 * Practical-span advisory — soft warning + πρόταση ενδιάμεσων κολωνών (ADR-504 Φάση 1,
 * ADR-487 §8.4 «ο άνθρωπος υπογράφει, το σύστημα προειδοποιεί»).
 *
 * Όταν ο auto-sizer (ADR-475/499) βγάζει **μηχανικά σωστή αλλά σχεδιαστικά μη-πρακτική**
 * δοκό (π.χ. 16m άνοιγμα → 250×1450mm), η διατομή είναι οριακά κάτω από το hard cap
 * (`BEAM_MAX_PRACTICAL_DEPTH_MM`) αλλά κόβει το ελεύθερο ύψος κάτω της — εκεί όπου περνούν
 * κουφώματα/πόρτες. Όπως οι μεγάλοι (Revit/Robot/ETABS): το σύστημα **προειδοποιεί +
 * προτείνει** ενδιάμεσες κολόνες, ΠΟΤΕ σιωπηλά/υποχρεωτικά (σε αίθριο/πυλωτή ο μηχανικός
 * θέλει το μεγάλο δοκάρι). Μηδέν μετάλλαξη σκηνής — μόνο διάγνωση `warning`.
 *
 * **Practical ≠ Feasible:** το feasibility (`error`, ADR-499 §D) πιάνει το «ανέφικτο στο
 * μέγιστο»· εδώ είναι το **soft** επίπεδο κάτω από το hard cap. Διαφορετικός code → μηδέν
 * διπλό μήνυμα.
 *
 * **Δυναμικό threshold (Giorgio 2026-06-19):** το πρακτικό όριο ύψους = ύψος ορόφου −
 * required clear (`practicalBeamDepthLimitMm`), δηλαδή προσαρμόζεται στο πραγματικό ύψος
 * ορόφου ΚΑΙ τη χρήση (κατοικία 2,20m / βοηθητικός 2,00m). Graceful default 3,0m/2,20m →
 * 800mm (= ο αριθμός του handoff).
 *
 * Mirror του `feasibility-checks` / `beam-torsion-checks`: pure (entities + graph +
 * provider + storey ως args), severity `warning`, wired στο ΕΝΑ diagnostics pass του
 * `structural-organism-core` (μηδέν νέο reactive trigger). Reuse `suggestBeamSection`
 * (μηδέν νέα φυσική — το «πόσες κολόνες» = iterative re-sizing με μειωμένο άνοιγμα).
 *
 * @see ../sizing/member-sizing.ts — suggestBeamSection (depth από span — reuse)
 * @see ../codes/clear-height-under-beam.ts — practicalBeamDepthLimitMm (το όριο)
 * @see ./derive-beam-support.ts — resolveBeamSupportCondition (πρόβολος/πλήθος στήριξης)
 * @see ./feasibility-checks.ts — το pattern mirror (hard error επίπεδο)
 * @see docs/centralized-systems/reference/adrs/ADR-504-practical-span-intermediate-columns.md
 */

import type { FloorKind } from '@/utils/floor-naming';
import type { Entity } from '../../../types/entities';
import { isBeamEntity } from '../../../types/entities';
import type { BeamSectionContext, StructuralCodeProvider } from '../codes/structural-code-types';
import type { StructuralDiagnostic, StructuralGraph } from './structural-organism-types';
import { buildBeamSectionContext } from '../section-context';
import { suggestBeamSection } from '../sizing/member-sizing';
import { resolveBeamSupportCondition } from './derive-beam-support';
import {
  clearHeightUnderBeamMm,
  practicalBeamDepthLimitMm,
  requiredClearHeightUnderBeamMm,
} from '../codes/clear-height-under-beam';

/** i18n key prefix (ns `dxf-viewer-shell`) — κοινό με τα υπόλοιπα structural διαγνωστικά. */
const MSG = 'structuralOrganism.diagnostics';

/** Άνω όριο προτεινόμενων ενδιάμεσων κολωνών (πρακτικός κάναβος — πέρα από αυτό αλλάζει layout). */
export const MAX_INTERMEDIATE_COLUMNS = 5;

const MM_PER_M = 1000;

/** Storey context που χρειάζεται το threshold (injected — ο πυρήνας μένει pure/jest-clean). */
export interface PracticalSpanStorey {
  /** Πραγματικό ύψος ορόφου (mm) — SSoT `ActiveStoreyContext.storeyHeightMm`. */
  readonly storeyHeightMm: number;
  /** Είδος ορόφου (χρήση) — καθορίζει το required clear (κατοικία 2,20m / βοηθητικός 2,00m). */
  readonly storeyKind: FloorKind | null;
}

/** Η πρόταση «πόσες ενδιάμεσες κολόνες + τι υπο-άνοιγμα/ύψος προκύπτει». */
export interface IntermediateColumnSuggestion {
  readonly columns: number;
  readonly subSpanMm: number;
  readonly suggestedDepthMm: number;
}

/**
 * Πόσες ισαπέχουσες ενδιάμεσες κολόνες χρειάζονται ώστε το αυτόματο ύψος της δοκού να πέσει
 * στο/κάτω από το πρακτικό όριο. Loop `k=1..MAX`: το άνοιγμα μοιράζεται σε `k+1` ίσα υπο-
 * ανοίγματα· το γραμμικό φορτίο (kN/m) είναι span-independent → ίδιο ctx με μειωμένο `spanMm`.
 * **Reuse `suggestBeamSection` — μηδέν νέα φυσική.** Επιστρέφει το πρώτο `k` που πετυχαίνει το
 * όριο· αν κανένα ως MAX → clamp στο MAX (η καλύτερη διαθέσιμη πρόταση).
 *
 * ADR-504 Φ2 — η πρόταση χτίζει το ίδιο μοντέλο που θα παράξει η εκτέλεση: ο δοκός με ≥1
 * ενδιάμεση στήριξη γίνεται **`'continuous'`** (wL_sub²/10, K=1.5 βέλος) → το προτεινόμενο ύψος
 * συμφωνεί με αυτό που θα δώσει ο sizer μετά την εισαγωγή των κολωνών (μηδέν διπλή αλήθεια Φ1↔Φ2).
 */
export function suggestIntermediateColumnCount(
  provider: StructuralCodeProvider,
  ctx: BeamSectionContext,
  practicalDepthLimitMm: number,
): IntermediateColumnSuggestion {
  for (let k = 1; k <= MAX_INTERMEDIATE_COLUMNS; k++) {
    const subSpanMm = ctx.spanMm / (k + 1);
    const suggestedDepthMm = suggestBeamSection(
      provider, { ...ctx, spanMm: subSpanMm, supportType: 'continuous' },
    ).depthMm;
    if (suggestedDepthMm <= practicalDepthLimitMm || k === MAX_INTERMEDIATE_COLUMNS) {
      return { columns: k, subSpanMm, suggestedDepthMm };
    }
  }
  // Μη-προσβάσιμο (MAX ≥ 1, η τελευταία επανάληψη πάντα επιστρέφει) — type-checker guard.
  const fallbackSubSpanMm = ctx.spanMm / (MAX_INTERMEDIATE_COLUMNS + 1);
  return { columns: MAX_INTERMEDIATE_COLUMNS, subSpanMm: fallbackSubSpanMm, suggestedDepthMm: 0 };
}

/** Συνθέτει το `warning` diagnostic με τα DERIVED params (μηδέν μεταφρασμένο string — N.11). */
function buildImpracticalDiagnostic(
  beamId: string,
  ctx: BeamSectionContext,
  depthMm: number,
  storey: PracticalSpanStorey,
  minClearMm: number,
  suggestion: IntermediateColumnSuggestion,
): StructuralDiagnostic {
  return {
    id: `beamSpanImpractical:${beamId}`,
    code: 'beamSpanImpractical',
    severity: 'warning',
    messageKey: `${MSG}.beamSpanImpractical`,
    primaryEntityId: beamId,
    entityIds: [beamId],
    messageParams: {
      width: Math.round(ctx.widthMm),
      span: (ctx.spanMm / MM_PER_M).toFixed(2),
      depth: Math.round(depthMm),
      clear: (clearHeightUnderBeamMm(storey.storeyHeightMm, depthMm) / MM_PER_M).toFixed(2),
      minClear: (minClearMm / MM_PER_M).toFixed(2),
      columns: suggestion.columns,
      subSpan: (suggestion.subSpanMm / MM_PER_M).toFixed(2),
      suggestedDepth: Math.round(suggestion.suggestedDepthMm),
    },
  };
}

/**
 * Practical-span advisory checks πάνω στα entities της σκηνής (ADR-504 §Φ1). Pure: provider
 * + graph (στήριξη) + storey (δυναμικό threshold) ως args. Για κάθε AUTO αμφιέρειστη δοκό
 * όπου το αυτόματο ύψος ξεπερνά το πρακτικό όριο → `warning` με πρόταση ενδιάμεσων κολωνών.
 * Skip: locked (`autoSized:false`) / πρόβολος / <2 στηρίξεις (κανένα διαιρετέο άνοιγμα).
 * Κενό όταν καμία δοκός δεν είναι μη-πρακτική (η συνήθης περίπτωση).
 */
export function runPracticalSpanChecks(
  entities: readonly Entity[],
  graph: StructuralGraph,
  provider: StructuralCodeProvider,
  storey: PracticalSpanStorey,
): StructuralDiagnostic[] {
  const minClearMm = requiredClearHeightUnderBeamMm(storey.storeyKind);
  const practicalLimitMm = practicalBeamDepthLimitMm(storey.storeyHeightMm, storey.storeyKind);
  const out: StructuralDiagnostic[] = [];
  for (const e of entities) {
    if (!isBeamEntity(e)) continue;
    if (e.params.autoSized === false) continue; // locked → ο μηχανικός όρισε διατομή ρητά
    const condition = resolveBeamSupportCondition(graph, e.id, e.params.supportType);
    if (condition.supportType === 'cantilever' || condition.supportCount < 2) continue;
    const ctx = buildBeamSectionContext(e, condition.supportType);
    const depthMm = suggestBeamSection(provider, ctx).depthMm;
    if (depthMm <= practicalLimitMm) continue; // πρακτικό ύψος → σιωπηλό
    const suggestion = suggestIntermediateColumnCount(provider, ctx, practicalLimitMm);
    out.push(buildImpracticalDiagnostic(e.id, ctx, depthMm, storey, minClearMm, suggestion));
  }
  return out;
}
