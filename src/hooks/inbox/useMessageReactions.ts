'use client';

/**
 * =============================================================================
 * MESSAGE REACTIONS HOOK - ENTERPRISE OMNICHANNEL
 * =============================================================================
 *
 * Centralized hook for Telegram-style message reactions with real-time sync.
 * Designed for reuse across all communication channels.
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
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { useAuth } from '@/auth/hooks/useAuth';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { MessageReaction, MessageReactionsMap, QuickReactionEmoji } from '@/types/conversations';
import { QUICK_REACTION_EMOJIS } from '@/types/conversations';
import { COLLECTIONS } from '@/config/firestore-collections';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Reaction action types
 */
export type ReactionAction = 'add' | 'remove' | 'toggle';

/**
 * Reaction API request
 */
export interface ReactionRequest {
  messageId: string;
  emoji: string;
  action: ReactionAction;
}

/**
 * Reaction API response
 */
export interface ReactionResponse {
  success: boolean;
  reactions?: MessageReactionsMap;
  userReactions?: string[];
  error?: string;
}

/**
 * Message reactions state for a single message
 */
export interface MessageReactionsState {
  /** All reactions for this message */
  reactions: MessageReactionsMap;
  /** Emojis the current user has reacted with */
  userReactions: Set<string>;
  /** Total reaction count */
  totalCount: number;
  /** Is this message currently loading */
  isLoading: boolean;
}

/**
 * Realtime listener subscription info
 */
interface RealtimeSubscription {
  messageId: string;
  unsubscribe: Unsubscribe;
}

/**
 * Hook configuration options
 */
export interface UseMessageReactionsOptions {
  /** Enable real-time Firestore listeners */
  realtime?: boolean;
  /** Conversation ID for scoped listeners */
  conversationId?: string | null;
}

/**
 * Hook return type
 */
export interface UseMessageReactionsReturn {
  /** Get reactions for a specific message */
  getReactions: (messageId: string) => MessageReactionsState;
  /** Check if current user has reacted with emoji */
  hasUserReacted: (messageId: string, emoji: string) => boolean;
  /** Add a reaction */
  addReaction: (messageId: string, emoji: string) => Promise<ReactionResponse>;
  /** Remove a reaction */
  removeReaction: (messageId: string, emoji: string) => Promise<ReactionResponse>;
  /** Toggle reaction (add if not present, remove if present) */
  toggleReaction: (messageId: string, emoji: string) => Promise<ReactionResponse>;
  /** Check if a specific message is loading */
  isLoading: (messageId: string) => boolean;
  /** Quick reaction emojis constant */
  quickEmojis: readonly QuickReactionEmoji[];
  /** Initialize reactions from fetched messages */
  initializeFromMessages: (messages: Array<{ id: string; reactions?: MessageReactionsMap; userReactions?: string[] }>) => void;
  /** Subscribe to real-time updates for a message */
  subscribeToMessage: (messageId: string) => void;
  /** Unsubscribe from a message */
  unsubscribeFromMessage: (messageId: string) => void;
  /** Real-time connection status */
  connected: boolean;
  /** Current user ID (for ownership checks) */
  currentUserId: string | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create empty reactions state
 */
function createEmptyState(): MessageReactionsState {
  return {
    reactions: {},
    userReactions: new Set(),
    totalCount: 0,
    isLoading: false,
  };
}

/**
 * Calculate total count from reactions map
 */
function calculateTotalCount(reactions: MessageReactionsMap): number {
  return Object.values(reactions).reduce((sum, r) => sum + (r.count || 0), 0);
}

/**
 * Extract user reactions from reactions map
 */
function extractUserReactions(reactions: MessageReactionsMap, userId: string): Set<string> {
  const userReactions = new Set<string>();
  Object.entries(reactions).forEach(([emoji, reaction]) => {
    if (reaction.userIds?.includes(userId)) {
      userReactions.add(emoji);
    }
  });
  return userReactions;
}

/**
 * Parse Firestore reactions data safely
 */
function parseFirestoreReactions(data: unknown): MessageReactionsMap {
  if (!data || typeof data !== 'object') return {};

  const reactions: MessageReactionsMap = {};
  const dataObj = data as Record<string, unknown>;

  Object.entries(dataObj).forEach(([emoji, value]) => {
    if (value && typeof value === 'object') {
      const reactionData = value as Record<string, unknown>;
      reactions[emoji] = {
        emoji,
        userIds: Array.isArray(reactionData.userIds) ? reactionData.userIds : [],
        userNames: Array.isArray(reactionData.userNames) ? reactionData.userNames : undefined,
        count: typeof reactionData.count === 'number' ? reactionData.count : 0,
        createdAt: reactionData.createdAt instanceof Date
          ? reactionData.createdAt
          : new Date(),
        updatedAt: reactionData.updatedAt instanceof Date
          ? reactionData.updatedAt
          : new Date(),
      };
    }
  });

  return reactions;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Centralized message reactions hook with real-time sync
 *
 * Features:
 * - Real-time Firestore listeners for live updates
 * - Optimistic updates for instant UI feedback
 * - Automatic rollback on API failure
 * - Proper auth integration
 * - Connection state tracking
 *
 * @example
 * ```tsx
 * const {
 *   getReactions,
 *   hasUserReacted,
 *   toggleReaction,
 *   quickEmojis,
 *   connected,
 * } = useMessageReactions({ realtime: true, conversationId: 'conv-123' });
 *
 * // Get reactions for a message
 * const { reactions, totalCount } = getReactions(messageId);
 *
 * // Toggle reaction with proper auth
 * await toggleReaction(messageId, '❤️');
 * ```
 */
export function useMessageReactions(
  options: UseMessageReactionsOptions = {}
): UseMessageReactionsReturn {
  const { realtime = true, conversationId } = options;

  // 🔐 AUTH: Get current user from auth context
  const { user } = useAuth();
  const currentUserId = user?.uid || null;

  // State: messageId -> reactions state
  const [reactionsMap, setReactionsMap] = useState<Map<string, MessageReactionsState>>(new Map());

  // Loading state per message (separate from reactionsMap for performance)
  const [loadingSet, setLoadingSet] = useState<Set<string>>(new Set());

  // Real-time connection status
  const [connected, setConnected] = useState(false);

  // 🔥 REALTIME: Active subscriptions
  const subscriptionsRef = useRef<Map<string, RealtimeSubscription>>(new Map());

  // Previous state for rollback
  const previousStateRef = useRef<Map<string, MessageReactionsState>>(new Map());

  // ============================================================================
  // REALTIME SUBSCRIPTIONS
  // ============================================================================

  /**
   * Subscribe to real-time updates for a specific message
   */
  const subscribeToMessage = useCallback((messageId: string) => {
    if (!realtime || !messageId) return;

    // Already subscribed?
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
              userReactions: currentUserId
                ? extractUserReactions(reactions, currentUserId)
                : new Set(),
              totalCount: calculateTotalCount(reactions),
              isLoading: loadingSet.has(messageId),
            });
            return newMap;
          });

          setConnected(true);
        },
        (error) => {
          console.error(`[useMessageReactions] Realtime error for ${messageId}:`, error);
          setConnected(false);
        }
      );

      subscriptionsRef.current.set(messageId, { messageId, unsubscribe });
      console.log(`✅ [Reactions] Subscribed to ${messageId}`);
    } catch (error) {
      console.error('[useMessageReactions] Failed to subscribe:', error);
    }
  }, [realtime, currentUserId, loadingSet]);

  /**
   * Unsubscribe from a specific message
   */
  const unsubscribeFromMessage = useCallback((messageId: string) => {
    const subscription = subscriptionsRef.current.get(messageId);
    if (subscription) {
      subscription.unsubscribe();
      subscriptionsRef.current.delete(messageId);
      console.log(`🔌 [Reactions] Unsubscribed from ${messageId}`);
    }
  }, []);

  // Cleanup all subscriptions on unmount
  useEffect(() => {
    return () => {
      subscriptionsRef.current.forEach(sub => sub.unsubscribe());
      subscriptionsRef.current.clear();
    };
  }, []);

  // ============================================================================
  // STATE ACCESSORS
  // ============================================================================

  /**
   * Get reactions state for a message
   */
  const getReactions = useCallback((messageId: string): MessageReactionsState => {
    return reactionsMap.get(messageId) || createEmptyState();
  }, [reactionsMap]);

  /**
   * Check if current user has reacted with specific emoji
   */
  const hasUserReacted = useCallback((messageId: string, emoji: string): boolean => {
    const state = reactionsMap.get(messageId);
    return state?.userReactions.has(emoji) || false;
  }, [reactionsMap]);

  /**
   * Check if a message is currently loading
   */
  const isLoading = useCallback((messageId: string): boolean => {
    return loadingSet.has(messageId);
  }, [loadingSet]);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize reactions from fetched messages (called by parent component)
   */
  const initializeFromMessages = useCallback((
    messages: Array<{ id: string; reactions?: MessageReactionsMap; userReactions?: string[] }>
  ) => {
    setReactionsMap(prev => {
      const newMap = new Map(prev);

      messages.forEach(msg => {
        const reactions = msg.reactions || {};
        newMap.set(msg.id, {
          reactions,
          userReactions: currentUserId
            ? extractUserReactions(reactions, currentUserId)
            : new Set(msg.userReactions || []),
          totalCount: calculateTotalCount(reactions),
          isLoading: false,
        });

        // Auto-subscribe to realtime updates if enabled
        if (realtime) {
          subscribeToMessage(msg.id);
        }
      });

      return newMap;
    });
  }, [currentUserId, realtime, subscribeToMessage]);

  // ============================================================================
  // OPTIMISTIC UPDATE HELPERS
  // ============================================================================

  /**
   * Save current state for potential rollback
   */
  const saveStateForRollback = useCallback((messageId: string) => {
    const currentState = reactionsMap.get(messageId);
    if (currentState) {
      previousStateRef.current.set(messageId, { ...currentState });
    }
  }, [reactionsMap]);

  /**
   * Rollback to previous state
   */
  const rollbackState = useCallback((messageId: string) => {
    const previousState = previousStateRef.current.get(messageId);
    if (previousState) {
      setReactionsMap(prev => {
        const newMap = new Map(prev);
        newMap.set(messageId, previousState);
        return newMap;
      });
      previousStateRef.current.delete(messageId);
    }
  }, []);

  // ============================================================================
  // REACTION OPERATIONS
  // ============================================================================

  /**
   * Add a reaction to a message
   */
  const addReaction = useCallback(async (
    messageId: string,
    emoji: string
  ): Promise<ReactionResponse> => {
    if (!currentUserId) {
      return { success: false, error: 'User not authenticated' };
    }

    // Save state for rollback
    saveStateForRollback(messageId);

    // 🚀 OPTIMISTIC UPDATE
    setReactionsMap(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(messageId) || createEmptyState();

      const existingReaction = current.reactions[emoji];
      const newReaction: MessageReaction = existingReaction
        ? {
            ...existingReaction,
            count: existingReaction.count + 1,
            userIds: [...existingReaction.userIds, currentUserId],
            updatedAt: new Date(),
          }
        : {
            emoji,
            userIds: [currentUserId],
            count: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

      const newReactions = { ...current.reactions, [emoji]: newReaction };
      const newUserReactions = new Set(current.userReactions);
      newUserReactions.add(emoji);

      newMap.set(messageId, {
        reactions: newReactions,
        userReactions: newUserReactions,
        totalCount: calculateTotalCount(newReactions),
        isLoading: true,
      });

      return newMap;
    });

    setLoadingSet(prev => new Set([...prev, messageId]));

    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic auth
      const response = await apiClient.post<ReactionResponse>(
        `/api/messages/${messageId}/reactions`,
        { emoji, action: 'add' }
      );

      if (!response.success) {
        rollbackState(messageId);
        return { success: false, error: response.error || 'Failed to add reaction' };
      }

      // Clear rollback state on success
      previousStateRef.current.delete(messageId);

      return {
        success: true,
        reactions: response.reactions,
        userReactions: response.userReactions
      };
    } catch (error) {
      console.error('[useMessageReactions] Add error:', error);
      rollbackState(messageId);
      return { success: false, error: 'Network error' };
    } finally {
      setLoadingSet(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });

      // Update loading state in reactionsMap
      setReactionsMap(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(messageId);
        if (current) {
          newMap.set(messageId, { ...current, isLoading: false });
        }
        return newMap;
      });
    }
  }, [currentUserId, saveStateForRollback, rollbackState]);

  /**
   * Remove a reaction from a message
   */
  const removeReaction = useCallback(async (
    messageId: string,
    emoji: string
  ): Promise<ReactionResponse> => {
    if (!currentUserId) {
      return { success: false, error: 'User not authenticated' };
    }

    // Save state for rollback
    saveStateForRollback(messageId);

    // 🚀 OPTIMISTIC UPDATE
    setReactionsMap(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(messageId);
      if (!current) return prev;

      const reaction = current.reactions[emoji];
      if (!reaction) return prev;

      let newReactions: MessageReactionsMap;
      if (reaction.count <= 1) {
        // Remove entire reaction entry
        const { [emoji]: _, ...rest } = current.reactions;
        newReactions = rest;
      } else {
        // Decrement count and remove user
        newReactions = {
          ...current.reactions,
          [emoji]: {
            ...reaction,
            count: reaction.count - 1,
            userIds: reaction.userIds.filter(id => id !== currentUserId),
            updatedAt: new Date(),
          },
        };
      }

      const newUserReactions = new Set(current.userReactions);
      newUserReactions.delete(emoji);

      newMap.set(messageId, {
        reactions: newReactions,
        userReactions: newUserReactions,
        totalCount: calculateTotalCount(newReactions),
        isLoading: true,
      });

      return newMap;
    });

    setLoadingSet(prev => new Set([...prev, messageId]));

    try {
      const response = await apiClient.post<ReactionResponse>(
        `/api/messages/${messageId}/reactions`,
        { emoji, action: 'remove' }
      );

      if (!response.success) {
        rollbackState(messageId);
        return { success: false, error: response.error || 'Failed to remove reaction' };
      }

      previousStateRef.current.delete(messageId);

      return {
        success: true,
        reactions: response.reactions,
        userReactions: response.userReactions
      };
    } catch (error) {
      console.error('[useMessageReactions] Remove error:', error);
      rollbackState(messageId);
      return { success: false, error: 'Network error' };
    } finally {
      setLoadingSet(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });

      setReactionsMap(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(messageId);
        if (current) {
          newMap.set(messageId, { ...current, isLoading: false });
        }
        return newMap;
      });
    }
  }, [currentUserId, saveStateForRollback, rollbackState]);

  /**
   * Toggle reaction (add if not present, remove if present)
   */
  const toggleReaction = useCallback(async (
    messageId: string,
    emoji: string
  ): Promise<ReactionResponse> => {
    if (hasUserReacted(messageId, emoji)) {
      return removeReaction(messageId, emoji);
    } else {
      return addReaction(messageId, emoji);
    }
  }, [hasUserReacted, addReaction, removeReaction]);

  // ============================================================================
  // MEMOIZED VALUES
  // ============================================================================

  const quickEmojis = useMemo(() => QUICK_REACTION_EMOJIS, []);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    getReactions,
    hasUserReacted,
    addReaction,
    removeReaction,
    toggleReaction,
    isLoading,
    quickEmojis,
    initializeFromMessages,
    subscribeToMessage,
    unsubscribeFromMessage,
    connected,
    currentUserId,
  };
}

export default useMessageReactions;
