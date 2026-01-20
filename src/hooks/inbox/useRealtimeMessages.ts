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
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { useAuth } from '@/auth/hooks/useAuth';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { MessageListItem } from './useInboxApi';
import type { MessageDirection, DeliveryStatus } from '@/types/conversations';
import type { CommunicationChannel } from '@/types/communications';
import type { SenderType } from '@/config/domain-constants';

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

function getString(data: Record<string, unknown>, field: string, defaultValue = ''): string {
  const value = data[field];
  return typeof value === 'string' ? value : defaultValue;
}

function getObject<T extends Record<string, unknown>>(
  data: Record<string, unknown>,
  field: string,
  defaultValue: T
): T {
  const value = data[field];
  return typeof value === 'object' && value !== null ? (value as T) : defaultValue;
}

function getTimestampString(data: Record<string, unknown>, field: string): string {
  const value = data[field];
  if (!value) return '';

  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const firestoreTimestamp = value as { toDate: () => Date };
    return firestoreTimestamp.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }

  return '';
}

/**
 * Convert Firestore document to MessageListItem
 */
function docToMessage(doc: { id: string; data: () => unknown }): MessageListItem {
  const data = doc.data() as Record<string, unknown>;

  return {
    id: doc.id,
    conversationId: getString(data, 'conversationId'),
    direction: getString(data, 'direction') as MessageDirection,
    channel: getString(data, 'channel', 'telegram') as CommunicationChannel,
    senderId: getString(data, 'senderId'),
    senderName: getString(data, 'senderName'),
    senderType: getString(data, 'senderType', 'customer') as SenderType,
    content: getObject(data, 'content', { text: '' }),
    providerMessageId: getString(data, 'providerMessageId'),
    deliveryStatus: getString(data, 'deliveryStatus', 'sent') as DeliveryStatus,
    providerMetadata: getObject(data, 'providerMetadata', {}),
    createdAt: getTimestampString(data, 'createdAt'),
    updatedAt: getTimestampString(data, 'updatedAt'),
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

  const unsubscribeRef = useRef<Unsubscribe | null>(null);
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

    try {
      // 🏢 ENTERPRISE: Firestore realtime query
      // Messages are in ROOT collection, NOT subcollection!
      const messagesRef = collection(db, COLLECTIONS.MESSAGES);

      const q = query(
        messagesRef,
        where('conversationId', '==', conversationId),
        orderBy('createdAt', 'asc'),
        limit(limitCount)
      );

      // 🔥 REALTIME LISTENER
      const unsubscribe = onSnapshot(
        q,
        async (snapshot) => {
          console.log(`🔥 [Realtime] Received ${snapshot.docs.length} messages for ${conversationId}`);

          // Convert Firestore docs to MessageListItem
          const newMessages = snapshot.docs.map(docToMessage);

          // 🔔 NOTIFICATION DISPATCH: Detect new inbound messages
          if (!isInitialLoadRef.current && user) {
            const currentMessageIds = new Set(snapshot.docs.map((doc) => doc.id));

            // Find NEW messages (not in previous set)
            const newInboundMessages = newMessages.filter((msg) => {
              const isNew = !previousMessageIdsRef.current.has(msg.id);
              const isInbound = msg.direction === 'inbound';
              return isNew && isInbound;
            });

            // Dispatch notifications για νέα inbound messages
            for (const message of newInboundMessages) {
              try {
                // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
                await apiClient.post('/api/notifications/dispatch', {
                  messageId: message.id,
                  conversationId: message.conversationId,
                  recipientId: user.uid,
                  tenantId: user.uid, // TODO: Replace with actual tenantId from conversation
                  direction: message.direction,
                  content: message.content,
                  channel: message.channel,
                });
              } catch (err) {
                console.error('[Realtime] Failed to dispatch notification:', err);
              }
            }

            // Update previous message IDs
            previousMessageIdsRef.current = currentMessageIds;
          } else {
            // Initial load - store IDs without dispatching
            isInitialLoadRef.current = false;
            previousMessageIdsRef.current = new Set(snapshot.docs.map((doc) => doc.id));
          }

          setMessages(newMessages);
          setConnected(true);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error('❌ [Realtime] Firestore listener error:', err);
          setError(err.message || 'Realtime connection failed');
          setConnected(false);
          setLoading(false);
        }
      );

      // Store unsubscribe function
      unsubscribeRef.current = unsubscribe;

      console.log(`✅ [Realtime] Started listening to ${conversationId}`);
    } catch (err) {
      console.error('❌ [Realtime] Failed to start listener:', err);
      setError(err instanceof Error ? err.message : 'Failed to start realtime listener');
      setLoading(false);
    }

    // Cleanup: unsubscribe when conversation changes or component unmounts
    return () => {
      if (unsubscribeRef.current) {
        console.log(`🔌 [Realtime] Unsubscribed from ${conversationId}`);
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [conversationId, enabled, limitCount]);

  return {
    messages,
    loading,
    error,
    connected,
  };
}
