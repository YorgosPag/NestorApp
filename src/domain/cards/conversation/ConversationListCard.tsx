'use client';

/**
 * 💬 ENTERPRISE CONVERSATION LIST CARD - Domain Component
 *
 * Domain-specific card for conversations in list views.
 * Extends ListCard with conversation-specific defaults and stats.
 *
 * @fileoverview Conversation domain card using centralized ListCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see ListCard for base component
 * @see COMMUNICATION_CHANNELS for channel constants
 * @author Enterprise Architecture Team
 * @since 2026-01-30
 */

import React, { useMemo } from 'react';
import { Mail, MessageSquare, Clock } from 'lucide-react';

import { ListCard } from '@/design-system';
import type { StatItem } from '@/design-system';

import { formatDateTime } from '@/lib/intl-utils';
import { truncateText } from '@/lib/obligations-utils';

import { CONVERSATION_STATUS } from '@/types/conversations';
import { COMMUNICATION_CHANNELS } from '@/types/communications';

// 🏢 ENTERPRISE: Import the API type from the hook
import type { ConversationListItem } from '@/hooks/inbox/useInboxApi';

import type { ListCardBadgeVariant } from '@/design-system/components/ListCard/ListCard.types';

import { MESSAGE_PREVIEW_LENGTH } from '@/config/domain-constants';

import { useTranslation } from '@/i18n/hooks/useTranslation';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface ConversationListCardProps {
  /** Conversation data (from API) */
  conversation: ConversationListItem;
  /** Whether card is selected */
  isSelected?: boolean;
  /** Click handler */
  onSelect?: () => void;
  /** Compact mode */
  compact?: boolean;
  /** Additional className */
  className?: string;
}

// =============================================================================
// 🏢 CHANNEL TO ICON MAPPING
// =============================================================================

const CHANNEL_ICONS: Record<string, typeof MessageSquare> = {
  [COMMUNICATION_CHANNELS.EMAIL]: Mail,
  [COMMUNICATION_CHANNELS.TELEGRAM]: MessageSquare,
  [COMMUNICATION_CHANNELS.WHATSAPP]: MessageSquare,
  [COMMUNICATION_CHANNELS.MESSENGER]: MessageSquare,
  [COMMUNICATION_CHANNELS.SMS]: MessageSquare,
};

// =============================================================================
// 🏢 CHANNEL TO COLOR MAPPING
// =============================================================================

const CHANNEL_COLORS: Record<string, string> = {
  [COMMUNICATION_CHANNELS.EMAIL]: 'text-blue-600',
  [COMMUNICATION_CHANNELS.TELEGRAM]: 'text-sky-500',
  [COMMUNICATION_CHANNELS.WHATSAPP]: 'text-green-500',
  [COMMUNICATION_CHANNELS.MESSENGER]: 'text-violet-500',
  [COMMUNICATION_CHANNELS.SMS]: 'text-orange-500',
};

// =============================================================================
// 🏢 STATUS TO BADGE VARIANT MAPPING
// =============================================================================

const STATUS_VARIANTS: Record<string, ListCardBadgeVariant> = {
  [CONVERSATION_STATUS.ACTIVE]: 'success',
  [CONVERSATION_STATUS.CLOSED]: 'secondary',
  [CONVERSATION_STATUS.ARCHIVED]: 'default',
  [CONVERSATION_STATUS.SPAM]: 'destructive',
};

// =============================================================================
// 🏢 HELPER FUNCTIONS
// =============================================================================

/**
 * Get relative time string
 */
function getRelativeTime(
  timestamp: string | Date | undefined,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (!timestamp) return '';

  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffHours < 1) return t('inbox.time.now');
  if (diffHours < 24) return t('inbox.time.hoursAgo', { hours: Math.floor(diffHours) });
  if (diffHours < 48) return t('inbox.time.yesterday');

  return formatDateTime(date);
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

/**
 * 💬 ConversationListCard Component
 *
 * Domain-specific card for conversations.
 * Uses ListCard with conversation defaults.
 *
 * @example
 * ```tsx
 * <ConversationListCard
 *   conversation={conv}
 *   isSelected={selectedId === conv.id}
 *   onSelect={() => setSelectedId(conv.id)}
 * />
 * ```
 */
export function ConversationListCard({
  conversation,
  isSelected = false,
  onSelect,
  compact = true,
  className,
}: ConversationListCardProps) {
  const { t } = useTranslation('crm');

  // ==========================================================================
  // 🏢 COMPUTED VALUES (Memoized)
  // ==========================================================================

  /** Get external participant name */
  const displayName = useMemo(() => {
    const externalParticipant = conversation.participants.find(p => !p.isInternal);
    return externalParticipant?.displayName || t('inbox.thread.participants');
  }, [conversation.participants, t]);

  /** Get subtitle with last message preview */
  const subtitle = useMemo(() => {
    if (!conversation.lastMessage?.content) {
      return t('inbox.thread.noMessages');
    }
    return truncateText(conversation.lastMessage.content, MESSAGE_PREVIEW_LENGTH);
  }, [conversation.lastMessage, t]);

  /** Build stats array */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    const ChannelIcon = CHANNEL_ICONS[conversation.channel] || MessageSquare;
    const channelColor = CHANNEL_COLORS[conversation.channel] || 'text-gray-500';

    items.push({
      icon: ChannelIcon,
      iconColor: channelColor,
      label: t('inbox.filters.channel'),
      value: conversation.channel.toUpperCase(),
    });

    const relativeTime = getRelativeTime(conversation.audit.updatedAt, t);
    if (relativeTime) {
      items.push({
        icon: Clock,
        iconColor: 'text-gray-400',
        label: t('inbox.time.label'),
        value: relativeTime,
      });
    }

    return items;
  }, [conversation.channel, conversation.audit.updatedAt, t]);

  /** Build badges */
  const badges = useMemo(() => {
    const badgeList: Array<{ label: string; variant: ListCardBadgeVariant; className?: string }> = [];

    badgeList.push({
      label: conversation.channel.toUpperCase(),
      variant: 'outline',
      className: 'text-xs',
    });

    if (conversation.unreadCount > 0) {
      badgeList.push({
        label: String(conversation.unreadCount),
        variant: 'destructive',
        className: 'text-xs',
      });
    }

    return badgeList;
  }, [conversation.channel, conversation.unreadCount]);

  // ==========================================================================
  // 🏢 HANDLERS
  // ==========================================================================

  const handleClick = () => {
    onSelect?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect?.();
    }
  };

  // ==========================================================================
  // 🏢 RENDER
  // ==========================================================================

  const ChannelIcon = CHANNEL_ICONS[conversation.channel] || MessageSquare;

  return (
    <ListCard
      entityType={undefined}
      customIcon={ChannelIcon}
      customIconColor={CHANNEL_COLORS[conversation.channel] || 'text-gray-500'}
      title={displayName}
      subtitle={subtitle}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      compact={compact}
      hideStats
      inlineBadges
      hideIcon={false}
      className={className}
      aria-label={t('inbox.card.ariaLabel', { name: displayName })}
    />
  );
}

ConversationListCard.displayName = 'ConversationListCard';

export default ConversationListCard;
