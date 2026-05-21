/**
 * Construction Alert Rules Engine — ADR-266 §5.8 / Phase D.3
 *
 * 6 rule functions, each returns an array of partial ConstructionAlert objects
 * (without id/companyId/buildingId/status/notifiedVia/createdAt — those are
 * filled in by construction-alert.service before persisting).
 */

import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';
import type { AlertRuleType, AlertSeverity } from '@/types/building/construction';
import type { BuildingMilestone } from '@/types/building/milestone';
import type { EVMResult } from '@/services/report-engine/evm-calculator';
import type { WeatherForecast } from '@/services/weather/open-meteo.service';
import { nowISO } from '@/lib/date-local';

// ─── Shared helpers ───────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / MS_PER_DAY);
}

function daysUntil(isoDate: string): number {
  return Math.floor((new Date(isoDate).getTime() - Date.now()) / MS_PER_DAY);
}

function overdueDays(plannedEnd: string): number {
  return Math.floor((Date.now() - new Date(plannedEnd).getTime()) / MS_PER_DAY);
}

// ─── Result type ─────────────────────────────────────────────────────────

export interface AlertCandidate {
  ruleType: AlertRuleType;
  severity: AlertSeverity;
  title: string;
  message: string;
  phaseId?: string;
  taskId?: string;
  data: Record<string, number | string>;
}

// ─── Rule 1: Task Overdue ─────────────────────────────────────────────────

export function detectTaskOverdue(tasks: ConstructionTask[]): AlertCandidate[] {
  const today = nowISO().split('T')[0];
  const results: AlertCandidate[] = [];

  for (const task of tasks) {
    if (task.status === 'completed') continue;
    if (task.plannedEndDate >= today) continue;

    const days = overdueDays(task.plannedEndDate);
    if (days <= 0) continue;

    results.push({
      ruleType: 'task_overdue',
      severity: 'high',
      title: task.name,
      message: `Εργασία καθυστερεί ${days} ημέρ${days === 1 ? 'α' : 'ες'} (προγρ. λήξη: ${task.plannedEndDate})`,
      phaseId: task.phaseId,
      taskId: task.id,
      data: { overdueDays: days, plannedEndDate: task.plannedEndDate },
    });
  }

  return results;
}

// ─── Rule 2: Phase SPI Drop ───────────────────────────────────────────────

export function detectSpiDrop(
  phases: ConstructionPhase[],
  evm: EVMResult,
  threshold = 0.85,
): AlertCandidate[] {
  if (evm.spi >= threshold) return [];

  const worstPhase = phases
    .filter(p => p.status !== 'completed')
    .sort((a, b) => a.progress - b.progress)[0];

  return [
    {
      ruleType: 'spi_drop',
      severity: 'high',
      title: worstPhase ? worstPhase.name : 'Πρόγραμμα',
      message: `SPI: ${evm.spi.toFixed(2)} (όριο: ${threshold}). Το έργο είναι πίσω από το πρόγραμμα.`,
      phaseId: worstPhase?.id,
      data: { spi: evm.spi, threshold, earnedValue: evm.ev, plannedValue: evm.pv },
    },
  ];
}

// ─── Rule 3: CPI Drop ─────────────────────────────────────────────────────

export function detectCpiDrop(evm: EVMResult, threshold = 0.85): AlertCandidate[] {
  if (evm.cpi >= threshold) return [];

  return [
    {
      ruleType: 'cpi_drop',
      severity: 'medium',
      title: 'Υπέρβαση Κόστους',
      message: `CPI: ${evm.cpi.toFixed(2)} (όριο: ${threshold}). Κίνδυνος υπέρβασης προϋπολογισμού.`,
      data: { cpi: evm.cpi, threshold, earnedValue: evm.ev, actualCost: evm.ac },
    },
  ];
}

// ─── Rule 4: Task Blocked > 3 days ───────────────────────────────────────

export function detectTaskBlocked(tasks: ConstructionTask[]): AlertCandidate[] {
  const results: AlertCandidate[] = [];

  for (const task of tasks) {
    if (task.status !== 'blocked') continue;

    const blockedSince = task.updatedAt ?? task.createdAt;
    if (!blockedSince) continue;

    const days = daysSince(blockedSince);
    if (days < 3) continue;

    results.push({
      ruleType: 'task_blocked',
      severity: 'high',
      title: task.name,
      message: `Εργασία μπλοκαρισμένη για ${days} ημέρ${days === 1 ? 'α' : 'ες'}.`,
      phaseId: task.phaseId,
      taskId: task.id,
      data: { blockedDays: days, blockedSince },
    });
  }

  return results;
}

// ─── Rule 5: Milestone At Risk ────────────────────────────────────────────

export function detectMilestoneAtRisk(
  milestones: BuildingMilestone[],
  daysWindow = 7,
  progressThreshold = 80,
): AlertCandidate[] {
  const results: AlertCandidate[] = [];

  for (const ms of milestones) {
    if (ms.status === 'completed') continue;

    const days = daysUntil(ms.date);
    if (days > daysWindow || days < 0) continue;
    if (ms.progress >= progressThreshold) continue;

    results.push({
      ruleType: 'milestone_risk',
      severity: 'high',
      title: ms.title,
      message: `Milestone σε ${days} ημέρ${days === 1 ? 'α' : 'ες'} — πρόοδος ${ms.progress}% (απαιτείται ≥${progressThreshold}%)`,
      data: { daysUntilDue: days, progress: ms.progress, milestoneDate: ms.date },
    });
  }

  return results;
}

// ─── Rule 6: No Progress > 5 days ────────────────────────────────────────

export function detectNoProgress(phases: ConstructionPhase[], staleDays = 5): AlertCandidate[] {
  const results: AlertCandidate[] = [];

  for (const phase of phases) {
    if (phase.status === 'completed' || phase.status === 'pending') continue;

    const lastUpdate = phase.updatedAt ?? phase.createdAt;
    if (!lastUpdate) continue;

    const days = daysSince(lastUpdate);
    if (days < staleDays) continue;

    results.push({
      ruleType: 'no_progress',
      severity: 'low',
      title: phase.name,
      message: `Δεν καταγράφηκε πρόοδος για ${days} ημέρ${days === 1 ? 'α' : 'ες'}.`,
      phaseId: phase.id,
      data: { staleDays: days, lastUpdate, currentProgress: phase.progress },
    });
  }

  return results;
}

// ─── Rule 7: Weather Risk ─────────────────────────────────────────────────

const RAIN_THRESHOLD_MM = 5;
const WIND_THRESHOLD_KMH = 50;

export function detectWeatherRisk(weather: WeatherForecast): AlertCandidate[] {
  const results: AlertCandidate[] = [];

  for (const day of weather.daily) {
    if (day.precipitationMm > RAIN_THRESHOLD_MM) {
      results.push({
        ruleType: 'weather_risk',
        severity: 'medium',
        title: `Έντονη βροχόπτωση (${day.date})`,
        message: `Αναμενόμενη βροχόπτωση ${day.precipitationMm.toFixed(1)}mm — επηρεάζει εξωτερικές εργασίες.`,
        data: { precipitationMm: day.precipitationMm, date: day.date },
      });
    }

    if (day.windspeedKmh > WIND_THRESHOLD_KMH) {
      results.push({
        ruleType: 'weather_risk',
        severity: 'high',
        title: `Ισχυροί άνεμοι (${day.date})`,
        message: `Αναμενόμενοι άνεμοι ${day.windspeedKmh.toFixed(0)}km/h — σταματήστε εργασίες σε ύψος.`,
        data: { windspeedKmh: day.windspeedKmh, date: day.date },
      });
    }
  }

  return results;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────

export function runAlertRules(
  phases: ConstructionPhase[],
  tasks: ConstructionTask[],
  milestones: BuildingMilestone[],
  evm: EVMResult,
  weather?: WeatherForecast | null,
): AlertCandidate[] {
  return [
    ...detectTaskOverdue(tasks),
    ...detectSpiDrop(phases, evm),
    ...detectCpiDrop(evm),
    ...detectTaskBlocked(tasks),
    ...detectMilestoneAtRisk(milestones),
    ...detectNoProgress(phases),
    ...(weather ? detectWeatherRisk(weather) : []),
  ];
}
