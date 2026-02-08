/**
 * =============================================================================
 * ENTERPRISE: CALENDAR EVENT MAPPERS
 * =============================================================================
 *
 * Pure functions that convert CrmTask and AppointmentDocument into
 * the unified CalendarEvent type for react-big-calendar.
 *
 * @module services/calendar/mappers
 */

import type { CrmTask, FirestoreishTimestamp } from '@/types/crm';
import type { AppointmentDocument } from '@/types/appointment';
import type { CalendarEvent, CalendarEventType } from '@/types/calendar-event';

// ============================================================================
// HELPERS
// ============================================================================

const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000; // 1 hour

/**
 * Normalize FirestoreishTimestamp to a Date object.
 * Returns null if the value cannot be converted.
 */
function normalizeTimestamp(value: FirestoreishTimestamp | null | undefined): Date | null {
  if (!value) return null;

  if (value instanceof Date) return value;

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'object' && 'toDate' in value) {
    return value.toDate();
  }

  return null;
}

/**
 * Map CrmTask.type to CalendarEventType
 */
function taskTypeToEventType(taskType: CrmTask['type']): CalendarEventType {
  return taskType as CalendarEventType;
}

// ============================================================================
// TASK → CALENDAR EVENT
// ============================================================================

/**
 * Convert a CrmTask into a CalendarEvent.
 * Returns null if the task has no dueDate (cannot be placed on calendar).
 */
export function taskToCalendarEvent(task: CrmTask): CalendarEvent | null {
  const start = normalizeTimestamp(task.dueDate);
  if (!start) return null;

  const taskId = task.id ?? '';

  return {
    id: `task_${taskId}`,
    title: task.title,
    start,
    end: new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS),
    allDay: false,
    source: 'task',
    eventType: taskTypeToEventType(task.type),
    entityId: taskId,
    description: task.description ?? '',
    assignedTo: task.assignedTo,
    status: task.status,
    priority: task.priority,
    companyId: task.companyId ?? '',
  };
}

// ============================================================================
// APPOINTMENT → CALENDAR EVENT
// ============================================================================

/**
 * Convert an AppointmentDocument into a CalendarEvent.
 * Returns null if the appointment has no requestedDate (cannot be placed on calendar).
 */
export function appointmentToCalendarEvent(appt: AppointmentDocument): CalendarEvent | null {
  const dateStr = appt.appointment.confirmedDate ?? appt.appointment.requestedDate;
  if (!dateStr) return null;

  const timeStr = appt.appointment.confirmedTime ?? appt.appointment.requestedTime ?? '09:00';
  const start = new Date(`${dateStr}T${timeStr}:00`);
  if (isNaN(start.getTime())) return null;

  const apptId = appt.id ?? '';
  const requesterName = appt.requester.name ?? appt.requester.email ?? 'Unknown';

  return {
    id: `appt_${apptId}`,
    title: `${requesterName} — ${appt.appointment.description}`,
    start,
    end: new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS),
    allDay: false,
    source: 'appointment',
    eventType: 'appointment',
    entityId: apptId,
    description: appt.appointment.description,
    assignedTo: appt.assignedTo ?? '',
    status: appt.status,
    companyId: appt.companyId,
  };
}
