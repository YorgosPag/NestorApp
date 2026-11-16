/**
 * ADR-929 Φ4 · Δ8 — το **δίκτυο** του λύτη διαστάσεων: ευθείες παρειών και γραμμένες διαστάσεις ως γραμμικές παρατηρήσεις.
 *
 * Άγνωστοι: η μετατόπιση κάθε ευθείας που αγγίζει κάποια δεμένη διάσταση, και — **μόνο** όταν δεν υπάρχει βαθμονόμηση —
 * η κλίμακα `K` (px ανά **μέτρο**, για καλή κατάσταση του μητρώου: συντελεστές τάξης 1–10 αντί για 1000–10000).
 * Παρατηρήσεις:
 * - **θέση** κάθε ευθείας όπως τη μέτρησε η όραση: `xᵢ = offsetᵢ`, σ = θόρυβος σχεδίου του είδους εισόδου ⊕ κβάντιση·
 * - **διάσταση** `x_B − x_A − (d/1000)·rᶠ·K = 0` (ή `x_B − x_A = d·kᶠ` με γνωστή κλίμακα), σ από την **ακρίβεια γραφής**.
 *   §6.22: `kᶠ` = px ανά mm **κατά την κάθετο της οικογένειας** των δύο ευθειών (`familyPxPerMm`, SSoT `fusion-metric.ts`)·
 *   με ανισοτροπική βαθμονόμηση η οριζόντια και η κατακόρυφη διάσταση έχουν **διαφορετική** κλίμακα, όπως η εικόνα στη
 *   σκηνή. Ελεύθερη κλίμακα: **ένας** άγνωστος `K` (μέγεθος) πάνω στο **σχήμα** της μετρικής (`rᶠ = kᶠ / k̄`) — η
 *   ανισοτροπία δεν εκτιμάται από γραμμένες τιμές μόνες τους, όπως και ο `calibration-solve` τη λύνει μόνο με άξονες
 *   που χωρίζονται.
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
import { familyPxPerMm, scaledMetric, type FamilyPxPerMm, type FusionMetric } from './fusion-metric';
import type { DimensionBinding, PlanFusionOptions } from './plan-fusion-types';

const MM_PER_M = 1000;

export interface BoundDimension {
  readonly target: DimensionTarget;
  readonly binding: DimensionBinding;
}

export interface NetworkScale {
  /** Η μετρική της επιλεγμένης πηγής (για τα σ και, αν είναι σταθερή, για τις εξισώσεις) — ανά διεύθυνση, §6.22. */
  readonly metric: FusionMetric;
  /** `true` ⇒ το **μέγεθος** της κλίμακας είναι άγνωστος του λύτη (το σχήμα της μετρικής μένει). */
  readonly free: boolean;
}

/** Η κλίμακα όπως τη βλέπει **μία** παρατήρηση: px/mm της οικογένειάς της και ο λόγος της προς τη βαθμωτή σύνοψη. */
interface ObservationScale {
  readonly ofFamily: FamilyPxPerMm;
  /** Βαθμωτά px ανά mm (`1 / √|det A|`): η μονάδα του ελεύθερου αγνώστου `K`. */
  readonly meanPxPerMm: number;
}

export interface NetworkOutcome {
  readonly adjustment: RobustAdjustment;
  readonly lineIndex: ReadonlyMap<string, number>;
  /** Δείκτης παρατήρησης θέσης ανά ευθεία. */
  readonly positionObservation: ReadonlyMap<string, number>;
  /** Δείκτης παρατήρησης ανά δεμένη διάσταση (ίδια σειρά με την είσοδο). */
  readonly dimensionObservation: readonly number[];
  /** Η μετρική **μετά** τη συνόρθωση (ή η σταθερή): ίδιο σχήμα, μέγεθος από τον `K` όταν ήταν ελεύθερη. */
  readonly metric: FusionMetric;
  readonly sigmaRel: number | null;
}

function involvedLines(bound: readonly BoundDimension[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const { binding } of bound) {
    for (const id of [binding.lineA, binding.lineB]) if (!index.has(id)) index.set(id, index.size);
  }
  return index;
}

/** Ο θόρυβος θέσης κάθε ευθείας: δάπεδο κβάντισης ⊕ θόρυβος σχεδίου (mm) στην κλίμακα **της οικογένειάς της**. */
function positionObservations(
  frame: FusionFrame, index: ReadonlyMap<string, number>, scale: ObservationScale, floorPx: number, sigmaMm: number,
): LinearObservation[] {
  return [...index].map(([id, i]) => {
    const line = frame.lineById.get(id);
    const pxPerMm = line === undefined ? scale.meanPxPerMm : scale.ofFamily(line.familyId);
    return { terms: [{ index: i, coefficient: 1 }], value: line?.offsetPx ?? 0, sigma: Math.hypot(floorPx, sigmaMm * pxPerMm) };
  });
}

function dimensionObservation(
  b: BoundDimension, frame: FusionFrame, index: ReadonlyMap<string, number>, scale: ObservationScale, free: boolean, kIndex: number,
): LinearObservation {
  const a = index.get(b.binding.lineA) ?? 0;
  const c = index.get(b.binding.lineB) ?? 0;
  const valueMm = b.target.dimension.valueMm;
  const familyId = frame.lineById.get(b.binding.lineA)?.familyId;
  const pxPerMm = familyId === undefined ? scale.meanPxPerMm : scale.ofFamily(familyId);
  const sigma = b.target.sigmaMm * pxPerMm;
  const pair = [{ index: c, coefficient: 1 }, { index: a, coefficient: -1 }];
  return free
    ? { terms: [...pair, { index: kIndex, coefficient: (-valueMm / MM_PER_M) * (pxPerMm / scale.meanPxPerMm) }], value: 0, sigma }
    : { terms: pair, value: valueMm * pxPerMm, sigma };
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
  const perObservation: ObservationScale = { ofFamily: familyPxPerMm(scale.metric, frame), meanPxPerMm: 1 / scale.metric.mmPerAlignedPx };
  const positions = positionObservations(frame, lineIndex, perObservation, o.cvSigmaFloorPx, o.cvSigmaMm[kind]);
  const dimensions = bound.map((b) => dimensionObservation(b, frame, lineIndex, perObservation, scale.free, kIndex));
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
    metric: freeK !== null && freeK > 0 ? scaledMetric(scale.metric, 1 / freeK) : scale.metric,
    sigmaRel: freeK !== null && freeK > 0 && sigmaK !== null ? sigmaK / freeK : null,
  };
}
