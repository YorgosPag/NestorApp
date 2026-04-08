/**
 * Helpers + sub-components for UnifiedInbox
 * Extracted for file-size compliance (<500 lines).
 */

import '@/lib/design-system';
import React from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatDateTime } from '@/lib/intl-utils';
import { truncateText } from '@/lib/obligations-utils';
import { CommonBadge } from '@/core/badges';
import { HOVER_BACKGROUND_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { ChevronRight } from 'lucide-react';
import { getChannelIconComponent } from '@/lib/channel-icon-map';
import { COMMUNICATION_CHANNELS } from '@/types/communications';
import { MESSAGE_PREVIEW_LENGTH } from '@/config/domain-constants';
import type { ConversationListItem } from '@/hooks/inbox/useInboxApi';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getChannelIcon(channel: string, iconSizes: ReturnType<typeof useIconSizes>) {
  const Icon = getChannelIconComponent(channel);
  return <Icon className={iconSizes.sm} />;
}

export function getChannelColorClasses(channel: string, colors: ReturnType<typeof useSemanticColors>) {
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

export function getRelativeTime(timestamp: string, t: (key: string, options?: Record<string, unknown>) => string): string {
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
// CONVERSATION LIST ITEM
// ============================================================================

interface ConversationItemProps {
  conversation: ConversationListItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function ConversationItem({ conversation, isSelected, onSelect, t }: ConversationItemProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const externalParticipant = conversation.participants.find(p => !p.isInternal);
  const relativeTime = getRelativeTime(conversation.audit.updatedAt, t);

  return (
    <li>
      <button
        onClick={() => onSelect(conversation.id)}
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
          <div className={`p-2 rounded-full flex-shrink-0 ${getChannelColorClasses(conversation.channel, colors)}`}>
            {getChannelIcon(conversation.channel, iconSizes)}
          </div>

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

          <ChevronRight className={`${iconSizes.sm} ${colors.text.muted} flex-shrink-0`} />
        </article>
      </button>
    </li>
  );
}
