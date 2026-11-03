/**
 * @fileoverview **ΤΟ ΜΟΝΤΕΛΟ ΤΟΥ INBOX** — καθαρές συναρτήσεις: προβολή, κατηγορία, μετρητές, ομάδες ανά ημέρα.
 * @related ADR-927 · config/notification-events.ts (`EVENT_CATEGORY_MAP`) · config/notification-preference-rows.ts
 * @module components/notifications/notification-inbox-model
 *
 * 🔑 **Η ΚΑΤΗΓΟΡΙΑ ΕΙΝΑΙ ΔΗΛΩΜΕΝΗ, ΟΧΙ ΜΑΝΤΕΜΕΝΗ.** Η παλιά σελίδα έψαχνε λέξεις στο `source.feature`
 *    (`'lead'` ⇒ «Νέο Lead») — ακριβώς η ευρετική που απαγορεύει το ADR-841 §7 Α18. Εδώ: `meta.eventType`
 *    (γραμμένο από τον orchestrator) → `EVENT_CATEGORY_MAP` → κατηγορία. Ίδιος χάρτης με τις **ρυθμίσεις**
 *    ειδοποιήσεων, άρα ό,τι ο άνθρωπος βλέπει ως «Ακίνητα» στο Inbox είναι ό,τι σιγεί ως «Ακίνητα» στις ρυθμίσεις.
 *    Χωρίς `eventType` (παλιά/δοκιμαστικά έγγραφα) ⇒ `other` — ειλικρινές, όχι μαντεψιά.
 *
 * 🔑 **ΗΜΕΡΑ = ΗΜΕΡΑ ΤΗΣ ΖΩΝΗΣ ΤΟΥ ΑΝΘΡΩΠΟΥ**, όχι του browser ή του UTC. Το «χθες» υπολογίζεται πάνω στο
 *    ημερολόγιο (`YYYY-MM-DD` − 1), όχι ως `now − 24h`: στις αλλαγές ώρας η μέρα έχει 23 ή 25 ώρες.
 */

import { EVENT_CATEGORY_MAP, isNotificationEventType } from '@/config/notification-events';
import { NOTIFICATION_PREFERENCE_GROUPS } from '@/config/notification-preference-rows';
import { isNotificationUnread } from '@/lib/notifications/notification-state';
import type { NotificationCategory } from '@/services/user-notification-settings';
import type { Notification } from '@/types/notification';

export type InboxView = 'all' | 'unread';
export const INBOX_VIEWS: readonly InboxView[] = ['all', 'unread'];

/** Η κατηγορία στο Inbox: μία των ρυθμίσεων, ή `other` για έγγραφα χωρίς δηλωμένο τύπο. */
export type InboxCategory = NotificationCategory | 'other';

export interface InboxFilter {
  readonly view: InboxView;
  /** `null` ⇒ όλες οι κατηγορίες. */
  readonly category: InboxCategory | null;
}

export function inboxCategoryOf(n: Pick<Notification, 'meta'>): InboxCategory {
  const eventType = n.meta?.eventType;
  return isNotificationEventType(eventType) ? EVENT_CATEGORY_MAP[eventType].category : 'other';
}

export function matchesInboxFilter(n: Notification, filter: InboxFilter): boolean {
  if (filter.view === 'unread' && !isNotificationUnread(n.delivery.state)) return false;
  return filter.category === null || inboxCategoryOf(n) === filter.category;
}

export function filterInbox(list: readonly Notification[], filter: InboxFilter): Notification[] {
  return list.filter((n) => matchesInboxFilter(n, filter));
}

export interface CategoryFacet {
  readonly category: InboxCategory;
  readonly total: number;
  readonly unread: number;
}

/** Η σειρά των κατηγοριών = η σειρά των ρυθμίσεων· το `other` πάντα τελευταίο. */
const CATEGORY_ORDER: readonly InboxCategory[] = [
  ...NOTIFICATION_PREFERENCE_GROUPS.map((g) => g.category),
  'other',
];

export function isInboxCategory(value: unknown): value is InboxCategory {
  return typeof value === 'string' && (CATEGORY_ORDER as readonly string[]).includes(value);
}

export function isInboxView(value: unknown): value is InboxView {
  return typeof value === 'string' && (INBOX_VIEWS as readonly string[]).includes(value);
}

/**
 * Μετρητές ανά κατηγορία — **μόνο** όσες έχουν ειδοποιήσεις (ένα φίλτρο χωρίς αποτέλεσμα είναι θόρυβος).
 * Εξαίρεση: η **επιλεγμένη** (`selected`) μένει πάντα ορατή, αλλιώς ο άνθρωπος δεν βλέπει τι τον φιλτράρει.
 */
export function categoryFacets(list: readonly Notification[], selected: InboxCategory | null = null): CategoryFacet[] {
  const counts = new Map<InboxCategory, { total: number; unread: number }>();
  for (const n of list) {
    const c = inboxCategoryOf(n);
    const cur = counts.get(c) ?? { total: 0, unread: 0 };
    cur.total += 1;
    if (isNotificationUnread(n.delivery.state)) cur.unread += 1;
    counts.set(c, cur);
  }
  return CATEGORY_ORDER.flatMap((category) => {
    const c = counts.get(category) ?? (category === selected ? { total: 0, unread: 0 } : undefined);
    return c ? [{ category, total: c.total, unread: c.unread }] : [];
  });
}

export type DayBucketKind = 'today' | 'yesterday' | 'date';

export interface DayBucket {
  readonly kind: DayBucketKind;
  /** `YYYY-MM-DD` στη ζώνη του ανθρώπου — σταθερό κλειδί React. */
  readonly dayKey: string;
  readonly items: readonly Notification[];
}

/** `YYYY-MM-DD` στη ζώνη `timeZone` (το `en-CA` γράφει ISO ημερομηνία). */
export function dayKeyOf(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** Η προηγούμενη ημερολογιακή μέρα ενός `YYYY-MM-DD` — αριθμητική ημερολογίου, όχι ωρών. */
export function previousDayKey(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Ομάδες ανά ημέρα, με τη σειρά της λίστας (νεότερη πρώτη). Η λίστα **πρέπει** να είναι ήδη ταξινομημένη —
 * το store την κρατά έτσι. Ειδοποίηση με άκυρη ημερομηνία πάει στην ομάδα της πιο πρόσφατης γνωστής.
 * Το `today` (`dayKeyOf(now, timeZone)`) είναι **είσοδος**, όχι `new Date()` εδώ μέσα: καθαρή συνάρτηση.
 */
export function groupByDay(list: readonly Notification[], today: string, timeZone: string): DayBucket[] {
  const yesterday = previousDayKey(today);
  const buckets: { kind: DayBucketKind; dayKey: string; items: Notification[] }[] = [];
  for (const n of list) {
    const created = new Date(n.createdAt);
    const key = Number.isNaN(created.getTime()) ? (buckets[buckets.length - 1]?.dayKey ?? today) : dayKeyOf(created, timeZone);
    const last = buckets[buckets.length - 1];
    if (last && last.dayKey === key) {
      last.items.push(n);
      continue;
    }
    const kind: DayBucketKind = key === today ? 'today' : key === yesterday ? 'yesterday' : 'date';
    buckets.push({ kind, dayKey: key, items: [n] });
  }
  return buckets;
}
