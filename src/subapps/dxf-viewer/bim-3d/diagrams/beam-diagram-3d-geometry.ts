/**
 * Beam diagram 3D geometry — pure SSoT (ADR-483 / Slice 6, 3Δ beam M/V/N).
 *
 * Το 3Δ αντίστοιχο του 2Δ `member-diagram-geometry` για **δοκάρια** (που τα σχεδιάζει
 * σε κάτοψη, πετώντας το zM): μετατρέπει το DERIVED αποτέλεσμα του FEM solver (ADR-481
 * `AnalysisResult`) + τον αναλυτικό φορέα (ADR-480 `AnalyticalModel`) σε
 * **screen-agnostic διαδρομές διαγράμματος ανά ΔΟΚΑΡΙ** — κρατώντας πλήρεις 3D κόμβους
 * (i/j με zM) ώστε ο mesh builder να στήσει την κορδέλα στο **κάθετο επίπεδο που περιέχει
 * τον άξονα του δοκαριού** (Revit/Robot), αντί να εκφυλιστεί όπως οι κολώνες σε κάτοψη.
 *
 * **Άξονας:** ο κόμβος-αρχή (i) → κόμβος-τέλος (j) του αναλυτικού μέλους· οι σταθμές
 * `xM` (απόσταση από i) τρέχουν i→j και το `f=xM/L` αντιστοιχεί σωστά — ίδια σύμβαση
 * δειγματοληψίας με την κολώνα (μηδέν αλλαγή).
 *
 * **Μονάδες/σύστημα:** αναλυτικές θέσεις σε **μέτρα** (ADR-480), σύστημα `(xM,yM,zM)` =
 * (East, North, υψόμετρο). Η μετατροπή σε three.js world γίνεται **στον mesh builder**
 * (`beam-diagram-3d-mesh`) — εδώ μένουμε καθαρά στο αναλυτικό domain (pure, unit-testable,
 * μηδέν three.js), ακριβώς όπως ο column builder.
 *
 * Reuse του ΕΝΟΣ sampling SSoT (`member-diagram-sampling`) — μηδέν διπλή λογική με τον
 * 2Δ ή τον column builder.
 *
 * @see ../../bim/structural/analytical/diagrams/member-diagram-sampling.ts — sampling SSoT
 * @see ./column-diagram-3d-geometry.ts — column δίδυμο (κατακόρυφος άξονας)
 * @see ./beam-diagram-3d-mesh.ts — three.js builder (analytical → world)
 */

import type { AnalyticalModel, AnalyticalPoint3D } from '../../bim/structural/analytical/analytical-model-types';
import type { AnalysisResult } from '../../bim/structural/analytical/solver/solver-types';
import {
  clamp01,
  dominantMomentKey,
  dominantShearKey,
  selectCombination,
  stationValue,
  type DiagramComponent,
  type DiagramSample,
} from '../../bim/structural/analytical/diagrams/member-diagram-sampling';

export type { DiagramComponent, DiagramSample };

/** Διαδρομή διαγράμματος ενός δοκαριού — άξονας i→j (αναλυτικά μέτρα) + στάθμες. */
export interface BeamDiagram3DPath {
  readonly memberId: string;
  /** Αναλυτικός κόμβος-αρχή (i) σε μέτρα. */
  readonly start: AnalyticalPoint3D;
  /** Αναλυτικός κόμβος-τέλος (j) σε μέτρα. */
  readonly end: AnalyticalPoint3D;
  /** Στάθμες f∈[0,1] (i→j) + τιμή. */
  readonly samples: readonly DiagramSample[];
  /** Στάθμη μέγιστης απόλυτης τιμής — εκεί μπαίνει η ετικέτα. */
  readonly extremum: DiagramSample;
}

/** Σύνολο διαδρομών δοκαριών + global max-abs + μήκος αναφοράς (m). */
export interface BeamDiagram3DSet {
  readonly component: DiagramComponent;
  readonly paths: readonly BeamDiagram3DPath[];
  /** Μέγιστη απόλυτη τιμή σε όλα τα δοκάρια — ορίζει την κλίμακα πλάτους κορδέλας. */
  readonly globalMaxAbs: number;
  /**
   * Μέσο μήκος (άνοιγμα) δοκαριού σε **μέτρα**. Ο mesh builder ορίζει το πλευρικό μήκος
   * της μέγιστης τιμής ως ποσοστό αυτού → το διάγραμμα κλιμακώνεται **μαζί** με το
   * μοντέλο (Revit/Robot model-space diagrams), σταθερή αναλογία με το δοκάρι.
   */
  readonly referenceLengthM: number;
  /** `false` όταν ο συνδυασμός βρήκε μηχανισμό (singular K) → ύποπτες τιμές. */
  readonly reliable: boolean;
  /** Ταυτότητα σχεδιαζόμενου συνδυασμού (Robot caption). Κενό όταν δεν υπάρχει. */
  readonly combinationKind: string;
}

export interface BuildBeamDiagram3DOptions {
  /** Εντατικό μέγεθος προς σχεδίαση (default 'moment'). */
  readonly component?: DiagramComponent;
}

const EMPTY: BeamDiagram3DSet = {
  component: 'moment', paths: [], globalMaxAbs: 0, referenceLengthM: 0, reliable: true, combinationKind: '',
};

/** Οριζόντιο μήκος μέλους (m) από τους αναλυτικούς κόμβους — fallback όταν λείπει `lengthM`. */
function planLengthM(start: AnalyticalPoint3D, end: AnalyticalPoint3D): number {
  return Math.hypot(end.xM - start.xM, end.yM - start.yM) || 1;
}

/**
 * Κύρια συνάρτηση: από analytical model + analysis result → screen-agnostic διαδρομές
 * διαγράμματος ανά **δοκάρι**. `globalMaxAbs` + `referenceLengthM` οδηγούν την auto-fit
 * κλίμακα του mesh builder. Κενό σύνολο όταν δεν υπάρχει έγκυρος συνδυασμός / κανένα
 * δοκάρι με διάγραμμα.
 */
export function buildBeamDiagram3DPaths(
  model: AnalyticalModel,
  result: AnalysisResult,
  options: BuildBeamDiagram3DOptions = {},
): BeamDiagram3DSet {
  const component = options.component ?? 'moment';
  const combination = selectCombination(result);
  if (!combination) return { ...EMPTY, component };

  const forceById = new Map(combination.memberForces.map((f) => [f.memberId, f]));
  const positionByNode = new Map(model.nodes.map((n) => [n.id, n.position]));

  const paths: BeamDiagram3DPath[] = [];
  let globalMaxAbs = 0;
  let lengthSum = 0;
  let lengthCount = 0;

  for (const member of model.members) {
    if (member.memberType !== 'beam') continue; // μόνο οριζόντια φέροντα μέλη
    const force = forceById.get(member.id);
    if (!force || force.diagram.length === 0) continue;
    const start = positionByNode.get(member.iNodeId);
    const end = positionByNode.get(member.jNodeId);
    if (!start || !end) continue;

    const momentKey = dominantMomentKey(force.diagram);
    const shearKey = dominantShearKey(force.diagram);
    const length = member.lengthM > 0 ? member.lengthM : planLengthM(start, end);

    let extremum: DiagramSample = { f: 0, value: 0 };
    const samples = force.diagram.map((st) => {
      const f = clamp01(st.xM / length);
      const value = stationValue(st, component, momentKey, shearKey);
      if (Math.abs(value) >= Math.abs(extremum.value)) extremum = { f, value };
      return { f, value };
    });

    paths.push({ memberId: member.id, start, end, samples, extremum });
    globalMaxAbs = Math.max(globalMaxAbs, Math.abs(extremum.value));
    lengthSum += length;
    lengthCount++;
  }

  return {
    component,
    paths,
    globalMaxAbs,
    referenceLengthM: lengthCount > 0 ? lengthSum / lengthCount : 0,
    reliable: !result.unstable,
    combinationKind: combination.combinationKind,
  };
}
