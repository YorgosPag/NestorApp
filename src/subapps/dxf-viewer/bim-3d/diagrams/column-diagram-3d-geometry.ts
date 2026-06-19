/**
 * Column diagram 3D geometry — pure SSoT (ADR-483 / Slice 5, 3Δ column M/V/N).
 *
 * Μετατρέπει το DERIVED αποτέλεσμα του FEM solver (ADR-481 `AnalysisResult`) + τον
 * αναλυτικό φορέα (ADR-480 `AnalyticalModel`) σε **screen-agnostic διαδρομές
 * διαγράμματος ανά ΚΟΛΩΝΑ** — το 3Δ αντίστοιχο του 2Δ `member-diagram-geometry`
 * (που σχεδιάζει δοκάρια σε κάτοψη). Οι κολώνες είναι κατακόρυφες → σε κάτοψη
 * εκφυλίζονται σε σημείο (iCanvas==jCanvas)· γι' αυτό φιλτράρονται εκεί και το
 * διάγραμμά τους ζει στο 3Δ, κατά μήκος του κατακόρυφου άξονα (Revit/Robot).
 *
 * **Άξονας:** ο αναλυτικός κόμβος-βάση (i) → κόμβος-κορυφή (j) — ο builder εγγυάται
 * `iRaw=base, jRaw=top` (`analytical-model-builder.appendColumn`), άρα οι σταθμές
 * `xM` (απόσταση από i) τρέχουν βάση→κορυφή και το `f=xM/L` αντιστοιχεί σωστά.
 *
 * **Μονάδες/σύστημα:** οι αναλυτικές θέσεις είναι σε **μέτρα** (ADR-480), στο
 * αναλυτικό σύστημα `(xM, yM, zM)` = (East, North, υψόμετρο). Η μετατροπή σε
 * three.js world (x=East, y=Up, z=−North) γίνεται **στον mesh builder**
 * (`column-diagram-3d-mesh`) — εδώ μένουμε καθαρά στο αναλυτικό domain (pure,
 * unit-testable, μηδέν three.js), ακριβώς όπως το 2Δ module μένει σε canvas units.
 *
 * Reuse του ΕΝΟΣ sampling SSoT (`member-diagram-sampling`): επιλογή συνδυασμού,
 * κυρίαρχος άξονας, τιμή στάθμης — μηδέν διπλή λογική με το 2Δ builder.
 *
 * @see ../../bim/structural/analytical/diagrams/member-diagram-sampling.ts — sampling SSoT
 * @see ../../bim/structural/analytical/diagrams/member-diagram-geometry.ts — 2Δ (δοκάρια) δίδυμο
 * @see ./column-diagram-3d-mesh.ts — three.js builder (analytical → world)
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

/**
 * Μοναδιαία διεύθυνση πλευρικού offset του διαγράμματος στο **plan** (αναλυτικό
 * (xM,yM)). v1: σταθερά κατά +East — όλες οι κορδέλες «βλέπουν» την ίδια φορά, σε
 * διαφορετικές θέσεις plan (μηδέν επικάλυψη). DEFER: επιλογή επιπέδου ανά κυρίαρχο
 * άξονα κάμψης (momentY vs momentZ) ώστε η κορδέλα να μπει στο πραγματικό επίπεδο.
 */
export const DEFAULT_LATERAL_OFFSET_DIR = { dxM: 1, dyM: 0 } as const;

/** Διαδρομή διαγράμματος μιας κολώνας — άξονας (αναλυτικά μέτρα) + στάθμες. */
export interface ColumnDiagram3DPath {
  readonly memberId: string;
  /** Αναλυτικός κόμβος-βάση (i) σε μέτρα. */
  readonly base: AnalyticalPoint3D;
  /** Αναλυτικός κόμβος-κορυφή (j) σε μέτρα. */
  readonly top: AnalyticalPoint3D;
  /** Μοναδιαία διεύθυνση πλευρικού offset στο plan. */
  readonly offsetDir: { readonly dxM: number; readonly dyM: number };
  /** Στάθμες f∈[0,1] (βάση→κορυφή) + τιμή. */
  readonly samples: readonly DiagramSample[];
  /** Στάθμη μέγιστης απόλυτης τιμής — εκεί μπαίνει η ετικέτα. */
  readonly extremum: DiagramSample;
}

/** Σύνολο διαδρομών κολωνών + global max-abs + μήκος αναφοράς (m). */
export interface ColumnDiagram3DSet {
  readonly component: DiagramComponent;
  readonly paths: readonly ColumnDiagram3DPath[];
  /** Μέγιστη απόλυτη τιμή σε όλες τις κολώνες — ορίζει την κλίμακα ύψους. */
  readonly globalMaxAbs: number;
  /**
   * Μέσο μήκος (ύψος) κολώνας σε **μέτρα**. Ο mesh builder ορίζει το πλευρικό
   * μήκος της μέγιστης τιμής ως ποσοστό αυτού → το διάγραμμα κλιμακώνεται **μαζί**
   * με το μοντέλο (Revit/Robot model-space diagrams), σταθερή αναλογία με την κολώνα.
   */
  readonly referenceLengthM: number;
  /** `false` όταν ο συνδυασμός βρήκε μηχανισμό (singular K) → ύποπτες τιμές. */
  readonly reliable: boolean;
  /** Ταυτότητα σχεδιαζόμενου συνδυασμού (Robot caption). Κενό όταν δεν υπάρχει. */
  readonly combinationKind: string;
}

export interface BuildColumnDiagram3DOptions {
  /** Εντατικό μέγεθος προς σχεδίαση (default 'moment'). */
  readonly component?: DiagramComponent;
}

const EMPTY: ColumnDiagram3DSet = {
  component: 'moment', paths: [], globalMaxAbs: 0, referenceLengthM: 0, reliable: true, combinationKind: '',
};

/**
 * Κύρια συνάρτηση: από analytical model + analysis result → screen-agnostic
 * διαδρομές διαγράμματος ανά **κολώνα**. `globalMaxAbs` + `referenceLengthM`
 * οδηγούν την auto-fit κλίμακα του mesh builder. Κενό σύνολο όταν δεν υπάρχει
 * έγκυρος συνδυασμός / καμία κολώνα με διάγραμμα.
 */
export function buildColumnDiagram3DPaths(
  model: AnalyticalModel,
  result: AnalysisResult,
  options: BuildColumnDiagram3DOptions = {},
): ColumnDiagram3DSet {
  const component = options.component ?? 'moment';
  const combination = selectCombination(result);
  if (!combination) return { ...EMPTY, component };

  const forceById = new Map(combination.memberForces.map((f) => [f.memberId, f]));
  const positionByNode = new Map(model.nodes.map((n) => [n.id, n.position]));

  const paths: ColumnDiagram3DPath[] = [];
  let globalMaxAbs = 0;
  let lengthSum = 0;
  let lengthCount = 0;

  for (const member of model.members) {
    if (member.memberType !== 'column') continue; // μόνο κατακόρυφα μέλη
    const force = forceById.get(member.id);
    if (!force || force.diagram.length === 0) continue;
    const base = positionByNode.get(member.iNodeId);
    const top = positionByNode.get(member.jNodeId);
    if (!base || !top) continue;

    const momentKey = dominantMomentKey(force.diagram);
    const shearKey = dominantShearKey(force.diagram);
    const length = member.lengthM > 0 ? member.lengthM : (Math.abs(top.zM - base.zM) || 1);

    let extremum: DiagramSample = { f: 0, value: 0 };
    const samples = force.diagram.map((st) => {
      const f = clamp01(st.xM / length);
      const value = stationValue(st, component, momentKey, shearKey);
      if (Math.abs(value) >= Math.abs(extremum.value)) extremum = { f, value };
      return { f, value };
    });

    paths.push({ memberId: member.id, base, top, offsetDir: DEFAULT_LATERAL_OFFSET_DIR, samples, extremum });
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
