/**
 * **«Πότε» μιας συνομιλίας / ενός μηνύματος στο inbox** — ο ΕΝΑΣ κανόνας (ADR-894 · N.0.2).
 *
 * Ζούσε τρεις φορές, λέξη προς λέξη: `crm/inbox/thread-view-helpers` · `crm/unified-inbox-helpers` ·
 * `domain/cards/conversation/ConversationListCard`.
 *
 * ⚠️ **Σκόπιμα ΔΕΝ είναι το `formatRelativeTime`** (`lib/intl-formatting`): το inbox λέει «τώρα» · «πριν N ώρες» ·
 * «χθες» και **μετά τις 48 ώρες δείχνει την ημερομηνία** — όχι «πριν 3 εβδομάδες». Σε λίστα συνομιλιών ο άνθρωπος
 * ψάχνει **τη μέρα**, όχι μια απόσταση που χρειάζεται αφαίρεση στο μυαλό του.
 *
 * @module components/crm/inbox/inbox-relative-time
 */

import { formatDateTime } from '@/lib/intl-utils';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const MS_PER_HOUR = 1000 * 60 * 60;

export function getInboxRelativeTime(timestamp: string | Date | undefined, t: Translate): string {
  if (!timestamp) return '';
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const diffHours = (Date.now() - date.getTime()) / MS_PER_HOUR;
  if (diffHours < 1) return t('inbox.time.now');
  if (diffHours < 24) return t('inbox.time.hoursAgo', { hours: Math.floor(diffHours) });
  if (diffHours < 48) return t('inbox.time.yesterday');
  return formatDateTime(date);
}
