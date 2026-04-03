import { Inbox, Mail, MessageSquare } from 'lucide-react';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { CONVERSATION_STATUS } from '@/types/conversations';
import type { ConversationListItem } from '@/hooks/inbox/useInboxApi';

export function buildCommunicationsDashboardStats(
  conversations: ConversationListItem[],
  totalCount: number,
  t: (key: string) => string,
): DashboardStat[] {
  return [
    {
      title: t('inbox.dashboard.total'),
      value: totalCount,
      icon: Inbox,
      color: 'blue',
    },
    {
      title: t('inbox.dashboard.active'),
      value: conversations.filter((conversation) => conversation.status === CONVERSATION_STATUS.ACTIVE).length,
      icon: MessageSquare,
      color: 'green',
    },
    {
      title: t('inbox.dashboard.unread'),
      value: conversations.reduce((sum, conversation) => sum + (conversation.unreadCount || 0), 0),
      icon: Mail,
      color: 'orange',
    },
  ];
}
