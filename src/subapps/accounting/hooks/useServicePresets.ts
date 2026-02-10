'use client';

/**
 * @fileoverview Accounting Subapp — useServicePresets Hook
 * @description Client-side hook για φόρτωση/αποθήκευση service presets (ADR-ACC-011)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 1.0.0
 * @see ADR-ACC-011 Service Presets
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { ServicePreset } from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface UseServicePresetsReturn {
  /** Λίστα active presets */
  presets: ServicePreset[];
  /** Κατάσταση φόρτωσης */
  loading: boolean;
  /** Κατάσταση αποθήκευσης */
  saving: boolean;
  /** Μήνυμα σφάλματος */
  error: string | null;
  /** Ανάκτηση presets από API */
  fetchPresets: () => Promise<void>;
  /** Αποθήκευση presets μέσω API — επιστρέφει true αν πέτυχε */
  savePresets: (presets: ServicePreset[]) => Promise<boolean>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useServicePresets(): UseServicePresetsReturn {
  const { user } = useAuth();

  const [presets, setPresets] = useState<ServicePreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const fetchPresets = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const headers = await getAuthHeaders();
      const response = await fetch('/api/accounting/setup/presets', { headers });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      const result: { success: boolean; data: ServicePreset[] } = await response.json();
      setPresets(result.data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch presets';
      setError(message);
      setPresets([]);
    } finally {
      setLoading(false);
    }
  }, [user, getAuthHeaders]);

  const savePresets = useCallback(
    async (updatedPresets: ServicePreset[]): Promise<boolean> => {
      if (!user) return false;

      try {
        setSaving(true);
        setError(null);

        const headers = await getAuthHeaders();
        const response = await fetch('/api/accounting/setup/presets', {
          method: 'PUT',
          headers,
          body: JSON.stringify(updatedPresets),
        });

        if (!response.ok) {
          const errorData: { error?: string } = await response.json();
          throw new Error(errorData.error ?? `HTTP ${response.status}`);
        }

        // Refetch to sync
        await fetchPresets();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save presets';
        setError(message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [user, getAuthHeaders, fetchPresets],
  );

  // Auto-fetch on mount when user is available
  useEffect(() => {
    if (user) {
      fetchPresets();
    }
  }, [user, fetchPresets]);

  return {
    presets,
    loading,
    saving,
    error,
    fetchPresets,
    savePresets,
  };
}
