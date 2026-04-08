/**
 * useOperatorInboxState — Data fetch, polling, approve/reject for OperatorInboxClient
 * Extracted for file-size compliance (<500 lines).
 *
 * @module app/admin/operator-inbox/useOperatorInboxState
 * @see ADR-080 (Pipeline Implementation), UC-009
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useInterval } from '@/hooks/useInterval';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import type { PipelineQueueItem, PipelineAction } from '@/types/ai-pipeline';
import type { ProposedItemStats } from '@/services/ai-pipeline/pipeline-queue-service';
import { API_ROUTES } from '@/config/domain-constants';
import {
  defaultOperatorInboxFilters,
  type OperatorInboxFilterState,
} from '@/components/core/AdvancedFilters';

const logger = createModuleLogger('OPERATOR_INBOX_STATE');

// ============================================================================
// TYPES
// ============================================================================

interface OperatorInboxApiResponse {
  success: boolean;
  items?: PipelineQueueItem[];
  stats?: ProposedItemStats;
  error?: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useOperatorInboxState() {
  const { t } = useTranslation('admin');
  const { success, error: notifyError } = useNotifications();

  const [items, setItems] = useState<PipelineQueueItem[]>([]);
  const [stats, setStats] = useState<ProposedItemStats>({ proposed: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<OperatorInboxFilterState>(defaultOperatorInboxFilters);

  const fetchData = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    try {
      const response = await fetch(API_ROUTES.ADMIN.OPERATOR_INBOX, { credentials: 'include' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as OperatorInboxApiResponse;
      if (!data.success) throw new Error(data.error ?? 'Unknown error');
      setItems(data.items ?? []);
      setStats(data.stats ?? { proposed: 0, approved: 0, rejected: 0 });
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(message);
      logger.error('Failed to fetch operator inbox data', { error: message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Smart polling
  const previousItemIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  useInterval(async () => {
    try {
      const response = await fetch(API_ROUTES.ADMIN.OPERATOR_INBOX, { credentials: 'include' });
      if (!response.ok) return;
      const data = await response.json() as OperatorInboxApiResponse;
      if (!data.success) return;

      const newItems = data.items ?? [];
      const newStats = data.stats ?? { proposed: 0, approved: 0, rejected: 0 };

      if (!isInitialLoadRef.current) {
        const currentIds = new Set(newItems.map(item => item.id));
        const addedIds = [...currentIds].filter(id => !previousItemIdsRef.current.has(id));
        if (addedIds.length > 0) {
          success(
            addedIds.length === 1
              ? 'Νέο αίτημα στο Operator Inbox!'
              : `${addedIds.length} νέα αιτήματα στο Operator Inbox!`
          );
        }
      }

      isInitialLoadRef.current = false;
      previousItemIdsRef.current = new Set(newItems.map(item => item.id));
      setItems(newItems);
      setStats(newStats);
      setError(null);
    } catch {
      // Silent fail for background polling
    }
  }, 15_000);

  useEffect(() => {
    if (items.length > 0 && isInitialLoadRef.current) {
      previousItemIdsRef.current = new Set(items.map(item => item.id));
      isInitialLoadRef.current = false;
    }
  }, [items]);

  const handleApprove = useCallback(async (queueId: string, modifiedActions?: PipelineAction[]) => {
    setProcessingId(queueId);
    try {
      const body: { queueId: string; decision: 'approved'; modifiedActions?: PipelineAction[] } = { queueId, decision: 'approved' };
      if (modifiedActions) body.modifiedActions = modifiedActions;
      const response = await fetch(API_ROUTES.ADMIN.OPERATOR_INBOX, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) { success(t('operatorInbox.approveSuccess')); await fetchData(); }
      else { notifyError(data.error ?? t('operatorInbox.approveFailed')); }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      notifyError(message);
      logger.error('Approve failed', { queueId, error: message });
    } finally {
      setProcessingId(null);
    }
  }, [fetchData, t, success, notifyError]);

  const handleReject = useCallback(async (queueId: string, reason: string) => {
    setProcessingId(queueId);
    try {
      const response = await fetch(API_ROUTES.ADMIN.OPERATOR_INBOX, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId, decision: 'rejected', reason }),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) { success(t('operatorInbox.rejectSuccess')); await fetchData(); }
      else { notifyError(data.error ?? t('operatorInbox.rejectFailed')); }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      notifyError(message);
      logger.error('Reject failed', { queueId, error: message });
    } finally {
      setProcessingId(null);
    }
  }, [fetchData, t, success, notifyError]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const understanding = item.context?.understanding;
      const sender = item.context?.intake?.normalized?.sender;
      const subject = item.context?.intake?.normalized?.subject;

      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        const matchesSender = (sender?.name ?? '').toLowerCase().includes(term) || (sender?.email ?? '').toLowerCase().includes(term);
        const matchesSubject = (subject ?? '').toLowerCase().includes(term);
        if (!matchesSender && !matchesSubject) return false;
      }
      if (filters.intent !== 'all' && understanding?.intent !== filters.intent) return false;
      if (filters.status !== 'all' && item.pipelineState !== filters.status) return false;
      if (filters.dateFrom && item.createdAt && new Date(item.createdAt) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && item.createdAt && new Date(item.createdAt) > new Date(filters.dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [items, filters]);

  return {
    items, stats, loading, error, processingId, refreshing,
    showDashboard, setShowDashboard, showFilters, setShowFilters,
    filters, setFilters, filteredItems,
    fetchData, handleApprove, handleReject,
  };
}
