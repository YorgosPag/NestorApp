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
import { daysSinceOrNull, daysUntilOrNull, nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ConstructionAlertRules');

// ─── Shared helpers ───────────────────────────────────────────────────────

function formatDateEU(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Στρογγυλοποίηση σε συμπληρωμένες ημέρες, διατηρώντας το «δεν ξέρω».
 *
 * Το `Math.floor` είναι απόφαση **πολιτικής** αυτού του engine («3 ημέρες
 * μπλοκαρισμένη» σημαίνει τρεις συμπληρωμένες), γι' αυτό ζει εδώ και όχι στον
 * SSoT — το `date-local` επιστρέφει την ακριβή κλασματική διαφορά.
 */
function wholeDays(value: number | null): number | null {
  return value === null ? null : Math.floor(value);
}

/**
 * Μια χρονική στιγμή που δεν διαβάζεται είναι **πρόβλημα δεδομένων**, όχι
 * μη-συμβάν. Ο κανόνας παραλείπεται — δεν μπορούμε να αποφανθούμε — αλλά η
 * παράλειψη **καταγράφεται**, ώστε να είναι ανιχνεύσιμο ποιο έγγραφο χρειάζεται
 * διόρθωση.
 *
 * Είναι η πρακτική των επαγγελματικών εργαλείων (Revit journal, ArchiCAD Report
 * window): κατεστραμμένα δεδομένα **ποτέ** δεν απορρίπτονται σιωπηλά. Δεν φτάνει
 * στον χρήστη — είναι log του server.
 *
 * ⚠️ Πριν το ADR-218 §Phase 4 δεν υπήρχε ούτε παράλειψη ούτε καταγραφή: το
 * `toMs()` επέστρεφε `NaN`, κάθε σύγκριση με `NaN` είναι `false`, και οι φύλακες
 * `if (days < 3) continue` **δεν παρέλειπαν** — εξέπεμπαν ειδοποίηση με κείμενο
 * «για NaN ημέρες» και έγραφαν `NaN` στο Firestore.
 */
function reportUnreadableInstant(
  ruleType: AlertRuleType,
  field: string,
  rawValue: unknown,
  entityId: string | undefined,
): void {
  logger.warn('Unreadable instant on construction entity — alert rule skipped', {
    ruleType,
    field,
    entityId,
    rawValue: String(rawValue),
  });
}

// ─── Result type ─────────────────────────────────────────────────────────

export interface AlertCandidate {
  ruleType: AlertRuleType;
  severity: AlertSeverity;
  title: string;
  message: string;
  phaseId?: string;
  taskId?: string;
  /** Overrides taskId/phaseId for deduplication (e.g. weather_risk uses date) */
  dedupId?: string;
  data: Record<string, number | string>;
}

// ─── Rule 1: Task Overdue ─────────────────────────────────────────────────

export function detectTaskOverdue(tasks: ConstructionTask[]): AlertCandidate[] {
  const today = nowISO().split('T')[0];
  const results: AlertCandidate[] = [];

  for (const task of tasks) {
    if (task.status === 'completed') continue;
    if (task.plannedEndDate >= today) continue;

    const days = wholeDays(daysSinceOrNull(task.plannedEndDate));
    if (days === null) {
      reportUnreadableInstant('task_overdue', 'plannedEndDate', task.plannedEndDate, task.id);
      continue;
    }
    if (days <= 0) continue;

    results.push({
      ruleType: 'task_overdue',
      severity: 'high',
      title: task.name,
      message: `Εργασία καθυστερεί ${days} ημέρ${days === 1 ? 'α' : 'ες'} (προγρ. λήξη: ${formatDateEU(task.plannedEndDate)})`,
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
  if (evm.plannedValue <= 0) return []; // no BOQ data — can't compute meaningful SPI
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
      data: { spi: evm.spi, threshold, earnedValue: evm.earnedValue, plannedValue: evm.plannedValue },
    },
  ];
}

// ─── Rule 3: CPI Drop ─────────────────────────────────────────────────────

export function detectCpiDrop(evm: EVMResult, threshold = 0.85): AlertCandidate[] {
  if (evm.budgetAtCompletion <= 0) return []; // no BOQ data — can't compute meaningful CPI
  if (evm.cpi >= threshold) return [];

  return [
    {
      ruleType: 'cpi_drop',
      severity: 'medium',
      title: 'Υπέρβαση Κόστους',
      message: `CPI: ${evm.cpi.toFixed(2)} (όριο: ${threshold}). Κίνδυνος υπέρβασης προϋπολογισμού.`,
      data: { cpi: evm.cpi, threshold, earnedValue: evm.earnedValue, actualCost: evm.actualCost },
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

    const days = wholeDays(daysSinceOrNull(blockedSince));
    if (days === null) {
      reportUnreadableInstant('task_blocked', 'updatedAt/createdAt', blockedSince, task.id);
      continue;
    }
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

    const days = wholeDays(daysUntilOrNull(ms.date));
    if (days === null) {
      reportUnreadableInstant('milestone_risk', 'date', ms.date, ms.id);
      continue;
    }
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
    if (phase.status === 'completed' || phase.status === 'planning') continue;

    const lastUpdate = phase.updatedAt ?? phase.createdAt;
    if (!lastUpdate) continue;

    const days = wholeDays(daysSinceOrNull(lastUpdate));
    if (days === null) {
      reportUnreadableInstant('no_progress', 'updatedAt/createdAt', lastUpdate, phase.id);
      continue;
    }
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
        title: `Έντονη βροχόπτωση (${formatDateEU(day.date)})`,
        message: `Αναμενόμενη βροχόπτωση ${day.precipitationMm.toFixed(1)}mm — επηρεάζει εξωτερικές εργασίες.`,
        dedupId: `rain:${day.date}`,
        data: { precipitationMm: day.precipitationMm, date: day.date },
      });
    }

    if (day.windspeedKmh > WIND_THRESHOLD_KMH) {
      results.push({
        ruleType: 'weather_risk',
        severity: 'high',
        title: `Ισχυροί άνεμοι (${formatDateEU(day.date)})`,
        message: `Αναμενόμενοι άνεμοι ${day.windspeedKmh.toFixed(0)}km/h — σταματήστε εργασίες σε ύψος.`,
        dedupId: `wind:${day.date}`,
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
