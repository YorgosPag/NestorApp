/**
 * @fileoverview FAST-tier delay predictor for UC-017 (ADR-034 §12)
 * Pure heuristic — no AI call. Compares actual vs expected progress.
 */

import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';
import type { DelayPrediction, RiskSeverity } from '../gantt-ai-types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROGRESS_GAP_THRESHOLDS: Record<RiskSeverity, number> = {
  low: 10,
  medium: 20,
  high: 35,
  critical: 50,
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Predict delays for all phases based on progress vs planned schedule.
 * Returns predictions sorted by severity (critical first).
 */
export function predictDelays(
  phases: ConstructionPhase[],
  tasks: ConstructionTask[]
): DelayPrediction[] {
  const tasksByPhase = groupTasksByPhase(tasks);
  const now = Date.now();

  const predictions = phases
    .map(phase => analyzePhase(phase, tasksByPhase.get(phase.id) ?? [], now))
    .filter((p): p is DelayPrediction => p !== null);

  return predictions.sort(bySeverityDesc);
}

// ─── Internal ────────────────────────────────────────────────────────────────

function groupTasksByPhase(tasks: ConstructionTask[]): Map<string, ConstructionTask[]> {
  const map = new Map<string, ConstructionTask[]>();
  for (const task of tasks) {
    if (!map.has(task.phaseId)) map.set(task.phaseId, []);
    map.get(task.phaseId)!.push(task);
  }
  return map;
}

function analyzePhase(
  phase: ConstructionPhase,
  phaseTasks: ConstructionTask[],
  nowMs: number
): DelayPrediction | null {
  if (phase.status === 'completed') return null;

  const start = safeParse(phase.plannedStartDate);
  const end = safeParse(phase.plannedEndDate);
  if (!start || !end || end <= start) return null;

  const totalMs = end.getTime() - start.getTime();
  const elapsedMs = Math.max(0, nowMs - start.getTime());
  const expectedProgress = Math.min(100, (elapsedMs / totalMs) * 100);
  const actualProgress = computeActualProgress(phase, phaseTasks);
  const gap = expectedProgress - actualProgress;

  const isAlreadyDelayed = phase.status === 'delayed' || phase.status === 'blocked';

  if (!isAlreadyDelayed && gap < PROGRESS_GAP_THRESHOLDS.low) return null;

  const severity = classifySeverity(gap, isAlreadyDelayed);
  const delayDays = estimateDelayDays(gap, totalMs);
  const reason = buildReason(phase, gap, isAlreadyDelayed);

  return {
    phaseId: phase.id,
    phaseName: phase.name,
    delayDays,
    confidence: computeConfidence(gap, isAlreadyDelayed),
    reason,
    severity,
  };
}

function computeActualProgress(phase: ConstructionPhase, tasks: ConstructionTask[]): number {
  if (tasks.length === 0) return phase.progress;
  const avg = tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length;
  return Math.round((phase.progress * 0.4) + (avg * 0.6));
}

function classifySeverity(gap: number, isAlreadyDelayed: boolean): RiskSeverity {
  if (isAlreadyDelayed || gap >= PROGRESS_GAP_THRESHOLDS.critical) return 'critical';
  if (gap >= PROGRESS_GAP_THRESHOLDS.high) return 'high';
  if (gap >= PROGRESS_GAP_THRESHOLDS.medium) return 'medium';
  return 'low';
}

function estimateDelayDays(gap: number, totalMs: number): number {
  const totalDays = totalMs / (1000 * 60 * 60 * 24);
  return Math.round((gap / 100) * totalDays);
}

function computeConfidence(gap: number, isAlreadyDelayed: boolean): number {
  if (isAlreadyDelayed) return 90;
  if (gap >= PROGRESS_GAP_THRESHOLDS.high) return 80;
  if (gap >= PROGRESS_GAP_THRESHOLDS.medium) return 70;
  return 60;
}

function buildReason(phase: ConstructionPhase, gap: number, isAlreadyDelayed: boolean): string {
  if (isAlreadyDelayed && phase.delayNote) return phase.delayNote;
  if (isAlreadyDelayed && phase.delayReason) return `Αιτία: ${phase.delayReason}`;
  if (isAlreadyDelayed) return 'Φάση έχει ήδη σημανθεί ως καθυστερημένη';
  return `Πρόοδος ${Math.round(gap)}% πίσω από το πρόγραμμα`;
}

function safeParse(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

const SEVERITY_RANK: Record<RiskSeverity, number> = {
  critical: 4, high: 3, medium: 2, low: 1,
};

function bySeverityDesc(a: DelayPrediction, b: DelayPrediction): number {
  return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
}
