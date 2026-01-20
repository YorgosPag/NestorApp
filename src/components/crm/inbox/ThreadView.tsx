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

import React, { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CommonBadge } from '@/core/badges';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
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
} from 'lucide-react';
import type { MessageListItem, ConversationListItem } from '@/hooks/inbox/useInboxApi';
import { Spinner } from '@/components/ui/spinner';

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
}: ThreadViewProps) {
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // No conversation selected
  if (!conversation) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <MessageSquare className={`${iconSizes.xl2} ${colors.text.muted} mx-auto mb-4 opacity-30`} />
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
          <Spinner size="medium" className="mx-auto mb-4" />
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
          <AlertCircle className={`${iconSizes.xl2} ${colors.text.error} mx-auto mb-4`} />
          <p className={colors.text.error}>{error}</p>
          <Button variant="outline" size="sm" onClick={onRefresh} className="mt-4">
            <RefreshCw className={iconSizes.sm} />
            <span className="ml-2">{t('leads.retry')}</span>
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
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${colors.bg.infoSubtle}`}>
              <MessageSquare className={iconSizes.md} />
            </div>
            <div>
              <CardTitle className="text-base">{participantName}</CardTitle>
              <p className={`text-sm ${colors.text.muted}`}>
                {conversation.channel.toUpperCase()} • {t(`inbox.status.${conversation.status}`)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

      {/* Messages */}
      <CardContent className="flex-1 overflow-y-auto p-4">
        {/* Load earlier button */}
        {hasMore && (
          <nav className="flex justify-center mb-4" aria-label="Pagination">
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadMore}
              disabled={loading}
              className="gap-2"
            >
              <ChevronUp className={iconSizes.sm} />
              {t('inbox.thread.loadEarlier')}
            </Button>
          </nav>
        )}

        {/* Messages list */}
        {messages.length === 0 ? (
          <section className="text-center py-8" aria-label="Empty thread">
            <MessageSquare className={`${iconSizes.xl} ${colors.text.muted} mx-auto mb-2 opacity-30`} />
            <p className={colors.text.muted}>{t('inbox.thread.noMessages')}</p>
          </section>
        ) : (
          <ul className="space-y-4" role="log" aria-label="Messages">
            {messages.map((message) => {
              const isOutbound = message.direction === MESSAGE_DIRECTION.OUTBOUND;
              const relativeTime = getRelativeTime(message.createdAt, t);

              return (
                <li
                  key={message.id}
                  className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                >
                  <article
                    className={`
                      ds-messageBubble
                      ${isOutbound ? 'ds-messageBubble--outbound' : 'ds-messageBubble--inbound'}
                      max-w-[75%]
                      ${TRANSITION_PRESETS.STANDARD_COLORS}
                      ${isOutbound ? 'ml-auto' : ''}
                    `}
                  >
                    {/* Message header */}
                    <header className={`flex items-center gap-2 mb-1 text-sm ${colors.text.muted}`}>
                      {getSenderIcon(message.senderType, iconSizes)}
                      <span className="font-medium">{message.senderName}</span>
                      <time dateTime={message.createdAt} className="text-xs">
                        {relativeTime}
                      </time>
                      {isOutbound && getStatusIcon(message.deliveryStatus, iconSizes, colors)}
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
                      <footer className="mt-2 pt-2 border-t">
                        <CommonBadge
                          status="company"
                          customLabel={`📎 ${t('inbox.message.attachments', { count: message.content.attachments.length })}`}
                          variant="outline"
                          className="text-xs"
                        />
                      </footer>
                    )}
                  </article>
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
