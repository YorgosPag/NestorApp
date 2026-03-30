/**
 * @fileoverview Accounting Subapp — useReport Hook (Phase 2e)
 * @description Fetches a single financial report by type with date filter
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md §2e
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
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
} from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface UseReportOptions {
  /** Report type to fetch */
  type: ReportType;
  /** Date filter (preset or custom range) */
  dateFilter: ReportDateFilter;
  /** Auto-fetch on mount/filter change (default: true) */
  autoFetch?: boolean;
}

interface UseReportReturn {
  /** Report result with period + data */
  report: ReportResult<ReportDataMap[ReportType]> | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Manual refetch */
  refetch: () => Promise<void>;
}

// ============================================================================
// HELPERS
// ============================================================================

function buildReportUrl(type: ReportType, filter: ReportDateFilter): string {
  const params = new URLSearchParams();
  params.set('preset', filter.preset);
  if (filter.preset === 'custom') {
    if (filter.customFrom) params.set('from', filter.customFrom);
    if (filter.customTo) params.set('to', filter.customTo);
  }
  return `${API_ROUTES.ACCOUNTING.REPORTS}/${type}?${params.toString()}`;
}

// ============================================================================
// HOOK
// ============================================================================

export function useReport(options: UseReportOptions): UseReportReturn {
  const { type, dateFilter, autoFetch = true } = options;
  const { user } = useAuth();

  const [report, setReport] = useState<ReportResult<ReportDataMap[ReportType]> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async (signal?: AbortSignal): Promise<void> => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const token = await user.getIdToken();
      const url = buildReportUrl(type, dateFilter);
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
      setReport(result.data);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Failed to load report';
      setError(message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [user, type, dateFilter]);

  useEffect(() => {
    if (!autoFetch || !user) return;

    const controller = new AbortController();
    fetchReport(controller.signal);
    return () => controller.abort();
  }, [autoFetch, user, fetchReport]);

  return { report, loading, error, refetch: fetchReport };
}
