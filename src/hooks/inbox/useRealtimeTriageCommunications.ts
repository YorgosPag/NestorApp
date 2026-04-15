'use client';

/**
 * =============================================================================
 * REALTIME TRIAGE COMMUNICATIONS HOOK - ENTERPRISE (ADR-079)
 * =============================================================================
 *
 * Firestore realtime listener για AI Inbox triage communications.
 * Αντικαθιστά τα server actions + WebSocket dead code με instant updates.
 *
 * Pattern: Ακολουθεί useRealtimeMessages (proven, ίδιο collection `messages`)
 *
 * @module hooks/inbox/useRealtimeTriageCommunications
 * @enterprise Real-time updates χωρίς polling/WebSocket dependency
 * @see ADR-079: AI Inbox Real-Time Updates
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { getString, getNumber, getBoolean, getStringArray } from '@/lib/firestore/field-extractors';
import { where, orderBy, type QueryConstraint } from 'firebase/firestore';
import { createStaleCache } from '@/lib/stale-cache';
import type { DocumentData } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult } from '@/services/firestore';
import { TRIAGE_STATUSES, type TriageStatus } from '@/constants/triage-statuses';
import type { Communication, FirestoreishTimestamp } from '@/types/crm';
import type { MessageIntentAnalysis } from '@/schemas/ai-analysis';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useRealtimeTriageCommunications');

const inboxTriageCache = createStaleCache<Array<Communication & { id: string }>>('inbox-triage');

// ============================================================================
// TYPES
// ============================================================================

interface UseRealtimeTriageCommunicationsOptions {
  /** Company ID for tenant isolation (required for Firestore rules) */
  companyId: string | undefined;
  /** Optional status filter */
  statusFilter?: TriageStatus;
  /** Enable/disable the listener */
  enabled?: boolean;
}

interface TriageStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  reviewed: number;
}

interface UseRealtimeTriageCommunicationsResult {
  /** Live communications from Firestore */
  communications: Array<Communication & { id: string }>;
  /** Computed stats from live data */
  stats: TriageStats;
  /** Initial loading state */
  loading: boolean;
  /** Error message if listener fails */
  error: string | null;
  /** Whether the Firestore listener is active */
  connected: boolean;
}

// ============================================================================
// TYPE-SAFE EXTRACTORS (proven pattern from useRealtimeMessages)
// ============================================================================

// ADR-219: getString, getNumber, getBoolean, getStringArray centralized to @/lib/firestore/field-extractors

function getTimestamp(data: Record<string, unknown>, field: string): FirestoreishTimestamp | undefined {
  const value = data[field];
  if (!value) return undefined;

  // Firestore Timestamp object
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return value as FirestoreishTimestamp;
  }

  // ISO string
  if (typeof value === 'string') {
    return value;
  }

  // Date object
  if (value instanceof Date) {
    return value;
  }

  return undefined;
}

function getIntentAnalysis(data: Record<string, unknown>): MessageIntentAnalysis | undefined {
  const value = data['intentAnalysis'];
  if (!value || typeof value !== 'object') return undefined;
  return value as MessageIntentAnalysis;
}

function getTriageStatus(data: Record<string, unknown>): TriageStatus | undefined {
  const value = data['triageStatus'];
  if (typeof value !== 'string') return undefined;

  const validStatuses = new Set<string>(Object.values(TRIAGE_STATUSES));
  return validStatuses.has(value) ? (value as TriageStatus) : undefined;
}

function getMetadata(data: Record<string, unknown>): Record<string, unknown> | undefined {
  const value = data['metadata'];
  if (!value || typeof value !== 'object') return undefined;
  return value as Record<string, unknown>;
}

// ============================================================================
// DOCUMENT CONVERTER
// ============================================================================

/**
 * Convert flat DocumentData to Communication with id
 * ADR-227 Phase 2: Adapted for firestoreQueryService.subscribe() output
 */
function docToTriageCommunication(doc: DocumentData & { id: string }): Communication & { id: string } {
  const data = doc as Record<string, unknown>;

  return {
    id: doc.id,
    companyId: getString(data, 'companyId'),
    contactId: getString(data, 'contactId') ?? '',
    projectId: getString(data, 'projectId'),
    propertyId: getString(data, 'propertyId'),
    opportunityId: getString(data, 'opportunityId'),
    type: getString(data, 'type', 'email') as Communication['type'],
    direction: getString(data, 'direction', 'inbound') as Communication['direction'],
    from: getString(data, 'from'),
    to: getString(data, 'to'),
    subject: getString(data, 'subject'),
    content: getString(data, 'content') ?? '',
    attachments: getStringArray(data, 'attachments'),
    duration: getNumber(data, 'duration'),
    meetingDate: getTimestamp(data, 'meetingDate'),
    location: getString(data, 'location'),
    attendees: getStringArray(data, 'attendees'),
    createdBy: getString(data, 'createdBy') ?? '',
    createdAt: getTimestamp(data, 'createdAt') ?? '',
    updatedAt: getTimestamp(data, 'updatedAt') ?? '',
    status: getString(data, 'status', 'pending') as Communication['status'],
    requiresFollowUp: getBoolean(data, 'requiresFollowUp'),
    followUpDate: getTimestamp(data, 'followUpDate'),
    metadata: getMetadata(data),
    intentAnalysis: getIntentAnalysis(data),
    triageStatus: getTriageStatus(data),
    linkedTaskId: getString(data, 'linkedTaskId'),
  };
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * 🏢 ENTERPRISE: Realtime listener for AI Inbox triage communications (ADR-079)
 *
 * Replaces server actions + WebSocket dead code with Firestore onSnapshot().
 * Follows proven useRealtimeMessages pattern on the same `messages` collection.
 *
 * @param options - Configuration (companyId required for Firestore rules)
 * @returns Live communications, computed stats, loading/error/connected states
 *
 * @example
 * ```tsx
 * const { communications, stats, connected } = useRealtimeTriageCommunications({
 *   companyId: adminContext.companyId,
 *   statusFilter: 'pending',
 *   enabled: true,
 * });
 * ```
 */
export function useRealtimeTriageCommunications(
  options: UseRealtimeTriageCommunicationsOptions
): UseRealtimeTriageCommunicationsResult {
  const { companyId, statusFilter, enabled = true } = options;
  const { success } = useNotifications();
  const { t } = useTranslation('admin');

  const [communications, setCommunications] = useState<Array<Communication & { id: string }>>(
    inboxTriageCache.get(companyId ?? '') ?? []
  );
  const [loading, setLoading] = useState(!inboxTriageCache.hasLoaded(companyId ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const previousIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  // =========================================================================
  // REALTIME LISTENER (ADR-227 Phase 2: Canonical pattern)
  // =========================================================================

  useEffect(() => {
    // Reset state — seed from cache to avoid flash on companyId change
    setCommunications(inboxTriageCache.get(companyId ?? '') ?? []);
    setError(null);
    setConnected(false);
    previousIdsRef.current.clear();
    isInitialLoadRef.current = true;

    // Guard: companyId required for Firestore security rules.
    // Auth readiness handled centrally in firestoreQueryService.subscribe().
    if (!enabled || !companyId) {
      setLoading(false);
      return;
    }

    if (!inboxTriageCache.hasLoaded(companyId)) setLoading(true);

    // Build constraints — companyId auto-injected by firestoreQueryService
    const constraints: QueryConstraint[] = [];
    if (statusFilter) {
      constraints.push(where('triageStatus', '==', statusFilter));
    }
    constraints.push(orderBy('createdAt', 'desc'));

    // 🏢 ENTERPRISE: Canonical pattern via firestoreQueryService.subscribe (ADR-227 Phase 2)
    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      'MESSAGES',
      (result: QueryResult<DocumentData>) => {
        const docs = result.documents.map(doc =>
          docToTriageCommunication(doc as DocumentData & { id: string })
        );

        // 🔔 NEW MESSAGE DETECTION (after initial load)
        if (!isInitialLoadRef.current) {
          const currentIds = new Set(result.documents.map(doc => doc.id));
          const newIds = [...currentIds].filter((id) => !previousIdsRef.current.has(id));

          if (newIds.length > 0) {
            success(
              newIds.length === 1
                ? t('aiInbox.newEmailSingle')
                : t('aiInbox.newEmailMultiple', { count: newIds.length })
            );
          }

          previousIdsRef.current = currentIds;
        } else {
          isInitialLoadRef.current = false;
          previousIdsRef.current = new Set(result.documents.map(doc => doc.id));
        }

        inboxTriageCache.set(docs, companyId);
        setCommunications(docs);
        setConnected(true);
        setLoading(false);
        setError(null);
      },
      (err: Error) => {
        logger.error('Firestore listener error', { error: err });
        setError(err.message || 'Real-time connection failed');
        setConnected(false);
        setLoading(false);
      },
      { constraints }
    );

    return () => {
      unsubscribe();
    };
  }, [companyId, statusFilter, enabled]);

  // =========================================================================
  // COMPUTED STATS (useMemo - replaces getTriageStats server call)
  // =========================================================================

  const stats = useMemo<TriageStats>(() => {
    return communications.reduce<TriageStats>(
      (acc, comm) => {
        acc.total++;
        const status = comm.triageStatus ?? TRIAGE_STATUSES.PENDING;
        switch (status) {
          case TRIAGE_STATUSES.PENDING:
            acc.pending++;
            break;
          case TRIAGE_STATUSES.APPROVED:
            acc.approved++;
            break;
          case TRIAGE_STATUSES.REJECTED:
            acc.rejected++;
            break;
          case TRIAGE_STATUSES.REVIEWED:
            acc.reviewed++;
            break;
        }
        return acc;
      },
      { total: 0, pending: 0, approved: 0, rejected: 0, reviewed: 0 }
    );
  }, [communications]);

  return {
    communications,
    stats,
    loading,
    error,
    connected,
  };
}
