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
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { MessageSquare, Search, RefreshCw, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Spinner } from '@/components/ui/spinner';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('UnifiedInbox');

import { useConversations, useConversationMessages, useSendMessage } from '@/hooks/inbox/useInboxApi';
import { CONVERSATION_STATUS } from '@/types/conversations';
import { COMMUNICATION_CHANNELS } from '@/types/communications';
import { ThreadView } from './inbox/ThreadView';
import { ReplyComposer } from './inbox/ReplyComposer';
import { useMessageReply } from '@/hooks/inbox/useMessageReply';
import { useMessageEdit } from '@/hooks/inbox/useMessageEdit';
import { useMessagePin } from '@/hooks/inbox/useMessagePin';
import type { MessageListItem } from '@/hooks/inbox/useInboxApi';
import { useCrmAttachmentUpload } from '@/hooks/inbox/useCrmAttachmentUpload';
import type { MessageAttachment } from '@/types/conversations';
import '@/lib/design-system';

// 🏢 ENTERPRISE: Extracted helpers + sub-component
import { ConversationItem } from './unified-inbox-helpers';

// Re-exports for backward compatibility
export { ConversationItem, getChannelIcon, getChannelColorClasses, getRelativeTime } from './unified-inbox-helpers';

// ============================================================================
// TYPES
// ============================================================================

interface UnifiedInboxProps {
  showFilters?: boolean;
  enablePolling?: boolean;
  leadId?: string;
  height?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function UnifiedInbox({
  showFilters = true,
  enablePolling = true,
}: UnifiedInboxProps) {
  const { t } = useTranslation(['crm', 'crm-inbox']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  const {
    conversations, loading: conversationsLoading, error: conversationsError,
    totalCount, hasMore, refresh: refreshConversations, loadMore: loadMoreConversations,
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
    messages, loading: messagesLoading, error: messagesError,
    hasMore: hasMoreMessages, refresh: refreshMessages, loadMore: loadMoreMessages,
  } = useConversationMessages(selectedConversationId, { polling: enablePolling && !!selectedConversationId });

  const { send, sending, error: sendError, clearError: clearSendError } = useSendMessage(selectedConversationId);
  const { mode: replyMode, quotedMessage, startReply, startForward, cancelReply, clearAfterSend } = useMessageReply();
  const { editingMessage, isEditing: _isEditing, startEdit, updateEditText, cancelEdit, saveEdit, isSaving } = useMessageEdit();
  const { isPinned, togglePin } = useMessagePin();

  const filteredConversations = useMemo(() => {
    if (!searchTerm) return conversations;
    const searchLower = searchTerm.toLowerCase();
    return conversations.filter(conv => {
      const participantMatch = conv.participants.some(p => p.displayName.toLowerCase().includes(searchLower));
      const lastMessageMatch = conv.lastMessage?.content.toLowerCase().includes(searchLower);
      return participantMatch || lastMessageMatch;
    });
  }, [conversations, searchTerm]);

  const handleSelectConversation = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
  }, []);

  const handleRefreshAll = useCallback(async () => {
    await refreshConversations();
    if (selectedConversationId) await refreshMessages();
  }, [refreshConversations, refreshMessages, selectedConversationId]);

  const handleReply = useCallback((message: MessageListItem) => { startReply(message); }, [startReply]);
  const handleForward = useCallback((message: MessageListItem) => { startForward(message); }, [startForward]);
  const handleEdit = useCallback((message: MessageListItem) => { startEdit(message); }, [startEdit]);

  const handleTogglePin = useCallback(async (messageId: string, _shouldPin: boolean) => {
    const message = messages.find(m => m.id === messageId);
    if (message) await togglePin(messageId, message.content.text || '', message.senderName);
  }, [messages, togglePin]);

  // 🏢 ADR-293 Phase 3: Canonical upload via file-mutation-gateway
  const { handleUploadAttachment } = useCrmAttachmentUpload({ conversationId: selectedConversationId });

  const handleSendWithReply = useCallback(async (text: string, attachments?: MessageAttachment[]): Promise<boolean> => {
    const messageData = quotedMessage && replyMode === 'reply'
      ? { text, replyTo: quotedMessage.id, attachments }
      : { text, attachments };
    const result = await send(messageData);
    if (result?.success) { clearAfterSend(); await refreshMessages(); return true; }
    return false;
  }, [send, quotedMessage, replyMode, clearAfterSend, refreshMessages]);

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
              <CommonBadge status="company" customLabel={t('inbox.conversationsCount', { count: totalCount })} variant="secondary" />
              <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={conversationsLoading} aria-label="Refresh">
                <RefreshCw className={`${iconSizes.sm} ${conversationsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {showFilters && (
            <nav className="flex flex-wrap gap-2 mt-4" aria-label="Filters">
              <div className="flex-1 min-w-[150px]">
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${iconSizes.sm} ${colors.text.muted}`} />
                  <Input placeholder={t('inbox.search')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" aria-label={t('inbox.search')} />
                </div>
              </div>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-[120px]" aria-label={t('inbox.filters.channel')}><SelectValue placeholder={t('inbox.filters.channel')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('inbox.filters.all')}</SelectItem>
                  <SelectItem value={COMMUNICATION_CHANNELS.TELEGRAM}>{t('inbox.channels.telegram')}</SelectItem>
                  <SelectItem value={COMMUNICATION_CHANNELS.EMAIL}>{t('inbox.channels.email')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px]" aria-label={t('inbox.filters.status')}><SelectValue placeholder={t('inbox.filters.status')} /></SelectTrigger>
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
          {conversationsError && (
            <div className={`p-3 mb-2 rounded ${colors.bg.errorSubtle} ${colors.text.error}`} role="alert">
              <AlertCircle className={`${iconSizes.sm} inline mr-2`} />{conversationsError}
            </div>
          )}

          {filteredConversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className={`${iconSizes.xl} ${colors.text.muted} mx-auto mb-2 opacity-30`} />
              <p className={colors.text.muted}>{t('inbox.noConversations')}</p>
            </div>
          ) : (
            <ul className="space-y-2" role="listbox" aria-label="Conversations">
              {filteredConversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isSelected={conversation.id === selectedConversationId}
                  onSelect={handleSelectConversation}
                  t={t}
                />
              ))}
            </ul>
          )}

          {hasMore && (
            <nav className="flex justify-center mt-4" aria-label="Pagination">
              <Button variant="outline" size="sm" onClick={loadMoreConversations} disabled={conversationsLoading}>
                {t('inbox.pagination.loadMore')}
              </Button>
            </nav>
          )}
        </CardContent>
      </Card>

      {/* Right Panel: Thread View + Composer */}
      <div className="flex-1 flex flex-col">
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
