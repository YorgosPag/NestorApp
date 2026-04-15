/**
 * =============================================================================
 * AI INBOX STATE HOOK — All state management and data fetching logic
 * =============================================================================
 *
 * Extracted from AIInboxClient.tsx for SRP compliance (ADR N.7.1).
 * Contains: state declarations, realtime/server data source unification,
 * approve/reject handlers, filter logic, dashboard stats, loading/error states.
 *
 * @module useAIInboxState
 * @enterprise Google SRP — single responsibility per module
 * @created 2026-03-28
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { useNotifications } from '@/providers/NotificationProvider';
import { createStaleCache } from '@/lib/stale-cache';
import { useRealtimeTriageCommunications } from '@/hooks/inbox/useRealtimeTriageCommunications';
import type { Communication, TriageStatus } from '@/types/crm';
import { TRIAGE_STATUSES } from '@/types/crm';
import { defaultAIInboxFilters, type AIInboxFilterState } from '@/components/core/AdvancedFilters';
import type { AdminContext } from '@/server/admin/admin-guards';
import {
  getTriageCommunications,
  getTriageStats,
  approveCommunication,
  rejectCommunication,
} from '@/services/communications.service';
import { getDisplayContent, resolveFirestoreTimestamp } from './ai-inbox-helpers';

// ============================================================================
// LOGGER & CONSTANTS
// ============================================================================

const logger = createModuleLogger('AI_INBOX_STATE');

const aiInboxCommsCache = createStaleCache<Array<Communication & { id: string }>>('ai-inbox-state');
const aiInboxStatsCache = createStaleCache<TriageStats>('ai-inbox-stats');

const TRIAGE_STATUS_SET = new Set<TriageStatus>(Object.values(TRIAGE_STATUSES));

// ============================================================================
// TYPES
// ============================================================================

export interface TriageStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  reviewed: number;
}

export interface AIInboxState {
  /** Unified communications list (realtime or server) */
  communications: Array<Communication & { id: string }>;
  /** Filtered communications based on current filter state */
  filteredCommunications: Array<Communication & { id: string }>;
  /** Whether data is loading */
  loading: boolean;
  /** Whether stats are loading */
  statsLoading: boolean;
  /** Error message, if any */
  error: string | null;
  /** ID of the communication currently being acted on */
  actionLoading: string | null;
  /** Unified triage stats */
  stats: TriageStats | null;
  /** Pending count shortcut */
  pendingCount: number;
  /** Whether any data source is refreshing */
  isRefreshing: boolean;
  /** Whether realtime listener is connected */
  connected: boolean;
  /** Current filter state */
  filters: AIInboxFilterState;
  /** UI toggles */
  showDashboard: boolean;
  showFilters: boolean;
  isMounted: boolean;
  /** Handlers */
  setFilters: (value: AIInboxFilterState | ((prev: AIInboxFilterState) => AIInboxFilterState)) => void;
  setShowDashboard: (value: boolean) => void;
  setShowFilters: (value: boolean) => void;
  handleRefresh: () => Promise<void>;
  handleApprove: (commId: string) => Promise<void>;
  handleReject: (commId: string) => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Manages all AI Inbox state: data fetching (realtime + server fallback),
 * approve/reject actions, filtering, and dashboard stats.
 *
 * @param adminContext - Server-verified admin context (uid, companyId, role, etc.)
 * @returns Complete state object for rendering
 */
export function useAIInboxState(adminContext: AdminContext): AIInboxState {
  const { t } = useTranslation('admin');
  const { success, error: notifyError } = useNotifications();

  // =========================================================================
  // UI STATE
  // =========================================================================

  const [isMounted, setIsMounted] = useState(false);
  const [filters, setFilters] = useState<AIInboxFilterState>(defaultAIInboxFilters);
  const [showDashboard, setShowDashboard] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // =========================================================================
  // SERVER ACTION STATE (super admin fallback)
  // =========================================================================

  const _cacheKey = adminContext.companyId ?? '';
  const [serverCommunications, setServerCommunications] = useState<Array<Communication & { id: string }>>(
    aiInboxCommsCache.get(_cacheKey) ?? []
  );
  const [serverLoading, setServerLoading] = useState(!aiInboxCommsCache.hasLoaded(_cacheKey));
  const [serverStatsLoading, setServerStatsLoading] = useState(!aiInboxStatsCache.hasLoaded(_cacheKey));
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [serverStats, setServerStats] = useState<TriageStats | null>(null);

  // =========================================================================
  // REALTIME vs SERVER DATA SOURCE
  // =========================================================================

  const isRealtimeEnabled = !!adminContext.companyId;

  const realtimeStatusFilter = useMemo((): TriageStatus | undefined => {
    if (filters.status === 'all') return undefined;
    const validStatuses = new Set<string>(Object.values(TRIAGE_STATUSES));
    return validStatuses.has(filters.status) ? (filters.status as TriageStatus) : undefined;
  }, [filters.status]);

  const {
    communications: realtimeCommunications,
    stats: realtimeStats,
    loading: realtimeLoading,
    error: realtimeError,
    connected,
  } = useRealtimeTriageCommunications({
    companyId: adminContext.companyId,
    statusFilter: realtimeStatusFilter,
    enabled: isRealtimeEnabled,
  });

  // Unified data source
  const communications = isRealtimeEnabled ? realtimeCommunications : serverCommunications;
  const loading = isRealtimeEnabled ? realtimeLoading : serverLoading;
  const stats = isRealtimeEnabled ? realtimeStats : serverStats;
  const statsLoading = isRealtimeEnabled ? realtimeLoading : serverStatsLoading;

  // =========================================================================
  // ERROR PROPAGATION
  // =========================================================================

  useEffect(() => {
    if (realtimeError && isRealtimeEnabled) {
      if (realtimeError.includes('AUTHENTICATION_ERROR')) {
        setError(t('aiInbox.errors.authRequired'));
      } else if (realtimeError.includes('Firestore') || realtimeError.includes('listener')) {
        setError(t('aiInbox.errors.firestoreListener'));
      } else {
        setError(t('aiInbox.errors.generic'));
      }
    }
  }, [realtimeError, isRealtimeEnabled, t]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // =========================================================================
  // HELPERS
  // =========================================================================

  const isTriageStatus = useCallback((value: string): value is TriageStatus => {
    return TRIAGE_STATUS_SET.has(value as TriageStatus);
  }, []);

  const resolveStatusFilter = useCallback((): TriageStatus | undefined => {
    if (filters.status === 'all') return undefined;
    return isTriageStatus(filters.status) ? filters.status : undefined;
  }, [filters.status, isTriageStatus]);

  // =========================================================================
  // SERVER ACTION LOADERS (super admin only)
  // =========================================================================

  const loadTriageCommunications = useCallback(async () => {
    if (isRealtimeEnabled) return;
    if (!aiInboxCommsCache.hasLoaded(adminContext.companyId ?? '')) setServerLoading(true);
    setError(null);

    try {
      const result = await getTriageCommunications(undefined, adminContext.operationId, resolveStatusFilter());
      if (!result.ok) {
        throw new Error(t('aiInbox.loadFailedWithErrorId', { errorId: result.errorId }));
      }
      aiInboxCommsCache.set(result.data as Array<Communication & { id: string }>, adminContext.companyId ?? '');
      setServerCommunications(result.data as Array<Communication & { id: string }>);
      logger.info('Loaded pending communications (super admin)', {
        count: result.data.length,
        source: 'server-action',
        adminUid: adminContext.uid,
      });
    } catch (err) {
      logger.error('Failed to load communications', { error: err });
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setServerLoading(false);
    }
  }, [isRealtimeEnabled, adminContext.operationId, adminContext.uid, resolveStatusFilter, t]);

  const loadTriageStats = useCallback(async () => {
    if (isRealtimeEnabled) return;
    if (!aiInboxStatsCache.hasLoaded(adminContext.companyId ?? '')) setServerStatsLoading(true);

    try {
      const result = await getTriageStats(undefined, adminContext.operationId);
      if (!result.ok) {
        throw new Error(t('aiInbox.loadFailedWithErrorId', { errorId: result.errorId }));
      }
      aiInboxStatsCache.set(result.data, adminContext.companyId ?? '');
      setServerStats(result.data);
    } catch (err) {
      logger.error('Failed to load triage stats', { error: err });
    } finally {
      setServerStatsLoading(false);
    }
  }, [isRealtimeEnabled, adminContext.operationId, t]);

  useEffect(() => {
    if (!isRealtimeEnabled) {
      loadTriageCommunications();
    }
  }, [loadTriageCommunications, isRealtimeEnabled]);

  useEffect(() => {
    if (!isRealtimeEnabled) {
      loadTriageStats();
    }
  }, [loadTriageStats, isRealtimeEnabled]);

  // =========================================================================
  // REFRESH
  // =========================================================================

  const handleRefresh = useCallback(async () => {
    if (isRealtimeEnabled) {
      success('Live data is already up-to-date!');
      return;
    }
    await Promise.all([loadTriageCommunications(), loadTriageStats()]);
  }, [isRealtimeEnabled, loadTriageCommunications, loadTriageStats, success]);

  // =========================================================================
  // APPROVE / REJECT ACTIONS
  // =========================================================================

  const handleApprove = useCallback(async (commId: string) => {
    setActionLoading(commId);
    try {
      const comm = communications.find(c => c.id === commId);
      const commCompanyId = comm?.companyId || adminContext.companyId;

      if (!commCompanyId) {
        notifyError('Cannot approve: missing company context');
        return;
      }

      const result = await approveCommunication(
        commId,
        adminContext.uid,
        commCompanyId,
        adminContext.operationId,
      );

      if (!result.ok) {
        notifyError(t('aiInbox.approveFailedWithErrorId', { errorId: result.errorId }));
        return;
      }

      if (!isRealtimeEnabled) {
        setServerCommunications(prev => {
          const updated = prev.map(c =>
            c.id === commId
              ? { ...c, triageStatus: TRIAGE_STATUSES.APPROVED, linkedTaskId: result.taskId }
              : c,
          );
          if (filters.status !== 'all' && filters.status !== TRIAGE_STATUSES.APPROVED) {
            return updated.filter(c => c.id !== commId);
          }
          return updated;
        });

        setServerStats(prev => {
          if (!prev) return prev;
          return { ...prev, pending: Math.max(0, prev.pending - 1), approved: prev.approved + 1 };
        });
      }

      success(t('aiInbox.approveSuccess'));
      logger.info('Communication approved', { communicationId: commId, taskId: result.taskId, adminUid: adminContext.uid });
    } catch (err) {
      logger.error('Approve failed', { communicationId: commId, error: err });
      notifyError(t('aiInbox.approveFailed'));
    } finally {
      setActionLoading(null);
    }
  }, [communications, adminContext, filters.status, isRealtimeEnabled, notifyError, success, t]);

  const handleReject = useCallback(async (commId: string) => {
    setActionLoading(commId);
    try {
      const comm = communications.find(c => c.id === commId);
      const commCompanyId = comm?.companyId || adminContext.companyId;

      if (!commCompanyId) {
        notifyError('Cannot reject: missing company context');
        return;
      }

      const result = await rejectCommunication(
        commId,
        commCompanyId,
        adminContext.uid,
        adminContext.operationId,
      );

      if (!result.ok) {
        notifyError(t('aiInbox.rejectFailedWithErrorId', { errorId: result.errorId }));
        return;
      }

      if (!isRealtimeEnabled) {
        setServerCommunications(prev => {
          const updated = prev.map(c =>
            c.id === commId
              ? { ...c, triageStatus: TRIAGE_STATUSES.REJECTED }
              : c,
          );
          if (filters.status !== 'all' && filters.status !== TRIAGE_STATUSES.REJECTED) {
            return updated.filter(c => c.id !== commId);
          }
          return updated;
        });

        setServerStats(prev => {
          if (!prev) return prev;
          return { ...prev, pending: Math.max(0, prev.pending - 1), rejected: prev.rejected + 1 };
        });
      }

      success(t('aiInbox.rejectSuccess'));
      logger.info('Communication rejected', { communicationId: commId, adminUid: adminContext.uid });
    } catch (err) {
      logger.error('Reject failed', { communicationId: commId, error: err });
      notifyError(t('aiInbox.rejectFailed'));
    } finally {
      setActionLoading(null);
    }
  }, [communications, adminContext, filters.status, isRealtimeEnabled, notifyError, success, t]);

  // =========================================================================
  // FILTERED COMMUNICATIONS
  // =========================================================================

  const filteredCommunications = useMemo(() => {
    let list = [...communications];

    if (filters.searchTerm.trim()) {
      const term = filters.searchTerm.trim().toLowerCase();
      list = list.filter(comm =>
        (comm.from || '').toLowerCase().includes(term) ||
        (comm.subject || '').toLowerCase().includes(term) ||
        getDisplayContent(comm.content).toLowerCase().includes(term),
      );
    }

    if (filters.channel !== 'all') {
      list = list.filter(comm => comm.type === filters.channel);
    }

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      list = list.filter(comm => {
        const createdAt = resolveFirestoreTimestamp(comm.createdAt);
        return createdAt ? createdAt.getTime() >= fromDate.getTime() : false;
      });
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      list = list.filter(comm => {
        const createdAt = resolveFirestoreTimestamp(comm.createdAt);
        return createdAt ? createdAt.getTime() <= toDate.getTime() : false;
      });
    }

    return list;
  }, [communications, filters.channel, filters.dateFrom, filters.dateTo, filters.searchTerm]);

  // =========================================================================
  // DERIVED VALUES
  // =========================================================================

  const pendingCount = stats?.pending ?? 0;
  const isRefreshing = loading || statsLoading;

  return {
    communications,
    filteredCommunications,
    loading,
    statsLoading,
    error,
    actionLoading,
    stats,
    pendingCount,
    isRefreshing,
    connected,
    filters,
    showDashboard,
    showFilters,
    isMounted,
    setFilters,
    setShowDashboard,
    setShowFilters,
    handleRefresh,
    handleApprove,
    handleReject,
  };
}
