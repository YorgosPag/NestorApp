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

import type { CrmTask } from '@/types/crm';
import type { AppointmentDocument } from '@/types/appointment';
import type { CalendarEvent, CalendarEventType } from '@/types/calendar-event';
import { normalizeToDate } from '@/lib/date-local';

// ============================================================================
// HELPERS
// ============================================================================

const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000; // 1 hour

/**
 * Strip HTML tags and decode basic entities to produce plain text.
 * Used for appointment descriptions that contain email HTML content.
 */
function stripHtmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(div|p|li|tr|td|th|h[1-6])[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ADR-218 Phase 2: normalizeTimestamp → centralised normalizeToDate

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
  const start = normalizeToDate(task.dueDate);
  if (!start) return null;

  const taskId = task.id ?? '';

  // Multi-day support: use endDate if provided
  let end: Date;
  let allDay = false;
  if (task.endDate) {
    const parsedEnd = normalizeToDate(task.endDate);
    if (parsedEnd) {
      end = parsedEnd;
      // If end is a different day, mark as all-day
      if (start.toDateString() !== parsedEnd.toDateString()) {
        allDay = true;
      }
    } else {
      end = new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS);
    }
  } else {
    end = new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS);
  }

  return {
    id: `task_${taskId}`,
    title: task.title,
    start,
    end,
    allDay,
    source: 'task',
    eventType: taskTypeToEventType(task.type),
    entityId: taskId,
    description: task.description ?? '',
    assignedTo: task.assignedTo,
    status: task.status,
    priority: task.priority,
    companyId: task.companyId ?? null,
    contactId: task.contactId ?? undefined,
    projectId: task.projectId ?? undefined,
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
    title: `${requesterName} — ${stripHtmlToPlainText(appt.appointment.description)}`,
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
