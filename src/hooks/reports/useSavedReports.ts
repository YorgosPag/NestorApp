/**
 * @module hooks/reports/useSavedReports
 * @enterprise ADR-268 Phase 7 — Saved Reports CRUD Hook
 *
 * Client-side hook for saved reports API operations.
 * Manages list state, tab/search filtering, and CRUD with optimistic updates.
 * Pattern: Salesforce saved views + QuickBooks memorized reports.
 */

'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { getErrorMessage } from '@/lib/error-utils';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  SavedReport,
  CreateSavedReportInput,
  UpdateSavedReportInput,
  SavedReportsTab,
} from '@/types/reports/saved-report';

// ============================================================================
// Types
// ============================================================================

export interface UseSavedReportsReturn {
  reports: SavedReport[];
  loading: boolean;
  error: string | null;
  fetchReports: () => Promise<void>;
  createReport: (input: CreateSavedReportInput) => Promise<SavedReport>;
  updateReport: (id: string, input: UpdateSavedReportInput) => Promise<SavedReport>;
  deleteReport: (id: string) => Promise<boolean>;
  toggleFavorite: (id: string) => Promise<boolean>;
  trackRun: (id: string) => Promise<void>;
  activeTab: SavedReportsTab;
  setActiveTab: (tab: SavedReportsTab) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredReports: SavedReport[];
}

// ============================================================================
// API Routes
// ============================================================================

// eslint-disable-next-line custom/no-hardcoded-strings -- API route template
const API_BASE = '/api/reports/saved';

function reportUrl(id: string): string {
  // eslint-disable-next-line custom/no-hardcoded-strings -- API route template
  return `/api/reports/saved/${id}`;
}

// ============================================================================
// Hook
// ============================================================================

export function useSavedReports(): UseSavedReportsReturn {
  const { t } = useTranslation('saved-reports');
  const { user } = useAuth();
  const userId = user?.uid ?? '';

  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SavedReportsTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ========================================================================
  // Fetch
  // ========================================================================

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<SavedReport[]>(API_BASE);
      setReports(data);
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      toast.error(t('messages.errorFetch'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  // ========================================================================
  // Create
  // ========================================================================

  const createReport = useCallback(async (input: CreateSavedReportInput): Promise<SavedReport> => {
    const created = await apiClient.post<SavedReport>(API_BASE, input);
    setReports(prev => [created, ...prev]);
    toast.success(t('messages.saved'));
    return created;
  }, [t]);

  // ========================================================================
  // Update
  // ========================================================================

  const updateReport = useCallback(async (
    id: string,
    input: UpdateSavedReportInput,
  ): Promise<SavedReport> => {
    const updated = await apiClient.put<SavedReport>(reportUrl(id), input);
    setReports(prev => prev.map(r => (r.id === id ? updated : r)));
    toast.success(t('messages.updated'));
    return updated;
  }, [t]);

  // ========================================================================
  // Delete
  // ========================================================================

  const deleteReport = useCallback(async (id: string): Promise<boolean> => {
    try {
      await apiClient.delete<{ deleted: boolean }>(reportUrl(id));
      setReports(prev => prev.filter(r => r.id !== id));
      toast.success(t('messages.deleted'));
      return true;
    } catch (err) {
      toast.error(t('messages.errorDelete'));
      throw err;
    }
  }, [t]);

  // ========================================================================
  // Actions
  // ========================================================================

  const toggleFavorite = useCallback(async (id: string): Promise<boolean> => {
    // Optimistic update
    const prevReports = reports;
    setReports(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        const isFav = r.favoritedBy.includes(userId);
        return {
          ...r,
          favoritedBy: isFav
            ? r.favoritedBy.filter(uid => uid !== userId)
            : [...r.favoritedBy, userId],
        };
      }),
    );

    try {
      const result = await apiClient.post<{ action: string; result: boolean }>(
        reportUrl(id),
        // eslint-disable-next-line custom/no-hardcoded-strings -- API action
        { action: 'toggle_favorite' },
      );
      return result.result;
    } catch {
      // Revert on failure
      setReports(prevReports);
      toast.error(t('messages.errorFavorite'));
      return false;
    }
  }, [reports, userId, t]);

  const trackRun = useCallback(async (id: string): Promise<void> => {
    try {
      await apiClient.post<{ action: string; result: boolean }>(
        reportUrl(id),
        // eslint-disable-next-line custom/no-hardcoded-strings -- API action
        { action: 'track_run' },
      );
      setReports(prev =>
        prev.map(r =>
          r.id === id
            ? { ...r, lastRunAt: new Date().toISOString(), runCount: r.runCount + 1 }
            : r,
        ),
      );
    } catch {
      // Non-blocking — silently fail
    }
  }, []);

  // ========================================================================
  // Client-side Filtering
  // ========================================================================

  const filteredReports = useMemo(() => {
    let filtered = reports;

    // Tab filtering
    switch (activeTab) {
      case 'favorites':
        filtered = filtered.filter(r => r.favoritedBy.includes(userId));
        break;
      case 'recent':
        filtered = filtered
          .filter(r => r.lastRunAt !== null)
          .sort((a, b) => (b.lastRunAt ?? '').localeCompare(a.lastRunAt ?? ''));
        break;
      case 'shared':
        filtered = filtered.filter(r => r.visibility === 'shared' || r.visibility === 'system');
        break;
      default:
        break;
    }

    // Search filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(q)
        || (r.description?.toLowerCase().includes(q) ?? false),
      );
    }

    return filtered;
  }, [reports, activeTab, searchQuery, userId]);

  // ========================================================================
  // Return
  // ========================================================================

  return {
    reports,
    loading,
    error,
    fetchReports,
    createReport,
    updateReport,
    deleteReport,
    toggleFavorite,
    trackRun,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filteredReports,
  };
}
