/**
 * @fileoverview Accounting Subapp — useAPYCertificates Hook
 * @description Client-side hook για λίστα βεβαιώσεων παρακράτησης φόρου με φίλτρα, δημιουργία, και refetch.
 *   Ίδιο pattern με useInvoices.ts (ADR-ACC-002).
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-17
 * @see ADR-ACC-020 Βεβαίωση Παρακράτησης Φόρου
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { API_ROUTES } from '@/config/domain-constants';
import type { APYCertificate } from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface UseAPYCertificatesOptions {
  /** Φορολογικό έτος (optional — αν δεν οριστεί, φέρνει όλα) */
  fiscalYear?: number;
  /** Φίλτρο contact ID (optional) */
  customerId?: string;
  /** Αυτόματο fetch κατά το mount (default: true) */
  autoFetch?: boolean;
}

interface CreateAPYCertificateInput {
  fiscalYear: number;
  customerId: string | null;
  provider: APYCertificate['provider'];
  customer: APYCertificate['customer'];
  lineItems: APYCertificate['lineItems'];
  totalNetAmount: number;
  totalWithholdingAmount: number;
  notes?: string | null;
}

interface UseAPYCertificatesReturn {
  /** Λίστα βεβαιώσεων */
  certificates: APYCertificate[];
  /** Κατάσταση φόρτωσης */
  loading: boolean;
  /** Μήνυμα σφάλματος */
  error: string | null;
  /** Ανανέωση δεδομένων */
  refetch: () => Promise<void>;
  /** Δημιουργία νέας βεβαίωσης */
  createCertificate: (
    data: CreateAPYCertificateInput
  ) => Promise<{ id: string } | { existingCertificateId: string } | null>;
  /** Ενημέρωση βεβαίωσης (isReceived, receivedAt, notes) */
  updateCertificate: (
    certificateId: string,
    updates: Pick<Partial<APYCertificate>, 'isReceived' | 'receivedAt' | 'notes'>
  ) => Promise<boolean>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useAPYCertificates(
  options: UseAPYCertificatesOptions = {}
): UseAPYCertificatesReturn {
  const { fiscalYear, customerId, autoFetch = true } = options;
  const { user } = useAuth();

  const [certificates, setCertificates] = useState<APYCertificate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const buildQueryString = useCallback((): string => {
    const params = new URLSearchParams();
    if (fiscalYear !== undefined) params.set('fiscalYear', String(fiscalYear));
    if (customerId) params.set('customerId', customerId);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [fiscalYear, customerId]);

  const fetchCertificates = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const headers = await getAuthHeaders();
      const queryString = buildQueryString();
      const response = await fetch(`${API_ROUTES.ACCOUNTING.APY_CERTIFICATES.LIST}${queryString}`, { headers });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      const data: { data: APYCertificate[] } = await response.json();
      setCertificates(data.data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load APY certificates';
      setError(message);
      setCertificates([]);
    } finally {
      setLoading(false);
    }
  }, [user, getAuthHeaders, buildQueryString]);

  const createCertificate = useCallback(
    async (
      data: CreateAPYCertificateInput
    ): Promise<{ id: string } | { existingCertificateId: string } | null> => {
      if (!user) return null;

      try {
        setError(null);
        const headers = await getAuthHeaders();
        const response = await fetch(API_ROUTES.ACCOUNTING.APY_CERTIFICATES.LIST, {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
        });

        if (response.status === 409) {
          // Duplicate — return existing certificate ID for navigation
          const errorData: { existingCertificateId?: string } = await response.json();
          return { existingCertificateId: errorData.existingCertificateId ?? '' };
        }

        if (!response.ok) {
          const errorData: { error?: string } = await response.json();
          throw new Error(errorData.error ?? `HTTP ${response.status}`);
        }

        const result: { data: { id: string } } = await response.json();
        await fetchCertificates();
        return { id: result.data.id };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create APY certificate';
        setError(message);
        return null;
      }
    },
    [user, getAuthHeaders, fetchCertificates]
  );

  const updateCertificate = useCallback(
    async (
      certificateId: string,
      updates: Pick<Partial<APYCertificate>, 'isReceived' | 'receivedAt' | 'notes'>
    ): Promise<boolean> => {
      if (!user) return false;

      try {
        setError(null);
        const headers = await getAuthHeaders();
        const response = await fetch(API_ROUTES.ACCOUNTING.APY_CERTIFICATES.BY_ID(certificateId), {
          method: 'PATCH',
          headers,
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const errorData: { error?: string } = await response.json();
          throw new Error(errorData.error ?? `HTTP ${response.status}`);
        }

        await fetchCertificates();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update APY certificate';
        setError(message);
        return false;
      }
    },
    [user, getAuthHeaders, fetchCertificates]
  );

  useEffect(() => {
    if (autoFetch && user) {
      fetchCertificates();
    }
  }, [autoFetch, user, fetchCertificates]);

  return {
    certificates,
    loading,
    error,
    refetch: fetchCertificates,
    createCertificate,
    updateCertificate,
  };
}
