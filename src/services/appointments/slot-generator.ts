/**
 * Appointment Slot Generator — Available time slots for booking
 *
 * Generates available slots by:
 * 1. Getting business hours for the requested day
 * 2. Generating all possible slots
 * 3. Querying existing appointments
 * 4. Removing occupied slots
 *
 * @module services/appointments/slot-generator
 */

import 'server-only';

import { generateTimeSlots } from '@/config/business-hours';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import {
  resolveAppointmentSchedule,
  type AppointmentScheduleSource,
} from './appointment-schedule';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('SlotGenerator');

/**
 * Get available time slots for a specific date.
 *
 * @param date - ISO date string (YYYY-MM-DD)
 * @param companyId - Tenant company ID
 * @returns Array of available time strings (e.g., ["09:00", "10:00", "11:00"])
 */
export async function getAvailableSlots(
  date: string,
  companyId: string,
): Promise<string[]> {
  const dayOfWeek = new Date(date).getDay();
  const allSlots = generateTimeSlots(dayOfWeek);

  if (allSlots.length === 0) {
    logger.info('No slots for this day (closed)', { date, dayOfWeek });
    return [];
  }

  // Query existing appointments for this date
  try {
    const db = getAdminFirestore();
    // 🔴 ADR-869 §12.2 — «ΠΟΙΑ ΩΡΑ ΕΙΝΑΙ ΠΙΑΣΜΕΝΗ;» ΡΩΤΑ ΤΗΝ ΙΣΧΥΟΥΣΑ.
    // Ρωτούσε `appointment.requestedDate` + `requestedTime`. Ένα ραντεβού που εγκρίθηκε
    // για άλλη ώρα θα κρατούσε πιασμένη την **παλιά** ώρα και θα άφηνε ελεύθερη τη
    // **νέα** — δηλαδή ο πελάτης θα μπορούσε να κλείσει ώρα που είναι ήδη κλεισμένη.
    const snapshot = await db
      .collection(COLLECTIONS.APPOINTMENTS)
      .where(FIELDS.COMPANY_ID, '==', companyId)
      .where(FIELDS.APPOINTMENT_EFFECTIVE_DATE, '==', date)
      .get();

    const occupiedTimes = new Set<string>();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const status = data.status as string;
      // Only block slots for active appointments
      if (status === 'pending_approval' || status === 'approved') {
        const schedule = resolveAppointmentSchedule(data as AppointmentScheduleSource);
        if (schedule !== null) occupiedTimes.add(schedule.time);
      }
    });

    const availableSlots = allSlots.filter(slot => !occupiedTimes.has(slot));

    logger.info('Slots generated', {
      date,
      total: allSlots.length,
      occupied: occupiedTimes.size,
      available: availableSlots.length,
    });

    return availableSlots;
  } catch (error) {
    // If query fails (e.g., missing index), return all slots as available
    logger.warn('Failed to check existing appointments, returning all slots', { date });
    return allSlots;
  }
}
