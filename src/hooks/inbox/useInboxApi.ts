'use client';

/**
 * =============================================================================
 * INBOX API HOOKS - ENTERPRISE SSoT
 * =============================================================================
 *
 * Centralized API hooks for Inbox UI (EPIC Δ).
 * All conversations/messages data flows through these hooks.
 *
 * @module hooks/inbox/useInboxApi
 * @enterprise ADR-030 - Zero Hardcoded Values
 * @security All requests require staff-only Bearer token
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
import {
  INBOX_POLL_MS,
  THREAD_POLL_MS,
  INBOX_PAGE_SIZE,
  MESSAGES_PAGE_SIZE,
} from '@/config/domain-constants';
import type { ConversationStatus, MessageDirection, DeliveryStatus, MessageAttachment } from '@/types/conversations';
import type { CommunicationChannel } from '@/types/communications';
import type { SenderType } from '@/config/domain-constants';
import { useRealtimeMessages } from './useRealtimeMessages';

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Conversation list item from API
 */
export interface ConversationListItem {
  id: string;
  channel: CommunicationChannel;
  status: ConversationStatus;
  messageCount: number;
  unreadCount: number;
  lastMessage: {
    content: string;
    direction: MessageDirection;
    timestamp: string;
  } | null;
  participants: Array<{
    displayName: string;
    role: string;
    isInternal: boolean;
  }>;
  tags: string[];
  assignedTo: string | null;
  audit: {
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * Message list item from API
 */
export interface MessageListItem {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  channel: CommunicationChannel;
  senderId: string;
  senderName: string;
  senderType: SenderType;
  content: {
    text: string;
    /** 🏢 ENTERPRISE: Uses canonical MessageAttachment type (ADR-055) */
    attachments?: MessageAttachment[];
  };
  providerMessageId: string;
  deliveryStatus: DeliveryStatus;
  providerMetadata: {
    platform?: string;
    chatId?: string;
    userName?: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Conversations list response
 */
interface ConversationsResponse {
  conversations: ConversationListItem[];
  count: number;
  totalCount: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
  loadedAt: string;
  source: 'cache' | 'firestore';
}

/**
 * Messages list response
 */
interface MessagesResponse {
  messages: MessageListItem[];
  count: number;
  totalCount: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
  conversationId: string;
  loadedAt: string;
  source: 'cache' | 'firestore';
}

/**
 * Send message response
 */
interface SendMessageResponse {
  success: boolean;
  messageId: string | null;
  providerMessageId: number | null;
  conversationId: string;
  sentAt: string;
}

// ============================================================================
// NOTE: Auth is handled by apiClient automatically
// ============================================================================

// ============================================================================
// useConversations HOOK
// ============================================================================

interface UseConversationsOptions {
  status?: ConversationStatus;
  channel?: CommunicationChannel;
  page?: number;
  pageSize?: number;
  polling?: boolean;
}

interface UseConversationsResult {
  conversations: ConversationListItem[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  page: number;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

/**
 * Hook for fetching conversations list
 * @enterprise Uses staff-only API endpoint with polling support
 */
export function useConversations(options: UseConversationsOptions = {}): UseConversationsResult {
  const {
    status,
    channel,
    page: initialPage = 1,
    pageSize = INBOX_PAGE_SIZE,
    polling = false,
  } = options;

  // 🏢 ENTERPRISE: Wait for auth state before fetching
  const { user, loading: authLoading } = useAuth();

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(initialPage);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const fetchConversations = useCallback(async (pageNum: number = currentPage, append: boolean = false) => {
    try {
      if (!append) {
        setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams();
      params.set('page', String(pageNum));
      params.set('pageSize', String(pageSize));
      if (status) params.set('status', status);
      if (channel) params.set('channel', channel);

      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      // apiClient.get() automatically unwraps canonical { success: true, data: T } responses
      // Returns T directly (not wrapped in .data)
      const result = await apiClient.get<ConversationsResponse>(`/api/conversations?${params.toString()}`);

      // 🏢 ENTERPRISE: Null safety check (Defense-in-Depth)
      if (!result || !Array.isArray(result.conversations)) {
        throw new Error('Invalid API response format');
      }

      if (mountedRef.current) {
        if (append) {
          setConversations(prev => [...prev, ...result.conversations]);
        } else {
          setConversations(result.conversations);
        }
        setTotalCount(result.totalCount ?? 0);
        setHasMore(result.hasMore ?? false);
        setCurrentPage(pageNum);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load conversations');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [currentPage, pageSize, status, channel]);

  const refresh = useCallback(async () => {
    setCurrentPage(1);
    await fetchConversations(1, false);
  }, [fetchConversations]);

  const loadMore = useCallback(async () => {
    if (hasMore && !loading) {
      await fetchConversations(currentPage + 1, true);
    }
  }, [hasMore, loading, currentPage, fetchConversations]);

  // Initial load - wait for auth before fetching
  useEffect(() => {
    mountedRef.current = true;

    // 🏢 ENTERPRISE: Only fetch when user is authenticated
    if (!authLoading && user) {
      fetchConversations(1, false);
    } else if (!authLoading && !user) {
      // User not authenticated - clear loading and set error
      setLoading(false);
      setError('Not authenticated');
    }

    return () => {
      mountedRef.current = false;
    };
  }, [status, channel, pageSize, user, authLoading]);

  // Polling - only when authenticated
  useEffect(() => {
    if (polling && user && !authLoading) {
      pollingRef.current = setInterval(() => {
        fetchConversations(1, false);
      }, INBOX_POLL_MS);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [polling, fetchConversations, user, authLoading]);

  return {
    conversations,
    loading,
    error,
    totalCount,
    hasMore,
    page: currentPage,
    refresh,
    loadMore,
  };
}

// ============================================================================
// useConversationMessages HOOK
// ============================================================================

interface UseConversationMessagesOptions {
  page?: number;
  pageSize?: number;
  order?: 'asc' | 'desc';
  polling?: boolean;
  /** 🔥 Use Firestore realtime listener instead of polling (recommended) */
  realtime?: boolean;
}

interface UseConversationMessagesResult {
  messages: MessageListItem[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  page: number;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

/**
 * Hook for fetching messages in a conversation
 * @enterprise Uses staff-only API endpoint with polling support OR Firestore realtime
 */
export function useConversationMessages(
  conversationId: string | null,
  options: UseConversationMessagesOptions = {}
): UseConversationMessagesResult {
  const {
    page: initialPage = 1,
    pageSize = MESSAGES_PAGE_SIZE,
    order = 'asc',
    polling = false,
    realtime = false, // 🔥 NEW: Realtime option
  } = options;

  // 🏢 ENTERPRISE: Wait for auth state before fetching
  const { user, loading: authLoading } = useAuth();

  // 🔥 REALTIME: Use Firestore listener when realtime=true
  const {
    messages: realtimeMessages,
    loading: realtimeLoading,
    error: realtimeError,
    connected,
  } = useRealtimeMessages(conversationId, {
    enabled: realtime && !!user && !authLoading,
    limitCount: pageSize,
  });

  const [messages, setMessages] = useState<MessageListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(initialPage);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // 🔥 REALTIME: Update messages when realtime data changes
  useEffect(() => {
    if (realtime) {
      setMessages(realtimeMessages);
      setLoading(realtimeLoading);
      setError(realtimeError);
    }
  }, [realtime, realtimeMessages, realtimeLoading, realtimeError]);

  const fetchMessages = useCallback(async (pageNum: number = currentPage, append: boolean = false) => {
    if (!conversationId) return;

    try {
      if (!append) {
        setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams();
      params.set('page', String(pageNum));
      params.set('pageSize', String(pageSize));
      params.set('order', order);

      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      // apiClient.get() automatically unwraps canonical { success: true, data: T } responses
      // Returns T directly (not wrapped in .data)
      const result = await apiClient.get<MessagesResponse>(`/api/conversations/${conversationId}/messages?${params.toString()}`);

      if (mountedRef.current) {
        if (append) {
          // Prepend for "load earlier" functionality
          setMessages(prev => [...result.messages, ...prev]);
        } else {
          setMessages(result.messages);
        }
        setTotalCount(result.totalCount);
        setHasMore(result.hasMore);
        setCurrentPage(pageNum);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load messages');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [conversationId, currentPage, pageSize, order]);

  const refresh = useCallback(async () => {
    setCurrentPage(1);
    await fetchMessages(1, false);
  }, [fetchMessages]);

  const loadMore = useCallback(async () => {
    if (hasMore && !loading) {
      await fetchMessages(currentPage + 1, true);
    }
  }, [hasMore, loading, currentPage, fetchMessages]);

  // Reset when conversation changes
  useEffect(() => {
    setMessages([]);
    setCurrentPage(1);
    setTotalCount(0);
    setHasMore(false);
    setError(null);
  }, [conversationId]);

  // Fetch when conversation changes - wait for auth (SKIP if realtime mode)
  useEffect(() => {
    mountedRef.current = true;
    if (!realtime && conversationId && user && !authLoading) {
      fetchMessages(1, false);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [conversationId, pageSize, order, user, authLoading, realtime, fetchMessages]);

  // Polling - only when authenticated (SKIP if realtime mode)
  useEffect(() => {
    if (!realtime && polling && conversationId && user && !authLoading) {
      pollingRef.current = setInterval(() => {
        fetchMessages(1, false);
      }, THREAD_POLL_MS);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [polling, conversationId, fetchMessages, realtime]);

  return {
    messages,
    loading,
    error,
    totalCount,
    hasMore,
    page: currentPage,
    refresh,
    loadMore,
  };
}

// ============================================================================
// useSendMessage HOOK
// ============================================================================

interface SendMessageOptions {
  text: string;
  replyToMessageId?: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}

interface UseSendMessageResult {
  send: (options: SendMessageOptions) => Promise<SendMessageResponse | null>;
  sending: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Hook for sending messages in a conversation
 * @enterprise Uses staff-only API endpoint
 */
export function useSendMessage(conversationId: string | null): UseSendMessageResult {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (options: SendMessageOptions): Promise<SendMessageResponse | null> => {
    if (!conversationId) {
      setError('No conversation selected');
      return null;
    }

    try {
      setSending(true);
      setError(null);

      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      // apiClient.post() automatically unwraps canonical { success: true, data: T } responses
      // Returns T directly (not wrapped in .data)
      const result = await apiClient.post<SendMessageResponse>(
        `/api/conversations/${conversationId}/send`,
        options
      );

      return result ?? null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      return null;
    } finally {
      setSending(false);
    }
  }, [conversationId]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    send,
    sending,
    error,
    clearError,
  };
}
