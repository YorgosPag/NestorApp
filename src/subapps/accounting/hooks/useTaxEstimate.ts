/**
 * @fileoverview Accounting Subapp — useTaxEstimate Hook
 * @description Client-side hook για εκτίμηση φόρου εισοδήματος (ετήσια)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 1.0.0
 * @see ADR-ACC-009 Tax Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { TaxEstimate } from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface UseTaxEstimateOptions {
  /** Φορολογικό έτος (υποχρεωτικό) */
  fiscalYear: number;
}

interface UseTaxEstimateReturn {
  /** Δεδομένα εκτίμησης φόρου */
  estimate: TaxEstimate | null;
  /** Κατάσταση φόρτωσης */
  loading: boolean;
  /** Μήνυμα σφάλματος */
  error: string | null;
  /** Ανανέωση δεδομένων */
  refetch: () => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useTaxEstimate(options: UseTaxEstimateOptions): UseTaxEstimateReturn {
  const { fiscalYear } = options;
  const { user } = useAuth();

  const [estimate, setEstimate] = useState<TaxEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const fetchTaxEstimate = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      params.set('fiscalYear', String(fiscalYear));

      const response = await fetch(`/api/accounting/tax/estimate?${params.toString()}`, { headers });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      const data: { success: boolean; data: TaxEstimate } = await response.json();
      setEstimate(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'accounting.errors.taxEstimateLoadFailed';
      setError(message);
      setEstimate(null);
    } finally {
      setLoading(false);
    }
  }, [user, fiscalYear, getAuthHeaders]);

  useEffect(() => {
    if (user) {
      fetchTaxEstimate();
    }
  }, [user, fetchTaxEstimate]);

  return {
    estimate,
    loading,
    error,
    refetch: fetchTaxEstimate,
  };
}
