/**
 * =============================================================================
 * ENTERPRISE: CALENDAR SERVICE CONTRACTS
 * =============================================================================
 *
 * Interface definitions for the Calendar service layer.
 * Follows the same pattern as `services/crm/tasks/contracts.ts`.
 *
 * @module services/calendar/contracts
 */

import type { AppointmentDocument } from '@/types/appointment';
import type { CalendarEvent } from '@/types/calendar-event';

// ============================================================================
// APPOINTMENTS REPOSITORY
// ============================================================================

export interface IAppointmentsRepository {
  getAll(): Promise<AppointmentDocument[]>;
  getByUser(userId: string): Promise<AppointmentDocument[]>;
  getByDateRange(start: Date, end: Date): Promise<AppointmentDocument[]>;
  getById(id: string): Promise<AppointmentDocument | null>;
}

// ============================================================================
// CALENDAR EVENT SERVICE
// ============================================================================

export interface ICalendarEventService {
  getEvents(start: Date, end: Date, userId?: string): Promise<CalendarEvent[]>;
}
