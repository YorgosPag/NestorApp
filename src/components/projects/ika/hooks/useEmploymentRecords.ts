'use client';

/**
 * =============================================================================
 * useEmploymentRecords — Hook for CRUD operations on employment records
 * =============================================================================
 *
 * Manages monthly employment records in Firestore. Records contain calculated
 * stamps, contributions, and APD submission status.
 *
 * @module components/projects/ika/hooks/useEmploymentRecords
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 3)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { EmploymentRecord, ApdStatus, WorkerStampsSummary } from '../contracts';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('useEmploymentRecords');

/** Parameters for saving employment records in batch */
export interface SaveEmploymentRecordsParams {
  projectId: string;
  month: number;
  year: number;
  workerSummaries: WorkerStampsSummary[];
  createdBy: string;
}

interface UseEmploymentRecordsReturn {
  /** Employment records for the selected month */
  records: EmploymentRecord[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Save computed records to Firestore (batch) */
  saveRecords: (params: SaveEmploymentRecordsParams) => Promise<boolean>;
  /** Update a single record's APD status */
  updateApdStatus: (recordId: string, status: ApdStatus, referenceNumber?: string) => Promise<boolean>;
  /** Force refetch */
  refetch: () => void;
}

/**
 * Hook for managing employment records (Firestore CRUD).
 *
 * Records are queried by projectId + year + month using a composite index.
 * Batch save creates/updates all worker records for a month atomically.
 */
export function useEmploymentRecords(
  projectId: string | undefined,
  month: number,
  year: number
): UseEmploymentRecordsReturn {
  const [records, setRecords] = useState<EmploymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  // Fetch records for the selected month
  useEffect(() => {
    let mounted = true;

    async function fetchRecords() {
      if (!projectId) {
        setRecords([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const recordsQuery = query(
          collection(db, COLLECTIONS.EMPLOYMENT_RECORDS),
          where('projectId', '==', projectId),
          where('year', '==', year),
          where('month', '==', month)
        );

        const snapshot = await getDocs(recordsQuery);

        if (!mounted) return;

        const fetchedRecords: EmploymentRecord[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            projectId: data.projectId as string,
            contactId: data.contactId as string,
            month: data.month as number,
            year: data.year as number,
            totalDaysWorked: data.totalDaysWorked as number,
            totalHoursWorked: data.totalHoursWorked as number ?? 0,
            overtimeHours: data.overtimeHours as number ?? 0,
            insuranceClassNumber: data.insuranceClassNumber as number,
            stampsCount: data.stampsCount as number,
            dailyWage: data.dailyWage as number ?? 0,
            employerContribution: data.employerContribution as number,
            employeeContribution: data.employeeContribution as number,
            totalContribution: data.totalContribution as number,
            apdStatus: data.apdStatus as ApdStatus,
            apdSubmissionDate: data.apdSubmissionDate ?? null,
            apdReferenceNumber: data.apdReferenceNumber ?? null,
            createdAt: data.createdAt as string,
            updatedAt: data.updatedAt as string,
          };
        });

        setRecords(fetchedRecords);
      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'Failed to load employment records';
          setError(message);
          logger.error('[useEmploymentRecords] Error:', { error: message });
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchRecords();
    return () => { mounted = false; };
  }, [projectId, month, year, refreshKey]);

  // Batch save employment records for a month
  const saveRecords = useCallback(async (params: SaveEmploymentRecordsParams): Promise<boolean> => {
    try {
      const now = new Date().toISOString();
      const batch = writeBatch(db);
      const collRef = collection(db, COLLECTIONS.EMPLOYMENT_RECORDS);

      // Build a map of existing records by contactId for updates
      const existingMap = new Map<string, EmploymentRecord>();
      for (const record of records) {
        existingMap.set(record.contactId, record);
      }

      for (const ws of params.workerSummaries) {
        // Skip workers with issues (no insurance class)
        if (ws.hasIssues) continue;

        const existing = existingMap.get(ws.contactId);
        const recordData = {
          projectId: params.projectId,
          contactId: ws.contactId,
          month: params.month,
          year: params.year,
          totalDaysWorked: ws.daysWorked,
          totalHoursWorked: ws.daysWorked * 8,
          overtimeHours: 0,
          insuranceClassNumber: ws.insuranceClassNumber ?? 0,
          stampsCount: ws.stampsCount,
          dailyWage: ws.imputedDailyWage ?? 0,
          employerContribution: ws.employerContribution,
          employeeContribution: ws.employeeContribution,
          totalContribution: ws.totalContribution,
          apdStatus: 'pending' as ApdStatus,
          apdSubmissionDate: null,
          apdReferenceNumber: null,
          updatedAt: now,
        };

        if (existing) {
          // Update existing record (preserve APD status if already submitted)
          const updateData = {
            ...recordData,
            apdStatus: existing.apdStatus === 'pending' ? 'pending' : existing.apdStatus,
            apdSubmissionDate: existing.apdSubmissionDate,
            apdReferenceNumber: existing.apdReferenceNumber,
          };
          const recordRef = doc(db, COLLECTIONS.EMPLOYMENT_RECORDS, existing.id);
          batch.update(recordRef, updateData);
        } else {
          // Create new record
          const newRef = doc(collRef);
          batch.set(newRef, {
            ...recordData,
            createdAt: now,
          });
        }
      }

      await batch.commit();
      refetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save employment records';
      setError(message);
      logger.error('[useEmploymentRecords] Save error:', { error: message });
      return false;
    }
  }, [records, refetch]);

  // Update a single record's APD status
  const updateApdStatus = useCallback(async (
    recordId: string,
    status: ApdStatus,
    referenceNumber?: string
  ): Promise<boolean> => {
    try {
      const now = new Date().toISOString();
      const recordRef = doc(db, COLLECTIONS.EMPLOYMENT_RECORDS, recordId);

      const updateData: Record<string, unknown> = {
        apdStatus: status,
        updatedAt: now,
      };

      if (status === 'submitted') {
        updateData.apdSubmissionDate = now;
      }

      if (referenceNumber !== undefined) {
        updateData.apdReferenceNumber = referenceNumber;
      }

      await updateDoc(recordRef, updateData);
      refetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update APD status';
      setError(message);
      logger.error('[useEmploymentRecords] Update error:', { error: message });
      return false;
    }
  }, [refetch]);

  return { records, isLoading, error, saveRecords, updateApdStatus, refetch };
}
