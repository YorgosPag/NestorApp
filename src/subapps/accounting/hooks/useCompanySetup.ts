/**
 * @fileoverview Accounting Subapp — useCompanySetup Hook
 * @description Client-side hook για φόρτωση/αποθήκευση ρυθμίσεων επιχείρησης (M-001)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-000 §2 Company Data
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { CompanyProfile, CompanySetupInput } from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface UseCompanySetupReturn {
  /** Φορτωμένο προφίλ (null αν δεν υπάρχει ακόμα) */
  profile: CompanyProfile | null;
  /** Κατάσταση φόρτωσης */
  loading: boolean;
  /** Κατάσταση αποθήκευσης */
  saving: boolean;
  /** Μήνυμα σφάλματος */
  error: string | null;
  /** Ανάκτηση setup από API */
  fetchSetup: () => Promise<void>;
  /** Αποθήκευση setup μέσω API — επιστρέφει true αν πέτυχε */
  saveSetup: (data: CompanySetupInput) => Promise<boolean>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useCompanySetup(): UseCompanySetupReturn {
  const { user } = useAuth();

  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const fetchSetup = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const headers = await getAuthHeaders();
      const response = await fetch('/api/accounting/setup', { headers });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      const result: { success: boolean; data: CompanyProfile | null } = await response.json();
      setProfile(result.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'accounting.errors.setupLoadFailed';
      setError(message);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [user, getAuthHeaders]);

  const saveSetup = useCallback(
    async (data: CompanySetupInput): Promise<boolean> => {
      if (!user) return false;

      try {
        setSaving(true);
        setError(null);

        const headers = await getAuthHeaders();
        const response = await fetch('/api/accounting/setup', {
          method: 'PUT',
          headers,
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData: { error?: string } = await response.json();
          throw new Error(errorData.error ?? `HTTP ${response.status}`);
        }

        // Refetch to get the updated profile with server timestamps
        await fetchSetup();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'accounting.errors.setupSaveFailed';
        setError(message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [user, getAuthHeaders, fetchSetup],
  );

  // Auto-fetch on mount when user is available
  useEffect(() => {
    if (user) {
      fetchSetup();
    }
  }, [user, fetchSetup]);

  return {
    profile,
    loading,
    saving,
    error,
    fetchSetup,
    saveSetup,
  };
}
