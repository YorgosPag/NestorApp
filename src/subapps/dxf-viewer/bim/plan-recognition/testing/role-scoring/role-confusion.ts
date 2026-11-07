/**
 * **Βαθμολόγηση ρόλων** (ADR-929 §6.9): πίνακας σύγχυσης σταθμισμένος με μήκος (precision), πίνακας ανάκλησης (recall),
 * μετρικές ανά ρόλο και η ουρά ελέγχου «μόνο τα αταίριαστα, πρώτα τα πιο αβέβαια».
 *
 * 🔑 Κάθε **δείγμα** προσθέτει το μήκος του στο κελί του: ένα τμήμα που είναι μισό τοίχος και μισό κενό μετρά μισό-μισό.
 * Η ετικέτα **ανά τμήμα** (`SegmentTruth.truth`, πλειοψηφία) υπάρχει μόνο για την ουρά, όπου ο άνθρωπος βλέπει τμήματα.
 * 🔑 Τμήμα χωρίς κρίση ρόλου μετρά ως `unknown`: έτσι το βλέπει και ο αναγνωριστής (υποψήφια παρειά, αβέβαιη).
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/testing/role-scoring/role-confusion
 */

import { applyAffine } from '@/lib/geometry/affine-2x3';
import { segmentRoleMap } from '../../classify/segment-roles';
import type { PlanSegmentRole } from '../../plan-recognition-types';
import type { CadTruthRole } from '../cad-truth/cad-truth-types';
import { labelledLine, labelsAlong, majorityLabel, type LabelledLine } from './match-truth';
import {
  DEFAULT_ROLE_SCORING,
  FOUND_LABELS,
  PREDICTED_ROLES,
  SCORED_ROLES,
  TRUTH_LABELS,
  TRUTH_ROLES,
  type FoundLabel,
  type LengthMatrix,
  type RoleMetric,
  type RoleScore,
  type RoleScoringInput,
  type RoleScoringOptions,
  type SegmentTruth,
  type TruthLabel,
} from './role-scoring-types';

type MutableMatrix<R extends string, C extends string> = Record<R, Record<C, number>>;

function zeroMatrix<R extends string, C extends string>(rows: readonly R[], cols: readonly C[]): MutableMatrix<R, C> {
  const zeroRow = (): Record<C, number> => Object.fromEntries(cols.map((c) => [c, 0])) as Record<C, number>;
  return Object.fromEntries(rows.map((r) => [r, zeroRow()])) as MutableMatrix<R, C>;
}

const rowSum = (row: Readonly<Record<string, number>>): number => Object.values(row).reduce((s, v) => s + v, 0);

function truthLines(input: RoleScoringInput): LabelledLine<CadTruthRole>[] {
  const t = input.drawingToPx;
  return input.truth.segments
    .map((s) => labelledLine(applyAffine(t, s.a), applyAffine(t, s.b), s.role))
    .filter((l): l is LabelledLine<CadTruthRole> => l !== null);
}

interface PredictedLine {
  readonly id: string;
  readonly line: LabelledLine<PlanSegmentRole>;
}

function predictedLines(input: RoleScoringInput): PredictedLine[] {
  const roles = segmentRoleMap(input.verdicts);
  const out: PredictedLine[] = [];
  for (const s of input.segments) {
    const line = labelledLine(s.start, s.end, roles.get(s.id) ?? 'unknown');
    if (line !== null) out.push({ id: s.id, line });
  }
  return out;
}

/** Αναγνωριστής → CAD: γεμίζει τον πίνακα σύγχυσης και δίνει την κρίση ανά τμήμα. */
function forwardPass(
  predicted: readonly PredictedLine[],
  truth: readonly LabelledLine<CadTruthRole>[],
  scores: ReadonlyMap<string, number>,
  o: RoleScoringOptions,
): { readonly confusion: MutableMatrix<PlanSegmentRole, TruthLabel>; readonly segments: SegmentTruth[] } {
  const confusion = zeroMatrix(PREDICTED_ROLES, TRUTH_LABELS);
  const segments: SegmentTruth[] = [];
  for (const { id, line } of predicted) {
    const along = labelsAlong(line, truth, o);
    for (const l of along.labels) confusion[line.label][l ?? 'no-truth'] += along.sampleLengthPx;
    const major = majorityLabel(along.labels);
    const truthLabel: TruthLabel = major.label !== null && major.fraction >= o.minCoverage ? major.label : 'no-truth';
    segments.push({
      segmentId: id,
      predicted: line.label,
      truth: truthLabel,
      coverage: major.fraction,
      lengthPx: line.lengthPx,
      dimensionScore: scores.get(id) ?? null,
    });
  }
  return { confusion, segments };
}

/** CAD → αναγνωριστής: γεμίζει τον πίνακα ανάκλησης. */
function reversePass(
  truth: readonly LabelledLine<CadTruthRole>[],
  predicted: readonly PredictedLine[],
  o: RoleScoringOptions,
): MutableMatrix<CadTruthRole, FoundLabel> {
  const recall = zeroMatrix(TRUTH_ROLES, FOUND_LABELS);
  const targets = predicted.map((p) => p.line);
  for (const line of truth) {
    const along = labelsAlong(line, targets, o);
    for (const l of along.labels) recall[line.label][l ?? 'missed'] += along.sampleLengthPx;
  }
  return recall;
}

function metricsOf(
  confusion: LengthMatrix<PlanSegmentRole, TruthLabel>,
  recall: LengthMatrix<CadTruthRole, FoundLabel>,
): RoleMetric[] {
  return SCORED_ROLES.map((role) => {
    const predictedTotal = rowSum(confusion[role]);
    const truthTotal = rowSum(recall[role]);
    return {
      role,
      precision: predictedTotal > 0 ? confusion[role][role] / predictedTotal : null,
      recall: truthTotal > 0 ? recall[role][role] / truthTotal : null,
    };
  });
}

/** Πόσο αβέβαιη ήταν η κρίση: απόσταση του βαθμού από το 0,5 (μικρότερο = πιο αβέβαιο). Χωρίς βαθμό ⇒ στο τέλος. */
const uncertainty = (s: SegmentTruth): number => (s.dimensionScore === null ? Number.POSITIVE_INFINITY : Math.abs(s.dimensionScore - 0.5));

/** Μόνο τα αταίριαστα: πρώτα τα πιο αβέβαια, μετά τα μακρύτερα, μετά κατά id (ντετερμινιστικά). */
export function mismatchQueue(segments: readonly SegmentTruth[]): SegmentTruth[] {
  return segments
    .filter((s) => s.truth !== s.predicted)
    .sort((p, q) => uncertainty(p) - uncertainty(q) || q.lengthPx - p.lengthPx || p.segmentId.localeCompare(q.segmentId));
}

/** **Βαθμολόγησε** τους ρόλους του αναγνωριστή έναντι της αλήθειας του CAD (ήδη καταγεγραμμένης στα pixel). */
export function scoreRoles(input: RoleScoringInput, o: RoleScoringOptions = DEFAULT_ROLE_SCORING): RoleScore {
  const truth = truthLines(input);
  const predicted = predictedLines(input);
  const scores = new Map(input.verdicts.map((v) => [v.segmentId, v.dimensionScore]));
  const { confusion, segments } = forwardPass(predicted, truth, scores, o);
  const recallMatrix = reversePass(truth, predicted, o);
  return {
    segments,
    confusion,
    recallMatrix,
    metrics: metricsOf(confusion, recallMatrix),
    mismatches: mismatchQueue(segments),
  };
}
