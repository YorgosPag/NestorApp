/**
 * @fileoverview Accounting Subapp — useInvoices Hook
 * @description Client-side hook για λίστα τιμολογίων με φίλτρα, δημιουργία, και refetch
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-002 Invoicing System
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type {
  Invoice,
  InvoiceType,
  CreateInvoiceInput,
} from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface UseInvoicesOptions {
  /** Φορολογικό έτος */
  fiscalYear?: number;
  /** Τύπος παραστατικού */
  type?: InvoiceType;
  /** Κατάσταση πληρωμής */
  paymentStatus?: 'unpaid' | 'partial' | 'paid';
  /** Φίλτρο πελάτη */
  customerId?: string;
  /** Φίλτρο project */
  projectId?: string;
  /** Αυτόματο fetch κατά το mount (default: true) */
  autoFetch?: boolean;
}

interface UseInvoicesReturn {
  /** Λίστα τιμολογίων */
  invoices: Invoice[];
  /** Κατάσταση φόρτωσης */
  loading: boolean;
  /** Μήνυμα σφάλματος */
  error: string | null;
  /** Ανανέωση δεδομένων */
  refetch: () => Promise<void>;
  /** Δημιουργία νέου τιμολογίου */
  createInvoice: (data: CreateInvoiceInput) => Promise<{ id: string; number: number } | null>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useInvoices(options: UseInvoicesOptions = {}): UseInvoicesReturn {
  const { fiscalYear, type, paymentStatus, customerId, projectId, autoFetch = true } = options;
  const { user } = useAuth();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
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
    if (type) params.set('type', type);
    if (paymentStatus) params.set('paymentStatus', paymentStatus);
    if (customerId) params.set('customerId', customerId);
    if (projectId) params.set('projectId', projectId);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [fiscalYear, type, paymentStatus, customerId, projectId]);

  const fetchInvoices = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const headers = await getAuthHeaders();
      const queryString = buildQueryString();
      const response = await fetch(`/api/accounting/invoices${queryString}`, { headers });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      const data: { invoices: Invoice[] } = await response.json();
      setInvoices(data.invoices);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'accounting.errors.invoicesLoadFailed';
      setError(message);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [user, getAuthHeaders, buildQueryString]);

  const createInvoice = useCallback(
    async (data: CreateInvoiceInput): Promise<{ id: string; number: number } | null> => {
      if (!user) return null;

      try {
        setError(null);
        const headers = await getAuthHeaders();
        const response = await fetch('/api/accounting/invoices', {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData: { error?: string } = await response.json();
          throw new Error(errorData.error ?? `HTTP ${response.status}`);
        }

        const result: { id: string; number: number } = await response.json();
        await fetchInvoices();
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'accounting.errors.invoiceCreateFailed';
        setError(message);
        return null;
      }
    },
    [user, getAuthHeaders, fetchInvoices],
  );

  useEffect(() => {
    if (autoFetch && user) {
      fetchInvoices();
    }
  }, [autoFetch, user, fetchInvoices]);

  return {
    invoices,
    loading,
    error,
    refetch: fetchInvoices,
    createInvoice,
  };
}
