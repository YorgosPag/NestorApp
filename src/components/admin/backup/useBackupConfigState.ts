/**
 * =============================================================================
 * BACKUP CONFIG STATE HOOK — ADR-313 Admin UI
 * =============================================================================
 *
 * Manages backup configuration (scheduler, retention) CRUD.
 *
 * @module components/admin/backup/useBackupConfigState
 */

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { getErrorMessage } from '@/lib/error-utils';

import type { BackupConfig } from '@/services/backup/backup-manifest.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConfigResponse {
  success: boolean;
  config: BackupConfig;
}

/** Subset of BackupConfig fields editable via UI */
export interface EditableBackupConfig {
  scheduleEnabled: boolean;
  scheduleCron: string;
  retentionCount: number;
  incrementalEnabled: boolean;
  fullBackupIntervalDays: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBackupConfigState() {
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // ── Fetch config ───────────────────────────────────────────────────────

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<ConfigResponse>(
        API_ROUTES.ADMIN.BACKUP.CONFIG,
      );
      setConfig(response.config);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load configuration'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Save config ────────────────────────────────────────────────────────

  const saveConfig = useCallback(async (updates: Partial<EditableBackupConfig>) => {
    setIsSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await apiClient.post<ConfigResponse>(
        API_ROUTES.ADMIN.BACKUP.CONFIG,
        updates,
      );
      setConfig(response.config);
      setSaved(true);
      // Auto-clear saved indicator after 3s
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save configuration'));
    } finally {
      setIsSaving(false);
    }
  }, []);

  // ── Initial fetch ──────────────────────────────────────────────────────

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    config,
    isLoading,
    isSaving,
    saved,
    error,
    fetchConfig,
    saveConfig,
    clearError: () => setError(null),
  };
}
