/**
 * @fileoverview Accounting Subapp — useVATSummary Hook
 * @description Client-side hook για σύνοψη ΦΠΑ (τριμηνιαία ή ετήσια)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-004 VAT Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type {
  FiscalQuarter,
  VATQuarterSummary,
  VATAnnualSummary,
} from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface UseVATSummaryOptions {
  /** Φορολογικό έτος (υποχρεωτικό) */
  fiscalYear: number;
  /** Τρίμηνο — αν παρέχεται, επιστρέφει τριμηνιαία σύνοψη, αλλιώς ετήσια */
  quarter?: FiscalQuarter;
}

/** Discriminated union για το αποτέλεσμα — τριμηνιαία ή ετήσια */
type VATSummaryData = VATQuarterSummary | VATAnnualSummary;

interface UseVATSummaryReturn {
  /** Δεδομένα σύνοψης ΦΠΑ */
  summary: VATSummaryData | null;
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

export function useVATSummary(options: UseVATSummaryOptions): UseVATSummaryReturn {
  const { fiscalYear, quarter } = options;
  const { user } = useAuth();

  const [summary, setSummary] = useState<VATSummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const fetchVATSummary = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      params.set('fiscalYear', String(fiscalYear));
      if (quarter !== undefined) params.set('quarter', String(quarter));

      const response = await fetch(`/api/accounting/vat/summary?${params.toString()}`, { headers });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      const data: { summary: VATSummaryData } = await response.json();
      setSummary(data.summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'accounting.errors.vatSummaryLoadFailed';
      setError(message);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [user, fiscalYear, quarter, getAuthHeaders]);

  useEffect(() => {
    if (user) {
      fetchVATSummary();
    }
  }, [user, fetchVATSummary]);

  return {
    summary,
    loading,
    error,
    refetch: fetchVATSummary,
  };
}
