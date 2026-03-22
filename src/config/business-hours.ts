/**
 * Business Hours Configuration — SSoT for appointment scheduling
 *
 * Used by:
 * - Telegram bot booking flow (slot generation)
 * - Availability check service
 * - Calendar UI (optional)
 *
 * @module config/business-hours
 */

// ============================================================================
// TYPES
// ============================================================================

interface TimeRange {
  /** Start time HH:mm */
  start: string;
  /** End time HH:mm */
  end: string;
}

interface BusinessHoursConfig {
  /** Monday-Friday hours (null = closed) */
  weekdays: TimeRange | null;
  /** Saturday hours (null = closed) */
  saturday: TimeRange | null;
  /** Sunday hours (null = closed) */
  sunday: TimeRange | null;
  /** Appointment slot duration in minutes */
  slotDurationMinutes: number;
  /** Break time (e.g., lunch) — excluded from slots */
  breakTime: TimeRange | null;
  /** How many days ahead customers can book */
  maxBookingDaysAhead: number;
  /** Minimum hours before appointment (prevents last-minute bookings) */
  minHoursBeforeBooking: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export const BUSINESS_HOURS: BusinessHoursConfig = {
  weekdays: { start: '09:00', end: '18:00' },
  saturday: { start: '09:00', end: '14:00' },
  sunday: null,
  slotDurationMinutes: 60,
  breakTime: { start: '13:00', end: '14:00' },
  maxBookingDaysAhead: 14,
  minHoursBeforeBooking: 2,
};

// ============================================================================
// HELPERS
// ============================================================================

/** Greek day names for Telegram buttons */
const DAY_NAMES_EL = ['Κυρ', 'Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ'];

/**
 * Get working hours for a specific day of week (0=Sunday, 6=Saturday)
 */
export function getHoursForDay(dayOfWeek: number): TimeRange | null {
  if (dayOfWeek === 0) return BUSINESS_HOURS.sunday;
  if (dayOfWeek === 6) return BUSINESS_HOURS.saturday;
  return BUSINESS_HOURS.weekdays;
}

/**
 * Get bookable dates (next N days that are open)
 */
export function getBookableDates(maxDays: number = BUSINESS_HOURS.maxBookingDaysAhead): Array<{
  date: string;
  label: string;
  dayOfWeek: number;
}> {
  const dates: Array<{ date: string; label: string; dayOfWeek: number }> = [];
  const now = new Date();

  for (let i = 1; i <= maxDays && dates.length < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dayOfWeek = d.getDay();
    const hours = getHoursForDay(dayOfWeek);

    if (!hours) continue; // closed day

    const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
    const dayName = DAY_NAMES_EL[dayOfWeek];
    const dayNum = d.getDate();
    const month = d.getMonth() + 1;

    dates.push({
      date: dateStr,
      label: `${dayName} ${dayNum}/${month}`,
      dayOfWeek,
    });
  }

  return dates;
}

/**
 * Generate time slots for a specific day
 */
export function generateTimeSlots(dayOfWeek: number): string[] {
  const hours = getHoursForDay(dayOfWeek);
  if (!hours) return [];

  const slots: string[] = [];
  const [startH, startM] = hours.start.split(':').map(Number);
  const [endH, endM] = hours.end.split(':').map(Number);
  const breakStart = BUSINESS_HOURS.breakTime?.start;
  const breakEnd = BUSINESS_HOURS.breakTime?.end;

  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  while (currentMinutes + BUSINESS_HOURS.slotDurationMinutes <= endMinutes) {
    const h = Math.floor(currentMinutes / 60);
    const m = currentMinutes % 60;
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    // Skip break time
    if (breakStart && breakEnd) {
      const [bsH, bsM] = breakStart.split(':').map(Number);
      const [beH, beM] = breakEnd.split(':').map(Number);
      const breakStartMin = bsH * 60 + bsM;
      const breakEndMin = beH * 60 + beM;

      if (currentMinutes >= breakStartMin && currentMinutes < breakEndMin) {
        currentMinutes = breakEndMin;
        continue;
      }
    }

    slots.push(timeStr);
    currentMinutes += BUSINESS_HOURS.slotDurationMinutes;
  }

  return slots;
}
