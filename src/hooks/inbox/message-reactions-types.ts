/**
 * @module hooks/inbox/message-reactions-types
 * @description Types and helper functions for useMessageReactions hook.
 * Extracted from useMessageReactions.ts for SRP compliance (ADR-065).
 */

import type { MessageReaction, MessageReactionsMap } from '@/types/conversations';

// ============================================================================
// TYPES
// ============================================================================

/** Reaction action types */
export type ReactionAction = 'add' | 'remove' | 'toggle';

/** Reaction API request */
export interface ReactionRequest {
  messageId: string;
  emoji: string;
  action: ReactionAction;
}

/** Reaction API response */
export interface ReactionResponse {
  success: boolean;
  reactions?: MessageReactionsMap;
  userReactions?: string[];
  error?: string;
}

/** Message reactions state for a single message */
export interface MessageReactionsState {
  reactions: MessageReactionsMap;
  userReactions: Set<string>;
  totalCount: number;
  isLoading: boolean;
}

/** Realtime listener subscription info */
export interface RealtimeSubscription {
  messageId: string;
  unsubscribe: () => void;
}

/** Hook configuration options */
export interface UseMessageReactionsOptions {
  realtime?: boolean;
  conversationId?: string | null;
}

/** Hook return type */
export interface UseMessageReactionsReturn {
  getReactions: (messageId: string) => MessageReactionsState;
  hasUserReacted: (messageId: string, emoji: string) => boolean;
  addReaction: (messageId: string, emoji: string) => Promise<ReactionResponse>;
  removeReaction: (messageId: string, emoji: string) => Promise<ReactionResponse>;
  toggleReaction: (messageId: string, emoji: string) => Promise<ReactionResponse>;
  isLoading: (messageId: string) => boolean;
  quickEmojis: readonly import('@/types/conversations').QuickReactionEmoji[];
  initializeFromMessages: (messages: Array<{ id: string; reactions?: MessageReactionsMap; userReactions?: string[] }>) => void;
  subscribeToMessage: (messageId: string) => void;
  unsubscribeFromMessage: (messageId: string) => void;
  connected: boolean;
  currentUserId: string | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Create empty reactions state */
export function createEmptyState(): MessageReactionsState {
  return {
    reactions: {},
    userReactions: new Set(),
    totalCount: 0,
    isLoading: false,
  };
}

/** Calculate total count from reactions map */
export function calculateTotalCount(reactions: MessageReactionsMap): number {
  return Object.values(reactions).reduce((sum, r) => sum + (r.count || 0), 0);
}

/** Extract user reactions from reactions map */
export function extractUserReactions(reactions: MessageReactionsMap, userId: string): Set<string> {
  const userReactions = new Set<string>();
  Object.entries(reactions).forEach(([emoji, reaction]) => {
    if (reaction.userIds?.includes(userId)) {
      userReactions.add(emoji);
    }
  });
  return userReactions;
}

/** Parse Firestore reactions data safely */
export function parseFirestoreReactions(data: unknown): MessageReactionsMap {
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
        createdAt: reactionData.createdAt instanceof Date ? reactionData.createdAt : new Date(),
        updatedAt: reactionData.updatedAt instanceof Date ? reactionData.updatedAt : new Date(),
      };
    }
  });

  return reactions;
}
