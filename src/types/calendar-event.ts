/**
 * =============================================================================
 * ENTERPRISE: UNIFIED CALENDAR EVENT TYPES
 * =============================================================================
 *
 * Single source of truth type that unifies CrmTask + AppointmentDocument
 * into a format consumable by react-big-calendar.
 *
 * @module types/calendar-event
 * @see CrmTask in types/crm.ts
 * @see AppointmentDocument in types/appointment.ts
 */

// ============================================================================
// SOURCE & TYPE ENUMS
// ============================================================================

/** Tracks where a calendar event originated */
export type CalendarEventSource = 'task' | 'appointment';

/** Event type for color coding in calendar views */
export type CalendarEventType =
  | 'appointment'
  | 'call'
  | 'email'
  | 'meeting'
  | 'viewing'
  | 'follow_up'
  | 'document'
  | 'other';

// ============================================================================
// CALENDAR EVENT
// ============================================================================

/**
 * Unified calendar event for react-big-calendar.
 *
 * Created by mapping functions in `services/calendar/mappers.ts`.
 * The `id` field is prefixed to avoid collisions between tasks and appointments:
 *   - Tasks: "task_{firestoreId}"
 *   - Appointments: "appt_{firestoreId}"
 */
export interface CalendarEvent {
  /** Unique ID (prefixed: task_xxx or appt_xxx) */
  id: string;

  /** Display title */
  title: string;

  /** Start date/time (Date object — UTC stored, displayed in local timezone by browser) */
  start: Date;

  /** End date/time (defaults to start + 1hr if not specified) */
  end: Date;

  /** Whether it is an all-day event */
  allDay: boolean;

  /** Source entity type */
  source: CalendarEventSource;

  /** Event type for color coding */
  eventType: CalendarEventType;

  /** Original Firestore document ID (without prefix) */
  entityId: string;

  /** Description/notes */
  description: string;

  /** Assigned user ID */
  assignedTo: string;

  /** Status from source entity */
  status: string;

  /** Priority (from tasks only) */
  priority?: 'low' | 'medium' | 'high' | 'urgent';

  /** Company ID for tenant isolation */
  companyId: string;
}
