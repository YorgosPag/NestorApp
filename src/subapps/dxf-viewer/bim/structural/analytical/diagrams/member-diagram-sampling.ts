/**
 * Member diagram sampling — shared pure SSoT (ADR-483 / Slice 5).
 *
 * Οι **agnostic ως προς προβολή** βοηθοί δειγματοληψίας του FEM αποτελέσματος
 * (ADR-481 `AnalysisResult`): επιλογή συνδυασμού, κυρίαρχος άξονας κάμψης/τέμνουσας,
 * τιμή στάθμης ανά εντατικό μέγεθος, ανάκτηση UDL από καμπυλότητα ροπής. Τα
 * καταναλώνουν **και** ο 2Δ builder (`member-diagram-geometry`, δοκάρια σε κάτοψη)
 * **και** ο 3Δ builder (`bim-3d/diagrams/column-diagram-3d-geometry`, κολώνες κατά
 * τον κατακόρυφο άξονα) — ΕΝΑ SSoT, μηδέν διπλή λογική δειγματοληψίας.
 *
 * Πριν την εξαγωγή ζούσαν private στο `member-diagram-geometry.ts`· μετακινήθηκαν εδώ
 * αυτούσια (zero behaviour change) ώστε ο 3Δ builder να μην τα ξαναγράψει.
 *
 * Pure — zero React/DOM/store/three.js.
 *
 * @see ./member-diagram-geometry.ts — 2Δ (κάτοψη, δοκάρια) consumer
 * @see ../solver/solver-types.ts — DiagramStation / MemberForceResult / AnalysisResult
 */

import type {
  AnalysisResult,
  CombinationResult,
  DiagramStation,
} from '../solver/solver-types';
// 🏢 SSoT: canonical clamp01 (ADR-071). Re-exported below so existing consumers
// (`member-diagram-geometry.ts`, `bim-3d/diagrams/*-diagram-3d-geometry.ts`) keep importing
// it from this module (unchanged public API).
import { clamp01 } from '../../../../rendering/entities/shared/geometry-utils';

export { clamp01 };

/** Ποιο εντατικό μέγεθος σχεδιάζεται (ροπή Μ / τέμνουσα V / αξονική Ν). */
export type DiagramComponent = 'moment' | 'shear' | 'axial';

/** Μία στάθμη διαγράμματος: κλάσμα μήκους f∈[0,1] + (προσημασμένη) τιμή. */
export interface DiagramSample {
  readonly f: number;
  readonly value: number;
}

/**
 * Επίλεξε τον συνδυασμό προς σχεδίαση: ο πρώτος μη-singular ULS (το envelope δεν
 * κρατά διάγραμμα, μόνο extrema) — αλλιώς ο πρώτος έγκυρος. `null` αν κανείς.
 */
export function selectCombination(result: AnalysisResult): CombinationResult | null {
  const valid = result.combinations.filter((c) => !c.singular && c.memberForces.length > 0);
  if (valid.length === 0) return null;
  return valid.find((c) => c.combinationKind.toLowerCase().includes('uls')) ?? valid[0]!;
}

/** Κυρίαρχος άξονας κάμψης του μέλους: momentZ vs momentY (μεγαλύτερο max-abs). */
export function dominantMomentKey(diagram: readonly DiagramStation[]): 'momentY' | 'momentZ' {
  let y = 0;
  let z = 0;
  for (const s of diagram) {
    y = Math.max(y, Math.abs(s.momentY));
    z = Math.max(z, Math.abs(s.momentZ));
  }
  return z >= y ? 'momentZ' : 'momentY';
}

/** Κυρίαρχος άξονας τέμνουσας: shearY vs shearZ (μεγαλύτερο max-abs). */
export function dominantShearKey(diagram: readonly DiagramStation[]): 'shearY' | 'shearZ' {
  let y = 0;
  let z = 0;
  for (const s of diagram) {
    y = Math.max(y, Math.abs(s.shearY));
    z = Math.max(z, Math.abs(s.shearZ));
  }
  return z >= y ? 'shearZ' : 'shearY';
}

/** Τιμή μιας στάθμης για το επιλεγμένο component (κυρίαρχος άξονας ανά μέλος). */
export function stationValue(
  st: DiagramStation,
  component: DiagramComponent,
  momentKey: 'momentY' | 'momentZ',
  shearKey: 'shearY' | 'shearZ',
): number {
  if (component === 'axial') return st.axialN;
  if (component === 'shear') return st[shearKey];
  return st[momentKey];
}

/**
 * Ανάκτηση του ομοιόμορφου φορτίου q (kN/m) από την **καμπυλότητα της ροπής**: για
 * UDL ισχύει `M(x) = a + b·x − (w/2)·x²` → `w = −d²M/dx²` (σταθερό). Δεύτερη διαφορά
 * των ισαπεχουσών σταθμών ροπής, μέσος όρος εσωτερικών → robust. 0 αν <3 σταθμές.
 */
export function recoverUdlKnM(moment: readonly number[], lengthM: number): number {
  const n = moment.length;
  if (n < 3 || lengthM <= 0) return 0;
  const dx = lengthM / (n - 1);
  if (dx <= 0) return 0;
  let sum = 0;
  let count = 0;
  for (let k = 1; k < n - 1; k++) {
    sum += Math.abs(moment[k - 1]! - 2 * moment[k]! + moment[k + 1]!) / (dx * dx);
    count++;
  }
  return count > 0 ? sum / count : 0;
}
