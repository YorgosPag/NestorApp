/**
 * =============================================================================
 * ENTERPRISE: CALENDAR EVENT MAPPERS
 * =============================================================================
 *
 * Pure functions that convert CrmTask and AppointmentDocument into
 * the unified CalendarEvent type for FullCalendar.
 *
 * @module services/calendar/mappers
 */

import type { CrmTask } from '@/types/crm';
import type { AppointmentDocument } from '@/types/appointment';
import type { CalendarEvent, CalendarEventType } from '@/types/calendar-event';
import { normalizeToDate, normalizeCalendarDay } from '@/lib/date-local';
import { appointmentStartAt } from '@/services/appointments/appointment-schedule';

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
  // ADR-869 §12.3 — ΤΕΤΑΡΤΟ αντίγραφο του ίδιου μεταφραστή, και το μόνο εκτός ραντεβού:
  // απόδειξη ότι η ερώτηση ήταν «τι μορφή έχει αυτή η ημέρα;», όχι ερώτηση του τομέα.
  const dueDateVal = normalizeCalendarDay(task.dueDate) ?? task.dueDate;
  const start = normalizeToDate(dueDateVal);
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
    eventType: taskTypeToEventType(task.type ?? 'other'),
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
 * Returns null όταν το ραντεβού δεν έχει ημέρα — δηλαδή δεν μπορεί να μπει σε ημερολόγιο.
 */
export function appointmentToCalendarEvent(appt: AppointmentDocument): CalendarEvent | null {
  const flat = appt as unknown as Record<string, unknown>;
  // ADR-869 §12 — η ερώτηση «πότε είναι αυτό;» έχει ΕΝΑΝ ιδιοκτήτη. Εδώ ζούσε το ΔΕΥΤΕΡΟ
  // από τρία αντίγραφα (σειρά προτίμησης + κανονικοποιητής DD/MM/YYYY + προεπιλογή ώρας).
  const start = appointmentStartAt(appt);
  if (start === null) return null;

  // Duration from flat format (durationMinutes field)
  const durationMs =
    typeof flat['durationMinutes'] === 'number'
      ? flat['durationMinutes'] * 60 * 1000
      : DEFAULT_EVENT_DURATION_MS;

  const apptId = appt.id ?? '';
  const requesterName = appt.requester?.name ?? appt.requester?.email ?? null;
  const description =
    appt.appointment?.description ??
    (flat['notes'] as string | undefined) ??
    (flat['title'] as string | undefined) ??
    '';
  const title = requesterName
    ? `${requesterName} — ${stripHtmlToPlainText(description)}`
    : stripHtmlToPlainText(description) || (flat['title'] as string | undefined) || 'Ραντεβού';

  return {
    id: `appt_${apptId}`,
    title,
    start,
    end: new Date(start.getTime() + durationMs),
    allDay: false,
    source: 'appointment',
    eventType: 'appointment',
    entityId: apptId,
    description,
    assignedTo: appt.assignedTo ?? '',
    status: appt.status ?? (flat['status'] as string | undefined) ?? 'approved',
    companyId: appt.companyId,
  };
}
