'use client';

/**
 * =============================================================================
 * MESSAGE REPLY/FORWARD HOOK - ENTERPRISE OMNICHANNEL
 * =============================================================================
 *
 * Centralized hook for message reply and forward functionality.
 * Designed for reuse across all communication channels.
 *
 * @module hooks/inbox/useMessageReply
 * @enterprise Omnichannel Communications
 * @reusable Works with Telegram, Email, WhatsApp, SMS, etc.
 */

import { useState, useCallback } from 'react';
import type { MessageListItem } from './useInboxApi';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Reply mode state
 */
export type ReplyMode = 'none' | 'reply' | 'forward';

/**
 * Quoted message for display in composer
 */
export interface QuotedMessage {
  id: string;
  text: string;
  senderName: string;
  createdAt: string;
}

/**
 * Hook return type
 */
export interface UseMessageReplyReturn {
  /** Current reply mode */
  mode: ReplyMode;
  /** Quoted message (when replying) */
  quotedMessage: QuotedMessage | null;
  /** Start reply to a message */
  startReply: (message: MessageListItem) => void;
  /** Start forward of a message */
  startForward: (message: MessageListItem) => void;
  /** Cancel reply/forward */
  cancelReply: () => void;
  /** Clear after send */
  clearAfterSend: () => void;
  /** Check if in reply mode */
  isReplying: boolean;
  /** Check if in forward mode */
  isForwarding: boolean;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Centralized message reply/forward hook
 *
 * Manages reply and forward state for the message composer.
 * Works across all communication channels (Telegram, Email, WhatsApp, SMS).
 *
 * @example
 * ```tsx
 * const {
 *   mode,
 *   quotedMessage,
 *   startReply,
 *   startForward,
 *   cancelReply,
 *   isReplying,
 *   isForwarding,
 * } = useMessageReply();
 *
 * // In context menu
 * <MessageContextMenu
 *   onReply={(id) => {
 *     const msg = messages.find(m => m.id === id);
 *     if (msg) startReply(msg);
 *   }}
 *   onForward={(id) => {
 *     const msg = messages.find(m => m.id === id);
 *     if (msg) startForward(msg);
 *   }}
 * />
 * ```
 */
export function useMessageReply(): UseMessageReplyReturn {
  const [mode, setMode] = useState<ReplyMode>('none');
  const [quotedMessage, setQuotedMessage] = useState<QuotedMessage | null>(null);

  // Start reply to a message
  const startReply = useCallback((message: MessageListItem) => {
    setMode('reply');
    setQuotedMessage({
      id: message.id,
      text: message.content.text || '',
      senderName: message.senderName,
      createdAt: message.createdAt,
    });
  }, []);

  // Start forward of a message
  const startForward = useCallback((message: MessageListItem) => {
    setMode('forward');
    setQuotedMessage({
      id: message.id,
      text: message.content.text || '',
      senderName: message.senderName,
      createdAt: message.createdAt,
    });
  }, []);

  // Cancel reply/forward
  const cancelReply = useCallback(() => {
    setMode('none');
    setQuotedMessage(null);
  }, []);

  // Clear after successful send
  const clearAfterSend = useCallback(() => {
    setMode('none');
    setQuotedMessage(null);
  }, []);

  return {
    mode,
    quotedMessage,
    startReply,
    startForward,
    cancelReply,
    clearAfterSend,
    isReplying: mode === 'reply',
    isForwarding: mode === 'forward',
  };
}

export default useMessageReply;
