/**
 * =============================================================================
 * RESTORE STATE HOOK — ADR-313 Admin UI
 * =============================================================================
 *
 * Manages restore preview, execution, and restore status polling.
 *
 * @module components/admin/backup/useRestoreState
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { getErrorMessage } from '@/lib/error-utils';

import type {
  RestorePreview,
  RestoreStatus,
  RestoreOptions,
} from '@/services/backup/backup-manifest.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RestorePreviewResponse {
  success: boolean;
  preview: RestorePreview;
}

interface RestoreExecuteResponse {
  success: boolean;
  restoreId: string;
  backupId: string;
  documentsRestored: number;
  documentsSkipped: number;
  storageRestored: number;
  storageSkipped: number;
  snapshotId: string;
  durationMs: number;
}

interface RestoreStatusResponse {
  success: boolean;
  status: RestoreStatus | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 3000;

const TERMINAL_PHASES = new Set(['completed', 'failed']);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRestoreState() {
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [restoreOptions, setRestoreOptions] = useState<RestoreOptions>({
    skipImmutable: true,
    mergeMode: true,
  });
  const [restoreStatus, setRestoreStatus] = useState<RestoreStatus | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Polling ────────────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async () => {
    try {
      const response = await apiClient.get<RestoreStatusResponse>(
        API_ROUTES.ADMIN.RESTORE.STATUS,
      );
      const status = response.status;
      setRestoreStatus(status);

      if (status && TERMINAL_PHASES.has(status.phase)) {
        stopPolling();
        setIsRestoring(false);

        if (status.phase === 'completed') {
          setLastResult(
            `Restore completed — ${status.documentsRestored} restored, ${status.documentsSkipped} skipped`,
          );
        } else {
          setError(status.error ?? 'Restore failed');
        }
      }
    } catch {
      // Skip tick on polling failure
    }
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollingRef.current = setInterval(pollStatus, POLL_INTERVAL_MS);
    pollStatus();
  }, [stopPolling, pollStatus]);

  // ── Fetch preview ──────────────────────────────────────────────────────

  const fetchPreview = useCallback(async (backupId: string) => {
    setIsPreviewLoading(true);
    setError(null);
    setPreview(null);

    try {
      const response = await apiClient.post<RestorePreviewResponse>(
        API_ROUTES.ADMIN.RESTORE.PREVIEW,
        { backupId, options: restoreOptions },
        { timeout: 120000 },
      );
      setPreview(response.preview);
      setSelectedBackupId(backupId);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load restore preview'));
    } finally {
      setIsPreviewLoading(false);
    }
  }, [restoreOptions]);

  // ── Execute restore ────────────────────────────────────────────────────

  const executeRestore = useCallback(async (backupId: string) => {
    setIsRestoring(true);
    setError(null);
    setLastResult(null);

    try {
      await apiClient.post<RestoreExecuteResponse>(
        API_ROUTES.ADMIN.RESTORE.EXECUTE,
        { backupId, options: restoreOptions },
        { timeout: 300000 },
      );
      startPolling();
    } catch (err) {
      setError(getErrorMessage(err, 'Restore failed'));
      setIsRestoring(false);
    }
  }, [restoreOptions, startPolling]);

  // ── Cleanup ────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return {
    selectedBackupId,
    setSelectedBackupId,
    preview,
    restoreOptions,
    setRestoreOptions,
    restoreStatus,
    isPreviewLoading,
    isRestoring,
    error,
    lastResult,
    fetchPreview,
    executeRestore,
    clearError: () => setError(null),
    clearPreview: () => setPreview(null),
  };
}
