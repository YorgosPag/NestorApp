'use client';

/**
 * =============================================================================
 * useAttendanceSummary — Pure computation hook for attendance summaries
 * =============================================================================
 *
 * Computes daily summaries, crew groups, and anomalies from raw events.
 * NO Firestore calls — pure useMemo computation.
 *
 * @module components/projects/ika/hooks/useAttendanceSummary
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 2)
 */

import { useMemo } from 'react';
import { format } from 'date-fns';
import type {
  AttendanceEvent,
  AttendanceMethod,
  ProjectWorker,
  WorkerDailySummary,
  ProjectDailySummary,
  CrewGroup,
  WorkerAttendanceStatus,
  AttendanceAnomaly,
} from '../contracts';

interface UseAttendanceSummaryReturn {
  /** Project-level aggregate summary */
  projectSummary: ProjectDailySummary;
  /** Individual worker summaries */
  workerSummaries: WorkerDailySummary[];
  /** Workers grouped by company (crew) */
  crewGroups: CrewGroup[];
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Determines current status from last event
 */
function deriveStatus(events: AttendanceEvent[]): WorkerAttendanceStatus {
  if (events.length === 0) return 'absent';

  const lastEvent = events[events.length - 1];

  switch (lastEvent.eventType) {
    case 'check_in':
    case 'returned':
    case 'break_end':
      return 'present';
    case 'check_out':
      return 'checked_out';
    case 'left_site':
    case 'exit_permission':
      return 'off_site';
    case 'break_start':
      return 'on_break';
    default:
      return 'present';
  }
}

/**
 * Calculates time intervals from paired events.
 * Returns minutes between pairs of start/end event types.
 */
function calculateIntervalMinutes(
  events: AttendanceEvent[],
  startTypes: string[],
  endTypes: string[]
): number {
  let totalMinutes = 0;
  let lastStart: Date | null = null;

  for (const event of events) {
    if (startTypes.includes(event.eventType) && !lastStart) {
      lastStart = new Date(event.timestamp);
    } else if (endTypes.includes(event.eventType) && lastStart) {
      const end = new Date(event.timestamp);
      totalMinutes += (end.getTime() - lastStart.getTime()) / (1000 * 60);
      lastStart = null;
    }
  }

  return Math.max(0, Math.round(totalMinutes));
}

/**
 * Calculates total presence minutes (check_in → check_out).
 * Handles multiple check-in/check-out pairs per day.
 */
function calculatePresenceMinutes(events: AttendanceEvent[]): number {
  let totalMinutes = 0;
  let lastCheckIn: Date | null = null;

  for (const event of events) {
    if (event.eventType === 'check_in' && !lastCheckIn) {
      lastCheckIn = new Date(event.timestamp);
    } else if (event.eventType === 'check_out' && lastCheckIn) {
      const checkOut = new Date(event.timestamp);
      totalMinutes += (checkOut.getTime() - lastCheckIn.getTime()) / (1000 * 60);
      lastCheckIn = null;
    }
  }

  // If still checked in (no final check-out), count until now
  if (lastCheckIn) {
    const now = new Date();
    totalMinutes += (now.getTime() - lastCheckIn.getTime()) / (1000 * 60);
  }

  return Math.max(0, Math.round(totalMinutes));
}

/**
 * Detects anomalies in daily events
 */
function detectAnomalies(events: AttendanceEvent[]): AttendanceAnomaly[] {
  const anomalies: AttendanceAnomaly[] = [];

  if (events.length === 0) return anomalies;

  // Check for missing checkout (check_in exists but no check_out at end of day)
  const hasCheckIn = events.some((e) => e.eventType === 'check_in');
  const hasCheckOut = events.some((e) => e.eventType === 'check_out');

  if (hasCheckIn && !hasCheckOut) {
    // Only flag as anomaly if it's a past day
    const lastEventTime = new Date(events[events.length - 1].timestamp);
    const now = new Date();
    const isToday = lastEventTime.toDateString() === now.toDateString();

    if (!isToday) {
      anomalies.push({
        type: 'missing_checkout',
        description: 'Check-in χωρίς check-out',
        severity: 'medium',
      });
    }
  }

  // Check for missing checkin (check_out without preceding check_in)
  if (!hasCheckIn && hasCheckOut) {
    anomalies.push({
      type: 'missing_checkin',
      description: 'Check-out χωρίς check-in',
      severity: 'high',
    });
  }

  // Check for unauthorized absence (left_site without exit_permission > 30 min)
  let leftSiteTime: Date | null = null;
  for (const event of events) {
    if (event.eventType === 'left_site') {
      leftSiteTime = new Date(event.timestamp);
    } else if (event.eventType === 'exit_permission' || event.eventType === 'returned') {
      if (leftSiteTime && event.eventType === 'returned') {
        const returnTime = new Date(event.timestamp);
        const absenceMinutes = (returnTime.getTime() - leftSiteTime.getTime()) / (1000 * 60);

        // Check if there's an exit_permission before this left_site
        const hasPermission = events.some(
          (e) =>
            e.eventType === 'exit_permission' &&
            new Date(e.timestamp) >= leftSiteTime! &&
            new Date(e.timestamp) <= returnTime
        );

        if (!hasPermission && absenceMinutes > 30) {
          anomalies.push({
            type: 'unauthorized_absence',
            description: `Αποχώρηση ${Math.round(absenceMinutes)} λεπτά χωρίς άδεια`,
            severity: 'high',
          });
        }
      }
      leftSiteTime = null;
    }
  }

  // Check for long breaks (> 60 minutes)
  const breakMinutes = calculateIntervalMinutes(events, ['break_start'], ['break_end']);
  if (breakMinutes > 60) {
    anomalies.push({
      type: 'long_break',
      description: `Διάλειμμα ${breakMinutes} λεπτά (> 60 λεπτά)`,
      severity: 'low',
    });
  }

  return anomalies;
}

/**
 * Determines the primary recording method for a worker's events
 */
function getPrimaryMethod(events: AttendanceEvent[]): AttendanceMethod {
  if (events.length === 0) return 'manual';

  const methodCounts = new Map<AttendanceMethod, number>();
  for (const event of events) {
    const count = methodCounts.get(event.method) ?? 0;
    methodCounts.set(event.method, count + 1);
  }

  let maxCount = 0;
  let primaryMethod: AttendanceMethod = 'manual';
  for (const [method, count] of methodCounts) {
    if (count > maxCount) {
      maxCount = count;
      primaryMethod = method;
    }
  }

  return primaryMethod;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Pure computation hook that derives summaries from raw events and workers.
 * All calculations happen in useMemo — no Firestore calls.
 */
export function useAttendanceSummary(
  events: AttendanceEvent[],
  workers: ProjectWorker[],
  selectedDate: Date,
  projectId: string
): UseAttendanceSummaryReturn {
  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Compute worker summaries
  const workerSummaries = useMemo<WorkerDailySummary[]>(() => {
    // Group events by contactId
    const eventsByWorker = new Map<string, AttendanceEvent[]>();
    for (const event of events) {
      const existing = eventsByWorker.get(event.contactId) ?? [];
      existing.push(event);
      eventsByWorker.set(event.contactId, existing);
    }

    return workers.map((worker): WorkerDailySummary => {
      const workerEvents = eventsByWorker.get(worker.contactId) ?? [];

      const presenceMinutes = calculatePresenceMinutes(workerEvents);
      const breakMinutes = calculateIntervalMinutes(workerEvents, ['break_start'], ['break_end']);
      const offSiteMinutes = calculateIntervalMinutes(workerEvents, ['left_site'], ['returned']);
      const effectiveWork = Math.max(0, presenceMinutes - breakMinutes - offSiteMinutes);

      const firstCheckIn = workerEvents.find((e) => e.eventType === 'check_in');
      const lastCheckOut = [...workerEvents].reverse().find((e) => e.eventType === 'check_out');

      return {
        contactId: worker.contactId,
        workerName: worker.name,
        companyName: worker.company,
        companyContactId: worker.companyContactId,
        date: dateStr,
        currentStatus: deriveStatus(workerEvents),
        firstCheckIn: firstCheckIn?.timestamp ?? null,
        lastCheckOut: lastCheckOut?.timestamp ?? null,
        totalPresenceMinutes: presenceMinutes,
        totalBreakMinutes: breakMinutes,
        totalOffSiteMinutes: offSiteMinutes,
        effectiveWorkMinutes: effectiveWork,
        events: workerEvents,
        anomalies: detectAnomalies(workerEvents),
        method: getPrimaryMethod(workerEvents),
      };
    });
  }, [events, workers, dateStr]);

  // Compute project summary
  const projectSummary = useMemo<ProjectDailySummary>(() => {
    let presentCount = 0;
    let absentCount = 0;
    let offSiteCount = 0;
    let onBreakCount = 0;
    let checkedOutCount = 0;
    let totalEffectiveMinutes = 0;
    let anomalyCount = 0;

    for (const summary of workerSummaries) {
      switch (summary.currentStatus) {
        case 'present':
          presentCount++;
          break;
        case 'absent':
          absentCount++;
          break;
        case 'off_site':
          offSiteCount++;
          break;
        case 'on_break':
          onBreakCount++;
          break;
        case 'checked_out':
          checkedOutCount++;
          break;
      }
      totalEffectiveMinutes += summary.effectiveWorkMinutes;
      anomalyCount += summary.anomalies.length;
    }

    return {
      date: dateStr,
      projectId,
      totalWorkers: workers.length,
      presentCount,
      absentCount,
      offSiteCount,
      onBreakCount,
      checkedOutCount,
      totalHoursToday: Math.round((totalEffectiveMinutes / 60) * 100) / 100,
      anomalyCount,
      workerSummaries,
    };
  }, [workerSummaries, workers.length, dateStr, projectId]);

  // Compute crew groups
  const crewGroups = useMemo<CrewGroup[]>(() => {
    const groupMap = new Map<string, {
      companyContactId: string | null;
      companyName: string;
      workers: ProjectWorker[];
      presentIds: Set<string>;
    }>();

    for (const worker of workers) {
      const key = worker.companyContactId ?? '__independent__';
      const existing = groupMap.get(key);

      if (existing) {
        existing.workers.push(worker);
      } else {
        groupMap.set(key, {
          companyContactId: worker.companyContactId,
          companyName: worker.company ?? 'Ανεξάρτητοι Εργάτες',
          workers: [worker],
          presentIds: new Set(),
        });
      }
    }

    // Mark present workers
    for (const summary of workerSummaries) {
      if (summary.currentStatus === 'present' || summary.currentStatus === 'on_break') {
        const key = summary.companyContactId ?? '__independent__';
        const group = groupMap.get(key);
        if (group) {
          group.presentIds.add(summary.contactId);
        }
      }
    }

    return Array.from(groupMap.values()).map((g) => ({
      companyContactId: g.companyContactId,
      companyName: g.companyName,
      workers: g.workers,
      presentCount: g.presentIds.size,
      totalCount: g.workers.length,
    }));
  }, [workers, workerSummaries]);

  return { projectSummary, workerSummaries, crewGroups };
}
