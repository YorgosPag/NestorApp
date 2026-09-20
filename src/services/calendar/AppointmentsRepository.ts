/**
 * =============================================================================
 * ENTERPRISE: APPOINTMENTS REPOSITORY
 * =============================================================================
 *
 * Firestore repository for the `appointments` collection.
 * ADR-214 Phase 4: READ methods delegated to firestoreQueryService.
 *
 * Features:
 * - Automatic tenant isolation via firestoreQueryService
 * - Super admin support (sees all data when no companyId)
 * - Date range querying (supports both nested and flat document formats)
 *
 * @module services/calendar/AppointmentsRepository
 * @see COLLECTIONS.APPOINTMENTS in firestore-collections.ts
 */

'use client';

import { where, orderBy, type DocumentData } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore';
import { FIELDS } from '@/config/firestore-field-constants';
import type { AppointmentDocument } from '@/types/appointment';
import type { IAppointmentsRepository } from './contracts';
import { format } from 'date-fns';

// ============================================================================
// TRANSFORM
// ============================================================================

/** Transform raw DocumentData (from firestoreQueryService) to AppointmentDocument */
function toAppointment(raw: DocumentData & { id: string }): AppointmentDocument {
  return { ...raw, id: raw.id } as unknown as AppointmentDocument;
}

// ============================================================================
// REPOSITORY
// ============================================================================

export class AppointmentsRepository implements IAppointmentsRepository {

  async getAll(): Promise<AppointmentDocument[]> {
    const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('APPOINTMENTS', {
      constraints: [orderBy('createdAt', 'desc')],
    });
    return result.documents.map(toAppointment);
  }

  async getByUser(userId: string): Promise<AppointmentDocument[]> {
    const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('APPOINTMENTS', {
      constraints: [
        where('assignedTo', '==', userId),
        orderBy('createdAt', 'desc'),
      ],
    });
    return result.documents.map(toAppointment);
  }

  /**
   * 🔴 ΣΑΡΩΣΗ, ΟΧΙ ΕΡΩΤΗΜΑ ΕΥΡΟΥΣ — και το λέει (ADR-869 §3).
   *
   * **Η διαδρομή του**: έτρεχε **τρία** ερωτήματα — δύο εύρους παράλληλα («Format A» =
   * `appointment.requestedDate`, «Format B» = flat `date`) και μετά, ως «fallback»,
   * πλήρη σάρωση. Μετρημένο ζωντανά: το Format B πετούσε **πάντα**
   * `FAILED_PRECONDITION`, άρα ο έλεγχος «και τα δύο fulfilled» ήταν **πάντα ψευδής**
   * και η πραγματική συμπεριφορά ήταν **η σάρωση** — με δύο άχρηστα ταξίδια από πάνω.
   *
   * Ούτε το Format A μόνο του έφτανε: η ερώτηση είναι `confirmedDate ?? requestedDate`
   * (ένα ραντεβού που μετακινήθηκε ζει στη **νέα** του μέρα), και ερώτημα εύρους μόνο
   * στο `requestedDate` θα το **έχανε**. Ερώτημα σε **δύο** πεδία θα χρειαζόταν δύο
   * δείκτες, συγχώνευση και αποδιπλασιασμό — για να απαντήσει **μία** ερώτηση.
   *
   * 🔑 **Πλέον η ερώτηση είναι πεδίο**: το `appointment.effectiveDate` γράφεται από τον
   * γραφέα (ADR-869 §12), έχει δείκτη `(companyId, appointment.effectiveDate)`, και
   * είναι κανονικοποιημένο σε `YYYY-MM-DD` ώστε η λεξικογραφική σειρά **να είναι** η
   * χρονολογική. **Ένα** ερώτημα, **ένα** εύρος, **κανένα** φίλτρο στον πελάτη: το
   * Firestore επιστρέφει ακριβώς όσα ζητήθηκαν, αντί για όλη τη συλλογή.
   */
  async getByDateRange(start: Date, end: Date): Promise<AppointmentDocument[]> {
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');

    const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('APPOINTMENTS', {
      constraints: [
        where(FIELDS.APPOINTMENT_EFFECTIVE_DATE, '>=', startStr),
        where(FIELDS.APPOINTMENT_EFFECTIVE_DATE, '<=', endStr),
      ],
    });

    return result.documents.map(toAppointment);
  }

  async getById(id: string): Promise<AppointmentDocument | null> {
    const raw = await firestoreQueryService.getById<DocumentData & { id: string }>('APPOINTMENTS', id);
    if (!raw) return null;
    return toAppointment(raw);
  }
}
