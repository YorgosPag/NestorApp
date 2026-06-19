/**
 * Member diagram geometry — pure SSoT (ADR-483, T3-UI / Slice 4).
 *
 * Μετατρέπει το DERIVED αποτέλεσμα του FEM solver (ADR-481 `AnalysisResult`) + τον
 * αναλυτικό φορέα (ADR-480 `AnalyticalModel`) σε **screen-agnostic διαδρομές
 * διαγράμματος** ανά φέρον μέλος: άξονας i→j (canvas units) + στάθμες
 * `{ f∈[0,1], value }` + ακραία τιμή. Ο overlay (`StructuralDiagramOverlay`) απλώς
 * προβάλλει τις διαδρομές σε οθόνη + σχεδιάζει — μηδέν solver/geometry εδώ.
 *
 * **Γιατί μόνο δοκάρια (v1):** σε κάτοψη μόνο τα μέλη που κείνται στο επίπεδο
 * σχεδίασης (δοκάρια) έχουν νόημα «κατά μήκος» διαγράμματος· οι κολόνες είναι
 * κατακόρυφες (σημείο σε plan) → τα M/V/N τους φαίνονται ως αριθμοί (ADR-482) και
 * τα διαγράμματά τους ανήκουν σε 3Δ/τομή (DEFER).
 *
 * **Μονάδες:** οι αναλυτικές θέσεις είναι σε **μέτρα** (ADR-480)· πολλαπλασιάζονται
 * με `toCanvasFromMeters` ( = 1 / sceneUnitsToMeters(units) ) ώστε να μπουν στο ίδιο
 * canvas frame με τη γεωμετρία entity (SSoT — ίδια μετατροπή με `ClashOverlay`).
 *
 * Pure — zero React/DOM/store. `xM` (απόσταση από κόμβο i) → fraction f = xM/L.
 *
 * @see ../solver/solver-types.ts — DiagramStation / MemberForceResult
 * @see ../analytical-model-types.ts — AnalyticalModel
 */

import type { Point2D } from '../../../../rendering/types/Types';
import type { AnalyticalModel } from '../analytical-model-types';
import type { AnalysisResult, MemberForceResult } from '../solver/solver-types';
import {
  clamp01,
  dominantMomentKey,
  dominantShearKey,
  recoverUdlKnM,
  selectCombination,
  stationValue,
  type DiagramComponent,
  type DiagramSample,
} from './member-diagram-sampling';

// ADR-483 Slice 5 — τα sampling helpers (selectCombination/dominant*/stationValue/
// recoverUdlKnM/clamp01) ζουν πλέον στο shared `member-diagram-sampling` (κοινό SSoT
// με τον 3Δ column builder). Re-export των τύπων ώστε οι υπάρχοντες consumers
// (analysis-diagram-view-store, DiagramComponentSelect, …) να μην αλλάξουν import.
export type { DiagramComponent, DiagramSample };

/** Η διαδρομή διαγράμματος ενός μέλους — άξονας (canvas units) + στάθμες. */
export interface MemberDiagramPath {
  readonly memberId: string;
  readonly iCanvas: Point2D;
  readonly jCanvas: Point2D;
  readonly samples: readonly DiagramSample[];
  /** Στάθμη μέγιστης απόλυτης τιμής — εκεί μπαίνει η ετικέτα. */
  readonly extremum: DiagramSample;
  /**
   * ADR-483 Slice 4b+ — το ομοιόμορφο φορτίο q (kN/m) που **όντως χρησιμοποίησε η
   * ανάλυση**, ανακτημένο από την **καμπυλότητα της ροπής** (`w = |d²M/dx²|`) — ίδια
   * πηγή με το διάγραμμα (self-consistent), όχι το tributary του scene. Οδηγεί τα
   * βέλη φορτίου. 0 για αφόρτιστο μέλος.
   */
  readonly appliedUdlKnM: number;
}

/** Σύνολο διαδρομών + global max-abs + μήκος αναφοράς (για model-space auto-fit). */
export interface MemberDiagramSet {
  readonly component: DiagramComponent;
  readonly paths: readonly MemberDiagramPath[];
  /** Μέγιστη απόλυτη τιμή σε όλα τα μέλη — ορίζει την κλίμακα ύψους. */
  readonly globalMaxAbs: number;
  /**
   * Μέσο μήκος μέλους σε **canvas units** (model space). Ο overlay ορίζει το ύψος
   * της μέγιστης τιμής ως ποσοστό αυτού → το διάγραμμα κλιμακώνεται **μαζί** με το
   * μοντέλο στο zoom (Revit/Robot model-space diagrams), όχι σταθερό pixel ύψος.
   */
  readonly referenceLengthCanvas: number;
  /**
   * ADR-483 Slice 4b — `false` όταν ο επιλεγμένος συνδυασμός βρήκε μηχανισμό
   * (`result.unstable` / singular K) → οι τιμές είναι ύποπτες. Ο overlay τις
   * σχεδιάζει αμπέρ-διακεκομμένες χωρίς γέμισμα (Robot «unreliable results»).
   */
  readonly reliable: boolean;
  /**
   * ADR-483 Slice 4b+ — ταυτότητα του σχεδιαζόμενου συνδυασμού (Robot caption «ποιον
   * συνδυασμό βλέπω»). Κενό όταν δεν υπάρχει έγκυρος συνδυασμός.
   */
  readonly combinationKind: string;
}

export interface BuildMemberDiagramOptions {
  /** Μετατροπή αναλυτικών μέτρων → canvas units ( = 1 / sceneUnitsToMeters(units) ). */
  readonly toCanvasFromMeters: number;
  /** Εντατικό μέγεθος προς σχεδίαση (default 'moment'). */
  readonly component?: DiagramComponent;
}

const EMPTY: MemberDiagramSet = {
  component: 'moment', paths: [], globalMaxAbs: 0, referenceLengthCanvas: 0, reliable: true, combinationKind: '',
};

/** Μέσο μήκος μέλους (canvas units) από τις διαδρομές — μήκος αναφοράς κλίμακας. */
function meanPathLength(paths: readonly MemberDiagramPath[]): number {
  if (paths.length === 0) return 0;
  let sum = 0;
  for (const p of paths) sum += Math.hypot(p.jCanvas.x - p.iCanvas.x, p.jCanvas.y - p.iCanvas.y);
  return sum / paths.length;
}

/** Διαδρομή ενός μέλους (ή null αν λείπουν κόμβοι/διάγραμμα). */
function buildMemberPath(
  member: AnalyticalModel['members'][number],
  force: MemberForceResult,
  positionByNode: ReadonlyMap<string, { xM: number; yM: number }>,
  component: DiagramComponent,
  toCanvas: number,
): MemberDiagramPath | null {
  const pi = positionByNode.get(member.iNodeId);
  const pj = positionByNode.get(member.jNodeId);
  if (!pi || !pj || force.diagram.length === 0) return null;

  const momentKey = dominantMomentKey(force.diagram);
  const shearKey = dominantShearKey(force.diagram);
  const length = member.lengthM > 0 ? member.lengthM : 1;

  let extremum: DiagramSample = { f: 0, value: 0 };
  const samples = force.diagram.map((st) => {
    const f = clamp01(st.xM / length);
    const value = stationValue(st, component, momentKey, shearKey);
    if (Math.abs(value) >= Math.abs(extremum.value)) extremum = { f, value };
    return { f, value };
  });

  // Φορτίο για τα βέλη: από την καμπυλότητα της ΡΟΠΗΣ (ανεξάρτητα από το επιλεγμένο
  // component) → πάντα ίδιο με το φορτίο της ανάλυσης, μηδέν εξάρτηση από scene tributary.
  const appliedUdlKnM = recoverUdlKnM(force.diagram.map((st) => st[momentKey]), length);

  return {
    memberId: member.id,
    iCanvas: { x: pi.xM * toCanvas, y: pi.yM * toCanvas },
    jCanvas: { x: pj.xM * toCanvas, y: pj.yM * toCanvas },
    samples,
    extremum,
    appliedUdlKnM,
  };
}

/**
 * Κύρια συνάρτηση: από analytical model + analysis result → screen-agnostic
 * διαδρομές διαγράμματος ανά **δοκάρι** (v1). `globalMaxAbs` οδηγεί την auto-fit
 * κλίμακα του overlay. Κενό σύνολο όταν δεν υπάρχει έγκυρος συνδυασμός.
 */
export function buildMemberDiagramPaths(
  model: AnalyticalModel,
  result: AnalysisResult,
  options: BuildMemberDiagramOptions,
): MemberDiagramSet {
  const component = options.component ?? 'moment';
  const combination = selectCombination(result);
  if (!combination) return { ...EMPTY, component };

  const forceById = new Map(combination.memberForces.map((f) => [f.memberId, f]));
  const positionByNode = new Map(model.nodes.map((n) => [n.id, n.position]));

  const paths: MemberDiagramPath[] = [];
  let globalMaxAbs = 0;
  for (const member of model.members) {
    if (member.memberType !== 'beam') continue; // v1: μόνο in-plane μέλη
    const force = forceById.get(member.id);
    if (!force) continue;
    const path = buildMemberPath(member, force, positionByNode, component, options.toCanvasFromMeters);
    if (!path) continue;
    globalMaxAbs = Math.max(globalMaxAbs, Math.abs(path.extremum.value));
    paths.push(path);
  }

  return {
    component,
    paths,
    globalMaxAbs,
    referenceLengthCanvas: meanPathLength(paths),
    reliable: !result.unstable,
    combinationKind: combination.combinationKind,
  };
}
