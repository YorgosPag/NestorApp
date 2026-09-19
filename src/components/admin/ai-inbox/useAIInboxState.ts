/**
 * =============================================================================
 * AI INBOX STATE HOOK — All state management and data fetching logic
 * =============================================================================
 *
 * Extracted from AIInboxClient.tsx for SRP compliance (ADR N.7.1).
 * Contains: state declarations, realtime data source, approve/reject handlers,
 * filter logic, dashboard stats, loading/error states.
 *
 * 🔴 **ADR-868 — ΕΝΑ ΣΥΝΟΡΟ, ΚΑΜΙΑ SERVER ACTION.** Μέχρι 2026-09-19 το hook καλούσε
 *    τέσσερις server actions του `communications.service.ts` και τους έδινε **το ίδιο**
 *    `adminUid` / `companyId` — ή `undefined`, που ο server διάβαζε ως «GLOBAL_ACCESS»:
 *    μηνύματα **όλων** των εταιρειών, σε οποιονδήποτε έστελνε ένα POST.
 *    Πλέον:
 *    - **ανάγνωση** = μόνο ο realtime listener, που τον κρίνουν τα `firestore.rules`·
 *    - **έγκριση/απόρριψη** = `POST /api/admin/ai-inbox/.../triage` μέσω `apiClient`, με
 *      σώμα **μόνο** `{ decision }` — ο server ξέρει ποιος ρωτά, δεν του το λέμε.
 *    - Η σελίδα δεν αποδίδει καν αυτό το hook χωρίς εταιρεία (`AIInboxAdminContext`):
 *      η κατάσταση «διαχειριστής χωρίς εταιρεία» είναι **μη εκφράσιμη** εδώ.
 *
 * @module useAIInboxState
 * @enterprise Google SRP — single responsibility per module
 * @created 2026-03-28
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { useNotifications } from '@/providers/NotificationProvider';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { apiErrorBodyOf } from '@/lib/api/api-client-types';
import { API_ROUTES } from '@/config/domain-constants';
import {
  useRealtimeTriageCommunications,
  type TriageStats,
} from '@/hooks/inbox/useRealtimeTriageCommunications';
import type { Communication, TriageStatus } from '@/types/crm';
import { TRIAGE_STATUSES } from '@/types/crm';
import { defaultAIInboxFilters, type AIInboxFilterState } from '@/components/core/AdvancedFilters';
import type { AdminContext } from '@/server/admin/admin-guards';
import { getDisplayContent, resolveFirestoreTimestamp } from './ai-inbox-helpers';

// ============================================================================
// LOGGER & CONSTANTS
// ============================================================================

const logger = createModuleLogger('AI_INBOX_STATE');

const TRIAGE_STATUS_SET = new Set<string>(Object.values(TRIAGE_STATUSES));

// ============================================================================
// TYPES
// ============================================================================

export type { TriageStats };

/**
 * Το `AdminContext` της σελίδας **με εγγυημένη εταιρεία** (ADR-868).
 *
 * Ο φύλακας της σελίδας (`requireAdminForPage`) επιστρέφει `companyId?` — ο
 * διαχειριστής χωρίς εταιρεία **υπάρχει** ως ταυτότητα. Τα εισερχόμενα όμως είναι
 * **ανά εταιρεία**, και η παλιά «καθολική όψη» ήταν ακριβώς η διαρροή. Η σελίδα
 * στενεύει τον τύπο **πριν** αποδώσει τον πελάτη.
 */
export type AIInboxAdminContext = AdminContext & { readonly companyId: string };

type TriageDecision = 'approve' | 'reject';

export interface AIInboxState {
  /** Live communications list */
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
  /** Live triage stats */
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
// PURE HELPERS
// ============================================================================

/** Το `errorId` που στέλνει ο server στο σώμα της άρνησης — για συσχέτιση με τα logs. */
function errorIdOf(cause: unknown): string | null {
  const errorId = apiErrorBodyOf(cause)?.errorId;
  return typeof errorId === 'string' ? errorId : null;
}

function toStatusFilter(status: string): TriageStatus | undefined {
  if (status === 'all') return undefined;
  return TRIAGE_STATUS_SET.has(status) ? (status as TriageStatus) : undefined;
}

function applyFilters(
  communications: Array<Communication & { id: string }>,
  filters: AIInboxFilterState,
): Array<Communication & { id: string }> {
  const term = filters.searchTerm.trim().toLowerCase();
  const fromTime = filters.dateFrom ? new Date(filters.dateFrom).getTime() : null;
  const toTime = filters.dateTo ? new Date(filters.dateTo).getTime() : null;

  return communications.filter((comm) => {
    if (term && !(
      (comm.from || '').toLowerCase().includes(term) ||
      (comm.subject || '').toLowerCase().includes(term) ||
      getDisplayContent(comm.content).toLowerCase().includes(term)
    )) return false;
    if (filters.channel !== 'all' && comm.type !== filters.channel) return false;
    if (fromTime === null && toTime === null) return true;
    const createdAt = resolveFirestoreTimestamp(comm.createdAt)?.getTime();
    if (createdAt === undefined) return false;
    return (fromTime === null || createdAt >= fromTime) && (toTime === null || createdAt <= toTime);
  });
}

// ============================================================================
// SUB-HOOKS
// ============================================================================

/** Αποτυχία του realtime listener → μήνυμα οθόνης. */
function useRealtimeErrorMessage(realtimeError: string | null): string | null {
  const { t } = useTranslation('admin');
  return useMemo(() => {
    if (!realtimeError) return null;
    if (realtimeError.includes('AUTHENTICATION_ERROR')) return t('aiInbox.errors.authRequired');
    if (realtimeError.includes('Firestore') || realtimeError.includes('listener')) {
      return t('aiInbox.errors.firestoreListener');
    }
    return t('aiInbox.errors.generic');
  }, [realtimeError, t]);
}

/**
 * Έγκριση / απόρριψη — **μία** διαδρομή για τις δύο αποφάσεις.
 *
 * ⚠️ Το σώμα είναι **μόνο** `{ decision }`: ούτε `adminUid` ούτε `companyId`. Ο
 *    server ξέρει ποιος ρωτά από το token· η διαδρομή απορρίπτει με 400 κάθε
 *    επιπλέον πεδίο (`.strict()`). Η λίστα ενημερώνεται από τον listener.
 */
function useTriageActions(adminUid: string) {
  const { t } = useTranslation('admin');
  const { success, error: notifyError } = useNotifications();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Κυριολεκτικά κλειδιά (όχι `t(μεταβλητή)`), ώστε οι CHECK 3.8/3.13 να τα βλέπουν.
  const successMessage = useCallback((decision: TriageDecision) => (
    decision === 'approve' ? t('aiInbox.approveSuccess') : t('aiInbox.rejectSuccess')
  ), [t]);

  const failureMessage = useCallback((decision: TriageDecision, errorId: string | null) => {
    if (decision === 'approve') {
      return errorId ? t('aiInbox.approveFailedWithErrorId', { errorId }) : t('aiInbox.approveFailed');
    }
    return errorId ? t('aiInbox.rejectFailedWithErrorId', { errorId }) : t('aiInbox.rejectFailed');
  }, [t]);

  const runTriage = useCallback(async (commId: string, decision: TriageDecision) => {
    setActionLoading(commId);
    try {
      await apiClient.post(API_ROUTES.ADMIN.AI_INBOX_TRIAGE(commId), { decision });
      success(successMessage(decision));
      logger.info('Communication triaged', { communicationId: commId, decision, adminUid });
    } catch (err) {
      const errorId = errorIdOf(err);
      logger.error('Triage failed', { communicationId: commId, decision, errorId, error: err });
      notifyError(failureMessage(decision, errorId));
    } finally {
      setActionLoading(null);
    }
  }, [adminUid, failureMessage, notifyError, success, successMessage]);

  const handleApprove = useCallback((commId: string) => runTriage(commId, 'approve'), [runTriage]);
  const handleReject = useCallback((commId: string) => runTriage(commId, 'reject'), [runTriage]);

  return { actionLoading, handleApprove, handleReject };
}

/** Κατάσταση οθόνης (φίλτρα, εναλλαγές, mount) — καμία σχέση με δεδομένα. */
function useInboxUiState() {
  const [isMounted, setIsMounted] = useState(false);
  const [filters, setFilters] = useState<AIInboxFilterState>(defaultAIInboxFilters);
  const [showDashboard, setShowDashboard] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  return { isMounted, filters, setFilters, showDashboard, setShowDashboard, showFilters, setShowFilters };
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Manages all AI Inbox state: realtime data, approve/reject actions,
 * filtering, and dashboard stats.
 *
 * @param adminContext - Server-verified admin context **with a company** (ADR-868)
 * @returns Complete state object for rendering
 */
export function useAIInboxState(adminContext: AIInboxAdminContext): AIInboxState {
  const { success } = useNotifications();
  const ui = useInboxUiState();
  const { filters } = ui;

  const statusFilter = useMemo(() => toStatusFilter(filters.status), [filters.status]);
  const { communications, stats, loading, error: realtimeError, connected } =
    useRealtimeTriageCommunications({ companyId: adminContext.companyId, statusFilter, enabled: true });

  const error = useRealtimeErrorMessage(realtimeError);
  const { actionLoading, handleApprove, handleReject } = useTriageActions(adminContext.uid);

  const handleRefresh = useCallback(async () => {
    success('Live data is already up-to-date!');
  }, [success]);

  const filteredCommunications = useMemo(
    () => applyFilters(communications, filters),
    [communications, filters],
  );

  return {
    ...ui,
    communications,
    filteredCommunications,
    loading,
    statsLoading: loading,
    error,
    actionLoading,
    stats,
    pendingCount: stats?.pending ?? 0,
    isRefreshing: loading,
    connected,
    handleRefresh,
    handleApprove,
    handleReject,
  };
}
