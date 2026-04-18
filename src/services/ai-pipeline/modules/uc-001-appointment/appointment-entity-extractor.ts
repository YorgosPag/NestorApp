/**
 * =============================================================================
 * UC-001 APPOINTMENT — ENTITY EXTRACTOR HELPER
 * =============================================================================
 *
 * Pure helper extracted from appointment-module.ts (ADR-314 Phase C.5.22 split
 * to keep the main module under Google 500-line SRP limit).
 *
 * @module services/ai-pipeline/modules/uc-001-appointment/appointment-entity-extractor
 * @see ADR-080 (Pipeline Implementation)
 */

/**
 * Extract date/time from AI understanding entities.
 *
 * The AI provider may return entities with various key names:
 * eventDate, requestedDate, date, appointmentDate, etc.
 */
export function extractDateTimeFromEntities(
  entities?: Record<string, string | undefined>
): { date: string | null; time: string | null } {
  if (!entities) {
    return { date: null, time: null };
  }

  const dateKeys = ['eventDate', 'requestedDate', 'date', 'appointmentDate', 'preferredDate'];
  const timeKeys = ['requestedTime', 'time', 'appointmentTime', 'preferredTime', 'eventTime'];

  let date: string | null = null;
  let time: string | null = null;

  for (const key of dateKeys) {
    if (entities[key]) {
      date = entities[key];
      break;
    }
  }

  for (const key of timeKeys) {
    if (entities[key]) {
      time = entities[key];
      break;
    }
  }

  return { date, time };
}
