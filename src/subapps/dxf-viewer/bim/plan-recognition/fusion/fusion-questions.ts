/**
 * ADR-929 Φ4 · Δ8 · Δ10 — **οι ερωτήσεις του λύτη**: κάθε διαφωνία που δεν επιτρέπεται να λυθεί σιωπηλά, με τις δύο τιμές,
 * τη σοβαρότητα και το πλαίσιο πηγής για «άλμα στο σημείο».
 *
 * 🔑 **Ποιος φταίει, όχι μόνο «κάτι δεν ταιριάζει».** Το Revit αρνείται δύο κλειδωμένες διαστάσεις που συγκρούονται χωρίς να
 * πει ποια· εδώ το τεστ Baarda ξεχωρίζει:
 * - `dimension-conflict`: η **γραμμένη** τιμή απορρίφθηκε («γράφει 3,50, η γεωμετρία δίνει 3,20»)·
 * - `face-displaced`: η **θέση** μιας παρειάς απορρίφθηκε — οι διαστάσεις συμφωνούν μεταξύ τους και η γραμμή του σχεδίου
 *   είναι εκτός (χειροποίητη αλλαγή, σκίτσο, λάθος ανίχνευση).
 * 🔑 **Σοβαρότητα = πόσο πάνω από το όριο.** `|w| / κρίσιμη` για τον λύτη, `απόκλιση / ανοχή` για την κλίμακα και το εμβαδόν·
 * οι ερωτήσεις χωρίς μέτρο (αδέσμευτη, διφορούμενη) έχουν σταθερή, χαμηλότερη σοβαρότητα.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/fusion/fusion-questions
 */

import { rasterBoundsOf } from '../alignment/alignment-region';
import type { RasterSegment } from '../plan-recognition-types';
import type { NetworkOutcome } from './adjustment-network';
import type { FusionFrame } from './fusion-frame';
import type { FusedDimension, FusedRoom, PlanFusionOptions, PlanQuestion } from './plan-fusion-types';

const AMBIGUOUS_SEVERITY = 0.6;
const UNBOUND_SEVERITY = 0.4;

function dimensionQuestions(dimensions: readonly FusedDimension[], o: PlanFusionOptions): PlanQuestion[] {
  return dimensions.flatMap((d): PlanQuestion[] => {
    if (d.status === 'conflict' && d.measuredMm !== null) {
      return [{ kind: 'dimension-conflict', textId: d.textId, writtenMm: d.valueMm, measuredMm: d.measuredMm, severity: Math.abs(d.w ?? o.baardaCritical) / o.baardaCritical, rect: d.rect }];
    }
    if (d.status !== 'unbound') return [];
    return d.binding?.ambiguous
      ? [{ kind: 'ambiguous-binding', textId: d.textId, valueMm: d.valueMm, severity: AMBIGUOUS_SEVERITY, rect: d.rect }]
      : [{ kind: 'unbound-dimension', textId: d.textId, valueMm: d.valueMm, severity: UNBOUND_SEVERITY, rect: d.rect }];
  });
}

function displacedFaces(
  frame: FusionFrame,
  network: NetworkOutcome | null,
  segments: ReadonlyMap<string, RasterSegment>,
  pxPerMm: number | null,
  o: PlanFusionOptions,
): PlanQuestion[] {
  if (network === null || pxPerMm === null || network.adjustment.solution.singular) return [];
  return [...network.positionObservation].flatMap(([lineId, obs]): PlanQuestion[] => {
    const verdict = network.adjustment.verdicts[obs];
    const line = frame.lineById.get(lineId);
    if (verdict.active || line === undefined) return [];
    const points = line.segmentIds.flatMap((id) => {
      const s = segments.get(id);
      return s ? [s.start, s.end] : [];
    });
    const shiftPx = network.adjustment.solution.x[network.lineIndex.get(lineId) ?? 0] - line.offsetPx;
    const severity = Math.abs(verdict.w ?? o.baardaCritical) / o.baardaCritical;
    return points.length === 0 ? [] : [{ kind: 'face-displaced', lineId, shiftMm: Math.abs(shiftPx) / pxPerMm, segmentIds: line.segmentIds, severity, rect: rasterBoundsOf(points) }];
  });
}

function roomQuestions(rooms: readonly FusedRoom[], o: PlanFusionOptions): PlanQuestion[] {
  return rooms.flatMap((r): PlanQuestion[] =>
    r.status === 'conflict' && r.writtenAreaM2 !== null && r.measuredAreaM2 !== null
      ? [{ kind: 'area-conflict', roomName: r.name, writtenM2: r.writtenAreaM2, measuredM2: r.measuredAreaM2, severity: Math.abs(r.measuredAreaM2 - r.writtenAreaM2) / (o.areaConflictRel * r.writtenAreaM2), rect: r.rect }]
      : [],
  );
}

export interface QuestionSources {
  readonly frame: FusionFrame;
  readonly network: NetworkOutcome | null;
  readonly segments: readonly RasterSegment[];
  readonly dimensions: readonly FusedDimension[];
  readonly rooms: readonly FusedRoom[];
  readonly scaleQuestions: readonly PlanQuestion[];
  readonly pxPerMm: number | null;
}

/** Όλες οι ερωτήσεις, η σοβαρότερη πρώτη (ντετερμινιστικά: ισοβαθμία ⇒ σειρά παραγωγής). */
export function planQuestions(s: QuestionSources, o: PlanFusionOptions): PlanQuestion[] {
  const segments = new Map(s.segments.map((seg) => [seg.id, seg]));
  const all = [
    ...dimensionQuestions(s.dimensions, o),
    ...displacedFaces(s.frame, s.network, segments, s.pxPerMm, o),
    ...s.scaleQuestions,
    ...roomQuestions(s.rooms, o),
  ];
  return all.map((q, i) => ({ q, i })).sort((a, b) => b.q.severity - a.q.severity || a.i - b.i).map(({ q }) => q);
}
