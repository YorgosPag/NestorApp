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
import type { AppointmentDocument } from '@/types/appointment';
import type { IAppointmentsRepository } from './contracts';
import { format, parse, isValid } from 'date-fns';

// ============================================================================
// TRANSFORM
// ============================================================================

/** Transform raw DocumentData (from firestoreQueryService) to AppointmentDocument */
function toAppointment(raw: DocumentData & { id: string }): AppointmentDocument {
  return { ...raw, id: raw.id } as unknown as AppointmentDocument;
}

/**
 * Normalize a date string to YYYY-MM-DD.
 * Handles both "YYYY-MM-DD" and "DD/MM/YYYY" formats written by the AI agent.
 */
function normalizeDateStr(raw: string): string | null {
  if (!raw) return null;
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const parsed = parse(raw, 'dd/MM/yyyy', new Date());
    return isValid(parsed) ? format(parsed, 'yyyy-MM-dd') : null;
  }
  return null;
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
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');

    // Query both document formats in parallel — graceful degradation if index missing
    const [nestedResult, flatResult] = await Promise.allSettled([
      // Format A: nested appointment.requestedDate (UC-001 + new AI schema)
      firestoreQueryService.getAll<DocumentData & { id: string }>('APPOINTMENTS', {
        constraints: [
          where('appointment.requestedDate', '>=', startStr),
          where('appointment.requestedDate', '<=', endStr),
        ],
      }),
      // Format B: flat date field (legacy AI agent format)
      firestoreQueryService.getAll<DocumentData & { id: string }>('APPOINTMENTS', {
        constraints: [
          where('date', '>=', startStr),
          where('date', '<=', endStr),
        ],
      }),
    ]);

    // Merge + deduplicate by document ID
    const seen = new Set<string>();
    const combined: AppointmentDocument[] = [];

    for (const result of [nestedResult, flatResult]) {
      if (result.status !== 'fulfilled') continue;
      for (const raw of result.value.documents) {
        if (seen.has(raw.id)) continue;
        seen.add(raw.id);
        combined.push(toAppointment(raw));
      }
    }

    // Client-side filter for flat-format docs with DD/MM/YYYY date (can't be indexed correctly)
    if (nestedResult.status === 'fulfilled' && flatResult.status === 'fulfilled') {
      return combined;
    }

    // Fallback: if Firestore queries fail (e.g. missing index), fetch all and filter client-side
    const allResult = await firestoreQueryService.getAll<DocumentData & { id: string }>('APPOINTMENTS', {
      constraints: [orderBy('createdAt', 'desc')],
    });

    return allResult.documents
      .map(toAppointment)
      .filter((appt) => {
        const raw = appt as unknown as Record<string, unknown>;
        const nested = (raw['appointment'] as Record<string, unknown> | undefined);
        const dateStr =
          (nested?.['confirmedDate'] as string | undefined) ??
          (nested?.['requestedDate'] as string | undefined) ??
          (raw['date'] as string | undefined);
        if (!dateStr) return false;
        const normalized = normalizeDateStr(dateStr);
        if (!normalized) return false;
        return normalized >= startStr && normalized <= endStr;
      });
  }

  async getById(id: string): Promise<AppointmentDocument | null> {
    const raw = await firestoreQueryService.getById<DocumentData & { id: string }>('APPOINTMENTS', id);
    if (!raw) return null;
    return toAppointment(raw);
  }
}
