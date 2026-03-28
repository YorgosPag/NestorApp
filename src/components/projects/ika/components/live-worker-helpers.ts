/**
 * =============================================================================
 * Live Worker Map Helpers — Formatting & Label Utilities
 * =============================================================================
 *
 * Pure functions for time formatting and event type labelling.
 *
 * @module components/projects/ika/components/live-worker-helpers
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

/** Format ISO timestamp to HH:mm (Greek locale) */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  // eslint-disable-next-line custom/no-hardcoded-strings
  return d.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
}

/** Map event type keys to i18n label keys */
const EVENT_TYPE_LABEL_KEYS: Record<string, string> = {
  check_in: 'ika.attendance.eventTypes.arrival',
  check_out: 'ika.attendance.eventTypes.departure',
  break_start: 'ika.attendance.eventTypes.break',
  break_end: 'ika.attendance.eventTypes.return',
  left_site: 'ika.attendance.eventTypes.departure',
  returned: 'ika.attendance.eventTypes.return',
};

/** Translate event type to localized display label */
export function eventTypeLabel(eventType: string, t: (key: string) => string): string {
  const key = EVENT_TYPE_LABEL_KEYS[eventType];
  return key ? t(key) : eventType;
}
