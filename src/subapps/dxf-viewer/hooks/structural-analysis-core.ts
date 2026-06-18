/**
 * structural-analysis-core — ADR-481 (T3, στατικός FEM solver entry).
 *
 * SSoT πυρήνας που επιλύει τον DERIVED αναλυτικό φορέα (ADR-480) και:
 *   1. στήνει τους injected providers (διατομή/υλικό + φορτίο μέλους) από τα entities,
 *   2. τρέχει τον pure `solveStaticFrame` (K·u=F ανά συνδυασμό → M/V/N + διαγράμματα),
 *   3. γράφει το αποτέλεσμα στο `AnalysisResultsStore` (single writer = αυτός ο core),
 *   4. emit-άρει `bim:analysis-solved`,
 *   5. επιστρέφει το αποτέλεσμα + τα diagnostics ευστάθειας (singular K / skipped).
 *
 * **Light module (σκόπιμα χωρίς firebase imports):** entities + έτοιμο μοντέλο
 * περνιούνται injected → ο πυρήνας μένει jest-clean (mirror του
 * `structural-analytical-core` του T2). Pure ως προς τα entities (μηδέν mutation).
 *
 * @see bim/structural/analytical/solver/frame-solver.ts — solveStaticFrame (pure)
 * @see bim/structural/analytical/solver/analysis-results-store.ts — ο store που γράφεται
 * @see hooks/structural-analytical-core.ts — το αδελφό πρότυπο (T2)
 * @see docs/centralized-systems/reference/adrs/ADR-481-static-fem-solver.md
 */

import { EventBus } from '../systems/events/EventBus';
import { solveStaticFrame } from '../bim/structural/analytical/solver/frame-solver';
import { resolveMemberSectionProperties } from '../bim/structural/analytical/solver/member-section-properties';
import { AnalysisResultsStore } from '../bim/structural/analytical/solver/analysis-results-store';
import { runAnalysisDiagnostics } from '../bim/structural/analytical/solver/analysis-diagnostics';
import { buildLoadCombinations } from '../bim/structural/analytical/load-cases';
import { resolveAppliedMemberLoad, type MemberLoad } from '../bim/structural/loads/structural-loads-types';
import { isBeamEntity, type Entity } from '../types/entities';
import type { AnalyticalMember, AnalyticalModel } from '../bim/structural/analytical/analytical-model-types';
import type { AnalysisResult } from '../bim/structural/analytical/solver/solver-types';
import type { StructuralDiagnostic } from '../bim/structural/organism/structural-organism-types';

/** Είσοδος του πυρήνα — entities + DERIVED αναλυτικός φορέας (από AnalyticalModelStore). */
export interface StructuralAnalysisInput {
  readonly entities: readonly Entity[];
  readonly model: AnalyticalModel;
}

/** Έξοδος — το αποτέλεσμα ανάλυσης + τα diagnostics ευστάθειας. */
export interface StructuralAnalysisOutput {
  readonly result: AnalysisResult;
  readonly diagnostics: readonly StructuralDiagnostic[];
}

/** Επιλογές εκτέλεσης — ADR-488: `silent` στο proactive (ζωντανός solver, μηδέν toast). */
export interface RunStructuralAnalysisOptions {
  /** true ⇒ το `bim:analysis-solved` φέρει `silent` → ο notification hook δεν κάνει toast. */
  readonly silent?: boolean;
}

/**
 * Επίλυσε & δημοσίευσε τη στατική γραμμική ανάλυση. Το φορτίο μέλους αντλείται ΜΟΝΟ
 * από δοκάρια (`appliedLoad`, ADR-467/472 — η αξονική κολόνας προκύπτει από το πλαίσιο).
 */
export function runStructuralAnalysis(
  input: StructuralAnalysisInput,
  options?: RunStructuralAnalysisOptions,
): StructuralAnalysisOutput {
  const byId = new Map(input.entities.map((e) => [e.id, e]));
  const sectionProvider = (m: AnalyticalMember) => resolveMemberSectionProperties(m, byId.get(m.entityId));
  const loadProvider = (m: AnalyticalMember): MemberLoad | null => {
    const entity = byId.get(m.entityId);
    if (m.memberType !== 'beam' || !entity || !isBeamEntity(entity)) return null;
    return resolveAppliedMemberLoad(entity.params.appliedLoad);
  };
  const result = solveStaticFrame({
    model: input.model, sectionProvider, loadProvider, combinations: buildLoadCombinations(),
  });
  AnalysisResultsStore.set(result);
  EventBus.emit('bim:analysis-solved', {
    combinationCount: result.combinations.length,
    unstable: result.unstable,
    silent: options?.silent,
  });
  return { result, diagnostics: runAnalysisDiagnostics(result, input.model.members.map((m) => m.id)) };
}
