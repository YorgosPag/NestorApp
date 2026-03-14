/**
 * Conflict detection for calendar events.
 * Pure function — no side effects, no imports beyond types.
 */

import type { CalendarEvent } from '@/types/calendar-event';

export interface ConflictResult {
  hasConflicts: boolean;
  conflicts: CalendarEvent[];
}

/**
 * Detect time conflicts between a proposed event and existing events.
 * Uses interval overlap: newStart < existingEnd && newEnd > existingStart
 *
 * @param newStart - Start time of proposed event
 * @param newEnd - End time of proposed event
 * @param existingEvents - Array of existing calendar events
 * @param excludeId - Optional event ID to exclude (for edit scenarios)
 */
export function detectConflicts(
  newStart: Date,
  newEnd: Date,
  existingEvents: CalendarEvent[],
  excludeId?: string
): ConflictResult {
  const conflicts = existingEvents.filter((event) => {
    // Skip excluded event (e.g., the event being edited)
    if (excludeId && event.id === excludeId) return false;
    // Skip all-day events — they don't create time conflicts
    if (event.allDay) return false;
    // Overlap check: newStart < existingEnd && newEnd > existingStart
    return newStart < event.end && newEnd > event.start;
  });

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
  };
}
