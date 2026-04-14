'use client';

/**
 * =============================================================================
 * THREAD VIEW - EPIC Δ
 * =============================================================================
 *
 * Displays messages in a conversation thread.
 *
 * @module components/crm/inbox/ThreadView
 * @enterprise ADR-030 - Zero Hardcoded Values
 */

import React, { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CommonBadge } from '@/core/badges';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatMessageHTML } from '@/lib/message-utils';
import { TRANSITION_PRESETS } from '@/components/ui/effects';
import { MESSAGE_DIRECTION } from '@/types/conversations';
import { MessageSquare, ChevronUp, RefreshCw, AlertCircle, Trash2, X, CheckSquare, Pin } from 'lucide-react';
import type { MessageListItem, ConversationListItem } from '@/hooks/inbox/useInboxApi';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useMessageActions } from '@/hooks/inbox/useMessageActions';
import { MessageContextMenu } from './MessageContextMenu';
import { ReactionBubbles } from './ReactionBubbles';
import { AttachmentRenderer } from './AttachmentRenderer';
import type { MessageReactionsMap, MessageAttachment } from '@/types/conversations';
import '@/lib/design-system';

// 🏢 ENTERPRISE: Extracted helpers + handler hook
import {
  getRelativeTime, getSenderIcon, getStatusIcon,
  useThreadMessageHandlers,
} from './thread-view-helpers';

// Re-exports
export { getRelativeTime, getSenderIcon, getStatusIcon } from './thread-view-helpers';

// ============================================================================
// TYPES
// ============================================================================

interface ThreadViewProps {
  conversation: ConversationListItem | null;
  messages: MessageListItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onRefresh: () => void;
  onMessagesDeleted?: (deletedIds: string[]) => void;
  onReply?: (message: MessageListItem) => void;
  onForward?: (message: MessageListItem) => void;
  onEdit?: (message: MessageListItem) => void;
  isPinnedFn?: (messageId: string) => boolean;
  onTogglePin?: (messageId: string, shouldPin: boolean) => Promise<void>;
  getReactionsFn?: (messageId: string) => { reactions: MessageReactionsMap; userReactions: Set<string> };
  onToggleReaction?: (messageId: string, emoji: string) => Promise<void>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ThreadView({
  conversation, messages, loading, error, hasMore,
  onLoadMore, onRefresh, onMessagesDeleted,
  onReply, onForward, onEdit, isPinnedFn, onTogglePin,
  getReactionsFn, onToggleReaction,
}: ThreadViewProps) {
  const { t } = useTranslation(['crm', 'crm-inbox']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    selectedIds: _selectedIds, isSelectionMode, isLoading: isDeleting,
    selectedCount, toggleSelect, selectAll, enterSelectionMode, exitSelectionMode,
    deleteSelected, deleteMessages, isSelected,
  } = useMessageActions();

  const {
    handleDeleteSingle, handleDeleteSelected, handleSelectAll,
    handleReply, handleForward, handleEdit, handleTogglePin, handleReaction,
  } = useThreadMessageHandlers({
    messages, onReply, onForward, onEdit, onTogglePin, onToggleReaction,
    deleteMessages, deleteSelected, selectedIds: _selectedIds,
    exitSelectionMode, selectAll, onMessagesDeleted, onRefresh,
  });

  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  if (!conversation) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <MessageSquare className={`${iconSizes.xl2} ${colors.text.muted} mx-auto ${spacing.margin.bottom.md} opacity-30`} />
          <p className={colors.text.muted}>{t('inbox.thread.selectConversation')}</p>
        </CardContent>
      </Card>
    );
  }

  if (loading && messages.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <Spinner size="medium" className={`mx-auto ${spacing.margin.bottom.md}`} />
          <p className={colors.text.muted}>{t('inbox.loading')}</p>
        </CardContent>
      </Card>
    );
  }

  if (error && messages.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <AlertCircle className={`${iconSizes.xl2} ${colors.text.error} mx-auto ${spacing.margin.bottom.md}`} />
          <p className={colors.text.error}>{error}</p>
          <Button variant="outline" size="sm" onClick={onRefresh} className={spacing.margin.top.md}>
            <RefreshCw className={iconSizes.sm} /><span className={spacing.margin.left.sm}>{t('leads.retry')}</span>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const externalParticipant = conversation.participants.find(p => !p.isInternal);
  const participantName = externalParticipant?.displayName || t('inbox.thread.participants');

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 border-b">
        <div className="flex items-center justify-between">
          <div className={`flex items-center ${spacing.gap.sm}`}>
            <div className={`${spacing.padding.sm} rounded-full ${colors.bg.infoSubtle}`}><MessageSquare className={iconSizes.md} /></div>
            <div>
              <CardTitle className="text-base">{participantName}</CardTitle>
              <p className={`text-sm ${colors.text.muted}`}>{conversation.channel.toUpperCase()} • {t(`inbox.status.${conversation.status}`)}</p>
            </div>
          </div>
          <div className={`flex items-center ${spacing.gap.sm}`}>
            {conversation.unreadCount > 0 && <CommonBadge status="company" customLabel={t('inbox.thread.unread', { count: conversation.unreadCount })} variant="destructive" />}
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={`${iconSizes.sm} ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isSelectionMode && (
        <div className={`flex items-center justify-between ${spacing.padding.sm} border-b bg-muted/50`}>
          <div className={`flex items-center ${spacing.gap.sm}`}>
            <CheckSquare className={iconSizes.sm} />
            <span className="text-sm font-medium">{t('inbox.selection.selected', { count: selectedCount })}</span>
          </div>
          <div className={`flex items-center ${spacing.gap.sm}`}>
            <Button variant="ghost" size="sm" onClick={handleSelectAll} disabled={isDeleting}>{t('inbox.selection.selectAll')}</Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={isDeleting || selectedCount === 0} className={spacing.gap.xs}>
              <Trash2 className={iconSizes.sm} />{t('inbox.selection.delete')}{isDeleting && <Spinner size="small" className="ml-1" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={exitSelectionMode} disabled={isDeleting}><X className={iconSizes.sm} /></Button>
          </div>
        </div>
      )}

      <CardContent className={`flex-1 overflow-y-auto ${spacing.padding.md}`}>
        {hasMore && (
          <nav className={`flex justify-center ${spacing.margin.bottom.md}`} aria-label="Pagination">
            <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loading} className={spacing.gap.sm}>
              <ChevronUp className={iconSizes.sm} />{t('inbox.thread.loadEarlier')}
            </Button>
          </nav>
        )}

        {messages.length === 0 ? (
          <section className="text-center py-8" aria-label="Empty thread">
            <MessageSquare className={`${iconSizes.xl} ${colors.text.muted} mx-auto ${spacing.margin.bottom.sm} opacity-30`} />
            <p className={colors.text.muted}>{t('inbox.thread.noMessages')}</p>
          </section>
        ) : (
          <ul className={spacing.spaceBetween.md} role="log" aria-label="Messages">
            {messages.map((message) => {
              const isOutbound = message.direction === MESSAGE_DIRECTION.OUTBOUND;
              const relativeTime = getRelativeTime(message.createdAt, t);
              const messageIsSelected = isSelected(message.id);

              return (
                <li key={message.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                  <MessageContextMenu
                    messageId={message.id} messageText={message.content.text || ''}
                    isSelected={messageIsSelected} isSelectionMode={isSelectionMode}
                    onDelete={handleDeleteSingle} onToggleSelect={toggleSelect}
                    onEnterSelectionMode={enterSelectionMode}
                    onReply={handleReply} onForward={handleForward} onEdit={handleEdit}
                    isPinned={isPinnedFn ? isPinnedFn(message.id) : false}
                    onTogglePin={handleTogglePin} isOwnMessage={isOutbound}
                    onReaction={onToggleReaction ? handleReaction : undefined}
                    userReactions={getReactionsFn ? getReactionsFn(message.id).userReactions : undefined}
                  >
                    <article
                      onClick={isSelectionMode ? () => toggleSelect(message.id) : undefined}
                      className={`ds-messageBubble ${isOutbound ? 'ds-messageBubble--outbound' : 'ds-messageBubble--inbound'} max-w-[75%] ${TRANSITION_PRESETS.STANDARD_COLORS} ${isOutbound ? 'ml-auto' : ''} ${messageIsSelected ? 'ring-2 ring-primary ring-offset-2' : ''} ${isSelectionMode ? 'cursor-pointer hover:opacity-80' : ''}`}
                    >
                      {isSelectionMode && (
                        <div className="absolute -left-6 top-1/2 -translate-y-1/2">
                          {messageIsSelected ? <CheckSquare className={`${iconSizes.sm} text-primary`} /> : <div className="w-4 h-4 border-2 border-muted-foreground rounded" />}
                        </div>
                      )}

                      <header className={`flex items-center ${spacing.gap.sm} ${spacing.margin.bottom.xs} text-sm ${colors.text.muted}`}>
                        {getSenderIcon(message.senderType, iconSizes)}
                        <span className="font-medium">{message.senderName}</span>
                        <time dateTime={message.createdAt} className="text-xs">{relativeTime}</time>
                        {isOutbound && getStatusIcon(message.deliveryStatus, iconSizes, colors)}
                        {isPinnedFn && isPinnedFn(message.id) && (
                          <Tooltip><TooltipTrigger asChild><span><Pin className={`${iconSizes.xs} text-amber-500`} /></span></TooltipTrigger><TooltipContent>{t('inbox.message.pinned')}</TooltipContent></Tooltip>
                        )}
                      </header>

                      <div className="ds-messageContent" dangerouslySetInnerHTML={{ __html: formatMessageHTML(message.content) }} />

                      {message.content.attachments && message.content.attachments.length > 0 && (
                        <AttachmentRenderer attachments={message.content.attachments as MessageAttachment[]} isOutbound={isOutbound} />
                      )}

                      {getReactionsFn && (() => {
                        const { reactions, userReactions } = getReactionsFn(message.id);
                        if (Object.keys(reactions).length === 0) return null;
                        return <ReactionBubbles messageId={message.id} reactions={reactions} userReactions={userReactions} onReactionClick={onToggleReaction ? handleReaction : undefined} isOutbound={isOutbound} />;
                      })()}
                    </article>
                  </MessageContextMenu>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={messagesEndRef} />
      </CardContent>
    </Card>
  );
}

export default ThreadView;
