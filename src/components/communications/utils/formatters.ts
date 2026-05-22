import { Mail, Phone, MessageSquare, Send } from 'lucide-react';
import { formatDateTime } from '@/lib/intl-utils';
import { normalizeToDate } from '@/lib/date-local';

export const getCommunicationTypeIcon = (type: string) => ({
  email: Mail, sms: MessageSquare, call: Phone, whatsapp: MessageSquare, telegram: Send,
}[type] || Mail);

export const getTypeColor = (type: string) => ({
  email: 'text-primary bg-[hsl(var(--bg-info))]/20',
  sms: 'text-green-707 bg-[hsl(var(--bg-success))]/10',
  call: 'text-primary bg-accent',
  whatsapp: 'text-green-707 bg-[hsl(var(--bg-success))]/10',
  telegram: 'text-primary bg-[hsl(var(--bg-info))]/20',
}[type] || 'text-muted-foreground bg-muted');

// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const getDirectionLabel = (direction: string) =>
  direction === 'inbound' ? 'communications.direction.inbound' : 'communications.direction.outbound';


export const getRelativeTime = (timestamp: Date | string | number | { toDate?: () => Date } | null | undefined) => {
  if (!timestamp) return '';
  try {
    const date = normalizeToDate(timestamp);
    if (!date) return '';
    const now = new Date();
    const diffInMinutes = Math.floor((+now - +date) / (1000 * 60));
    if (diffInMinutes < 1) return 'common.time.justNow';
    if (diffInMinutes < 60) return 'common.time.minutesAgo';
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return 'common.time.hoursAgo';
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return 'common.time.daysAgo';
    return formatDateTime(date);
  } catch {
    return '';
  }
};
