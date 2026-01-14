'use client';

/**
 * =============================================================================
 * CONTACT ACTIVITY TIMELINE
 * =============================================================================
 *
 * Displays the activity history for a contact in a conversation context.
 * Shows communications, status changes, and interaction events in a timeline.
 *
 * @module components/crm/inbox/ContactActivityTimeline
 * @enterprise ADR-compliant - Uses centralized design system hooks
 * @pattern Based on StorageHistoryTab pattern
 */

import React from 'react';
import type { ConversationListItem, MessageListItem } from '@/hooks/inbox/useInboxApi';
import { formatDateTime } from '@/lib/intl-utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  Clock,
  User,
  MessageSquare,
  Mail,
  Phone,
  CheckCircle,
  Circle,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Activity as ActivityIcon
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { COMMUNICATION_CHANNELS, type CommunicationChannel } from '@/types/communications';
import { MESSAGE_DIRECTION } from '@/types/conversations';

// ============================================================================
// TYPES
// ============================================================================

/** Activity event type for timeline */
type ActivityEventType =
  | 'message_received'
  | 'message_sent'
  | 'status_change'
  | 'agent_assigned'
  | 'conversation_opened'
  | 'conversation_closed';

/** Activity event status */
type ActivityEventStatus = 'completed' | 'in_progress' | 'pending' | 'failed';

/** Timeline event interface */
interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  title: string;
  description: string;
  date: Date;
  actor?: string;
  status: ActivityEventStatus;
  channel?: CommunicationChannel;
  metadata?: {
    messageId?: string;
    direction?: 'inbound' | 'outbound';
    content?: string;
  };
}

/** Component props */
interface ContactActivityTimelineProps {
  /** The conversation to display activities for */
  conversation: ConversationListItem | null;
  /** Messages from the conversation */
  messages: MessageListItem[];
  /** Whether data is loading */
  loading?: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get icon for activity type
 */
function getEventIcon(type: ActivityEventType, channel?: CommunicationChannel) {
  if (type === 'message_received' || type === 'message_sent') {
    switch (channel) {
      case COMMUNICATION_CHANNELS.EMAIL:
        return Mail;
      case COMMUNICATION_CHANNELS.TELEGRAM:
      case COMMUNICATION_CHANNELS.WHATSAPP:
      case COMMUNICATION_CHANNELS.MESSENGER:
        return MessageSquare;
      case COMMUNICATION_CHANNELS.SMS:
        return Phone;
      default:
        return MessageSquare;
    }
  }

  switch (type) {
    case 'status_change':
      return Circle;
    case 'agent_assigned':
      return User;
    case 'conversation_opened':
      return ArrowDownLeft;
    case 'conversation_closed':
      return CheckCircle;
    default:
      return ActivityIcon;
  }
}

/**
 * Get color classes for activity type
 */
function getEventColor(type: ActivityEventType, colors: ReturnType<typeof useSemanticColors>) {
  switch (type) {
    case 'message_received':
      return `${colors.text.info} ${colors.bg.infoSubtle}`;
    case 'message_sent':
      return `${colors.text.success} ${colors.bg.successSubtle}`;
    case 'status_change':
      return `${colors.text.accent} ${colors.bg.infoSubtle}`;
    case 'agent_assigned':
      return `${colors.text.warning} ${colors.bg.warningSubtle}`;
    case 'conversation_opened':
      return `${colors.text.info} ${colors.bg.infoSubtle}`;
    case 'conversation_closed':
      return `${colors.text.success} ${colors.bg.successSubtle}`;
    default:
      return `${colors.text.muted} ${colors.bg.muted}`;
  }
}

/**
 * Get status icon
 */
function getStatusIcon(status: ActivityEventStatus) {
  switch (status) {
    case 'completed':
      return CheckCircle;
    case 'in_progress':
      return Clock;
    case 'pending':
      return Circle;
    case 'failed':
      return AlertCircle;
    default:
      return Circle;
  }
}

/**
 * Build activity events from messages and conversation
 */
function buildActivityEvents(
  conversation: ConversationListItem | null,
  messages: MessageListItem[],
  t: (key: string, options?: Record<string, unknown>) => string
): ActivityEvent[] {
  if (!conversation) return [];

  const events: ActivityEvent[] = [];

  // Add conversation opened event
  events.push({
    id: `conv-opened-${conversation.id}`,
    type: 'conversation_opened',
    title: t('inbox.activity.conversationOpened'),
    description: t('inbox.activity.conversationOpenedDesc', {
      channel: conversation.channel.toUpperCase()
    }),
    date: new Date(conversation.audit.createdAt),
    actor: t('inbox.activity.system'),
    status: 'completed',
    channel: conversation.channel
  });

  // Add message events
  messages.forEach((message) => {
    const isInbound = message.direction === MESSAGE_DIRECTION.INBOUND;
    const senderName = message.senderName || t('inbox.activity.unknown');
    const messageContent = message.content.text || '';

    events.push({
      id: `msg-${message.id}`,
      type: isInbound ? 'message_received' : 'message_sent',
      title: isInbound
        ? t('inbox.activity.messageReceived')
        : t('inbox.activity.messageSent'),
      description: messageContent.length > 80
        ? messageContent.slice(0, 80) + '...'
        : messageContent,
      date: new Date(message.createdAt),
      actor: senderName,
      status: message.deliveryStatus === 'failed' ? 'failed' : 'completed',
      channel: conversation.channel,
      metadata: {
        messageId: message.id,
        direction: isInbound ? 'inbound' : 'outbound',
        content: messageContent
      }
    });
  });

  // Add agent assignment if exists
  if (conversation.assignedTo) {
    events.push({
      id: `agent-${conversation.id}`,
      type: 'agent_assigned',
      title: t('inbox.activity.agentAssigned'),
      description: t('inbox.activity.agentAssignedDesc', {
        agent: conversation.assignedTo
      }),
      date: new Date(conversation.audit.updatedAt),
      actor: t('inbox.activity.system'),
      status: 'completed'
    });
  }

  // Add status change if closed
  if (conversation.status === 'closed' || conversation.status === 'archived') {
    events.push({
      id: `conv-closed-${conversation.id}`,
      type: 'conversation_closed',
      title: t('inbox.activity.conversationClosed'),
      description: t('inbox.activity.conversationClosedDesc'),
      date: new Date(conversation.audit.updatedAt),
      actor: conversation.assignedTo || t('inbox.activity.system'),
      status: 'completed'
    });
  }

  // Sort by date descending (newest first)
  return events.sort((a, b) => b.date.getTime() - a.date.getTime());
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ContactActivityTimeline({
  conversation,
  messages,
  loading = false
}: ContactActivityTimelineProps) {
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  // Build activity events from data
  const activityEvents = React.useMemo(
    () => buildActivityEvents(conversation, messages, t),
    [conversation, messages, t]
  );

  // Calculate statistics
  const stats = React.useMemo(() => {
    const inbound = activityEvents.filter(e => e.type === 'message_received').length;
    const outbound = activityEvents.filter(e => e.type === 'message_sent').length;

    return {
      total: activityEvents.length,
      inbound,
      outbound,
      assignments: activityEvents.filter(e => e.type === 'agent_assigned').length
    };
  }, [activityEvents]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Clock className={`${iconSizes.md} animate-spin mr-2 ${colors.text.muted}`} />
        <span className={colors.text.muted}>{t('inbox.loading')}</span>
      </div>
    );
  }

  // Empty state
  if (!conversation || activityEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <ActivityIcon className={`${iconSizes.xl2} ${colors.text.muted} mb-4 opacity-30`} />
        <p className={colors.text.muted}>{t('inbox.noActivity')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <ActivityIcon className={iconSizes.md} />
          {t('inbox.activity.overview')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`bg-card ${quick.card} p-4 text-center`}>
            <div className={`text-2xl font-bold ${colors.text.muted}`}>{stats.total}</div>
            <div className="text-sm text-muted-foreground">{t('inbox.activity.totalEvents')}</div>
          </div>
          <div className={`bg-card ${quick.card} p-4 text-center`}>
            <div className={`text-2xl font-bold ${colors.text.info}`}>{stats.inbound}</div>
            <div className="text-sm text-muted-foreground">{t('inbox.activity.received')}</div>
          </div>
          <div className={`bg-card ${quick.card} p-4 text-center`}>
            <div className={`text-2xl font-bold ${colors.text.success}`}>{stats.outbound}</div>
            <div className="text-sm text-muted-foreground">{t('inbox.activity.sent')}</div>
          </div>
          <div className={`bg-card ${quick.card} p-4 text-center`}>
            <div className={`text-2xl font-bold ${colors.text.warning}`}>{stats.assignments}</div>
            <div className="text-sm text-muted-foreground">{t('inbox.activity.assignments')}</div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Clock className={iconSizes.md} />
          {t('inbox.activity.timeline')}
        </h3>
        <div className="space-y-4">
          {activityEvents.map((event, index) => {
            const EventIcon = getEventIcon(event.type, event.channel);
            const StatusIcon = getStatusIcon(event.status);
            const isLast = index === activityEvents.length - 1;
            const DirectionIcon = event.metadata?.direction === 'inbound'
              ? ArrowDownLeft
              : event.metadata?.direction === 'outbound'
                ? ArrowUpRight
                : null;

            return (
              <article key={event.id} className="relative">
                {/* Vertical Line */}
                {!isLast && (
                  <div className="absolute left-6 top-12 w-0.5 h-16 bg-border" />
                )}

                <div className="flex gap-4">
                  {/* Icon */}
                  <figure
                    className={`flex-shrink-0 ${iconSizes.xl2} rounded-full flex items-center justify-center ${getEventColor(event.type, colors)}`}
                  >
                    <EventIcon className={iconSizes.md} />
                  </figure>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className={`bg-card ${quick.card} p-4`}>
                      <header className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm">{event.title}</h4>
                            {DirectionIcon && (
                              <DirectionIcon className={`${iconSizes.xs} ${colors.text.muted}`} />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {event.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-4">
                          <StatusIcon className={iconSizes.xs} />
                          <span>
                            {event.status === 'completed'
                              ? t('inbox.activity.statusCompleted')
                              : event.status === 'in_progress'
                                ? t('inbox.activity.statusInProgress')
                                : event.status === 'pending'
                                  ? t('inbox.activity.statusPending')
                                  : t('inbox.activity.statusFailed')}
                          </span>
                        </div>
                      </header>

                      <footer className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <time className="flex items-center gap-1">
                            <Clock className={iconSizes.xs} />
                            {formatDateTime(event.date)}
                          </time>
                          {event.actor && (
                            <span className="flex items-center gap-1">
                              <User className={iconSizes.xs} />
                              {event.actor}
                            </span>
                          )}
                        </div>

                        {/* Channel badge */}
                        {event.channel && (
                          <span className={`${colors.bg.muted} px-2 py-1 rounded text-xs uppercase`}>
                            {event.channel}
                          </span>
                        )}
                      </footer>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Conversation Summary */}
      {conversation && (
        <section>
          <h3 className="font-semibold mb-4">{t('inbox.activity.summary')}</h3>
          <div className={`bg-card ${quick.card} p-4`}>
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="font-medium text-muted-foreground">{t('inbox.activity.channel')}:</dt>
                <dd className="ml-2">{conversation.channel.toUpperCase()}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">{t('inbox.activity.status')}:</dt>
                <dd className="ml-2 capitalize">{conversation.status}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">{t('inbox.activity.created')}:</dt>
                <dd className="ml-2">{formatDateTime(new Date(conversation.audit.createdAt))}</dd>
              </div>
              {conversation.assignedTo && (
                <div>
                  <dt className="font-medium text-muted-foreground">{t('inbox.activity.assignedTo')}:</dt>
                  <dd className="ml-2">{conversation.assignedTo}</dd>
                </div>
              )}
              <div>
                <dt className="font-medium text-muted-foreground">{t('inbox.activity.lastUpdated')}:</dt>
                <dd className="ml-2">{formatDateTime(new Date(conversation.audit.updatedAt))}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">{t('inbox.activity.participants')}:</dt>
                <dd className="ml-2">{conversation.participants.length}</dd>
              </div>
            </dl>
          </div>
        </section>
      )}
    </div>
  );
}

export default ContactActivityTimeline;
