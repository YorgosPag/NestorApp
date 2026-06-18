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
import type {
  AnalysisResult,
  CombinationResult,
  DiagramStation,
  MemberForceResult,
} from '../solver/solver-types';

/** Ποιο εντατικό μέγεθος σχεδιάζεται (v1 overlay = ροπή· extensible σε V/N). */
export type DiagramComponent = 'moment' | 'shear' | 'axial';

/** Μία στάθμη διαγράμματος: κλάσμα μήκους f∈[0,1] + (προσημασμένη) τιμή. */
export interface DiagramSample {
  readonly f: number;
  readonly value: number;
}

/** Η διαδρομή διαγράμματος ενός μέλους — άξονας (canvas units) + στάθμες. */
export interface MemberDiagramPath {
  readonly memberId: string;
  readonly iCanvas: Point2D;
  readonly jCanvas: Point2D;
  readonly samples: readonly DiagramSample[];
  /** Στάθμη μέγιστης απόλυτης τιμής — εκεί μπαίνει η ετικέτα. */
  readonly extremum: DiagramSample;
}

/** Σύνολο διαδρομών + global max-abs (για auto-fit της pixel κλίμακας). */
export interface MemberDiagramSet {
  readonly component: DiagramComponent;
  readonly paths: readonly MemberDiagramPath[];
  readonly globalMaxAbs: number;
}

export interface BuildMemberDiagramOptions {
  /** Μετατροπή αναλυτικών μέτρων → canvas units ( = 1 / sceneUnitsToMeters(units) ). */
  readonly toCanvasFromMeters: number;
  /** Εντατικό μέγεθος προς σχεδίαση (default 'moment'). */
  readonly component?: DiagramComponent;
}

const EMPTY: MemberDiagramSet = { component: 'moment', paths: [], globalMaxAbs: 0 };

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * Επίλεξε τον συνδυασμό προς σχεδίαση: ο πρώτος μη-singular ULS (το envelope δεν
 * κρατά διάγραμμα, μόνο extrema) — αλλιώς ο πρώτος έγκυρος. `null` αν κανείς.
 */
function selectCombination(result: AnalysisResult): CombinationResult | null {
  const valid = result.combinations.filter((c) => !c.singular && c.memberForces.length > 0);
  if (valid.length === 0) return null;
  return valid.find((c) => c.combinationKind.toLowerCase().includes('uls')) ?? valid[0]!;
}

/** Κυρίαρχος άξονας κάμψης του μέλους: momentZ vs momentY (μεγαλύτερο max-abs). */
function dominantMomentKey(diagram: readonly DiagramStation[]): 'momentY' | 'momentZ' {
  let y = 0;
  let z = 0;
  for (const s of diagram) {
    y = Math.max(y, Math.abs(s.momentY));
    z = Math.max(z, Math.abs(s.momentZ));
  }
  return z >= y ? 'momentZ' : 'momentY';
}

/** Κυρίαρχος άξονας τέμνουσας: shearY vs shearZ (μεγαλύτερο max-abs). */
function dominantShearKey(diagram: readonly DiagramStation[]): 'shearY' | 'shearZ' {
  let y = 0;
  let z = 0;
  for (const s of diagram) {
    y = Math.max(y, Math.abs(s.shearY));
    z = Math.max(z, Math.abs(s.shearZ));
  }
  return z >= y ? 'shearZ' : 'shearY';
}

/** Τιμή μιας στάθμης για το επιλεγμένο component (κυρίαρχος άξονας ανά μέλος). */
function stationValue(
  st: DiagramStation,
  component: DiagramComponent,
  momentKey: 'momentY' | 'momentZ',
  shearKey: 'shearY' | 'shearZ',
): number {
  if (component === 'axial') return st.axialN;
  if (component === 'shear') return st[shearKey];
  return st[momentKey];
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

  return {
    memberId: member.id,
    iCanvas: { x: pi.xM * toCanvas, y: pi.yM * toCanvas },
    jCanvas: { x: pj.xM * toCanvas, y: pj.yM * toCanvas },
    samples,
    extremum,
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

  return { component, paths, globalMaxAbs };
}
