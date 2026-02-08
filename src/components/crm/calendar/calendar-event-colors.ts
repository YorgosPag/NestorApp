/**
 * =============================================================================
 * ENTERPRISE: CALENDAR EVENT COLOR CONFIGURATION
 * =============================================================================
 *
 * Single source of truth for calendar event colors by type.
 * Uses CSS variables (--status-*) — same pattern as GanttView.tsx.
 *
 * @module components/crm/calendar/calendar-event-colors
 */

import type { CalendarEventType } from '@/types/calendar-event';

export interface EventColorScheme {
  /** Background color (with opacity) */
  bg: string;
  /** Border/accent color */
  border: string;
  /** Text color */
  text: string;
}

/**
 * Color scheme per event type.
 * Used by `eventStyleGetter` in CrmCalendar for react-big-calendar.
 */
export const CALENDAR_EVENT_COLORS: Record<CalendarEventType, EventColorScheme> = {
  appointment: {
    bg: 'hsl(var(--status-info) / 0.15)',
    border: 'hsl(var(--status-info))',
    text: 'hsl(var(--status-info))',
  },
  call: {
    bg: 'hsl(var(--status-success) / 0.15)',
    border: 'hsl(var(--status-success))',
    text: 'hsl(var(--status-success))',
  },
  meeting: {
    bg: 'hsl(var(--chart-4) / 0.15)',
    border: 'hsl(var(--chart-4))',
    text: 'hsl(var(--chart-4))',
  },
  viewing: {
    bg: 'hsl(var(--status-warning) / 0.15)',
    border: 'hsl(var(--status-warning))',
    text: 'hsl(var(--status-warning))',
  },
  follow_up: {
    bg: 'hsl(var(--status-error) / 0.15)',
    border: 'hsl(var(--status-error))',
    text: 'hsl(var(--status-error))',
  },
  email: {
    bg: 'hsl(var(--muted) / 0.5)',
    border: 'hsl(var(--muted-foreground))',
    text: 'hsl(var(--muted-foreground))',
  },
  document: {
    bg: 'hsl(var(--chart-3) / 0.15)',
    border: 'hsl(var(--chart-3))',
    text: 'hsl(var(--chart-3))',
  },
  other: {
    bg: 'hsl(var(--muted) / 0.3)',
    border: 'hsl(var(--foreground) / 0.5)',
    text: 'hsl(var(--foreground))',
  },
};
