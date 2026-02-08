/**
 * =============================================================================
 * ENTERPRISE: CALENDAR EVENT SERVICE
 * =============================================================================
 *
 * Merges Tasks + Appointments into a unified CalendarEvent[] for the calendar UI.
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
import { taskToCalendarEvent, appointmentToCalendarEvent } from './mappers';
import type { CalendarEvent } from '@/types/calendar-event';
import type { ICalendarEventService } from './contracts';

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

  // Fetch in parallel
  const [taskList, appointmentList] = await Promise.all([
    userId ? tasks.getByUser(userId) : tasks.getAll(),
    appointments.getByDateRange(start, end),
  ]);

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
  const allEvents = [...filteredTaskEvents, ...appointmentEvents];
  allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

  return allEvents;
}

// Export as service object for interface compliance
export const CalendarEventService: ICalendarEventService = {
  getEvents: getCalendarEvents,
};
