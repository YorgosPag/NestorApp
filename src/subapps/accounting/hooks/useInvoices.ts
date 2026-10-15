/**
 * @fileoverview Accounting Subapp — useInvoices Hook
 * @description Η ΣΕΛΙΔΑ τιμολογίων με δρομέα (ADR-ACC-010 §2.1.1 Φάση 3β) πάνω στο κοινό `useCursorPagedList`.
 *   Αντικαθιστά το fetch που ζούσε μέσα στο `InvoicesPageContent` (ίδιο αντίγραφο με τα άλλα τρία hooks λίστας).
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-10-15
 * @see ADR-ACC-002 Invoicing
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCursorPagedList, type CachedFirstPage, type UseCursorPagedListReturn } from '@/hooks/useCursorPagedList';
import { API_ROUTES } from '@/config/domain-constants';
import { createStaleCache } from '@/lib/stale-cache';
import type { Invoice, InvoicePaymentStatus, InvoiceType } from '@/subapps/accounting/types';

// ADR-300: Module-level cache — survives React unmount/remount (navigation)
const invoicesCache = createStaleCache<CachedFirstPage<Invoice>>('accounting-invoices');

interface UseInvoicesOptions {
  /** Φορολογικό έτος — η οθόνη τιμολογίων ζητά πάντα έτος (δηλωμένοι συνδυασμοί στο `INVOICE_LIST`). */
  fiscalYear: number;
  type?: InvoiceType;
  paymentStatus?: InvoicePaymentStatus;
}

export function useInvoices(options: UseInvoicesOptions): UseCursorPagedListReturn<Invoice> {
  const { fiscalYear, type, paymentStatus } = options;
  const { user } = useAuth();
  const params = useMemo(() => ({ fiscalYear, type, paymentStatus }), [fiscalYear, type, paymentStatus]);

  return useCursorPagedList<Invoice>({
    url: API_ROUTES.ACCOUNTING.INVOICES.LIST,
    params,
    enabled: user !== null,
    cache: invoicesCache,
  });
}
