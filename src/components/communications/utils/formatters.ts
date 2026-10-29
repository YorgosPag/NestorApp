import { Mail, Phone, MessageSquare, Send } from 'lucide-react';
import { formatRelativeTime } from '@/lib/intl-formatting';
import { normalizeToDate } from '@/lib/date-local';

export const getCommunicationTypeIcon = (type: string) => ({
  email: Mail, sms: MessageSquare, call: Phone, whatsapp: MessageSquare, telegram: Send,
}[type] || Mail);

export const getTypeColor = (type: string) => ({
  email: 'text-primary bg-[hsl(var(--bg-info))]/20',
  sms: 'text-[hsl(var(--text-success))] bg-[hsl(var(--bg-success))]/10',
  call: 'text-primary bg-accent',
  whatsapp: 'text-[hsl(var(--text-success))] bg-[hsl(var(--bg-success))]/10',
  telegram: 'text-primary bg-[hsl(var(--bg-info))]/20',
}[type] || 'text-muted-foreground bg-muted');

// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const getDirectionLabel = (direction: string) =>
  direction === 'inbound' ? 'communications.direction.inbound' : 'communications.direction.outbound';


/**
 * «Πριν από Χ» στη γλώσσα του αναγνώστη — ανάθεση στο SSoT `formatRelativeTime` (ADR-894).
 *
 * 🔴 Ήταν τοπικό αντίγραφο που επέστρεφε **ωμά κλειδιά** (`common.time.minutesAgo`, χωρίς καν τον αριθμό), και το
 * `CommunicationsHistory` τα αποδίδει **χωρίς** `t()` ⇒ ο άνθρωπος έβλεπε το κλειδί αυτολεξεί.
 */
export const getRelativeTime = (timestamp: Date | string | number | { toDate?: () => Date } | null | undefined) => {
  if (!timestamp) return '';
  const date = normalizeToDate(timestamp);
  return date ? formatRelativeTime(date) : '';
};
