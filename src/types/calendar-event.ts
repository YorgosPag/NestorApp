/**
 * =============================================================================
 * ENTERPRISE: UNIFIED CALENDAR EVENT TYPES
 * =============================================================================
 *
 * Single source of truth type that unifies CrmTask + AppointmentDocument
 * into a format consumable by FullCalendar.
 *
 * @module types/calendar-event
 * @see CrmTask in types/crm.ts
 * @see AppointmentDocument in types/appointment.ts
 */

import type { WorkspaceHref } from '@/lib/workspace/route-worlds';

// ============================================================================
// SOURCE & TYPE ENUMS
// ============================================================================

/**
 * Tracks where a calendar event originated. ADR-915 §45 Φ4 — `document-issuance`: η προθεσμία παράδοσης μιας ανάθεσης
 * έκδοσης του μητρώου λήξεων (προβολή, ΟΧΙ εργασία· κάτοχος το μητρώο ⇒ μόνο ανάγνωση εδώ).
 * ADR-915 §45.19 Φ6β — `engagement`: εκκρεμότητα του **ίδιου του χρήστη** ως επαγγελματία σε ξένο γραφείο (παράδοση ·
 * υπογραφή), από το «Οι υποθέσεις μου»· κάτοχος ο οικοδεσπότης ⇒ μόνο ανάγνωση.
 */
export type CalendarEventSource = 'task' | 'appointment' | 'document-issuance' | 'engagement';

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
 * Unified calendar event for FullCalendar.
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
  companyId: string | null;

  /** Contact ID (from task source) */
  contactId?: string;

  /** Project ID (from task source) */
  projectId?: string;

  /** Contact display name (resolved from contactId) */
  contactName?: string;

  /** Project display name (resolved from projectId) */
  projectName?: string;

  /**
   * ADR-915 §45 Φ4 — πού ζει το πρωτότυπο όταν **δεν** είναι οντότητα του CRM (π.χ. η γραμμή του μητρώου λήξεων με το
   * πάνελ της ανοιχτό). Το «Άνοιγμα» του διαλόγου πηγαίνει εκεί.
   */
  href?: WorkspaceHref;
}
