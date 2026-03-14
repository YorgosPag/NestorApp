/**
 * Recurrence pattern for calendar events.
 * Stored on CrmTask.recurrence field.
 */

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type RecurrenceEndType = 'never' | 'date' | 'count';

export interface RecurrencePattern {
  frequency: RecurrenceFrequency;
  interval: number; // e.g. every 2 weeks
  daysOfWeek?: number[]; // 0=Sun..6=Sat (for weekly)
  endType: RecurrenceEndType;
  endDate?: string; // ISO date
  occurrences?: number; // max count
}
