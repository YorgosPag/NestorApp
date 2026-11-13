/**
 * ADR-929 Φ4 · Δ8 — το **δίκτυο** του λύτη διαστάσεων: ευθείες παρειών και γραμμένες διαστάσεις ως γραμμικές παρατηρήσεις.
 *
 * Άγνωστοι: η μετατόπιση κάθε ευθείας που αγγίζει κάποια δεμένη διάσταση, και — **μόνο** όταν δεν υπάρχει βαθμονόμηση —
 * η κλίμακα `K` (px ανά **μέτρο**, για καλή κατάσταση του μητρώου: συντελεστές τάξης 1–10 αντί για 1000–10000).
 * Παρατηρήσεις:
 * - **θέση** κάθε ευθείας όπως τη μέτρησε η όραση: `xᵢ = offsetᵢ`, σ = θόρυβος σχεδίου του είδους εισόδου ⊕ κβάντιση·
 * - **διάσταση** `x_B − x_A − (d/1000)·K = 0` (ή `x_B − x_A = d·k` με γνωστή κλίμακα), σ από την **ακρίβεια γραφής**.
 * Τα αθροίσματα αλυσίδων και η συνολική διάσταση (Δ8, «έλεγχος αθροισμάτων») **δεν** χρειάζονται δική τους εξίσωση:
 * μοιράζονται αγνώστους, άρα ελέγχουν η μία την άλλη μέσα από τον πλεονασμό.
 *
 * ⚠️ **Χωρίς παρατήρηση «τυπικού πάχους τοίχου»** (απόκλιση από το αρχικό Δ8, με λόγο): το πάχος **είναι** η απόσταση δύο
 * παρειών που η όραση έχει ήδη μετρήσει, άρα θα μετρούσε το ίδιο τεκμήριο δύο φορές και θα τραβούσε κάθε τοίχο προς έναν
 * «τυπικό» αριθμό που δεν γράφτηκε πουθενά.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/fusion/adjustment-network
 */

import type { LinearObservation } from '@/lib/linear-algebra/weighted-least-squares';
import { adjustWithDataSnooping, type RobustAdjustment } from '@/lib/linear-algebra/robust-adjustment';
import type { PlanInputKind } from '../plan-recognition-types';
import type { DimensionTarget } from './dimension-binding';
import type { FusionFrame } from './fusion-frame';
import type { DimensionBinding, PlanFusionOptions } from './plan-fusion-types';

const MM_PER_M = 1000;

export interface BoundDimension {
  readonly target: DimensionTarget;
  readonly binding: DimensionBinding;
}

export interface NetworkScale {
  /** Ευθυγραμμισμένα px ανά mm: η τιμή της επιλεγμένης πηγής (για τα σ και, αν είναι σταθερή, για τις εξισώσεις). */
  readonly pxPerMm: number;
  /** `true` ⇒ η κλίμακα είναι άγνωστος του λύτη. */
  readonly free: boolean;
}

export interface NetworkOutcome {
  readonly adjustment: RobustAdjustment;
  readonly lineIndex: ReadonlyMap<string, number>;
  /** Δείκτης παρατήρησης θέσης ανά ευθεία. */
  readonly positionObservation: ReadonlyMap<string, number>;
  /** Δείκτης παρατήρησης ανά δεμένη διάσταση (ίδια σειρά με την είσοδο). */
  readonly dimensionObservation: readonly number[];
  /** Η κλίμακα **μετά** τη συνόρθωση (ή η σταθερή). */
  readonly pxPerMm: number;
  readonly sigmaRel: number | null;
}

function involvedLines(bound: readonly BoundDimension[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const { binding } of bound) {
    for (const id of [binding.lineA, binding.lineB]) if (!index.has(id)) index.set(id, index.size);
  }
  return index;
}

function positionObservations(frame: FusionFrame, index: ReadonlyMap<string, number>, sigmaPx: number): LinearObservation[] {
  return [...index].map(([id, i]) => ({ terms: [{ index: i, coefficient: 1 }], value: frame.lineById.get(id)?.offsetPx ?? 0, sigma: sigmaPx }));
}

function dimensionObservation(b: BoundDimension, index: ReadonlyMap<string, number>, scale: NetworkScale, kIndex: number): LinearObservation {
  const a = index.get(b.binding.lineA) ?? 0;
  const c = index.get(b.binding.lineB) ?? 0;
  const valueMm = b.target.dimension.valueMm;
  const sigma = b.target.sigmaMm * scale.pxPerMm;
  const pair = [{ index: c, coefficient: 1 }, { index: a, coefficient: -1 }];
  return scale.free
    ? { terms: [...pair, { index: kIndex, coefficient: -valueMm / MM_PER_M }], value: 0, sigma }
    : { terms: pair, value: valueMm * scale.pxPerMm, sigma };
}

/** Η συνόρθωση του δικτύου, ή `null` χωρίς καμία δεμένη διάσταση (τότε δεν υπάρχει τι να ελεγχθεί). */
export function adjustNetwork(
  frame: FusionFrame,
  bound: readonly BoundDimension[],
  scale: NetworkScale,
  kind: PlanInputKind,
  o: PlanFusionOptions,
): NetworkOutcome | null {
  if (bound.length === 0) return null;
  const lineIndex = involvedLines(bound);
  const kIndex = lineIndex.size;
  const unknowns = lineIndex.size + (scale.free ? 1 : 0);
  const positions = positionObservations(frame, lineIndex, Math.hypot(o.cvSigmaFloorPx, o.cvSigmaMm[kind] * scale.pxPerMm));
  const dimensions = bound.map((b) => dimensionObservation(b, lineIndex, scale, kIndex));
  // Ισοβαθμία ⇒ φταίει η **γραμμένη** τιμή: «γράφει 2,90, το σχέδιο δίνει 3,325» είναι η τίμια διατύπωση όταν το τεστ δεν
  // ξεχωρίζει· η «μετατοπισμένη παρειά» θέλει **πολλές** διαστάσεις που συμφωνούν μεταξύ τους εναντίον της γραμμής.
  const blamePriority = [...positions.map(() => 0), ...dimensions.map(() => 1)];
  const adjustment = adjustWithDataSnooping([...positions, ...dimensions], unknowns, {
    critical: o.baardaCritical,
    minRedundancy: o.minRedundancy,
    blamePriority,
  });
  const { solution, sigma0 } = adjustment;
  const freeK = scale.free && !solution.singular ? solution.x[kIndex] / MM_PER_M : null;
  const sigmaK = freeK === null ? null : Math.sqrt(Math.max(0, solution.cofactor.at(kIndex, kIndex))) * Math.max(1, sigma0 ?? 1) / MM_PER_M;
  return {
    adjustment,
    lineIndex,
    positionObservation: new Map([...lineIndex].map(([id, i]) => [id, i])),
    dimensionObservation: dimensions.map((_, j) => positions.length + j),
    pxPerMm: freeK !== null && freeK > 0 ? freeK : scale.pxPerMm,
    sigmaRel: freeK !== null && freeK > 0 && sigmaK !== null ? sigmaK / freeK : null,
  };
}
