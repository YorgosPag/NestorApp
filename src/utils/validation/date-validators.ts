/**
 * 🏢 ENTERPRISE DATE UTILITY FUNCTIONS
 *
 * Extracted from validation.ts on 2026-04-18 (ADR-314 Phase B — file size split, Google SRP).
 * Re-exported from validation.ts for backward compatibility.
 */

/**
 * Converts date string to Date object safely
 */
export const parseDate = (dateStr?: string): Date | null => {
  if (!dateStr || dateStr.trim() === '') return null;

  const trimmed = dateStr.trim();
  const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoDateMatch) {
    const year = Number(isoDateMatch[1]);
    const monthIndex = Number(isoDateMatch[2]) - 1;
    const day = Number(isoDateMatch[3]);
    const localDate = new Date(year, monthIndex, day);
    return isNaN(localDate.getTime()) ? null : localDate;
  }

  const date = new Date(trimmed);
  return isNaN(date.getTime()) ? null : date;
};


/**
 * Check if date is in the past or today
 */
export const isDatePastOrToday = (dateStr?: string): boolean => {
  const date = parseDate(dateStr);
  if (!date) return true; // Skip validation if date is empty/invalid
  return date <= new Date();
};
