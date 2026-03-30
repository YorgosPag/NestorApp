/**
 * @fileoverview Accounting Subapp — useReportsDashboard Hook (Phase 2e)
 * @description Fetches key metrics for all 8 report types in parallel
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md §2e (Q12 — dashboard tiles)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { API_ROUTES } from '@/config/domain-constants';
import type {
  ReportType,
  ReportDateFilter,
  ReportResult,
  ReportDataMap,
  ChangeMetric,
} from '@/subapps/accounting/types';
import { extractKeyMetric } from '../services/export/report-table-adapter';

// ============================================================================
// CONSTANTS
// ============================================================================

const ALL_REPORT_TYPES: readonly ReportType[] = [
  'profit_and_loss',
  'trial_balance',
  'ar_aging',
  'tax_summary',
  'bank_reconciliation',
  'cash_flow',
  'income_by_customer',
  'expense_by_category',
] as const;

// ============================================================================
// TYPES
// ============================================================================

export interface ReportSummary {
  type: ReportType;
  keyMetric: number;
  metricLabel: string;
  change: ChangeMetric | null;
  format: 'currency' | 'percentage' | 'number';
}

interface ReportError {
  type: ReportType;
  error: string;
}

interface UseReportsDashboardReturn {
  summaries: ReportSummary[];
  loading: boolean;
  errors: ReportError[];
  refetch: () => Promise<void>;
}

// ============================================================================
// HELPERS
// ============================================================================

function buildUrl(type: ReportType, filter: ReportDateFilter): string {
  const params = new URLSearchParams();
  params.set('preset', filter.preset);
  if (filter.preset === 'custom') {
    if (filter.customFrom) params.set('from', filter.customFrom);
    if (filter.customTo) params.set('to', filter.customTo);
  }
  return `${API_ROUTES.ACCOUNTING.REPORTS}/${type}?${params.toString()}`;
}

async function fetchSingleReport(
  type: ReportType,
  filter: ReportDateFilter,
  token: string,
  signal: AbortSignal
): Promise<{ type: ReportType; data: ReportDataMap[ReportType] }> {
  const url = buildUrl(type, filter);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal,
  });

  if (!response.ok) {
    const errorData: { error?: string } = await response.json();
    throw new Error(errorData.error ?? `HTTP ${response.status}`);
  }

  const result: { success: boolean; data: ReportResult<ReportDataMap[ReportType]> } =
    await response.json();
  return { type, data: result.data.data };
}

// ============================================================================
// HOOK
// ============================================================================

export function useReportsDashboard(dateFilter: ReportDateFilter): UseReportsDashboardReturn {
  const { user } = useAuth();

  const [summaries, setSummaries] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ReportError[]>([]);

  const fetchAll = useCallback(async (signal?: AbortSignal): Promise<void> => {
    if (!user) return;

    try {
      setLoading(true);
      setErrors([]);

      const token = await user.getIdToken();
      const results = await Promise.allSettled(
        ALL_REPORT_TYPES.map((type) =>
          fetchSingleReport(type, dateFilter, token, signal ?? new AbortController().signal)
        )
      );

      const newSummaries: ReportSummary[] = [];
      const newErrors: ReportError[] = [];

      results.forEach((result, index) => {
        const type = ALL_REPORT_TYPES[index];
        if (result.status === 'fulfilled') {
          const metric = extractKeyMetric(type, result.value.data);
          newSummaries.push({
            type,
            keyMetric: metric.value,
            metricLabel: metric.label,
            change: metric.change,
            format: metric.format,
          });
        } else {
          const errorMsg = result.reason instanceof Error
            ? result.reason.message
            : 'Unknown error';
          // Don't track abort errors
          if (!(result.reason instanceof DOMException && result.reason.name === 'AbortError')) {
            newErrors.push({ type, error: errorMsg });
          }
        }
      });

      setSummaries(newSummaries);
      setErrors(newErrors);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setErrors([{ type: 'profit_and_loss', error: 'Failed to fetch reports' }]);
    } finally {
      setLoading(false);
    }
  }, [user, dateFilter]);

  useEffect(() => {
    if (!user) return;

    const controller = new AbortController();
    fetchAll(controller.signal);
    return () => controller.abort();
  }, [user, fetchAll]);

  return { summaries, loading, errors, refetch: fetchAll };
}
