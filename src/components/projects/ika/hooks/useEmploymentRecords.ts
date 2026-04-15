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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { useCompanyId } from '@/hooks/useCompanyId';
import type { EmploymentRecord, ApdStatus, WorkerStampsSummary } from '../contracts';
import { createModuleLogger } from '@/lib/telemetry';
import { createStaleCache } from '@/lib/stale-cache';
import {
  saveEmploymentRecordsWithPolicy,
  updateEmploymentRecordApdStatusWithPolicy,
} from '@/services/ika/ika-mutation-gateway';
const logger = createModuleLogger('useEmploymentRecords');

// ADR-300: Module-level cache — keyed by projectId+year+month, survives re-navigation
const employmentRecordsCache = createStaleCache<EmploymentRecord[]>('project-employment-records');

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
  const companyId = useCompanyId()?.companyId;
  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const cacheKey = `${projectId ?? 'none'}-${year}-${month}`;
  const [records, setRecords] = useState<EmploymentRecord[]>(employmentRecordsCache.get(cacheKey) ?? []);
  const [isLoading, setIsLoading] = useState(!employmentRecordsCache.hasLoaded(cacheKey));
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  // Fetch records for the selected month
  useEffect(() => {
    let mounted = true;

    async function fetchRecords() {
      if (!projectId || !companyId) {
        setRecords([]);
        setIsLoading(false);
        return;
      }

      const key = `${projectId}-${year}-${month}`;
      try {
        // ADR-300: Only show spinner on first load — not on re-navigation
        if (!employmentRecordsCache.hasLoaded(key)) setIsLoading(true);
        setError(null);

        const recordsQuery = query(
          collection(db, COLLECTIONS.EMPLOYMENT_RECORDS),
          where('companyId', '==', companyId),
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

        // ADR-300: Write to module-level cache so next remount skips spinner
        employmentRecordsCache.set(fetchedRecords, key);
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
  }, [projectId, companyId, month, year, refreshKey]);

  // Batch save employment records for a month (server-side — SPEC-255C)
  const saveRecords = useCallback(async (params: SaveEmploymentRecordsParams): Promise<boolean> => {
    try {
      await saveEmploymentRecordsWithPolicy({
        projectId: params.projectId,
        month: params.month,
        year: params.year,
        workerSummaries: params.workerSummaries,
      });

      refetch();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save employment records';
      setError(message);
      logger.error('[useEmploymentRecords] Save error:', { error: message });
      return false;
    }
  }, [refetch]);

  // Update a single record's APD status (server-side — SPEC-255C)
  const updateApdStatus = useCallback(async (
    recordId: string,
    status: ApdStatus,
    referenceNumber?: string
  ): Promise<boolean> => {
    try {
      await updateEmploymentRecordApdStatusWithPolicy(recordId, { status, referenceNumber });

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
