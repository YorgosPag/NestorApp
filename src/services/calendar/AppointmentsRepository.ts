/**
 * =============================================================================
 * ENTERPRISE: APPOINTMENTS REPOSITORY
 * =============================================================================
 *
 * Firestore repository for the `appointments` collection.
 * Follows the same pattern as `services/crm/tasks/repositories/TasksRepository.ts`.
 *
 * Features:
 * - Tenant isolation via companyId
 * - Super admin support
 * - Date range querying
 *
 * @module services/calendar/AppointmentsRepository
 * @see COLLECTIONS.APPOINTMENTS in firestore-collections.ts
 */

'use client';

import { auth, db } from '@/lib/firebase';
import {
  collection,
  getDoc,
  getDocs,
  doc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { AppointmentDocument } from '@/types/appointment';
import type { IAppointmentsRepository } from './contracts';
import type { DocumentSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';

// ============================================================================
// TRANSFORM
// ============================================================================

function transformAppointment(snapshot: DocumentSnapshot): AppointmentDocument {
  const data = snapshot.data() as Omit<AppointmentDocument, 'id'>;
  return {
    ...data,
    id: snapshot.id,
  };
}

// ============================================================================
// REPOSITORY
// ============================================================================

export class AppointmentsRepository implements IAppointmentsRepository {
  private collectionName = COLLECTIONS.APPOINTMENTS;

  /**
   * Require authenticated user and extract tenant context.
   * Follows the same pattern as TasksRepository.requireAuthContext().
   */
  private async requireAuthContext(): Promise<{
    uid: string;
    companyId: string | null;
    isSuperAdmin: boolean;
  }> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('AUTHENTICATION_ERROR: User must be logged in to access appointments');
    }

    const tokenResult = await currentUser.getIdTokenResult();
    const companyId = tokenResult.claims?.companyId as string | undefined;
    const globalRole = tokenResult.claims?.globalRole as string | undefined;
    const isSuperAdmin = globalRole === 'super_admin';

    if (!companyId && !isSuperAdmin) {
      throw new Error('AUTHORIZATION_ERROR: User is not assigned to a company');
    }

    return { uid: currentUser.uid, companyId: companyId ?? null, isSuperAdmin };
  }

  async getAll(): Promise<AppointmentDocument[]> {
    const { companyId, isSuperAdmin } = await this.requireAuthContext();

    const q = isSuperAdmin && !companyId
      ? query(
          collection(db, this.collectionName),
          orderBy('createdAt', 'desc')
        )
      : query(
          collection(db, this.collectionName),
          where('companyId', '==', companyId),
          orderBy('createdAt', 'desc')
        );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(transformAppointment);
  }

  async getByUser(userId: string): Promise<AppointmentDocument[]> {
    const { companyId, isSuperAdmin } = await this.requireAuthContext();

    const q = isSuperAdmin && !companyId
      ? query(
          collection(db, this.collectionName),
          where('assignedTo', '==', userId),
          orderBy('createdAt', 'desc')
        )
      : query(
          collection(db, this.collectionName),
          where('companyId', '==', companyId),
          where('assignedTo', '==', userId),
          orderBy('createdAt', 'desc')
        );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(transformAppointment);
  }

  async getByDateRange(start: Date, end: Date): Promise<AppointmentDocument[]> {
    const { companyId, isSuperAdmin } = await this.requireAuthContext();

    // Appointments store requestedDate as YYYY-MM-DD string — string comparison works
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');

    const q = isSuperAdmin && !companyId
      ? query(
          collection(db, this.collectionName),
          where('appointment.requestedDate', '>=', startStr),
          where('appointment.requestedDate', '<=', endStr)
        )
      : query(
          collection(db, this.collectionName),
          where('companyId', '==', companyId),
          where('appointment.requestedDate', '>=', startStr),
          where('appointment.requestedDate', '<=', endStr)
        );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(transformAppointment);
  }

  async getById(id: string): Promise<AppointmentDocument | null> {
    const snapshot = await getDoc(doc(db, this.collectionName, id));
    if (!snapshot.exists()) return null;
    return transformAppointment(snapshot);
  }
}
