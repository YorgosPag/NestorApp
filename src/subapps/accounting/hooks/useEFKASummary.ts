/**
 * @fileoverview Accounting Subapp — useEFKASummary Hook
 * @description Client-side hook για ετήσια σύνοψη εισφορών ΕΦΚΑ
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-006 EFKA Contributions
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { EFKAAnnualSummary, PartnershipEFKASummary, EntityType } from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface UseEFKASummaryOptions {
  /** Φορολογικό έτος (υποχρεωτικό) */
  year: number;
}

interface UseEFKASummaryReturn {
  /** Ετήσια σύνοψη ΕΦΚΑ (sole_proprietor) */
  summary: EFKAAnnualSummary | null;
  /** Σύνοψη ΕΦΚΑ ΟΕ (oe) */
  partnershipSummary: PartnershipEFKASummary | null;
  /** Τύπος νομικής μορφής */
  entityType: EntityType | null;
  /** Κατάσταση φόρτωσης */
  loading: boolean;
  /** Μήνυμα σφάλματος */
  error: string | null;
  /** Ανανέωση δεδομένων */
  refetch: () => Promise<void>;
}

/** API response discriminated by entityType */
interface EFKASummaryApiResponse {
  success: boolean;
  entityType: EntityType;
  data: EFKAAnnualSummary | PartnershipEFKASummary;
}

// ============================================================================
// HOOK
// ============================================================================

export function useEFKASummary(options: UseEFKASummaryOptions): UseEFKASummaryReturn {
  const { year } = options;
  const { user } = useAuth();

  const [summary, setSummary] = useState<EFKAAnnualSummary | null>(null);
  const [partnershipSummary, setPartnershipSummary] = useState<PartnershipEFKASummary | null>(null);
  const [entityType, setEntityType] = useState<EntityType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const fetchEFKASummary = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      params.set('year', String(year));

      const response = await fetch(`/api/accounting/efka/summary?${params.toString()}`, { headers });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      const result: EFKASummaryApiResponse = await response.json();
      setEntityType(result.entityType);

      if (result.entityType === 'oe') {
        setPartnershipSummary(result.data as PartnershipEFKASummary);
        setSummary(null);
      } else {
        setSummary(result.data as EFKAAnnualSummary);
        setPartnershipSummary(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'accounting.errors.efkaSummaryLoadFailed';
      setError(message);
      setSummary(null);
      setPartnershipSummary(null);
    } finally {
      setLoading(false);
    }
  }, [user, year, getAuthHeaders]);

  useEffect(() => {
    if (user) {
      fetchEFKASummary();
    }
  }, [user, fetchEFKASummary]);

  return {
    summary,
    partnershipSummary,
    entityType,
    loading,
    error,
    refetch: fetchEFKASummary,
  };
}
