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
 * - Date range querying
 *
 * @module services/calendar/AppointmentsRepository
 * @see COLLECTIONS.APPOINTMENTS in firestore-collections.ts
 */

'use client';

import { where, orderBy, type DocumentData } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore';
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

  async getByDateRange(start: Date, end: Date): Promise<AppointmentDocument[]> {
    // Appointments store requestedDate as YYYY-MM-DD string — string comparison works
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');

    const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('APPOINTMENTS', {
      constraints: [
        where('appointment.requestedDate', '>=', startStr),
        where('appointment.requestedDate', '<=', endStr),
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
