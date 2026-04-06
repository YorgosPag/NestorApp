'use client';

/**
 * =============================================================================
 * MESSAGE REACTIONS HOOK - ENTERPRISE OMNICHANNEL
 * =============================================================================
 *
 * Centralized hook for Telegram-style message reactions with real-time sync.
 * Types and helpers extracted to message-reactions-types.ts (ADR-065).
 *
 * 🏢 ENTERPRISE FEATURES:
 * - Real-time Firestore listeners (instant updates from other users)
 * - Optimistic updates with automatic rollback on failure
 * - Proper auth integration (actual userId, not placeholder)
 * - Connection state tracking
 * - Telegram webhook compatibility
 *
 * @module hooks/inbox/useMessageReactions
 * @enterprise Omnichannel Communications
 * @reusable Works with Telegram, Email, WhatsApp, SMS, etc.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/auth/hooks/useAuth';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { MessageReaction, MessageReactionsMap } from '@/types/conversations';
import { QUICK_REACTION_EMOJIS } from '@/types/conversations';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { API_ROUTES } from '@/config/domain-constants';

import type {
  ReactionResponse,
  MessageReactionsState,
  RealtimeSubscription,
  UseMessageReactionsOptions,
  UseMessageReactionsReturn,
} from './message-reactions-types';
import {
  createEmptyState,
  calculateTotalCount,
  extractUserReactions,
  parseFirestoreReactions,
} from './message-reactions-types';

// Re-export types for consumers
export type { ReactionAction, ReactionRequest, ReactionResponse, MessageReactionsState, UseMessageReactionsOptions, UseMessageReactionsReturn } from './message-reactions-types';

const logger = createModuleLogger('useMessageReactions');

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Centralized message reactions hook with real-time sync
 *
 * @example
 * ```tsx
 * const { getReactions, hasUserReacted, toggleReaction, quickEmojis, connected } =
 *   useMessageReactions({ realtime: true, conversationId: 'conv-123' });
 *
 * const { reactions, totalCount } = getReactions(messageId);
 * await toggleReaction(messageId, '❤️');
 * ```
 */
export function useMessageReactions(
  options: UseMessageReactionsOptions = {}
): UseMessageReactionsReturn {
  const { realtime = true, conversationId } = options;

  const { user } = useAuth();
  const currentUserId = user?.uid || null;

  const [reactionsMap, setReactionsMap] = useState<Map<string, MessageReactionsState>>(new Map());
  const [loadingSet, setLoadingSet] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);

  const subscriptionsRef = useRef<Map<string, RealtimeSubscription>>(new Map());
  const previousStateRef = useRef<Map<string, MessageReactionsState>>(new Map());

  // ── Realtime Subscriptions ──

  const subscribeToMessage = useCallback((messageId: string) => {
    if (!realtime || !messageId) return;
    if (subscriptionsRef.current.has(messageId)) return;

    try {
      const messageRef = doc(db, COLLECTIONS.MESSAGES, messageId);

      const unsubscribe = onSnapshot(
        messageRef,
        (docSnapshot) => {
          if (!docSnapshot.exists()) return;
          const data = docSnapshot.data();
          const reactions = parseFirestoreReactions(data?.reactions);

          setReactionsMap(prev => {
            const newMap = new Map(prev);
            newMap.set(messageId, {
              reactions,
              userReactions: currentUserId ? extractUserReactions(reactions, currentUserId) : new Set(),
              totalCount: calculateTotalCount(reactions),
              isLoading: loadingSet.has(messageId),
            });
            return newMap;
          });
          setConnected(true);
        },
        (error) => {
          logger.error('Realtime error', { messageId, error });
          setConnected(false);
        }
      );

      subscriptionsRef.current.set(messageId, { messageId, unsubscribe });
    } catch (error) {
      logger.error('Failed to subscribe', { error });
    }
  }, [realtime, currentUserId, loadingSet]);

  const unsubscribeFromMessage = useCallback((messageId: string) => {
    const subscription = subscriptionsRef.current.get(messageId);
    if (subscription) {
      subscription.unsubscribe();
      subscriptionsRef.current.delete(messageId);
    }
  }, []);

  useEffect(() => {
    return () => {
      subscriptionsRef.current.forEach(sub => sub.unsubscribe());
      subscriptionsRef.current.clear();
    };
  }, []);

  // ── State Accessors ──

  const getReactions = useCallback((messageId: string): MessageReactionsState => {
    return reactionsMap.get(messageId) || createEmptyState();
  }, [reactionsMap]);

  const hasUserReacted = useCallback((messageId: string, emoji: string): boolean => {
    return reactionsMap.get(messageId)?.userReactions.has(emoji) || false;
  }, [reactionsMap]);

  const isLoading = useCallback((messageId: string): boolean => {
    return loadingSet.has(messageId);
  }, [loadingSet]);

  // ── Initialization ──

  const initializeFromMessages = useCallback((
    messages: Array<{ id: string; reactions?: MessageReactionsMap; userReactions?: string[] }>
  ) => {
    setReactionsMap(prev => {
      const newMap = new Map(prev);
      messages.forEach(msg => {
        const reactions = msg.reactions || {};
        newMap.set(msg.id, {
          reactions,
          userReactions: currentUserId ? extractUserReactions(reactions, currentUserId) : new Set(msg.userReactions || []),
          totalCount: calculateTotalCount(reactions),
          isLoading: false,
        });
        if (realtime) subscribeToMessage(msg.id);
      });
      return newMap;
    });
  }, [currentUserId, realtime, subscribeToMessage]);

  // ── Optimistic Update Helpers ──

  const saveStateForRollback = useCallback((messageId: string) => {
    const currentState = reactionsMap.get(messageId);
    if (currentState) previousStateRef.current.set(messageId, { ...currentState });
  }, [reactionsMap]);

  const rollbackState = useCallback((messageId: string) => {
    const previousState = previousStateRef.current.get(messageId);
    if (previousState) {
      setReactionsMap(prev => { const newMap = new Map(prev); newMap.set(messageId, previousState); return newMap; });
      previousStateRef.current.delete(messageId);
    }
  }, []);

  const clearLoadingForMessage = useCallback((messageId: string) => {
    setLoadingSet(prev => { const newSet = new Set(prev); newSet.delete(messageId); return newSet; });
    setReactionsMap(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(messageId);
      if (current) newMap.set(messageId, { ...current, isLoading: false });
      return newMap;
    });
  }, []);

  // ── Reaction Operations ──

  const addReaction = useCallback(async (messageId: string, emoji: string): Promise<ReactionResponse> => {
    if (!currentUserId) return { success: false, error: 'User not authenticated' };

    saveStateForRollback(messageId);

    setReactionsMap(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(messageId) || createEmptyState();
      const existingReaction = current.reactions[emoji];
      const newReaction: MessageReaction = existingReaction
        ? { ...existingReaction, count: existingReaction.count + 1, userIds: [...existingReaction.userIds, currentUserId], updatedAt: new Date() }
        : { emoji, userIds: [currentUserId], count: 1, createdAt: new Date(), updatedAt: new Date() };
      const newReactions = { ...current.reactions, [emoji]: newReaction };
      const newUserReactions = new Set(current.userReactions);
      newUserReactions.add(emoji);
      newMap.set(messageId, { reactions: newReactions, userReactions: newUserReactions, totalCount: calculateTotalCount(newReactions), isLoading: true });
      return newMap;
    });

    setLoadingSet(prev => new Set([...prev, messageId]));

    try {
      const response = await apiClient.post<ReactionResponse>(API_ROUTES.MESSAGES.REACTIONS(messageId), { emoji, action: 'add' });
      if (!response.success) { rollbackState(messageId); return { success: false, error: response.error || 'Failed to add reaction' }; }
      previousStateRef.current.delete(messageId);
      return { success: true, reactions: response.reactions, userReactions: response.userReactions };
    } catch (error) {
      logger.error('Add reaction error', { error });
      rollbackState(messageId);
      return { success: false, error: 'Network error' };
    } finally {
      clearLoadingForMessage(messageId);
    }
  }, [currentUserId, saveStateForRollback, rollbackState, clearLoadingForMessage]);

  const removeReaction = useCallback(async (messageId: string, emoji: string): Promise<ReactionResponse> => {
    if (!currentUserId) return { success: false, error: 'User not authenticated' };

    saveStateForRollback(messageId);

    setReactionsMap(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(messageId);
      if (!current) return prev;
      const reaction = current.reactions[emoji];
      if (!reaction) return prev;

      let newReactions: MessageReactionsMap;
      if (reaction.count <= 1) {
        const { [emoji]: _, ...rest } = current.reactions;
        newReactions = rest;
      } else {
        newReactions = {
          ...current.reactions,
          [emoji]: { ...reaction, count: reaction.count - 1, userIds: reaction.userIds.filter(id => id !== currentUserId), updatedAt: new Date() },
        };
      }

      const newUserReactions = new Set(current.userReactions);
      newUserReactions.delete(emoji);
      newMap.set(messageId, { reactions: newReactions, userReactions: newUserReactions, totalCount: calculateTotalCount(newReactions), isLoading: true });
      return newMap;
    });

    setLoadingSet(prev => new Set([...prev, messageId]));

    try {
      const response = await apiClient.post<ReactionResponse>(API_ROUTES.MESSAGES.REACTIONS(messageId), { emoji, action: 'remove' });
      if (!response.success) { rollbackState(messageId); return { success: false, error: response.error || 'Failed to remove reaction' }; }
      previousStateRef.current.delete(messageId);
      return { success: true, reactions: response.reactions, userReactions: response.userReactions };
    } catch (error) {
      logger.error('Remove reaction error', { error });
      rollbackState(messageId);
      return { success: false, error: 'Network error' };
    } finally {
      clearLoadingForMessage(messageId);
    }
  }, [currentUserId, saveStateForRollback, rollbackState, clearLoadingForMessage]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string): Promise<ReactionResponse> => {
    return hasUserReacted(messageId, emoji) ? removeReaction(messageId, emoji) : addReaction(messageId, emoji);
  }, [hasUserReacted, addReaction, removeReaction]);

  const quickEmojis = useMemo(() => QUICK_REACTION_EMOJIS, []);

  return {
    getReactions, hasUserReacted, addReaction, removeReaction, toggleReaction,
    isLoading, quickEmojis, initializeFromMessages,
    subscribeToMessage, unsubscribeFromMessage, connected, currentUserId,
  };
}

export default useMessageReactions;
