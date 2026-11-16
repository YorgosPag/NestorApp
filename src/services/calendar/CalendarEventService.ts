/**
 * =============================================================================
 * ENTERPRISE: CALENDAR EVENT SERVICE
 * =============================================================================
 *
 * Merges Tasks + Appointments (+ ADR-915 §45 Φ4: delivery due dates of open document-issuance assignments, read-only)
 * into a unified CalendarEvent[] for the calendar UI.
 *
 * Data Flow:
 *   Firestore tasks → TasksRepository.getAll() → CrmTask[]
 *   Firestore appointments → AppointmentsRepository.getByDateRange() → AppointmentDocument[]
 *   → mappers → CalendarEvent[] (sorted by date)
 *
 * @module services/calendar/CalendarEventService
 */

'use client';

import { TasksRepository } from '@/services/crm/tasks/repositories/TasksRepository';
import { AppointmentsRepository } from './AppointmentsRepository';
import { taskToCalendarEvent, appointmentToCalendarEvent, issuanceOpenItemToCalendarEvent } from './mappers';
import { fetchIssuanceOpenItems } from '@/services/document-registry/document-registry.client';
import type { CalendarEvent } from '@/types/calendar-event';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CalendarEventService');

// ============================================================================
// SINGLETON REPOSITORIES
// ============================================================================

let tasksRepo: TasksRepository | null = null;
let appointmentsRepo: AppointmentsRepository | null = null;

function getTasksRepository(): TasksRepository {
  if (!tasksRepo) {
    tasksRepo = new TasksRepository();
  }
  return tasksRepo;
}

function getAppointmentsRepository(): AppointmentsRepository {
  if (!appointmentsRepo) {
    appointmentsRepo = new AppointmentsRepository();
  }
  return appointmentsRepo;
}

// ============================================================================
// SERVICE
// ============================================================================

/**
 * Fetch calendar events (tasks + appointments) for a given date range.
 *
 * @param start - Start of date range
 * @param end - End of date range
 * @param userId - Optional user filter (assignedTo)
 * @returns Sorted array of CalendarEvent
 */
export async function getCalendarEvents(
  start: Date,
  end: Date,
  userId?: string
): Promise<CalendarEvent[]> {
  const tasks = getTasksRepository();
  const appointments = getAppointmentsRepository();

  // Fetch in parallel — graceful degradation: if one source fails, show the others.
  // ADR-915 §45 Φ4 — οι αναθέσεις του μητρώου ανήκουν στο γραφείο, όχι σε χρήστη: μόνο στην προβολή «όλων».
  const [taskResult, appointmentResult, issuanceResult] = await Promise.allSettled([
    userId ? tasks.getByUser(userId) : tasks.getAll(),
    appointments.getByDateRange(start, end),
    userId ? Promise.resolve(null) : fetchIssuanceOpenItems(),
  ]);

  const taskList = taskResult.status === 'fulfilled' ? taskResult.value : [];
  const appointmentList = appointmentResult.status === 'fulfilled' ? appointmentResult.value : [];

  if (taskResult.status === 'rejected') {
    logger.warn('Tasks fetch failed', { reason: taskResult.reason });
  }
  if (appointmentResult.status === 'rejected') {
    logger.warn('Appointments fetch failed', { reason: appointmentResult.reason });
  }
  if (issuanceResult.status === 'rejected') {
    logger.warn('Document-issuance open items fetch failed', { reason: issuanceResult.reason });
  }
  const issuanceItems = issuanceResult.status === 'fulfilled' && issuanceResult.value !== null ? issuanceResult.value.items : [];
  const issuanceEvents = issuanceItems
    .map((item) => issuanceOpenItemToCalendarEvent(item, null))
    .filter((e): e is CalendarEvent => e !== null && e.start >= start && e.start <= end);

  // Map to CalendarEvent, filtering out entries without dates
  const taskEvents = taskList
    .map(taskToCalendarEvent)
    .filter((e): e is CalendarEvent => e !== null);

  const appointmentEvents = appointmentList
    .map(appointmentToCalendarEvent)
    .filter((e): e is CalendarEvent => e !== null);

  // Filter tasks by date range (tasks repo doesn't range-filter by default)
  const filteredTaskEvents = taskEvents.filter(
    (event) => event.start >= start && event.start <= end
  );

  // Merge and sort by start date
  const allEvents = [...filteredTaskEvents, ...appointmentEvents, ...issuanceEvents];
  allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

  return allEvents;
}
