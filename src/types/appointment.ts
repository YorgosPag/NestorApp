/**
 * =============================================================================
 * 🏢 ENTERPRISE: APPOINTMENT TYPES
 * =============================================================================
 *
 * Firestore document types for the `appointments` collection.
 * Used by UC-001 (Appointment Request) pipeline module.
 *
 * @module types/appointment
 * @see UC-001 (Αίτημα Ραντεβού)
 * @see ADR-080 (Pipeline Implementation)
 * @see COLLECTIONS.APPOINTMENTS in firestore-collections.ts
 */

// ============================================================================
// STATUS
// ============================================================================

/**
 * Appointment lifecycle status
 *
 * Flow: pending_approval → approved → completed
 *                        → rejected
 *                        → cancelled (by requester or operator)
 */
export type AppointmentStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'completed';

// ============================================================================
// DETAILS — οι ημερομηνίες του ραντεβού, και η ΜΙΑ που μετράει
// ============================================================================

/**
 * Οι λεπτομέρειες ενός ραντεβού.
 *
 * 🔑 **ΤΡΕΙΣ ημερομηνίες, ΜΙΑ αλήθεια** (ADR-869 §12). Οι `requestedDate`/`confirmedDate`
 * είναι **ιστορικό**: τι ζητήθηκε, τι εγκρίθηκε. Το `effectiveDate` είναι **η απάντηση**
 * στο *«πότε είναι αυτό το ραντεβού;»* — παραγόμενο, κανονικοποιημένο σε `YYYY-MM-DD`,
 * και **το μόνο που ρωτιέται** σε `where()`/`orderBy()`.
 *
 * ⛔ **ΜΗΝ το γράψεις με το χέρι.** Το παράγει αποκλειστικά το
 * `services/appointments/appointment-schedule.ts` — `withAppointmentSchedule()` στη
 * γέννηση, `appointmentConfirmationPatch()` στην έγκριση. Χειρόγραφη εγγραφή σημαίνει
 * ότι κάποια στιγμή θα διαφωνήσει με τις δύο πηγές του, και τότε το ημερολόγιο θα λέει
 * άλλα από το ίδιο το έγγραφο.
 */
export interface AppointmentDetails {
  /** Requested date — ISO format YYYY-MM-DD (extracted by AI, may be null) */
  requestedDate?: string | null;
  /** Requested time — HH:mm format (extracted by AI, may be null) */
  requestedTime?: string | null;
  /** Confirmed date — set after operator approval */
  confirmedDate?: string;
  /** Confirmed time — set after operator approval */
  confirmedTime?: string;
  /**
   * 🔑 **Η ΜΙΑ ημερομηνία που ρωτιέται** — `confirmedDate ?? requestedDate`,
   * κανονικοποιημένη σε `YYYY-MM-DD` ώστε η λεξικογραφική σειρά **να είναι** η χρονολογική.
   * Δείκτης: `(companyId, appointment.effectiveDate)`. Παράγεται, ποτέ χειρόγραφη.
   */
  effectiveDate?: string | null;
  /** Η ώρα που αντιστοιχεί στην `effectiveDate` — `HH:mm`. Παράγεται μαζί της, ποτέ χωριστά. */
  effectiveTime?: string | null;
  /** Summarized description of the appointment request */
  description: string;
  /** Additional notes from operator or AI */
  notes?: string;
}

// ============================================================================
// DOCUMENT
// ============================================================================

/**
 * Appointment document stored in Firestore `appointments` collection.
 *
 * Created by the UC-001 AppointmentModule during pipeline EXECUTE step.
 * The operator approves the proposal via UC-009 Operator Inbox before
 * the appointment is written to Firestore.
 */
export interface AppointmentDocument {
  /** Firestore document ID (optional — set by Firestore on create) */
  id?: string;

  /** Tenant isolation */
  companyId: string;

  /** Pipeline correlation — links back to ai_pipeline_queue */
  pipelineRequestId: string;

  /** Source channel info */
  source: {
    /** Channel the request came from */
    channel: string;
    /** Communication/message ID from the intake */
    messageId: string;
  };

  /** Requester (sender) info */
  requester: {
    /** Sender email address */
    email?: string | null;
    /** Sender display name */
    name?: string | null;
    /** Firestore contact ID (null if unknown sender) */
    contactId?: string | null;
    /** Whether the sender was found in the contacts collection */
    isKnownContact: boolean;
  };

  /** Appointment details */
  appointment: AppointmentDetails;

  /** User ID of the assigned sales manager/responsible person */
  assignedTo?: string;

  /** Role responsible for this appointment */
  assignedRole: string;

  /** Current status */
  status: AppointmentStatus;

  /** ISO 8601 timestamps */
  createdAt: string;
  updatedAt: string;

  /** Approval metadata */
  approvedBy?: string | null;
  approvedAt?: string | null;
}
