'use client';

/**
 * =============================================================================
 * REALTIME MESSAGES HOOK - ENTERPRISE
 * =============================================================================
 *
 * Firestore realtime listener για αυτόματη ενημέρωση μηνυμάτων.
 * Αντικαθιστά το polling με instant updates.
 *
 * @module hooks/inbox/useRealtimeMessages
 * @enterprise Real-time updates χωρίς polling delay
 * @see local_5_TELEGRAM.txt - Real-time listener requirement
 */

import { useState, useEffect, useRef } from 'react';
import { where, orderBy } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { useAuth } from '@/auth/hooks/useAuth';
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult } from '@/services/firestore';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { MessageListItem } from './useInboxApi';
import type { MessageDirection, DeliveryStatus } from '@/types/conversations';
import type { CommunicationChannel } from '@/types/communications';
import type { SenderType } from '@/config/domain-constants';
import { API_ROUTES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { getString, getObject } from '@/lib/firestore/field-extractors';
import { fieldToISO } from '@/lib/date-local';

const logger = createModuleLogger('useRealtimeMessages');

// ============================================================================
// TYPES
// ============================================================================

interface UseRealtimeMessagesOptions {
  enabled?: boolean;
  limitCount?: number;
}

interface UseRealtimeMessagesResult {
  messages: MessageListItem[];
  loading: boolean;
  error: string | null;
  connected: boolean;
}

// ============================================================================
// TYPE-SAFE EXTRACTORS (από API route)
// ============================================================================

// ADR-219: Field extractors centralized to @/lib/firestore/field-extractors

// ADR-218: getTimestampString replaced by centralized fieldToISO (import at top of file)

/**
 * Convert flat DocumentData to MessageListItem
 * ADR-227 Phase 2: Adapted for firestoreQueryService.subscribe() output
 */
function docToMessage(data: DocumentData & { id: string }): MessageListItem {
  const record = data as Record<string, unknown>;

  return {
    id: data.id,
    conversationId: getString(record, 'conversationId'),
    direction: getString(record, 'direction') as MessageDirection,
    channel: getString(record, 'channel', 'telegram') as CommunicationChannel,
    senderId: getString(record, 'senderId'),
    senderName: getString(record, 'senderName'),
    senderType: getString(record, 'senderType', 'customer') as SenderType,
    content: getObject(record, 'content', { text: '' }),
    providerMessageId: getString(record, 'providerMessageId'),
    deliveryStatus: getString(record, 'deliveryStatus', 'sent') as DeliveryStatus,
    providerMetadata: getObject(record, 'providerMetadata', {}),
    createdAt: fieldToISO(record, 'createdAt'),
    updatedAt: fieldToISO(record, 'updatedAt'),
  };
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * 🏢 ENTERPRISE: Realtime listener για conversation messages
 *
 * Αντικαθιστά το polling με Firestore onSnapshot για instant updates.
 * Τα νέα μηνύματα εμφανίζονται αυτόματα χωρίς refresh.
 *
 * @param conversationId - Το ID του conversation
 * @param options - Configuration options
 * @returns Messages με realtime updates
 *
 * @example
 * ```tsx
 * const { messages, connected } = useRealtimeMessages('conv-123', {
 *   enabled: true,
 *   limitCount: 50
 * });
 * ```
 */
export function useRealtimeMessages(
  conversationId: string | null,
  options: UseRealtimeMessagesOptions = {}
): UseRealtimeMessagesResult {
  const { enabled = true, limitCount = 50 } = options;

  const [messages, setMessages] = useState<MessageListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const previousMessageIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  const { user } = useAuth();

  useEffect(() => {
    // Reset state when conversation changes
    setMessages([]);
    setError(null);
    setConnected(false);
    previousMessageIdsRef.current.clear();
    isInitialLoadRef.current = true;

    // Don't start listener if disabled or no conversation
    if (!enabled || !conversationId) {
      return;
    }

    setLoading(true);

    // 🏢 ENTERPRISE: Canonical pattern via firestoreQueryService.subscribe (ADR-227 Phase 2)
    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      'MESSAGES',
      (result: QueryResult<DocumentData>) => {
        logger.info('Received messages', { count: result.documents.length, conversationId });

        // Convert + reverse for chronological display (query is DESC)
        const newMessages = result.documents.map(doc =>
          docToMessage(doc as DocumentData & { id: string })
        ).reverse();

        // 🔔 NOTIFICATION DISPATCH: Detect new inbound messages
        if (!isInitialLoadRef.current && user) {
          const currentMessageIds = new Set(result.documents.map(doc => doc.id));

          const newInboundMessages = newMessages.filter((msg) => {
            const isNew = !previousMessageIdsRef.current.has(msg.id);
            const isInbound = msg.direction === 'inbound';
            return isNew && isInbound;
          });

          // Dispatch notifications for new inbound messages (fire-and-forget)
          for (const message of newInboundMessages) {
            apiClient.post(API_ROUTES.NOTIFICATIONS.DISPATCH, {
              messageId: message.id,
              conversationId: message.conversationId,
              recipientId: user.uid,
              tenantId: user.uid,
              direction: message.direction,
              content: message.content,
              channel: message.channel,
            }).catch(err => {
              logger.error('Failed to dispatch notification', { error: err });
            });
          }

          previousMessageIdsRef.current = currentMessageIds;
        } else {
          // Initial load - store IDs without dispatching
          isInitialLoadRef.current = false;
          previousMessageIdsRef.current = new Set(result.documents.map(doc => doc.id));
        }

        setMessages(newMessages);
        setConnected(true);
        setLoading(false);
        setError(null);
      },
      (err: Error) => {
        logger.error('Firestore listener error', { error: err });
        setError(err.message || 'Realtime connection failed');
        setConnected(false);
        setLoading(false);
      },
      {
        constraints: [
          where('conversationId', '==', conversationId),
          orderBy('createdAt', 'desc'),
        ],
        maxResults: limitCount,
      }
    );

    logger.info('Started listening', { conversationId });

    return () => {
      logger.info('Unsubscribed', { conversationId });
      unsubscribe();
    };
  }, [conversationId, enabled, limitCount]);

  return {
    messages,
    loading,
    error,
    connected,
  };
}
