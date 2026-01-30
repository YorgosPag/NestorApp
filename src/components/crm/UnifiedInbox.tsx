'use client';

/**
 * =============================================================================
 * UNIFIED INBOX - EPIC Δ (REFACTORED)
 * =============================================================================
 *
 * Enterprise Inbox UI using staff-only API endpoints.
 * NO FIRESTORE DIRECT ACCESS - All data through API.
 *
 * @module components/crm/UnifiedInbox
 * @enterprise ADR-030 - Zero Hardcoded Values
 * @security Staff-only Bearer token authentication
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { CommonBadge } from '@/core/badges';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatDateTime } from '@/lib/intl-utils';
import { truncateText } from '@/lib/obligations-utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { HOVER_BACKGROUND_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import {
  MessageSquare,
  Mail,
  Search,
  RefreshCw,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Spinner } from '@/components/ui/spinner';

// 🏢 ENTERPRISE: API hooks instead of Firestore direct
import {
  useConversations,
  useConversationMessages,
  useSendMessage,
} from '@/hooks/inbox/useInboxApi';

// 🏢 ENTERPRISE: Centralized constants
import {
  MESSAGE_PREVIEW_LENGTH,
} from '@/config/domain-constants';

import { CONVERSATION_STATUS } from '@/types/conversations';
import { COMMUNICATION_CHANNELS } from '@/types/communications';

// 🏢 ENTERPRISE: Inbox sub-components
import { ThreadView } from './inbox/ThreadView';
import { ReplyComposer } from './inbox/ReplyComposer';
// 🏢 ENTERPRISE: Centralized reply/edit hooks
import { useMessageReply } from '@/hooks/inbox/useMessageReply';
import { useMessageEdit } from '@/hooks/inbox/useMessageEdit';
import { useMessagePin } from '@/hooks/inbox/useMessagePin';
import type { MessageListItem } from '@/hooks/inbox/useInboxApi';
// 🏢 ADR-055: Attachment upload support
import { PhotoUploadService } from '@/services/photo-upload.service';
import type { MessageAttachment } from '@/types/conversations';

// ============================================================================
// TYPES
// ============================================================================

interface UnifiedInboxProps {
  /** Show filters panel */
  showFilters?: boolean;
  /** Enable polling for real-time updates */
  enablePolling?: boolean;
  /** Lead/Contact ID για filtering (optional) */
  leadId?: string;
  /** Height of the inbox component */
  height?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get channel icon component
 */
function getChannelIcon(channel: string, iconSizes: ReturnType<typeof useIconSizes>) {
  switch (channel) {
    case COMMUNICATION_CHANNELS.EMAIL:
      return <Mail className={iconSizes.sm} />;
    case COMMUNICATION_CHANNELS.TELEGRAM:
    case COMMUNICATION_CHANNELS.WHATSAPP:
    case COMMUNICATION_CHANNELS.MESSENGER:
    case COMMUNICATION_CHANNELS.SMS:
      return <MessageSquare className={iconSizes.sm} />;
    default:
      return <MessageSquare className={iconSizes.sm} />;
  }
}

/**
 * Get channel color classes
 */
function getChannelColorClasses(channel: string, colors: ReturnType<typeof useSemanticColors>) {
  switch (channel) {
    case COMMUNICATION_CHANNELS.EMAIL:
      return `${colors.bg.infoSubtle} ${colors.text.info}`;
    case COMMUNICATION_CHANNELS.TELEGRAM:
      return `${colors.bg.infoSubtle} ${colors.text.info}`;
    case COMMUNICATION_CHANNELS.WHATSAPP:
      return `${colors.bg.successSubtle} ${colors.text.success}`;
    default:
      return `${colors.bg.muted} ${colors.text.muted}`;
  }
}

/**
 * Format relative time
 */
function getRelativeTime(timestamp: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffHours < 1) return t('inbox.time.now');
  if (diffHours < 24) return t('inbox.time.hoursAgo', { hours: Math.floor(diffHours) });
  if (diffHours < 48) return t('inbox.time.yesterday');

  return formatDateTime(date);
}

// ============================================================================
// COMPONENT
// ============================================================================

export function UnifiedInbox({
  showFilters = true,
  enablePolling = true,
}: UnifiedInboxProps) {
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // State
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  // 🏢 ENTERPRISE: API hooks (NO FIRESTORE DIRECT)
  const {
    conversations,
    loading: conversationsLoading,
    error: conversationsError,
    totalCount,
    hasMore,
    refresh: refreshConversations,
    loadMore: loadMoreConversations,
  } = useConversations({
    status: statusFilter !== 'all' ? statusFilter as typeof CONVERSATION_STATUS[keyof typeof CONVERSATION_STATUS] : undefined,
    channel: channelFilter !== 'all' ? channelFilter as typeof COMMUNICATION_CHANNELS[keyof typeof COMMUNICATION_CHANNELS] : undefined,
    polling: enablePolling,
  });

  const selectedConversation = useMemo(
    () => conversations.find(c => c.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    hasMore: hasMoreMessages,
    refresh: refreshMessages,
    loadMore: loadMoreMessages,
  } = useConversationMessages(selectedConversationId, {
    polling: enablePolling && !!selectedConversationId,
  });

  const {
    send,
    sending,
    error: sendError,
    clearError: clearSendError,
  } = useSendMessage(selectedConversationId);

  // 🏢 ENTERPRISE: Reply/Forward state
  const {
    mode: replyMode,
    quotedMessage,
    startReply,
    startForward,
    cancelReply,
    clearAfterSend,
  } = useMessageReply();

  // 🏢 ENTERPRISE: Edit state
  const {
    editingMessage,
    isEditing,
    startEdit,
    updateEditText,
    cancelEdit,
    saveEdit,
    isSaving,
  } = useMessageEdit();

  // 🏢 ENTERPRISE: Pin state
  const {
    isPinned,
    togglePin,
  } = useMessagePin();

  // Filter conversations by search term (client-side)
  const filteredConversations = useMemo(() => {
    if (!searchTerm) return conversations;

    const searchLower = searchTerm.toLowerCase();
    return conversations.filter(conv => {
      const participantMatch = conv.participants.some(p =>
        p.displayName.toLowerCase().includes(searchLower)
      );
      const lastMessageMatch = conv.lastMessage?.content.toLowerCase().includes(searchLower);
      return participantMatch || lastMessageMatch;
    });
  }, [conversations, searchTerm]);

  // Handlers
  const handleSelectConversation = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
  }, []);

  const handleSendMessage = useCallback(async (text: string): Promise<boolean> => {
    const result = await send({ text });
    if (result?.success) {
      // Refresh messages after successful send
      await refreshMessages();
      return true;
    }
    return false;
  }, [send, refreshMessages]);

  const handleRefreshAll = useCallback(async () => {
    await refreshConversations();
    if (selectedConversationId) {
      await refreshMessages();
    }
  }, [refreshConversations, refreshMessages, selectedConversationId]);

  // 🏢 ENTERPRISE: Reply handler
  const handleReply = useCallback((message: MessageListItem) => {
    console.log('[UnifiedInbox] handleReply called:', message.id);
    startReply(message);
    console.log('[UnifiedInbox] startReply completed');
  }, [startReply]);

  // 🏢 ENTERPRISE: Forward handler
  const handleForward = useCallback((message: MessageListItem) => {
    console.log('[UnifiedInbox] handleForward called:', message.id);
    startForward(message);
    console.log('[UnifiedInbox] startForward completed');
  }, [startForward]);

  // 🏢 ENTERPRISE: Edit handler - puts text in composer for editing
  const handleEdit = useCallback((message: MessageListItem) => {
    console.log('[UnifiedInbox] handleEdit called:', message.id);
    startEdit(message);
    console.log('[UnifiedInbox] startEdit completed');
  }, [startEdit]);

  // 🏢 ENTERPRISE: Pin handler
  const handleTogglePin = useCallback(async (messageId: string, shouldPin: boolean) => {
    console.log('[UnifiedInbox] handleTogglePin called:', messageId, 'shouldPin:', shouldPin);
    const message = messages.find(m => m.id === messageId);
    if (message) {
      await togglePin(messageId, message.content.text || '', message.senderName);
      console.log('[UnifiedInbox] togglePin completed');
    } else {
      console.log('[UnifiedInbox] Message not found for id:', messageId);
    }
  }, [messages, togglePin]);

  // 🏢 ADR-055: Attachment upload handler for ReplyComposer
  const handleUploadAttachment = useCallback(async (
    file: File,
    onProgress: (progress: number) => void
  ): Promise<{ url: string; thumbnailUrl?: string } | null> => {
    try {
      console.log('📎 [UnifiedInbox] Uploading attachment:', file.name, file.type);

      const result = await PhotoUploadService.uploadPhoto(file, {
        folderPath: 'telegram-outbound',
        onProgress: (progress) => {
          // Map PhotoUploadService progress to simple percentage
          const percent = progress.phase === 'complete' ? 100 : progress.progress;
          onProgress(percent);
        },
        enableCompression: file.type.startsWith('image/'),
        compressionUsage: 'document-scan',
      });

      console.log('✅ [UnifiedInbox] Attachment uploaded:', result.url);

      return {
        url: result.url,
      };
    } catch (error) {
      console.error('❌ [UnifiedInbox] Attachment upload failed:', error);
      return null;
    }
  }, []);

  // 🏢 ENTERPRISE: Enhanced send with reply support + attachments (ADR-055)
  const handleSendWithReply = useCallback(async (
    text: string,
    attachments?: MessageAttachment[]
  ): Promise<boolean> => {
    // Include quoted message reference if replying
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

  // Loading state for initial load
  if (conversationsLoading && conversations.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Spinner size="medium" className="mr-2" />
            <span>{t('inbox.loadingConversations')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="flex gap-4 h-full min-h-0" aria-label="Unified Inbox">
      {/* Left Panel: Conversations List */}
      <Card className="w-1/3 flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className={iconSizes.md} />
              {t('inbox.title')}
            </CardTitle>
            <div className="flex items-center gap-2">
              <CommonBadge
                status="company"
                customLabel={t('inbox.conversationsCount', { count: totalCount })}
                variant="secondary"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshAll}
                disabled={conversationsLoading}
                aria-label="Refresh"
              >
                <RefreshCw className={`${iconSizes.sm} ${conversationsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {showFilters && (
            <nav className="flex flex-wrap gap-2 mt-4" aria-label="Filters">
              {/* Search */}
              <div className="flex-1 min-w-[150px]">
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${iconSizes.sm} ${colors.text.muted}`} />
                  <Input
                    placeholder={t('inbox.search')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    aria-label={t('inbox.search')}
                  />
                </div>
              </div>

              {/* Channel filter */}
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-[120px]" aria-label={t('inbox.filters.channel')}>
                  <SelectValue placeholder={t('inbox.filters.channel')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('inbox.filters.all')}</SelectItem>
                  <SelectItem value={COMMUNICATION_CHANNELS.TELEGRAM}>{t('inbox.channels.telegram')}</SelectItem>
                  <SelectItem value={COMMUNICATION_CHANNELS.EMAIL}>{t('inbox.channels.email')}</SelectItem>
                </SelectContent>
              </Select>

              {/* Status filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px]" aria-label={t('inbox.filters.status')}>
                  <SelectValue placeholder={t('inbox.filters.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('inbox.filters.all')}</SelectItem>
                  <SelectItem value={CONVERSATION_STATUS.ACTIVE}>{t('inbox.status.active')}</SelectItem>
                  <SelectItem value={CONVERSATION_STATUS.CLOSED}>{t('inbox.status.closed')}</SelectItem>
                  <SelectItem value={CONVERSATION_STATUS.ARCHIVED}>{t('inbox.status.archived')}</SelectItem>
                </SelectContent>
              </Select>
            </nav>
          )}
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-2">
          {/* Error display */}
          {conversationsError && (
            <div className={`p-3 mb-2 rounded ${colors.bg.errorSubtle} ${colors.text.error}`} role="alert">
              <AlertCircle className={`${iconSizes.sm} inline mr-2`} />
              {conversationsError}
            </div>
          )}

          {/* Conversations list */}
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className={`${iconSizes.xl} ${colors.text.muted} mx-auto mb-2 opacity-30`} />
              <p className={colors.text.muted}>{t('inbox.noConversations')}</p>
            </div>
          ) : (
            <ul className="space-y-2" role="listbox" aria-label="Conversations">
              {filteredConversations.map((conversation) => {
                const isSelected = conversation.id === selectedConversationId;
                const externalParticipant = conversation.participants.find(p => !p.isInternal);
                const relativeTime = getRelativeTime(conversation.audit.updatedAt, t);

                return (
                  <li key={conversation.id}>
                    <button
                      onClick={() => handleSelectConversation(conversation.id)}
                      className={`
                        w-full text-left p-3 rounded-lg
                        ${TRANSITION_PRESETS.STANDARD_COLORS}
                        ${isSelected
                          ? `${colors.bg.accent} ring-2 ring-ring`
                          : `${HOVER_BACKGROUND_EFFECTS.LIGHT}`
                        }
                      `}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <article className="flex items-start gap-3">
                        {/* Channel icon */}
                        <div className={`p-2 rounded-full flex-shrink-0 ${getChannelColorClasses(conversation.channel, colors)}`}>
                          {getChannelIcon(conversation.channel, iconSizes)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <header className="flex items-center justify-between mb-1">
                            <span className="font-medium truncate">
                              {externalParticipant?.displayName || 'Unknown'}
                            </span>
                            <time className={`text-xs ${colors.text.muted} flex-shrink-0`}>
                              {relativeTime}
                            </time>
                          </header>

                          <p className={`text-sm ${colors.text.muted} truncate`}>
                            {conversation.lastMessage
                              ? truncateText(conversation.lastMessage.content, MESSAGE_PREVIEW_LENGTH)
                              : t('inbox.thread.noMessages')
                            }
                          </p>

                          <footer className="flex items-center gap-2 mt-1">
                            <CommonBadge
                              status="company"
                              customLabel={conversation.channel.toUpperCase()}
                              variant="outline"
                              className="text-xs"
                            />
                            {conversation.unreadCount > 0 && (
                              <CommonBadge
                                status="company"
                                customLabel={String(conversation.unreadCount)}
                                variant="destructive"
                                className="text-xs"
                              />
                            )}
                          </footer>
                        </div>

                        {/* Arrow indicator */}
                        <ChevronRight className={`${iconSizes.sm} ${colors.text.muted} flex-shrink-0`} />
                      </article>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Load more button */}
          {hasMore && (
            <nav className="flex justify-center mt-4" aria-label="Pagination">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMoreConversations}
                disabled={conversationsLoading}
              >
                {t('inbox.pagination.loadMore')}
              </Button>
            </nav>
          )}
        </CardContent>
      </Card>

      {/* Right Panel: Thread View + Composer */}
      <div className="flex-1 flex flex-col">
        {/* Thread View */}
        <div className="flex-1 overflow-hidden">
          <ThreadView
            conversation={selectedConversation}
            messages={messages}
            loading={messagesLoading}
            error={messagesError}
            hasMore={hasMoreMessages}
            onLoadMore={loadMoreMessages}
            onRefresh={refreshMessages}
            onReply={handleReply}
            onForward={handleForward}
            onEdit={handleEdit}
            isPinnedFn={isPinned}
            onTogglePin={handleTogglePin}
          />
        </div>

        {/* Reply Composer */}
        <ReplyComposer
          disabled={!selectedConversationId}
          sending={sending}
          error={sendError}
          onSend={handleSendWithReply}
          onClearError={clearSendError}
          replyMode={replyMode}
          quotedMessage={quotedMessage}
          onCancelReply={cancelReply}
          editingMessage={editingMessage}
          onUpdateEditText={updateEditText}
          onCancelEdit={cancelEdit}
          onSaveEdit={saveEdit}
          isSavingEdit={isSaving}
          onUploadAttachment={handleUploadAttachment}
        />
      </div>
    </section>
  );
}

export default UnifiedInbox;
