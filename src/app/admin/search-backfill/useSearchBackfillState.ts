/**
 * 📄 USE SEARCH BACKFILL STATE — Hook for admin backfill page logic
 *
 * All state + handlers for search index backfill, contact migration,
 * parking FK migration, and parking re-seed operations.
 *
 * Extracted from page.tsx (Google SRP).
 * @enterprise ADR-029 - Global Search v1
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { getErrorMessage } from '@/lib/error-utils';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type {
  IndexStatus,
  BackfillResponse,
  MigrationResponse,
  ParkingFKMigrationResponse,
} from './search-backfill-types';

export function useSearchBackfillState() {
  // ── State ──
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isParkingMigrating, setIsParkingMigrating] = useState(false);
  const [isParkingReseeding, setIsParkingReseeding] = useState(false);
  const [result, setResult] = useState<BackfillResponse | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResponse | null>(null);
  const [parkingMigrationResult, setParkingMigrationResult] = useState<ParkingFKMigrationResponse | null>(null);
  const [parkingReseedResult, setParkingReseedResult] = useState<{ deleted: number; created: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // ── Logging ──

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('el-GR');
    setLogs((prev) => [...prev.slice(-29), `[${timestamp}] ${message}`]);
  }, []);

  // ── Fetch Status ──

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    addLog('Fetching index status...');

    try {
      const response = await apiClient.get<IndexStatus>(API_ROUTES.ADMIN.SEARCH_BACKFILL);
      setStatus(response);
      addLog(`Index has ${response.currentIndex.totalDocuments} documents`);
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to fetch status');
      setError(message);
      addLog(`Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [addLog]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ── Execute Backfill ──

  const executeBackfill = useCallback(async (dryRun: boolean) => {
    setIsExecuting(true);
    setError(null);
    setResult(null);

    const mode = dryRun ? 'DRY-RUN' : 'EXECUTE';
    addLog(`Starting ${mode}...`);

    try {
      const response = await apiClient.post<BackfillResponse>(
        API_ROUTES.ADMIN.SEARCH_BACKFILL,
        { dryRun },
        { timeout: 120000 },
      );
      setResult(response);
      addLog(`${mode} complete: ${response.totalStats.indexed} documents indexed`);
      if (!dryRun) await fetchStatus();
    } catch (err) {
      const message = getErrorMessage(err, 'Backfill failed');
      setError(message);
      addLog(`Error: ${message}`);
    } finally {
      setIsExecuting(false);
    }
  }, [addLog, fetchStatus]);

  // ── Contact Migration ──

  const executeMigration = useCallback(async (dryRun: boolean) => {
    setIsMigrating(true);
    setError(null);
    setMigrationResult(null);

    const mode = dryRun ? 'DRY-RUN' : 'EXECUTE';
    addLog(`Starting Contact Migration ${mode}...`);

    try {
      const { LEGACY_TENANT_COMPANY_ID: DEFAULT_COMPANY_ID } = await import('@/config/tenant');
      const response = await apiClient.patch<MigrationResponse>(
        API_ROUTES.ADMIN.SEARCH_BACKFILL,
        { dryRun, defaultCompanyId: DEFAULT_COMPANY_ID },
        { timeout: 120000 },
      );
      setMigrationResult(response);
      addLog(`${mode} complete: ${response.stats.migrated} contacts migrated`);
      if (!dryRun) await fetchStatus();
    } catch (err) {
      const message = getErrorMessage(err, 'Migration failed');
      setError(message);
      addLog(`Error: ${message}`);
    } finally {
      setIsMigrating(false);
    }
  }, [addLog, fetchStatus]);

  // ── Parking FK Migration ──

  const executeParkingMigration = useCallback(async (dryRun: boolean) => {
    setIsParkingMigrating(true);
    setError(null);
    setParkingMigrationResult(null);

    const mode = dryRun ? 'DRY-RUN' : 'EXECUTE';
    addLog(`Starting Parking FK Migration ${mode}...`);

    try {
      const response = await apiClient.patch<ParkingFKMigrationResponse>(
        API_ROUTES.ADMIN.SEED_PARKING,
        { dryRun },
      );
      setParkingMigrationResult(response);
      addLog(`${mode} complete: ${response.stats.migrated} parking spots migrated`);
      if (!dryRun) await fetchStatus();
    } catch (err) {
      const message = getErrorMessage(err, 'Parking FK Migration failed');
      setError(message);
      addLog(`Error: ${message}`);
    } finally {
      setIsParkingMigrating(false);
    }
  }, [addLog, fetchStatus]);

  // ── Parking Re-seed ──

  const executeParkingReseed = useCallback(async () => {
    setIsParkingReseeding(true);
    setError(null);
    setParkingReseedResult(null);

    addLog('Starting Parking Re-seed (DELETE + CREATE)...');

    try {
      addLog('Step 1: Deleting existing parking spots...');
      const deleteResponse = await apiClient.delete<{
        success: boolean;
        deleted: { count: number };
      }>(API_ROUTES.ADMIN.SEED_PARKING);
      addLog(`Deleted ${deleteResponse.deleted.count} parking spots`);

      addLog('Step 2: Creating new parking spots with correct IDs...');
      const createResponse = await apiClient.post<{
        success: boolean;
        created: { count: number };
      }>(API_ROUTES.ADMIN.SEED_PARKING, {});
      addLog(`Created ${createResponse.created.count} parking spots`);

      setParkingReseedResult({
        deleted: deleteResponse.deleted.count,
        created: createResponse.created.count,
      });
      addLog('Parking Re-seed complete! Run Search Backfill to index them.');
      await fetchStatus();
    } catch (err) {
      const message = getErrorMessage(err, 'Parking Re-seed failed');
      setError(message);
      addLog(`Error: ${message}`);
    } finally {
      setIsParkingReseeding(false);
    }
  }, [addLog, fetchStatus]);

  return {
    // Status
    status, isLoading, error, fetchStatus,
    // Backfill
    isExecuting, result, executeBackfill,
    // Contact migration
    isMigrating, migrationResult, executeMigration,
    // Parking FK migration
    isParkingMigrating, parkingMigrationResult, executeParkingMigration,
    // Parking re-seed
    isParkingReseeding, parkingReseedResult, executeParkingReseed,
    // Logs
    logs,
  };
}
