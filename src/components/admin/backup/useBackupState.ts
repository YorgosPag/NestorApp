/**
 * =============================================================================
 * BACKUP STATE HOOK — ADR-313 Admin UI
 * =============================================================================
 *
 * Manages backup list, trigger full/incremental, and status polling.
 * Follows useSearchBackfillState pattern: useState + useCallback + useEffect.
 *
 * @module components/admin/backup/useBackupState
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { getErrorMessage } from '@/lib/error-utils';

import type { BackupManifest, BackupStatus } from '@/services/backup/backup-manifest.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BackupListResponse {
  success: boolean;
  backups: BackupManifest[];
  total: number;
  skipped: number;
}

interface BackupTriggerResponse {
  success: boolean;
  backupId: string;
  totalDocuments: number;
  totalCollections: number;
  totalSubcollections: number;
  totalStorageFiles: number;
  totalStorageBytes: number;
  durationMs: number;
  bucket: string;
}

interface IncrementalTriggerResponse {
  success: boolean;
  backupId: string;
  type: 'incremental';
  parentBackupId: string;
  deltaFrom: string;
  totalDocuments: number;
  collectionsAffected: number;
  durationMs: number;
  warnings: string[];
  bucket: string;
}

interface BackupStatusResponse {
  success: boolean;
  status: BackupStatus | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 3000;

const TERMINAL_PHASES = new Set(['completed', 'failed']);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBackupState() {
  const [backups, setBackups] = useState<BackupManifest[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch backup list ──────────────────────────────────────────────────

  const fetchBackups = useCallback(async () => {
    setIsLoadingList(true);
    setError(null);

    try {
      const response = await apiClient.get<BackupListResponse>(
        API_ROUTES.ADMIN.BACKUP.LIST,
      );
      setBackups(response.backups);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load backup list'));
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  // ── Poll backup status ─────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async () => {
    try {
      const response = await apiClient.get<BackupStatusResponse>(
        API_ROUTES.ADMIN.BACKUP.STATUS,
      );
      const status = response.status;
      setBackupStatus(status);

      if (status && TERMINAL_PHASES.has(status.phase)) {
        stopPolling();
        setIsBackingUp(false);

        if (status.phase === 'completed') {
          setLastResult(`Backup ${status.backupId} completed — ${status.documentsExported} documents`);
          // Refresh list to include new backup
          fetchBackups();
        } else {
          setError(status.error ?? 'Backup failed');
        }
      }
    } catch {
      // Polling failure — don't stop, just skip this tick
    }
  }, [stopPolling, fetchBackups]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollingRef.current = setInterval(pollStatus, POLL_INTERVAL_MS);
    // Immediate first poll
    pollStatus();
  }, [stopPolling, pollStatus]);

  // ── Trigger full backup ────────────────────────────────────────────────

  const triggerFullBackup = useCallback(async () => {
    setIsBackingUp(true);
    setError(null);
    setLastResult(null);

    try {
      await apiClient.post<BackupTriggerResponse>(
        API_ROUTES.ADMIN.BACKUP.FULL,
        {},
        { timeout: 300000 }, // 5 min timeout for large backups
      );
      // Backup will run async — start polling for status
      startPolling();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to trigger full backup'));
      setIsBackingUp(false);
    }
  }, [startPolling]);

  // ── Trigger incremental backup ─────────────────────────────────────────

  const triggerIncrementalBackup = useCallback(async (parentBackupId: string) => {
    setIsBackingUp(true);
    setError(null);
    setLastResult(null);

    try {
      await apiClient.post<IncrementalTriggerResponse>(
        API_ROUTES.ADMIN.BACKUP.INCREMENTAL,
        { parentBackupId },
        { timeout: 300000 },
      );
      startPolling();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to trigger incremental backup'));
      setIsBackingUp(false);
    }
  }, [startPolling]);

  // ── Initial fetch + cleanup ────────────────────────────────────────────

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return {
    backups,
    isLoadingList,
    isBackingUp,
    backupStatus,
    error,
    lastResult,
    fetchBackups,
    triggerFullBackup,
    triggerIncrementalBackup,
    clearError: () => setError(null),
  };
}
