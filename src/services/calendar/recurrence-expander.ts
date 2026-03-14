/**
 * =============================================================================
 * ENTERPRISE: RECURRENCE EXPANDER
 * =============================================================================
 *
 * Expands recurring tasks into multiple CalendarEvent instances.
 * Pure function — takes a task with recurrence pattern and generates events
 * within a given date range.
 *
 * @module services/calendar/recurrence-expander
 */

import type { CrmTask } from '@/types/crm';
import type { CalendarEvent } from '@/types/calendar-event';
import type { RecurrencePattern } from '@/types/recurrence';
import { taskToCalendarEvent } from './mappers';
import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  isBefore,
  startOfDay,
} from 'date-fns';

const MAX_OCCURRENCES = 365;

/**
 * Generate the next date based on recurrence frequency and interval.
 */
function getNextDate(
  current: Date,
  frequency: RecurrencePattern['frequency'],
  interval: number
): Date {
  switch (frequency) {
    case 'daily':
      return addDays(current, interval);
    case 'weekly':
      return addWeeks(current, interval);
    case 'monthly':
      return addMonths(current, interval);
    case 'yearly':
      return addYears(current, interval);
  }
}

/**
 * Expand a recurring task into multiple CalendarEvent instances
 * within the specified date range.
 */
export function expandRecurrence(
  task: CrmTask,
  rangeStart: Date,
  rangeEnd: Date
): CalendarEvent[] {
  const recurrence = task.recurrence;
  if (!recurrence) return [];

  // Get the base event to extract duration
  const baseEvent = taskToCalendarEvent(task);
  if (!baseEvent) return [];

  const duration = baseEvent.end.getTime() - baseEvent.start.getTime();
  const events: CalendarEvent[] = [];
  let currentDate = startOfDay(baseEvent.start);
  let count = 0;

  // Determine end condition
  const maxDate =
    recurrence.endType === 'date' && recurrence.endDate
      ? new Date(recurrence.endDate)
      : addYears(rangeEnd, 1); // safety cap

  const maxCount =
    recurrence.endType === 'count' && recurrence.occurrences
      ? recurrence.occurrences
      : MAX_OCCURRENCES;

  while (
    count < maxCount &&
    isBefore(currentDate, maxDate) &&
    isBefore(currentDate, rangeEnd)
  ) {
    const eventStart = new Date(currentDate);
    eventStart.setHours(baseEvent.start.getHours(), baseEvent.start.getMinutes());
    const eventEnd = new Date(eventStart.getTime() + duration);

    // Only include if the occurrence overlaps with the display range
    if (eventEnd >= rangeStart && eventStart <= rangeEnd) {
      events.push({
        ...baseEvent,
        id: `${baseEvent.id}_r${count}`,
        start: eventStart,
        end: eventEnd,
      });
    }

    currentDate = getNextDate(currentDate, recurrence.frequency, recurrence.interval);
    count++;
  }

  return events;
}
