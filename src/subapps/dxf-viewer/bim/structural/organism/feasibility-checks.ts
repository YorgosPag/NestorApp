/**
 * Global feasibility escalation — η ΕΣΧΑΤΗ παρέμβαση του οργανισμού (ADR-499 Slice D,
 * ADR-487 §7). Όταν ο auto-sizer (Slice B) έχει φτάσει το **πρακτικό μέγιστο** μέγεθος
 * (`MAX_PRACTICAL_*`) και η διατομή είναι **ΑΚΟΜΑ ανεπαρκής**, καμία αύξηση διάστασης ή
 * οπλισμού δεν λύνει το πρόβλημα → ο «στατικός» (η εφαρμογή) **παραδίδεται στον άνθρωπο**
 * με diagnostic `severity:'error'` «ανέφικτο — απαιτείται αλλαγή σχεδιασμού».
 *
 * Είναι το **μοναδικό** σημείο όπου ο οργανισμός βγάζει `error` (vs τα `warning` των B/C):
 * εδώ η αυτο-διόρθωση έχει εξαντληθεί. Διακρίνει τρία μέλη — ΟΛΑ μέσω των ΥΠΑΡΧΟΝΤΩΝ SSoT
 * (μηδέν νέα μηχανική):
 *   · **πλάκα-πρόβολος** → `M_Ed > M_Rd,lim` στο μέγιστο πάχος (`isFlexurallyAdequate`).
 *   · **κολώνα** → `As,req > ρ_max·A_c` στη μέγιστη διατομή (`isColumnInfeasibleAtMaxSection`).
 *   · **δοκός (στρέψη)** → `T_Ed > T_Rd,max` στο μέγιστο ύψος (`assessBeamTorsion` → `'infeasible'`).
 *
 * Pure (provider + FEM-moment map ως args) — μηδέν store/Firestore (mirror `runSlabChecks`/
 * `runFootingDesignChecks`). Wired στο `useStructuralOrganism` diagnostics pass (μηδέν νέο
 * reactive trigger). i18n: ΕΝΑ key `sectionInfeasibleAtMaxSize` (ICU select στο `memberKind`).
 *
 * @see ../codes/flexural-capacity.ts — isFlexurallyAdequate (πλάκα)
 * @see ../sizing/column-sizing.ts — isColumnInfeasibleAtMaxSection (κολώνα)
 * @see ../loads/beam-torsion.ts — assessBeamTorsion ('infeasible' = έσχατο για δοκό)
 * @see ./slab-checks.ts — runSlabChecks (το pattern mirror)
 * @see docs/centralized-systems/reference/adrs/ADR-499-auto-correcting-organism.md
 */

import type { Entity } from '../../../types/entities';
import { isSlabEntity, isColumnEntity } from '../../../types/entities';
import type { StructuralCodeProvider } from '../codes/structural-code-types';
import type { StructuralDiagnostic } from './structural-organism-types';
import { computeSlabSupportConditions } from '../loads/slab-beam-support';
import { buildSlabFoundationSectionContext } from '../section-context';
import { footingEffectiveDepthMm } from '../codes/suggest-reinforcement';
import { isFlexurallyAdequate, limitMomentNmm } from '../codes/flexural-capacity';
import { slabDesignMomentNmmPerM } from '../codes/suggest-slab-reinforcement';
import { DEFAULT_CONCRETE_GRADE, concreteFcdMpa } from '../concrete-grades';
import { MAX_PRACTICAL_SLAB_THICKNESS_MM, SLAB_DESIGN_STRIP_MM } from '../sizing/slab-sizing';
import {
  isColumnInfeasibleAtMaxSection,
  MAX_PRACTICAL_COLUMN_DIMENSION_MM,
} from '../sizing/column-sizing';
import { BEAM_MAX_PRACTICAL_DEPTH_MM } from '../sizing/member-sizing';
import { assessBeamTorsion } from '../loads/beam-torsion';

/** i18n key prefix (ns `dxf-viewer-shell`) — κοινό με τα υπόλοιπα structural διαγνωστικά. */
const MSG = 'structuralOrganism.diagnostics';
const CODE = 'sectionInfeasibleAtMaxSize';

/** Συνθέτει το ενιαίο `error` diagnostic (κοινό schema για πλάκα/κολώνα/δοκό· memberKind = ICU token). */
function infeasible(
  entityId: string,
  messageParams: Readonly<Record<string, string | number>>,
): StructuralDiagnostic {
  return {
    id: `${CODE}:${entityId}`,
    code: CODE,
    severity: 'error',
    messageKey: `${MSG}.${CODE}`,
    primaryEntityId: entityId,
    entityIds: [entityId],
    messageParams,
  };
}

/** Πλάκα-πρόβολος ανέφικτη: `M_Ed > M_Rd,lim` ακόμη και στο μέγιστο πρακτικό πάχος. */
function appendSlabInfeasible(
  out: StructuralDiagnostic[],
  entities: readonly Entity[],
  provider: StructuralCodeProvider,
): void {
  const conditions = computeSlabSupportConditions(entities);
  if (conditions.size === 0) return;
  for (const e of entities) {
    if (!isSlabEntity(e)) continue;
    const cond = conditions.get(e.id);
    if (!cond || cond.supportType !== 'cantilever') continue;
    const ctx = buildSlabFoundationSectionContext(e, cond);
    if (ctx.kind !== 'suspended') continue; // εδαφόπλακες/raft δεν είναι πρόβολοι
    const cover = provider.slabFoundationReinforcementLimits(ctx).nominalCoverMm;
    const dEffMax = footingEffectiveDepthMm(MAX_PRACTICAL_SLAB_THICKNESS_MM, cover);
    const fcd = concreteFcdMpa(ctx.concreteGrade ?? DEFAULT_CONCRETE_GRADE);
    const mLim = limitMomentNmm(SLAB_DESIGN_STRIP_MM, dEffMax, fcd, provider.flexuralLimitMuLim());
    const mEd = slabDesignMomentNmmPerM(ctx);
    if (mEd <= 0 || isFlexurallyAdequate(mEd, mLim)) continue; // αρκεί στο max → σιωπηλό (B το λύνει)
    out.push(infeasible(e.id, {
      memberKind: 'slab',
      span: ((ctx.cantileverSpanMm ?? 0) / 1000).toFixed(2),
      maxThickness: MAX_PRACTICAL_SLAB_THICKNESS_MM,
    }));
  }
}

/** Κολώνα ανέφικτη: `As,req > ρ_max·A_c` ακόμη και στη μέγιστη πρακτική διατομή. */
function appendColumnInfeasible(
  out: StructuralDiagnostic[],
  entities: readonly Entity[],
  provider: StructuralCodeProvider,
  femMomentByColumnId: ReadonlyMap<string, number>,
): void {
  for (const e of entities) {
    if (!isColumnEntity(e)) continue;
    if (!isColumnInfeasibleAtMaxSection(provider, e.params, femMomentByColumnId.get(e.id))) continue;
    out.push(infeasible(e.id, {
      memberKind: 'column',
      maxSize: MAX_PRACTICAL_COLUMN_DIMENSION_MM,
    }));
  }
}

/** Δοκός ανέφικτη: `T_Ed > T_Rd,max` ακόμη και στο μέγιστο πρακτικό ύψος (στρέψη προβόλου). */
function appendBeamTorsionInfeasible(
  out: StructuralDiagnostic[],
  entities: readonly Entity[],
): void {
  for (const [beamId, a] of assessBeamTorsion(entities)) {
    if (a.classification !== 'infeasible') continue;
    out.push(infeasible(beamId, {
      memberKind: 'beam',
      tEd: a.tEdKnm.toFixed(1),
      tRd: a.tRdMaxAtMaxDepthKnm.toFixed(1),
      maxDepth: BEAM_MAX_PRACTICAL_DEPTH_MM,
      width: Math.round(a.widthMm),
    }));
  }
}

/**
 * Έλεγχοι «ανέφικτο στο πρακτικό μέγιστο» πάνω στα entities της σκηνής (ADR-499 §D). Pure:
 * ο `provider` (όρια ρ/μ_lim/cover) + το engaged-gated `femMomentByColumnId` (B2-parity)
 * περνούν ως args. Κενό όταν κανένα μέλος δεν είναι ανέφικτο (η συνήθης περίπτωση).
 */
export function runFeasibilityChecks(
  entities: readonly Entity[],
  provider: StructuralCodeProvider,
  femMomentByColumnId: ReadonlyMap<string, number>,
): StructuralDiagnostic[] {
  const out: StructuralDiagnostic[] = [];
  appendSlabInfeasible(out, entities, provider);
  appendColumnInfeasible(out, entities, provider, femMomentByColumnId);
  appendBeamTorsionInfeasible(out, entities);
  return out;
}
