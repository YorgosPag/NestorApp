/**
 * =============================================================================
 * ENTERPRISE: AVAILABILITY CHECK (Server-Side)
 * =============================================================================
 *
 * Queries existing appointments for a specific date/company via admin Firestore.
 * Builds a Greek-language operator briefing for the UC-001 proposal.
 *
 * Used by: UC-001 AppointmentModule (LOOKUP + PROPOSE steps)
 * Reusable by: Any future module that needs calendar availability checks.
 *
 * @module services/ai-pipeline/shared/availability-check
 * @see UC-001 (docs/centralized-systems/ai/use-cases/UC-001-appointment.md)
 * @see PRE-001 (docs/centralized-systems/ai/prerequisites.md)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import {
  resolveAppointmentSchedule,
  type AppointmentScheduleSource,
} from '@/services/appointments/appointment-schedule';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('AVAILABILITY_CHECK');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Ένα ραντεβού που **ήδη κρατά** χώρο στην ημέρα.
 *
 * 🔑 ADR-869 §12.2 — τα πεδία λέγονται `effective*` και **όχι** `requested*` επίτηδες:
 * αυτό που πιάνει ώρα είναι η μέρα/ώρα **που ισχύει**, όχι εκείνη που ζητήθηκε κάποτε.
 * Το `AvailabilityResult` από κάτω κρατά `requested*`, γιατί εκεί η ερώτηση **είναι**
 * «τι ζήτησε ο αποστολέας». Δύο διαφορετικές ερωτήσεις ⇒ δύο διαφορετικά ονόματα.
 */
export interface ExistingAppointment {
  id: string;
  requesterName: string;
  effectiveDate: string | null;
  effectiveTime: string | null;
  description: string;
  status: string;
}

export interface AvailabilityResult {
  requestedDate: string | null;
  requestedTime: string | null;
  existingAppointments: ExistingAppointment[];
  isDateFree: boolean;
  hasTimeConflict: boolean;
  /** Greek-language briefing text for the operator (internal only) */
  operatorBriefing: string;
}

export interface AvailabilityCheckParams {
  companyId: string;
  requestedDate: string | null;
  requestedTime: string | null;
  requestId: string;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Check calendar availability for a requested date/time.
 *
 * Queries the `appointments` collection for active appointments
 * on the same date and company. Builds a human-readable briefing.
 *
 * Non-fatal: if the query fails, returns a graceful fallback.
 */
export async function checkAvailability(
  params: AvailabilityCheckParams
): Promise<AvailabilityResult> {
  const { companyId, requestedDate, requestedTime, requestId } = params;

  // No date → can't check availability
  if (!requestedDate) {
    return {
      requestedDate: null,
      requestedTime: null,
      existingAppointments: [],
      isDateFree: true,
      hasTimeConflict: false,
      operatorBriefing:
        'Ο αποστολέας δεν ζήτησε συγκεκριμένη ημερομηνία. Δεν ήταν δυνατός ο έλεγχος διαθεσιμότητας.',
    };
  }

  try {
    const adminDb = getAdminFirestore();

    // Query active appointments for the same date and company
    // 🔴 ADR-869 §12.2 — ΡΩΤΑΕΙ ΤΗΝ ΙΣΧΥΟΥΣΑ, ΟΧΙ ΤΗΝ ΑΙΤΟΥΜΕΝΗ.
    // Ρωτούσε `appointment.requestedDate`. Όσο η έγκριση αντιγράφει την αιτούμενη στην
    // επιβεβαιωμένη οι δύο ταυτίζονται — αλλά την πρώτη φορά που ένα ραντεβού εγκριθεί
    // για **άλλη** μέρα, ο έλεγχος θα το μετρούσε ακόμη στην **παλιά** (ψεύτικη
    // κατειλημμένη ώρα) και **καθόλου** στη νέα (**διπλοκράτηση**). Το `effectiveDate`
    // είναι εξ ορισμού «η μέρα που ισχύει», άρα η ερώτηση γίνεται σωστή **πριν** ανοίξει
    // το κενό, όχι αφού σκάσει.
    const snapshot = await adminDb
      .collection(COLLECTIONS.APPOINTMENTS)
      .where(FIELDS.COMPANY_ID, '==', companyId)
      .where(FIELDS.APPOINTMENT_EFFECTIVE_DATE, '==', requestedDate)
      .where(FIELDS.STATUS, 'in', ['approved', 'pending_approval'])
      .get();

    const existingAppointments: ExistingAppointment[] = snapshot.docs.map(
      (doc) => {
        const data = doc.data();
        // Ο ΕΝΑΣ αναγνώστης του «πότε» — παράγει όταν το κανονικό πεδίο λείπει (παλαιό έγγραφο).
        const schedule = resolveAppointmentSchedule(data as AppointmentScheduleSource);
        return {
          id: doc.id,
          requesterName:
            (data.requester?.name as string) ??
            (data.requester?.email as string) ??
            'Άγνωστος',
          effectiveDate: schedule?.date ?? null,
          effectiveTime: schedule?.time ?? null,
          description: (data.appointment?.description as string) ?? '',
          status: (data.status as string) ?? 'unknown',
        };
      }
    );

    // Σύγκρουση ώρας: η ώρα ΠΟΥ ΙΣΧΥΕΙ για το υπάρχον ραντεβού, όχι η αρχικά ζητούμενή του.
    const hasTimeConflict =
      requestedTime !== null &&
      existingAppointments.some(
        (appt) => appt.effectiveTime === requestedTime
      );

    const isDateFree = existingAppointments.length === 0;

    const operatorBriefing = buildBriefing({
      requestedDate,
      requestedTime,
      existingAppointments,
      isDateFree,
      hasTimeConflict,
    });

    logger.info('Availability check complete', {
      requestId,
      requestedDate,
      requestedTime,
      existingCount: existingAppointments.length,
      isDateFree,
      hasTimeConflict,
    });

    return {
      requestedDate,
      requestedTime,
      existingAppointments,
      isDateFree,
      hasTimeConflict,
      operatorBriefing,
    };
  } catch (error) {
    const msg = getErrorMessage(error);

    logger.warn('Availability check failed (non-fatal)', {
      requestId,
      error: msg,
    });

    return {
      requestedDate,
      requestedTime,
      existingAppointments: [],
      isDateFree: true,
      hasTimeConflict: false,
      operatorBriefing: `Δεν ήταν δυνατός ο έλεγχος διαθεσιμότητας (σφάλμα: ${msg}).`,
    };
  }
}

// ============================================================================
// BRIEFING BUILDER
// ============================================================================

function buildBriefing(params: {
  requestedDate: string;
  requestedTime: string | null;
  existingAppointments: ExistingAppointment[];
  isDateFree: boolean;
  hasTimeConflict: boolean;
}): string {
  const {
    requestedDate,
    requestedTime,
    existingAppointments,
    isDateFree,
    hasTimeConflict,
  } = params;

  const lines: string[] = [];

  if (isDateFree) {
    lines.push(
      `Στις ${requestedDate} δεν υπάρχουν προγραμματισμένα ραντεβού.`
    );
    if (requestedTime) {
      lines.push(`Η ώρα ${requestedTime} είναι ελεύθερη.`);
    } else {
      lines.push('Η ημερομηνία είναι πλήρως διαθέσιμη.');
    }
  } else {
    lines.push(
      `Στις ${requestedDate} υπάρχουν ${existingAppointments.length} ραντεβού:`
    );

    for (const appt of existingAppointments) {
      const timeStr = appt.effectiveTime ?? 'χωρίς ώρα';
      const statusLabel =
        appt.status === 'approved' ? 'εγκεκριμένο' : 'σε αναμονή';
      lines.push(
        `  \u2022 ${timeStr} — ${appt.requesterName} (${statusLabel})`
      );
    }

    if (requestedTime) {
      lines.push('');
      if (hasTimeConflict) {
        lines.push(
          `\u26A0 Η ζητούμενη ώρα ${requestedTime} ΣΥΓΚΡΟΥΕΤΑΙ με υπάρχον ραντεβού.`
        );
      } else {
        lines.push(
          `\u2713 Η ζητούμενη ώρα ${requestedTime} είναι διαθέσιμη.`
        );
      }
    }
  }

  return lines.join('\n');
}
