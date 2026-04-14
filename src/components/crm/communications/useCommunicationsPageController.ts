'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useUserRole } from '@/auth/hooks/useAuth';
import { useConversations, useConversationMessages, useSendMessage, type MessageListItem } from '@/hooks/inbox/useInboxApi';
import { useMessageReply } from '@/hooks/inbox/useMessageReply';
import { useMessageEdit } from '@/hooks/inbox/useMessageEdit';
import { useMessagePin } from '@/hooks/inbox/useMessagePin';
import { useMessageReactions } from '@/hooks/inbox/useMessageReactions';
import { createModuleLogger } from '@/lib/telemetry';
import { useCrmAttachmentUpload } from '@/hooks/inbox/useCrmAttachmentUpload';
import { CONVERSATION_STATUS, type MessageAttachment } from '@/types/conversations';
import { COMMUNICATION_CHANNELS } from '@/types/communications';
import { defaultCommunicationsFilters, type CommunicationsFilterState } from '@/components/core/AdvancedFilters';
import { buildCommunicationsDashboardStats } from './communicationsDashboardStats';

const logger = createModuleLogger('crm/communications');

export function useCommunicationsPageController() {
  const { t } = useTranslation(['crm', 'crm-inbox']);
  const { isLoading: authLoading, isAuthenticated, isAdmin } = useUserRole();
  const authReady = !authLoading;
  const hasStaffAccess = isAuthenticated && isAdmin;

  const [showDashboard, setShowDashboard] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'status'>('date');
  const [filters, setFilters] = useState<CommunicationsFilterState>(defaultCommunicationsFilters);

  const {
    conversations,
    loading: conversationsLoading,
    error: conversationsError,
    totalCount,
    hasMore,
    refresh: refreshConversations,
    loadMore: loadMoreConversations,
  } = useConversations({
    status: filters.status !== 'all' ? filters.status as typeof CONVERSATION_STATUS[keyof typeof CONVERSATION_STATUS] : undefined,
    channel: filters.channel !== 'all' ? filters.channel as typeof COMMUNICATION_CHANNELS[keyof typeof COMMUNICATION_CHANNELS] : undefined,
    polling: false,
  });

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    hasMore: hasMoreMessages,
    refresh: refreshMessages,
    loadMore: loadMoreMessages,
  } = useConversationMessages(selectedConversationId, {
    realtime: true,
    polling: false,
  });

  const {
    send,
    sending,
    error: sendError,
    clearError: clearSendError,
  } = useSendMessage(selectedConversationId);

  const {
    mode: replyMode,
    quotedMessage,
    startReply,
    startForward,
    cancelReply,
    clearAfterSend,
  } = useMessageReply();

  const {
    editingMessage,
    startEdit,
    updateEditText,
    cancelEdit,
    saveEdit,
    isSaving,
  } = useMessageEdit();

  const {
    isPinned,
    togglePin,
  } = useMessagePin();

  const {
    getReactions,
    toggleReaction,
  } = useMessageReactions({
    realtime: true,
    conversationId: selectedConversationId,
  });

  const filteredConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      if (selectedChannels.length > 0 && !selectedChannels.includes(conversation.channel)) {
        return false;
      }

      if (!searchTerm) {
        return true;
      }

      const searchLower = searchTerm.toLowerCase();
      const participantMatch = conversation.participants.some((participant) =>
        participant.displayName.toLowerCase().includes(searchLower),
      );
      const lastMessageMatch = conversation.lastMessage?.content.toLowerCase().includes(searchLower);
      return participantMatch || !!lastMessageMatch;
    });
  }, [conversations, searchTerm, selectedChannels]);

  const handleSelectConversation = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
  }, []);

  const handleRefreshAll = useCallback(async () => {
    await refreshConversations();
    if (selectedConversationId) {
      await refreshMessages();
    }
  }, [refreshConversations, refreshMessages, selectedConversationId]);

  const handleReply = useCallback((message: MessageListItem) => {
    logger.info('Reply action', { messageId: message.id });
    startReply(message);
  }, [startReply]);

  const handleForward = useCallback((message: MessageListItem) => {
    logger.info('Forward action', { messageId: message.id });
    startForward(message);
  }, [startForward]);

  const handleEdit = useCallback((message: MessageListItem) => {
    logger.info('Edit action', { messageId: message.id });
    startEdit(message);
  }, [startEdit]);

  const handleTogglePin = useCallback(async (messageId: string, shouldPin: boolean) => {
    logger.info('Toggle pin', { messageId, shouldPin });
    const message = messages.find((item) => item.id === messageId);
    if (message) {
      await togglePin(messageId, message.content.text || '', message.senderName);
    }
  }, [messages, togglePin]);

  const handleToggleReaction = useCallback(async (messageId: string, emoji: string) => {
    logger.info('Toggle reaction', { messageId, emoji });
    await toggleReaction(messageId, emoji);
  }, [toggleReaction]);

  const getReactionsFn = useCallback((messageId: string) => {
    const state = getReactions(messageId);
    return {
      reactions: state.reactions,
      userReactions: state.userReactions,
    };
  }, [getReactions]);

  // 🏢 ADR-293 Phase 3: Canonical upload via file-mutation-gateway
  const { handleUploadAttachment } = useCrmAttachmentUpload({ conversationId: selectedConversationId });

  const handleSendWithReply = useCallback(async (
    text: string,
    attachments?: MessageAttachment[],
  ): Promise<boolean> => {
    const messageData = quotedMessage && replyMode === 'reply'
      ? { text, replyTo: quotedMessage.id, attachments }
      : { text, attachments };

    const result = await send(messageData);
    if (result?.success) {
      clearAfterSend();
      await refreshMessages();
      return true;
    }

    return false;
  }, [send, quotedMessage, replyMode, clearAfterSend, refreshMessages]);

  const dashboardStats = useMemo(
    () => buildCommunicationsDashboardStats(conversations, totalCount, t),
    [conversations, totalCount, t],
  );

  return {
    t,
    authReady,
    isAuthenticated,
    hasStaffAccess,
    showDashboard,
    setShowDashboard,
    showMobileFilters,
    setShowMobileFilters,
    selectedConversationId,
    selectedConversation,
    searchTerm,
    setSearchTerm,
    selectedChannels,
    setSelectedChannels,
    showToolbar,
    setShowToolbar,
    selectedItems,
    setSelectedItems,
    activeFilters,
    setActiveFilters,
    sortBy,
    setSortBy,
    filters,
    setFilters,
    conversations,
    conversationsLoading,
    conversationsError,
    filteredConversations,
    totalCount,
    hasMore,
    loadMoreConversations,
    messages,
    messagesLoading,
    messagesError,
    hasMoreMessages,
    loadMoreMessages,
    refreshMessages,
    sending,
    sendError,
    clearSendError,
    replyMode,
    quotedMessage,
    cancelReply,
    editingMessage,
    updateEditText,
    cancelEdit,
    saveEdit,
    isSaving,
    isPinned,
    handleSelectConversation,
    handleRefreshAll,
    handleReply,
    handleForward,
    handleEdit,
    handleTogglePin,
    handleToggleReaction,
    getReactionsFn,
    handleUploadAttachment,
    handleSendWithReply,
    dashboardStats,
  };
}
