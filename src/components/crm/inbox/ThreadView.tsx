'use client';

/**
 * =============================================================================
 * THREAD VIEW - EPIC Δ
 * =============================================================================
 *
 * Displays messages in a conversation thread.
 * Enterprise-grade with semantic HTML and centralized styling.
 *
 * @module components/crm/inbox/ThreadView
 * @enterprise ADR-030 - Zero Hardcoded Values
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CommonBadge } from '@/core/badges';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens (ADR compliant)
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateTime } from '@/lib/intl-utils';
import { formatMessageHTML } from '@/lib/message-utils';
import { TRANSITION_PRESETS } from '@/components/ui/effects';
import { MESSAGE_DIRECTION } from '@/types/conversations';
import {
  MessageSquare,
  User,
  Bot,
  ChevronUp,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Trash2,
  X,
  CheckSquare,
  Pin,
} from 'lucide-react';
import type { MessageListItem, ConversationListItem } from '@/hooks/inbox/useInboxApi';
import { Spinner } from '@/components/ui/spinner';
// 🏢 ENTERPRISE: Centralized message actions (selection + delete)
import { useMessageActions } from '@/hooks/inbox/useMessageActions';
import { MessageContextMenu } from './MessageContextMenu';
import { ReactionBubbles } from './ReactionBubbles';
import type { MessageReactionsMap } from '@/types/conversations';

// ============================================================================
// TYPES
// ============================================================================

interface ThreadViewProps {
  /** Selected conversation (for header info) */
  conversation: ConversationListItem | null;
  /** Messages to display */
  messages: MessageListItem[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Has more messages to load */
  hasMore: boolean;
  /** Load more callback */
  onLoadMore: () => void;
  /** Refresh callback */
  onRefresh: () => void;
  /** Callback when messages are deleted (optional - for parent to refresh) */
  onMessagesDeleted?: (deletedIds: string[]) => void;
  /** Callback when reply is initiated (passes message to parent for composer) */
  onReply?: (message: MessageListItem) => void;
  /** Callback when forward is initiated (passes message to parent for forward modal) */
  onForward?: (message: MessageListItem) => void;
  /** Callback when edit is initiated (passes message to parent for composer) */
  onEdit?: (message: MessageListItem) => void;
  /** Function to check if message is pinned (from parent hook) */
  isPinnedFn?: (messageId: string) => boolean;
  /** Callback when pin/unpin is toggled */
  onTogglePin?: (messageId: string, shouldPin: boolean) => Promise<void>;
  /** 🏢 ENTERPRISE: Reactions support */
  /** Function to get reactions for a message */
  getReactionsFn?: (messageId: string) => { reactions: MessageReactionsMap; userReactions: Set<string> };
  /** Callback when a reaction is toggled */
  onToggleReaction?: (messageId: string, emoji: string) => Promise<void>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get relative time display
 * @param timestamp - ISO timestamp string
 * @param t - Translation function from useTranslation
 */
function getRelativeTime(
  timestamp: string,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffHours < 1) return t('inbox.time.now');
  if (diffHours < 24) return t('inbox.time.hoursAgo', { hours: Math.floor(diffHours) });
  if (diffHours < 48) return t('inbox.time.yesterday');

  return formatDateTime(date);
}

/**
 * Get sender icon based on sender type
 */
function getSenderIcon(senderType: string, iconSizes: ReturnType<typeof useIconSizes>) {
  switch (senderType) {
    case 'bot':
      return <Bot className={iconSizes.sm} />;
    case 'agent':
    case 'customer':
    default:
      return <User className={iconSizes.sm} />;
  }
}

/**
 * Get delivery status icon
 */
function getStatusIcon(
  status: string,
  iconSizes: ReturnType<typeof useIconSizes>,
  colors: ReturnType<typeof useSemanticColors>
) {
  switch (status) {
    case 'sent':
    case 'delivered':
    case 'read':
      return <CheckCircle className={`${iconSizes.xs} ${colors.text.success}`} />;
    case 'failed':
      return <AlertCircle className={`${iconSizes.xs} ${colors.text.error}`} />;
    case 'pending':
    default:
      return <Clock className={`${iconSizes.xs} ${colors.text.muted}`} />;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ThreadView({
  conversation,
  messages,
  loading,
  error,
  hasMore,
  onLoadMore,
  onRefresh,
  onMessagesDeleted,
  onReply,
  onForward,
  onEdit,
  isPinnedFn,
  onTogglePin,
  getReactionsFn,
  onToggleReaction,
}: ThreadViewProps) {
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: Centralized spacing tokens
  const spacing = useSpacingTokens();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 🏢 ENTERPRISE: Centralized message actions (selection + delete)
  const {
    selectedIds,
    isSelectionMode,
    isLoading: isDeleting,
    selectedCount,
    toggleSelect,
    selectAll,
    enterSelectionMode,
    exitSelectionMode,
    deleteSelected,
    deleteMessages,
    isSelected,
  } = useMessageActions();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Handle delete from context menu (single message)
  const handleDeleteSingle = useCallback(async (messageId: string) => {
    const result = await deleteMessages([messageId]);
    if (result.success && result.deleted > 0) {
      onMessagesDeleted?.([messageId]);
      onRefresh(); // Refresh to update the list
    }
  }, [deleteMessages, onMessagesDeleted, onRefresh]);

  // Handle delete selected messages
  const handleDeleteSelected = useCallback(async () => {
    const deletedIds = Array.from(selectedIds);
    const result = await deleteSelected();
    if (result.success && result.deleted > 0) {
      onMessagesDeleted?.(deletedIds);
      exitSelectionMode();
      onRefresh(); // Refresh to update the list
    }
  }, [selectedIds, deleteSelected, onMessagesDeleted, exitSelectionMode, onRefresh]);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    selectAll(messages);
  }, [selectAll, messages]);

  // 🏢 ENTERPRISE: Handle reply from context menu
  const handleReply = useCallback((messageId: string) => {
    console.log('[ThreadView] handleReply called with messageId:', messageId);
    const message = messages.find(m => m.id === messageId);
    if (message) {
      console.log('[ThreadView] Message found, onReply exists:', !!onReply);
      if (onReply) {
        onReply(message);
        console.log('[ThreadView] onReply called successfully');
      } else {
        console.log('[ThreadView] Reply clicked but no onReply handler');
      }
    } else {
      console.log('[ThreadView] Message NOT found for id:', messageId);
    }
  }, [messages, onReply]);

  // 🏢 ENTERPRISE: Handle forward from context menu
  const handleForward = useCallback((messageId: string) => {
    console.log('[ThreadView] handleForward called with messageId:', messageId);
    const message = messages.find(m => m.id === messageId);
    if (message) {
      console.log('[ThreadView] Message found, onForward exists:', !!onForward);
      if (onForward) {
        onForward(message);
        console.log('[ThreadView] onForward called successfully');
      } else {
        console.log('[ThreadView] Forward clicked but no onForward handler');
      }
    }
  }, [messages, onForward]);

  // 🏢 ENTERPRISE: Handle edit from context menu (delegates to parent)
  const handleEdit = useCallback((messageId: string) => {
    console.log('[ThreadView] handleEdit called with messageId:', messageId);
    const message = messages.find(m => m.id === messageId);
    if (message) {
      console.log('[ThreadView] Message found, onEdit exists:', !!onEdit);
      if (onEdit) {
        onEdit(message);
        console.log('[ThreadView] onEdit called successfully');
      } else {
        console.log('[ThreadView] Edit clicked but no onEdit handler');
      }
    }
  }, [messages, onEdit]);

  // 🏢 ENTERPRISE: Handle pin/unpin from context menu (delegates to parent)
  const handleTogglePin = useCallback(async (messageId: string, shouldPin: boolean) => {
    console.log('[ThreadView] handleTogglePin called:', messageId, 'shouldPin:', shouldPin);
    if (onTogglePin) {
      await onTogglePin(messageId, shouldPin);
      console.log('[ThreadView] onTogglePin called successfully');
    } else {
      console.log('[ThreadView] Pin clicked but no onTogglePin handler');
    }
  }, [onTogglePin]);

  // 🏢 ENTERPRISE: Handle reaction from context menu (delegates to parent)
  const handleReaction = useCallback(async (messageId: string, emoji: string) => {
    console.log('[ThreadView] handleReaction called:', messageId, 'emoji:', emoji);
    if (onToggleReaction) {
      await onToggleReaction(messageId, emoji);
      console.log('[ThreadView] onToggleReaction called successfully');
    } else {
      console.log('[ThreadView] Reaction clicked but no onToggleReaction handler');
    }
  }, [onToggleReaction]);

  // No conversation selected
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

  // Loading state
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

  // Error state
  if (error && messages.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <AlertCircle className={`${iconSizes.xl2} ${colors.text.error} mx-auto ${spacing.margin.bottom.md}`} />
          <p className={colors.text.error}>{error}</p>
          <Button variant="outline" size="sm" onClick={onRefresh} className={spacing.margin.top.md}>
            <RefreshCw className={iconSizes.sm} />
            <span className={spacing.margin.left.sm}>{t('leads.retry')}</span>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Get participant names for header
  const externalParticipant = conversation.participants.find(p => !p.isInternal);
  const participantName = externalParticipant?.displayName || t('inbox.thread.participants');

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <CardHeader className="flex-shrink-0 border-b">
        <div className="flex items-center justify-between">
          <div className={`flex items-center ${spacing.gap.sm}`}>
            <div className={`${spacing.padding.sm} rounded-full ${colors.bg.infoSubtle}`}>
              <MessageSquare className={iconSizes.md} />
            </div>
            <div>
              <CardTitle className="text-base">{participantName}</CardTitle>
              <p className={`text-sm ${colors.text.muted}`}>
                {conversation.channel.toUpperCase()} • {t(`inbox.status.${conversation.status}`)}
              </p>
            </div>
          </div>
          <div className={`flex items-center ${spacing.gap.sm}`}>
            {conversation.unreadCount > 0 && (
              <CommonBadge
                status="company"
                customLabel={t('inbox.thread.unread', { count: conversation.unreadCount })}
                variant="destructive"
              />
            )}
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={`${iconSizes.sm} ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* 🏢 ENTERPRISE: Selection Mode Toolbar */}
      {isSelectionMode && (
        <div className={`flex items-center justify-between ${spacing.padding.sm} border-b bg-muted/50`}>
          <div className={`flex items-center ${spacing.gap.sm}`}>
            <CheckSquare className={iconSizes.sm} />
            <span className="text-sm font-medium">
              {t('inbox.selection.selected', { count: selectedCount })}
            </span>
          </div>
          <div className={`flex items-center ${spacing.gap.sm}`}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              disabled={isDeleting}
            >
              {t('inbox.selection.selectAll', 'Επιλογή όλων')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={isDeleting || selectedCount === 0}
              className={spacing.gap.xs}
            >
              <Trash2 className={iconSizes.sm} />
              {t('inbox.selection.delete', 'Διαγραφή')}
              {isDeleting && <Spinner size="small" className="ml-1" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={exitSelectionMode}
              disabled={isDeleting}
            >
              <X className={iconSizes.sm} />
            </Button>
          </div>
        </div>
      )}

      {/* Messages */}
      {/* 🏢 ENTERPRISE: Centralized spacing tokens */}
      <CardContent className={`flex-1 overflow-y-auto ${spacing.padding.md}`}>
        {/* Load earlier button */}
        {hasMore && (
          <nav className={`flex justify-center ${spacing.margin.bottom.md}`} aria-label="Pagination">
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadMore}
              disabled={loading}
              className={spacing.gap.sm}
            >
              <ChevronUp className={iconSizes.sm} />
              {t('inbox.thread.loadEarlier')}
            </Button>
          </nav>
        )}

        {/* Messages list */}
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
                <li
                  key={message.id}
                  className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                >
                  <MessageContextMenu
                    messageId={message.id}
                    messageText={message.content.text || ''}
                    isSelected={messageIsSelected}
                    isSelectionMode={isSelectionMode}
                    onDelete={handleDeleteSingle}
                    onToggleSelect={toggleSelect}
                    onEnterSelectionMode={enterSelectionMode}
                    onReply={handleReply}
                    onForward={handleForward}
                    onEdit={handleEdit}
                    isPinned={isPinnedFn ? isPinnedFn(message.id) : false}
                    onTogglePin={handleTogglePin}
                    isOwnMessage={isOutbound}
                    onReaction={onToggleReaction ? handleReaction : undefined}
                    userReactions={getReactionsFn ? getReactionsFn(message.id).userReactions : undefined}
                  >
                    <article
                      onClick={isSelectionMode ? () => toggleSelect(message.id) : undefined}
                      className={`
                        ds-messageBubble
                        ${isOutbound ? 'ds-messageBubble--outbound' : 'ds-messageBubble--inbound'}
                        max-w-[75%]
                        ${TRANSITION_PRESETS.STANDARD_COLORS}
                        ${isOutbound ? 'ml-auto' : ''}
                        ${messageIsSelected ? 'ring-2 ring-primary ring-offset-2' : ''}
                        ${isSelectionMode ? 'cursor-pointer hover:opacity-80' : ''}
                      `}
                    >
                      {/* Selection indicator */}
                      {isSelectionMode && (
                        <div className={`absolute -left-6 top-1/2 -translate-y-1/2`}>
                          {messageIsSelected ? (
                            <CheckSquare className={`${iconSizes.sm} text-primary`} />
                          ) : (
                            <div className="w-4 h-4 border-2 border-muted-foreground rounded" />
                          )}
                        </div>
                      )}

                      {/* Message header */}
                      <header className={`flex items-center ${spacing.gap.sm} ${spacing.margin.bottom.xs} text-sm ${colors.text.muted}`}>
                        {getSenderIcon(message.senderType, iconSizes)}
                        <span className="font-medium">{message.senderName}</span>
                        <time dateTime={message.createdAt} className="text-xs">
                          {relativeTime}
                        </time>
                        {isOutbound && getStatusIcon(message.deliveryStatus, iconSizes, colors)}
                        {/* 🏢 ENTERPRISE: Pin indicator */}
                        {isPinnedFn && isPinnedFn(message.id) && (
                          <span title={t('inbox.message.pinned', 'Καρφιτσωμένο')}>
                            <Pin className={`${iconSizes.xs} text-amber-500`} />
                          </span>
                        )}
                      </header>

                      {/* Message content - HTML formatted με XSS protection */}
                      <div
                        className="ds-messageContent"
                        dangerouslySetInnerHTML={{
                          __html: formatMessageHTML(message.content)
                        }}
                      />

                      {/* Attachments */}
                      {message.content.attachments && message.content.attachments.length > 0 && (
                        <footer className={`${spacing.margin.top.sm} ${spacing.padding.top.sm} border-t`}>
                          <CommonBadge
                            status="company"
                            customLabel={`📎 ${t('inbox.message.attachments', { count: message.content.attachments.length })}`}
                            variant="outline"
                            className="text-xs"
                          />
                        </footer>
                      )}

                      {/* 🏢 ENTERPRISE: Reactions (Telegram-style) */}
                      {getReactionsFn && (() => {
                        const { reactions, userReactions } = getReactionsFn(message.id);
                        const hasReactions = Object.keys(reactions).length > 0;
                        if (!hasReactions) return null;
                        return (
                          <ReactionBubbles
                            messageId={message.id}
                            reactions={reactions}
                            userReactions={userReactions}
                            onReactionClick={onToggleReaction ? handleReaction : undefined}
                            isOutbound={isOutbound}
                          />
                        );
                      })()}
                    </article>
                  </MessageContextMenu>
                </li>
              );
            })}
          </ul>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </CardContent>
    </Card>
  );
}

export default ThreadView;
