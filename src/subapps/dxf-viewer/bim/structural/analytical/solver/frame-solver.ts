/**
 * Static linear FEM solver — orchestrator (ADR-481, T3 / S6).
 *
 * Επιλύει K·u = F για το 3D χωρικό πλαίσιο ανά συνδυασμό φόρτισης (γραμμική
 * στατική ανάλυση): συναρμολόγηση K (μία φορά) → ανά συνδυασμό build F + solve +
 * post-process (κομβικές μετακινήσεις + τοπικά εντατικά μεγέθη μέλους + διαγράμματα)
 * → envelope (max-abs) ανά μέλος.
 *
 * **ΟΧΙ** σεισμός/μάζες/ιδιομορφές (T4) — αλλά extensible: αρκεί να περάσει ο caller
 * επιπλέον σεισμικούς `LoadCombination` (ADR-480 `buildLoadCombinations({seismic})`)
 * και ο solver τους χειρίζεται ομοιόμορφα, χωρίς αναδόμηση.
 *
 * Pure (injected providers → jest-clean, μηδέν entity store/firebase imports).
 *
 * @see ./global-assembly.ts · ./load-vector.ts · ./cholesky-solve.ts
 * @see ./member-end-forces.ts · ./member-diagrams.ts
 * @see docs/centralized-systems/reference/adrs/ADR-481-static-fem-solver.md
 */

import { DOF_PER_NODE } from './frame-element-stiffness';
import { assembleGlobalStiffness, type SectionPropertyProvider, type AssembledStiffness, type AssembledElement } from './global-assembly';
import { buildLoadVector, elementLocalLoad, type MemberLoadProvider } from './load-vector';
import { solveSymmetric } from './cholesky-solve';
import { computeMemberEndForces } from './member-end-forces';
import { sampleMemberDiagram, diagramExtrema, DEFAULT_DIAGRAM_STATIONS } from './member-diagrams';
import type { DofMap } from './dof-map';
import type { Vector } from './dense-matrix';
import type { AnalyticalModel } from '../analytical-model-types';
import type { LoadCombination } from '../load-cases';
import {
  EMPTY_ANALYSIS_RESULT,
  type AnalysisResult,
  type CombinationResult,
  type MemberForceExtrema,
  type MemberForceResult,
  type NodeDisplacement,
} from './solver-types';

/** Είσοδος του solver — μοντέλο + injected providers + συνδυασμοί. */
export interface SolveFrameInput {
  readonly model: AnalyticalModel;
  readonly sectionProvider: SectionPropertyProvider;
  readonly loadProvider: MemberLoadProvider;
  readonly combinations: readonly LoadCombination[];
  /** Σταθμές διαγράμματος ανά μέλος (default 9). */
  readonly diagramStations?: number;
}

/** Κομβικές μετακινήσεις ανά κόμβο από το διάνυσμα λύσης. */
function buildDisplacements(model: AnalyticalModel, dofMap: DofMap, u: Vector): NodeDisplacement[] {
  return model.nodes.map((node) => {
    const base = (dofMap.indexByNode.get(node.id) ?? 0) * DOF_PER_NODE;
    return { nodeId: node.id, ux: u[base], uy: u[base + 1], uz: u[base + 2], rx: u[base + 3], ry: u[base + 4], rz: u[base + 5] };
  });
}

/** Εντατικά μεγέθη + διάγραμμα ενός μέλους για έναν συνδυασμό. */
function buildMemberForce(
  element: AssembledElement, combination: LoadCombination, provider: MemberLoadProvider, u: Vector, stations: number,
): MemberForceResult {
  const localLoad = elementLocalLoad(element, combination, provider);
  const endForcesLocal = computeMemberEndForces(element, u, localLoad);
  const diagram = sampleMemberDiagram(element, endForcesLocal, localLoad, stations);
  return { memberId: element.member.id, endForcesLocal, diagram, extrema: diagramExtrema(diagram) };
}

/** Επίλυση + post-process ενός συνδυασμού. */
function solveCombination(
  assembled: AssembledStiffness, combination: LoadCombination, input: SolveFrameInput,
): CombinationResult {
  const f = buildLoadVector(assembled.elements, combination, input.loadProvider, assembled.dofMap.dofCount, assembled.restrained);
  const { solution, singular } = solveSymmetric(assembled.k, f, assembled.physicalStiffnessScale);
  const stations = input.diagramStations ?? DEFAULT_DIAGRAM_STATIONS;
  const memberForces = singular ? [] : assembled.elements.map((el) => buildMemberForce(el, combination, input.loadProvider, solution, stations));
  return {
    combinationId: combination.id,
    combinationKind: combination.kind,
    singular,
    displacements: singular ? [] : buildDisplacements(input.model, assembled.dofMap, solution),
    memberForces,
  };
}

/** Συνδύασε δύο extrema (max-abs ανά συνιστώσα) — για το envelope. */
function maxExtrema(a: MemberForceExtrema, b: MemberForceExtrema): MemberForceExtrema {
  return {
    maxAbsAxialN: Math.max(a.maxAbsAxialN, b.maxAbsAxialN),
    maxAbsShear: Math.max(a.maxAbsShear, b.maxAbsShear),
    maxAbsMoment: Math.max(a.maxAbsMoment, b.maxAbsMoment),
    maxAbsTorsion: Math.max(a.maxAbsTorsion, b.maxAbsTorsion),
  };
}

/** Envelope (max-abs over combinations) ανά μέλος. */
function buildEnvelope(combinations: readonly CombinationResult[]): Map<string, MemberForceExtrema> {
  const envelope = new Map<string, MemberForceExtrema>();
  for (const combo of combinations) {
    for (const mf of combo.memberForces) {
      const prev = envelope.get(mf.memberId);
      envelope.set(mf.memberId, prev ? maxExtrema(prev, mf.extrema) : mf.extrema);
    }
  }
  return envelope;
}

/**
 * Τρέξε τη στατική γραμμική ανάλυση. Κενό μοντέλο / κανένα φέρον μέλος / κανένας
 * συνδυασμός → `EMPTY_ANALYSIS_RESULT` (no-op). Μη-ευσταθής φορέας (singular K)
 * → ο συνδυασμός σημειώνεται `singular` και `unstable: true` (ο caller το δείχνει
 * ως diagnostic, δεν εμπιστεύεται τιμές).
 */
export function solveStaticFrame(input: SolveFrameInput): AnalysisResult {
  if (input.model.members.length === 0 || input.combinations.length === 0) return EMPTY_ANALYSIS_RESULT;
  const assembled = assembleGlobalStiffness(input.model, input.sectionProvider);
  if (assembled.elements.length === 0) {
    return { ...EMPTY_ANALYSIS_RESULT, skippedMemberIds: assembled.skippedMemberIds };
  }
  const combinations = input.combinations.map((c) => solveCombination(assembled, c, input));
  return {
    combinations,
    envelopeByMember: buildEnvelope(combinations),
    skippedMemberIds: assembled.skippedMemberIds,
    unstable: combinations.some((c) => c.singular),
  };
}
