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
import { useInterval } from '@/hooks/useInterval';
import { useAuth } from '@/auth/hooks/useAuth';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
import { createStaleCache } from '@/lib/stale-cache';
import { getErrorMessage } from '@/lib/error-utils';
import {
  INBOX_POLL_MS,
  THREAD_POLL_MS,
  INBOX_PAGE_SIZE,
  MESSAGES_PAGE_SIZE,
  API_ROUTES,
} from '@/config/domain-constants';
import type { ConversationStatus, MessageDirection, DeliveryStatus, MessageAttachment } from '@/types/conversations';
import type { CommunicationChannel } from '@/types/communications';
import type { SenderType } from '@/config/domain-constants';
import { useRealtimeMessages } from './useRealtimeMessages';

const conversationsCache = createStaleCache<ConversationListItem[]>('inbox-conversations');

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

  const _convCacheKey = `${user?.uid ?? ''}-${status ?? 'all'}-${channel ?? 'all'}`;
  const [conversations, setConversations] = useState<ConversationListItem[]>(
    conversationsCache.get(_convCacheKey) ?? []
  );
  const [loading, setLoading] = useState(!conversationsCache.hasLoaded(_convCacheKey));
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(initialPage);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const fetchConversations = useCallback(async (pageNum: number = currentPage, append: boolean = false) => {
    const cacheKey = `${user?.uid ?? ''}-${status ?? 'all'}-${channel ?? 'all'}`;
    try {
      if (!append) {
        if (!conversationsCache.hasLoaded(cacheKey)) setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams();
      params.set('page', String(pageNum));
      params.set('pageSize', String(pageSize));
      if (status) params.set('status', status);
      if (channel) params.set('channel', channel);

      const result = await apiClient.get<ConversationsResponse>(`${API_ROUTES.CONVERSATIONS.LIST}?${params.toString()}`);
      if (!result || !Array.isArray(result.conversations)) {
        throw new Error('Invalid API response format');
      }

      if (mountedRef.current) {
        if (append) {
          setConversations(prev => [...prev, ...result.conversations]);
        } else {
          if (pageNum === 1) conversationsCache.set(result.conversations, cacheKey);
          setConversations(result.conversations);
        }
        setTotalCount(result.totalCount ?? 0);
        setHasMore(result.hasMore ?? false);
        setCurrentPage(pageNum);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(getErrorMessage(err, 'Failed to load conversations'));
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

  // Polling - only when authenticated (ADR-205 Phase 4 — useInterval)
  useInterval(
    () => fetchConversations(1, false),
    polling && user && !authLoading ? INBOX_POLL_MS : null,
  );

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

      const result = await apiClient.get<MessagesResponse>(`${API_ROUTES.CONVERSATIONS.MESSAGES(conversationId)}?${params.toString()}`);

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
        setError(getErrorMessage(err, 'Failed to load messages'));
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

  // Polling - only when authenticated, SKIP if realtime mode (ADR-205 Phase 4 — useInterval)
  useInterval(
    () => fetchMessages(1, false),
    !realtime && polling && conversationId && user && !authLoading ? THREAD_POLL_MS : null,
  );

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
  /** 🏢 ADR-055: Attachments for outbound messages */
  attachments?: MessageAttachment[];
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

      const result = await apiClient.post<SendMessageResponse>(
        API_ROUTES.CONVERSATIONS.SEND(conversationId),
        options
      );

      return result ?? null;
    } catch (err) {
      const errorMessage = getErrorMessage(err, 'Failed to send message');
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
