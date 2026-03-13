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
import { db } from '@/lib/firebase';
import { getString, getNumber, getBoolean, getStringArray } from '@/lib/firestore/field-extractors';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  type Unsubscribe,
  type QueryConstraint,
} from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { TRIAGE_STATUSES, type TriageStatus } from '@/constants/triage-statuses';
import type { Communication, FirestoreishTimestamp } from '@/types/crm';
import type { MessageIntentAnalysis } from '@/schemas/ai-analysis';
import { useNotifications } from '@/providers/NotificationProvider';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useRealtimeTriageCommunications');

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
 * Convert Firestore document to Communication with id
 * Type-safe extraction following useRealtimeMessages proven pattern
 */
function docToTriageCommunication(doc: { id: string; data: () => unknown }): Communication & { id: string } {
  const data = doc.data() as Record<string, unknown>;

  return {
    id: doc.id,
    companyId: getString(data, 'companyId'),
    contactId: getString(data, 'contactId'),
    projectId: getString(data, 'projectId'),
    unitId: getString(data, 'unitId'),
    opportunityId: getString(data, 'opportunityId'),
    type: getString(data, 'type', 'email') as Communication['type'],
    direction: getString(data, 'direction', 'inbound') as Communication['direction'],
    from: getString(data, 'from'),
    to: getString(data, 'to'),
    subject: getString(data, 'subject'),
    content: getString(data, 'content'),
    attachments: getStringArray(data, 'attachments'),
    duration: getNumber(data, 'duration'),
    meetingDate: getTimestamp(data, 'meetingDate'),
    location: getString(data, 'location'),
    attendees: getStringArray(data, 'attendees'),
    createdBy: getString(data, 'createdBy'),
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

  const [communications, setCommunications] = useState<Array<Communication & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const previousIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  // =========================================================================
  // REALTIME LISTENER
  // =========================================================================

  useEffect(() => {
    // Reset state
    setCommunications([]);
    setError(null);
    setConnected(false);
    previousIdsRef.current.clear();
    isInitialLoadRef.current = true;

    // Guard: companyId is required for Firestore security rules
    // Super admin (companyId === undefined) uses server actions fallback
    if (!enabled || !companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const messagesRef = collection(db, COLLECTIONS.MESSAGES);

      // Build query constraints
      const constraints: QueryConstraint[] = [
        where('companyId', '==', companyId),
      ];

      // Optional status filter
      if (statusFilter) {
        constraints.push(where('triageStatus', '==', statusFilter));
      }

      // Order by createdAt DESC (newest first)
      constraints.push(orderBy('createdAt', 'desc'));

      const q = query(messagesRef, ...constraints);

      // 🔥 REALTIME LISTENER
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const docs = snapshot.docs.map(docToTriageCommunication);

          // 🔔 NEW MESSAGE DETECTION (after initial load)
          if (!isInitialLoadRef.current) {
            const currentIds = new Set(snapshot.docs.map((doc) => doc.id));
            const newIds = [...currentIds].filter((id) => !previousIdsRef.current.has(id));

            if (newIds.length > 0) {
              success(
                newIds.length === 1
                  ? 'New email received!'
                  : `${newIds.length} new emails received!`
              );
            }

            previousIdsRef.current = currentIds;
          } else {
            // Initial load - store IDs without notification
            isInitialLoadRef.current = false;
            previousIdsRef.current = new Set(snapshot.docs.map((doc) => doc.id));
          }

          setCommunications(docs);
          setConnected(true);
          setLoading(false);
          setError(null);
        },
        (err) => {
          logger.error('Firestore listener error', { error: err });
          setError(err.message || 'Real-time connection failed');
          setConnected(false);
          setLoading(false);
        }
      );

      unsubscribeRef.current = unsubscribe;
    } catch (err) {
      logger.error('Failed to start listener', { error: err });
      setError(err instanceof Error ? err.message : 'Failed to start real-time listener');
      setLoading(false);
    }

    // Cleanup
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
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
