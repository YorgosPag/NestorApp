'use client';

/**
 * =============================================================================
 * MESSAGE PIN HOOK - ENTERPRISE OMNICHANNEL
 * =============================================================================
 *
 * Centralized hook for message pinning functionality.
 * Designed for reuse across all communication channels.
 *
 * @module hooks/inbox/useMessagePin
 * @enterprise Omnichannel Communications
 * @reusable Works with Telegram, Email, WhatsApp, SMS, etc.
 */

import { useState, useCallback } from 'react';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useMessagePin');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Pinned message info
 */
export interface PinnedMessage {
  id: string;
  text: string;
  senderName: string;
  pinnedAt: string;
  pinnedBy: string;
}

/**
 * Hook return type
 */
export interface UseMessagePinReturn {
  /** Set of pinned message IDs */
  pinnedIds: Set<string>;
  /** List of pinned messages with details */
  pinnedMessages: PinnedMessage[];
  /** Check if a message is pinned */
  isPinned: (messageId: string) => boolean;
  /** Pin a message */
  pinMessage: (messageId: string, text: string, senderName: string) => Promise<{ success: boolean; error?: string }>;
  /** Unpin a message */
  unpinMessage: (messageId: string) => Promise<{ success: boolean; error?: string }>;
  /** Toggle pin state */
  togglePin: (messageId: string, text: string, senderName: string) => Promise<{ success: boolean; error?: string }>;
  /** Loading state */
  isLoading: boolean;
  /** Pinned count */
  pinnedCount: number;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Centralized message pin hook
 *
 * Manages pinned messages state and API calls.
 * Works across all communication channels.
 *
 * Pinned messages appear at the top of the conversation for quick access.
 *
 * @example
 * ```tsx
 * const {
 *   pinnedIds,
 *   pinnedMessages,
 *   isPinned,
 *   pinMessage,
 *   unpinMessage,
 *   togglePin,
 * } = useMessagePin();
 *
 * // Check if pinned
 * if (isPinned(messageId)) { ... }
 *
 * // Toggle pin
 * await togglePin(messageId, messageText, senderName);
 * ```
 */
export function useMessagePin(): UseMessagePinReturn {
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Check if a message is pinned
  const isPinned = useCallback((messageId: string) => {
    return pinnedIds.has(messageId);
  }, [pinnedIds]);

  // Pin a message
  const pinMessage = useCallback(async (
    messageId: string,
    text: string,
    senderName: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/messages/pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          action: 'pin',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to pin message' };
      }

      // Update local state
      setPinnedIds(prev => new Set([...prev, messageId]));
      setPinnedMessages(prev => [
        ...prev,
        {
          id: messageId,
          text,
          senderName,
          pinnedAt: new Date().toISOString(),
          pinnedBy: 'current_user', // Will be replaced by actual user from API
        },
      ]);

      return { success: true };
    } catch (error) {
      logger.error('Pin error', { error });
      return { success: false, error: 'Network error' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Unpin a message
  const unpinMessage = useCallback(async (messageId: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/messages/pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          action: 'unpin',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to unpin message' };
      }

      // Update local state
      setPinnedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
      setPinnedMessages(prev => prev.filter(m => m.id !== messageId));

      return { success: true };
    } catch (error) {
      logger.error('Unpin error', { error });
      return { success: false, error: 'Network error' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Toggle pin state
  const togglePin = useCallback(async (
    messageId: string,
    text: string,
    senderName: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (pinnedIds.has(messageId)) {
      return unpinMessage(messageId);
    } else {
      return pinMessage(messageId, text, senderName);
    }
  }, [pinnedIds, pinMessage, unpinMessage]);

  return {
    pinnedIds,
    pinnedMessages,
    isPinned,
    pinMessage,
    unpinMessage,
    togglePin,
    isLoading,
    pinnedCount: pinnedIds.size,
  };
}

export default useMessagePin;
