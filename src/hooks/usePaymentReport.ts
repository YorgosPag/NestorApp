/**
 * 🏢 usePaymentReport — ADR-234 Phase 5
 *
 * Hook for fetching payment report data and triggering Excel export.
 *
 * @module hooks/usePaymentReport
 */

'use client';

import { useState, useCallback } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { getErrorMessage } from '@/lib/error-utils';
import type { PaymentReportData } from '@/services/payment-export/types';

interface UsePaymentReportReturn {
  report: PaymentReportData | null;
  isLoading: boolean;
  error: string | null;
  fetchReport: () => Promise<void>;
  exportToExcel: () => Promise<void>;
}

export function usePaymentReport(projectId: string): UsePaymentReportReturn {
  const [report, setReport] = useState<PaymentReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!projectId) {
      setError('Δεν βρέθηκε project ID');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ROUTES.PROJECTS.PAYMENT_REPORT(projectId));
      const json = await response.json();

      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? 'Σφάλμα κατά τη φόρτωση αναφοράς');
      }

      setReport(json.data);
    } catch (err) {
      const message = getErrorMessage(err, 'Άγνωστο σφάλμα');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const exportToExcel = useCallback(async () => {
    if (!report) {
      setError('Δεν υπάρχουν δεδομένα για εξαγωγή');
      return;
    }

    try {
      // Dynamic import to avoid bundling ExcelJS on page load
      const { exportPaymentReportToExcel } = await import(
        '@/services/payment-export/payment-excel-exporter'
      );
      await exportPaymentReportToExcel(report);
    } catch (err) {
      const message = getErrorMessage(err, 'Σφάλμα εξαγωγής');
      setError(message);
    }
  }, [report]);

  return { report, isLoading, error, fetchReport, exportToExcel };
}
