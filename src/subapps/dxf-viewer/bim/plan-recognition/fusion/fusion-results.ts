/**
 * ADR-929 Φ4 — από τη συνόρθωση στα **ευρήματα**: διαστάσεις με κατάσταση, συνορθωμένα τμήματα, βεβαιότητα ανά τμήμα.
 *
 * 🔑 **Η πρόταση ταξιδεύει πίσω στα αρχικά px (Δ3).** Μια ευθεία που μετακινήθηκε κατά `δ` στο ευθυγραμμισμένο πλαίσιο
 * μετακινεί κάθε τμήμα της κατά `δ·n` εκεί, και μόνο η ομογραφία το γυρίζει στην αρχική εικόνα. Στη σάρωση το `δ` είναι
 * κλάσμα του pixel· στο σκίτσο είναι η **διόρθωση** που φέρνει τους τοίχους στις γραμμένες διαστάσεις (Δ14 α).
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/fusion/fusion-results
 */

import { applyHomography, type Homography } from '@/lib/geometry/homography';
import type { ObservationVerdict } from '@/lib/linear-algebra/robust-adjustment';
import { minimalDetectableBias } from '@/lib/linear-algebra/weighted-least-squares';
import type { PlanConfidence, RasterSegment } from '../plan-recognition-types';
import type { DimensionTarget } from './dimension-binding';
import type { BoundDimension, NetworkOutcome } from './adjustment-network';
import { familyNormal, type FusionFrame } from './fusion-frame';
import { bindingFactor, composeConfidence, solverFactor } from './fusion-confidence';
import type { DimensionBinding, FusedDimension, FusedDimensionStatus, PlanFusionOptions } from './plan-fusion-types';

/** Η συνορθωμένη μετατόπιση κάθε ευθείας του δικτύου. */
export function adjustedOffsets(network: NetworkOutcome | null): Map<string, number> {
  const out = new Map<string, number>();
  if (network === null || network.adjustment.solution.singular) return out;
  for (const [id, i] of network.lineIndex) out.set(id, network.adjustment.solution.x[i]);
  return out;
}

function shiftSegment(segment: RasterSegment, delta: { x: number; y: number }, toAligned: Homography, toOriginal: Homography): RasterSegment {
  const move = (p: { x: number; y: number }) => {
    const a = applyHomography(toAligned, p.x, p.y);
    return applyHomography(toOriginal, a.x + delta.x, a.y + delta.y);
  };
  return { ...segment, start: move(segment.start), end: move(segment.end) };
}

/** Τα τμήματα της Φ2 μετά τη συνόρθωση (όσα δεν άγγιξε ο λύτης μένουν ως είχαν). */
export function adjustedSegments(
  segments: readonly RasterSegment[],
  frame: FusionFrame,
  offsets: ReadonlyMap<string, number>,
  alignment: { readonly originalToAligned: Homography; readonly alignedToOriginal: Homography },
): RasterSegment[] {
  return segments.map((s) => {
    const line = frame.lineById.get(frame.lineOfSegment.get(s.id) ?? '');
    const adjusted = line === undefined ? undefined : offsets.get(line.id);
    if (line === undefined || adjusted === undefined) return s;
    const n = familyNormal(frame.families[line.familyId]);
    const d = adjusted - line.offsetPx;
    return shiftSegment(s, { x: n.x * d, y: n.y * d }, alignment.originalToAligned, alignment.alignedToOriginal);
  });
}

function dimensionStatus(
  binding: DimensionBinding | null,
  verdict: ObservationVerdict | null,
  detectable: number | null,
  valueMm: number,
  o: PlanFusionOptions,
): FusedDimensionStatus {
  if (binding === null || binding.ambiguous || verdict === null) return 'unbound';
  if (!verdict.active) return 'conflict';
  return detectable === null || detectable > o.uncheckableMdbRel * valueMm ? 'uncheckable' : 'consistent';
}

/** Το ελάχιστο ανιχνεύσιμο λάθος γραφής (mm) μιας ενεργής διάστασης· `null` όταν δεν ελέγχεται καθόλου. */
function detectableErrorMm(target: DimensionTarget, verdict: ObservationVerdict | null): number | null {
  if (verdict === null || !verdict.active || verdict.redundancy === null) return null;
  return minimalDetectableBias(target.sigmaMm, verdict.redundancy);
}

/** `x_B − x_A` μετά τη συνόρθωση, όταν και οι δύο ευθείες είναι στο δίκτυο. */
function adjustedGapPx(binding: DimensionBinding | null, network: NetworkOutcome | null): number | null {
  if (binding === null || network === null || network.adjustment.solution.singular) return null;
  const a = network.lineIndex.get(binding.lineA);
  const b = network.lineIndex.get(binding.lineB);
  const x = network.adjustment.solution.x;
  return a === undefined || b === undefined ? null : x[b] - x[a];
}

function fuseOne(
  target: DimensionTarget,
  binding: DimensionBinding | null,
  network: NetworkOutcome | null,
  obs: number | undefined,
  pxPerMm: number | null,
  o: PlanFusionOptions,
): FusedDimension {
  const verdict = network !== null && obs !== undefined ? network.adjustment.verdicts[obs] : null;
  const adjustedPx = adjustedGapPx(binding, network);
  const detectable = detectableErrorMm(target, verdict);
  const status = dimensionStatus(binding, verdict, detectable, target.dimension.valueMm, o);
  const solver = verdict === null ? 0 : solverFactor(verdict, o.baardaCritical, status === 'consistent');
  return {
    textId: target.dimension.textId,
    valueMm: target.dimension.valueMm,
    precisionMm: target.precisionMm,
    binding,
    measuredMm: binding && pxPerMm ? binding.gapPx / pxPerMm : null,
    adjustedMm: adjustedPx !== null && pxPerMm ? adjustedPx / pxPerMm : null,
    w: verdict?.w ?? null,
    redundancy: verdict?.redundancy ?? null,
    detectableErrorMm: detectable,
    status,
    confidence: composeConfidence({ reading: target.dimension.confidence.score, geometry: bindingFactor(binding), solver }),
    rect: target.text.rect,
  };
}

/** Κάθε διάσταση με την κατάστασή της. `bound` είναι υποσύνολο των `targets` (ίδια αντικείμενα), με τη σειρά του δικτύου. */
export function fuseDimensions(
  targets: readonly DimensionTarget[],
  bindings: readonly (DimensionBinding | null)[],
  bound: readonly BoundDimension[],
  network: NetworkOutcome | null,
  pxPerMm: number | null,
  o: PlanFusionOptions,
): FusedDimension[] {
  const obsOf = new Map(bound.map((b, j) => [b.target, network?.dimensionObservation[j]]));
  return targets.map((t, i) => fuseOne(t, bindings[i], network, obsOf.get(t), pxPerMm, o));
}

/** Βεβαιότητα ανά τμήμα: γεωμετρία της Φ2 · λύτης (θέση της ευθείας του) · ανάγνωση (συνεπής διάσταση που το μετρά). */
export function segmentConfidence(
  segments: readonly RasterSegment[],
  frame: FusionFrame,
  network: NetworkOutcome | null,
  dimensions: readonly FusedDimension[],
  o: PlanFusionOptions,
): Map<string, PlanConfidence> {
  const readingOfLine = new Map<string, number>();
  for (const d of dimensions) {
    if (d.status !== 'consistent' || d.binding === null) continue;
    for (const id of [d.binding.lineA, d.binding.lineB]) readingOfLine.set(id, Math.max(readingOfLine.get(id) ?? 0, d.confidence.factors.reading ?? 0));
  }
  return new Map(segments.map((s) => {
    const lineId = frame.lineOfSegment.get(s.id) ?? '';
    const obs = network?.positionObservation.get(lineId);
    const solver = network && obs !== undefined ? solverFactor(network.adjustment.verdicts[obs], o.baardaCritical) : undefined;
    return [s.id, composeConfidence({ geometry: s.confidence.score, solver, reading: readingOfLine.get(lineId) })];
  }));
}
