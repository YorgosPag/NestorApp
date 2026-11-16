/**
 * ADR-929 Φ4 — **η σύντηξη**: γεωμετρία (Φ2) + ανάγνωση (Φ3) ⇒ δεμένες διαστάσεις, κλίμακα, συνορθωμένες παρειές,
 * βεβαιότητα και ερωτήσεις. Καθαρή συνάρτηση, στον πελάτη, χωρίς αποστολή πουθενά.
 *
 * Ροή: πλαίσιο (ευθείες παρειών) → στόχοι διαστάσεων (υποψήφιες δέσεις) → κλίμακα (συναίνεση + βαθμονόμηση + «1:100» +
 * εμβαδά, Δ4) → δέση στην κλίμακα → συνόρθωση με data snooping (Δ8) → ευρήματα → βεβαιότητα (Δ9) → ερωτήσεις.
 *
 * 🔑 **Χωρίς ανάγνωση η σύντηξη δεν σταματά** (Δ15 #1, Δ16 #4): κλειστός διακόπτης, όριο κόστους ή αποτυχία παρόχου δίνουν
 * ό,τι μπορεί η γεωμετρία μόνη της με τη γνωστή κλίμακα, και καμία ερώτηση που προϋποθέτει γραμμένες τιμές.
 * 🔑 **Τίποτα δεν γράφεται εδώ.** Η κλίμακα γράφεται μόνο μέσω `/calibrate` και τα τμήματα μόνο με έγκριση ανθρώπου (Φ5).
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/fusion/plan-fusion
 */

import { isWallCandidateRole } from '../classify/segment-roles';
import type { PlanExtensionAnchor, PlanReading, PlanSegmentRole } from '../plan-recognition-types';
import { adjustNetwork, type BoundDimension, type NetworkOutcome } from './adjustment-network';
import { dimensionTargets, selectBinding, type DimensionTarget } from './dimension-binding';
import { dimensionMarkTextIds, withoutDimensionMarks } from './dimension-marks';
import { dimensionSpans } from './dimension-spans';
import { resolveDrawingKind, type KnownScaleConsensus } from './drawing-kind';
import { buildFusionFrame, type FusionFrame } from './fusion-frame';
import { familyPxPerMm, isotropicMetric, type FamilyPxPerMm, type FusionMetric } from './fusion-metric';
import { planQuestions } from './fusion-questions';
import { adjustedOffsets, adjustedSegments, fuseDimensions, segmentConfidence } from './fusion-results';
import { findSegmentJunctions } from './segment-junctions';
import { createRoomAreaProbe, fusedRooms, measureRooms, type RoomMeasurement } from './room-areas';
import { dimensionScaleConsensus } from './scale-consensus';
import { chooseScale, knownScaleEvidence, metresPerOriginalPx, scaleConflicts, scaleEvidence, writtenScaleEvidence } from './scale-evidence';
import {
  DEFAULT_PLAN_FUSION,
  type AdjustmentSummary,
  type DimensionBinding,
  type DimensionSpan,
  type PlanFusionInput,
  type PlanFusionOptions,
  type PlanFusionResult,
  type PlanQuestion,
  type PlanScaleEvidence,
  type PlanScaleSuggestion,
} from './plan-fusion-types';

interface ScaleStage {
  readonly evidence: readonly PlanScaleEvidence[];
  readonly chosen: PlanScaleEvidence | null;
  readonly rooms: RoomMeasurement | null;
}

const present = <T>(v: T | null): v is T => v !== null;

function resolveScale(
  input: PlanFusionInput,
  reading: PlanReading | null,
  frame: FusionFrame,
  targets: readonly DimensionTarget[],
  known: KnownScaleConsensus,
  o: PlanFusionOptions,
): ScaleStage {
  // ADR-929 §6.16 #8 — η κρίση του είδους έχει ήδη ψηφίσει πάνω σε ΑΥΤΟΥΣ τους στόχους· καμία δεύτερη ψηφοφορία.
  const consensus = known.computed ? known.value : dimensionScaleConsensus(targets, o);
  const primary = [
    knownScaleEvidence(input.knownScale, frame),
    // Η συναίνεση μετρήθηκε στο ευθυγραμμισμένο πλαίσιο, από διαστάσεις κάθε διεύθυνσης μαζί ⇒ ισοτροπική εκεί (§6.22).
    consensus === null ? null : scaleEvidence('dimension-consensus', isotropicMetric(1 / consensus.pxPerMm), consensus.support),
    writtenScaleEvidence(reading?.writtenScale ?? null, input.sourceDpi, frame),
  ].filter(present);
  if (reading === null || reading.rooms.length === 0) return { evidence: primary, chosen: chooseScale(primary), rooms: null };
  const probe = input.roomAreaProbe ?? createRoomAreaProbe(input.alignment.image);
  const guess = chooseScale(primary)?.mmPerAlignedPx ?? null;
  const { measurement, evidence: area } = measureRooms(reading, input.alignment.originalToAligned, probe, guess, frame.drawingSpanPx);
  const evidence = area === null ? primary : [...primary, area];
  return { evidence, chosen: chooseScale(evidence), rooms: measurement };
}

function bindAll(targets: readonly DimensionTarget[], chosen: PlanScaleEvidence | null, frame: FusionFrame, o: PlanFusionOptions): {
  bindings: (DimensionBinding | null)[];
  bound: BoundDimension[];
} {
  const pxPerMm = chosen === null ? null : familyPxPerMm(chosen.metric, frame);
  const bindings = targets.map((t) => (pxPerMm === null ? null : selectBinding(t, pxPerMm, o)));
  const bound = targets.flatMap((target, i) => {
    const binding = bindings[i];
    return binding !== null && !binding.ambiguous ? [{ target, binding }] : [];
  });
  return { bindings, bound };
}

function summary(network: NetworkOutcome | null): AdjustmentSummary | null {
  if (network === null) return null;
  const a = network.adjustment;
  return {
    observations: a.verdicts.length,
    unknowns: a.solution.x.length,
    degreesOfFreedom: a.solution.degreesOfFreedom,
    sigma0: a.sigma0,
    globalTestPassed: a.globalTestPassed,
    rejected: a.rejected,
    singular: a.solution.singular,
  };
}

function suggestion(stage: ScaleStage, network: NetworkOutcome | null, frame: FusionFrame): PlanScaleSuggestion | null {
  if (stage.chosen === null) return null;
  const mmPerAlignedPx = network === null ? stage.chosen.mmPerAlignedPx : network.metric.mmPerAlignedPx;
  return {
    chosen: stage.chosen.source,
    mmPerAlignedPx,
    sigmaRel: network?.sigmaRel ?? null,
    metresPerOriginalPx: metresPerOriginalPx(mmPerAlignedPx, frame),
    evidence: stage.evidence,
  };
}

/**
 * §6.22 — η **τελική** μετρική (συνορθωμένη, ή η σταθερή της πηγής) ως «px/mm ανά οικογένεια»: ό,τι μετρά mm μετά τον
 * λύτη (ευρήματα διαστάσεων, μετατοπισμένες παρειές) ρωτά την οικογένειά του, όχι έναν μέσο όρο.
 */
function finalPxPerMm(stage: ScaleStage, network: NetworkOutcome | null, frame: FusionFrame): FamilyPxPerMm | null {
  const metric: FusionMetric | null = network?.metric ?? stage.chosen?.metric ?? null;
  return metric === null ? null : familyPxPerMm(metric, frame);
}

/** Φ5.5: ποιες παρειές μετρά κάθε διάσταση, από τις γραμμές επέκτασης — και χωρίς ανάγνωση. */
function spansOf(input: PlanFusionInput, roles: ReadonlyMap<string, PlanSegmentRole>, frame: FusionFrame, o: PlanFusionOptions): DimensionSpan[] {
  const anchors = input.extensionAnchors ?? new Map<string, readonly PlanExtensionAnchor[]>();
  const textLinks = input.textLinks ?? new Map<string, readonly string[]>();
  return dimensionSpans({ segments: input.segments, roles, anchors, textLinks, frame, originalToAligned: input.alignment.originalToAligned }, o);
}

/**
 * §6.19 — η ανάγνωση που μετρά: απολήξεις που το OCR διάβασε ως «T»/«I»/«4» απορροφώνται στη διάσταση **πριν** από κάθε
 * χρήση της (στόχοι διαστάσεων, κλίμακα, χώροι).
 */
function readingWithoutMarks(
  input: PlanFusionInput, roles: ReadonlyMap<string, PlanSegmentRole>,
): { readonly reading: PlanReading | null; readonly marks: ReadonlySet<string> } {
  if (input.reading?.status !== 'read') return { reading: null, marks: new Set() };
  const marks = dimensionMarkTextIds(input.reading.reading, input.segments, roles);
  return { reading: withoutDimensionMarks(input.reading.reading, marks), marks };
}

/**
 * §6.21.9 — τα συνορθωμένα τμήματα μαζί με την τοπολογία των κόμβων τους, υπολογισμένη ΜΙΑ φορά: κλείνει τις γωνίες
 * ΚΑΙ ταξιδεύει στην επικάλυψη (`segmentCorners`).
 */
function adjustedGeometry(
  input: PlanFusionInput, frame: FusionFrame, offsets: ReadonlyMap<string, number>, o: PlanFusionOptions,
): Pick<PlanFusionResult, 'adjustedSegments' | 'segmentJunctions'> {
  const junctions = findSegmentJunctions(input.segments, frame, input.alignment.originalToAligned, o.junctionMinAngleDeg);
  return { adjustedSegments: adjustedSegments(input.segments, frame, offsets, input.alignment, junctions), segmentJunctions: junctions };
}

/** Η σύντηξη μιας αναγνώρισης. Ντετερμινιστική: ίδια είσοδος ⇒ ίδιο αποτέλεσμα. */
export function fusePlan(input: PlanFusionInput): PlanFusionResult {
  const o: PlanFusionOptions = { ...DEFAULT_PLAN_FUSION, ...input.options };
  const roles = input.segmentRoles ?? new Map<string, PlanSegmentRole>();
  // Φ5.4: μόνο οι υποψήφιες παρειές γίνονται ευθείες — καμία διάσταση δεν δένεται σε γραμμή διάστασης.
  const faceSegments = input.segments.filter((s) => isWallCandidateRole(roles.get(s.id)));
  const frame = buildFusionFrame(faceSegments, input.alignment, o);
  const spans = spansOf(input, roles, frame, o);
  const { reading, marks } = readingWithoutMarks(input, roles);
  // Δ21 (0) · Δ7 Γ — το είδος (σκίτσο ή όχι) κρίνεται ΕΔΩ, μία φορά· ό,τι ακολουθεί τρέχει με αυτό.
  const { decision: drawingKind, targets, consensus } = resolveDrawingKind(input.kind, input.drawing, (kind) => (
    reading === null ? [] : dimensionTargets(reading, frame, input.alignment.originalToAligned, kind, o, spans)
  ), o);
  const stage = resolveScale(input, reading, frame, targets, consensus, o);
  const { bindings, bound } = bindAll(targets, stage.chosen, frame, o);
  const network = stage.chosen === null ? null
    : adjustNetwork(frame, bound, { metric: stage.chosen.metric, free: stage.chosen.source !== 'known-calibration' }, drawingKind.kind, o);
  const scale = suggestion(stage, network, frame);
  const pxPerMm = finalPxPerMm(stage, network, frame);
  const dimensions = fuseDimensions(targets, bindings, bound, network, frame, pxPerMm, o);
  const rooms = stage.rooms === null ? [] : fusedRooms(stage.rooms, scale?.mmPerAlignedPx ?? null, o);
  const offsets = adjustedOffsets(network);
  const scaleQuestions: PlanQuestion[] = stage.chosen === null ? [] : scaleConflicts(stage.chosen, stage.evidence, o);
  return {
    families: frame.families,
    faceLines: frame.lines,
    adjustedOffsetPx: offsets,
    ...adjustedGeometry(input, frame, offsets, o),
    dimensions,
    scale,
    rooms,
    questions: planQuestions({ frame, network, segments: input.segments, dimensions, rooms, scaleQuestions, pxPerMm }, o),
    segmentConfidence: segmentConfidence(input.segments, frame, network, dimensions, o),
    segmentRoles: roles,
    dimensionSpans: spans,
    absorbedMarkTextIds: [...marks],
    adjustment: summary(network),
    drawingKind,
  };
}
