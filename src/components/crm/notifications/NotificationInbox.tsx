'use client';

/**
 * @fileoverview **ΤΟ INBOX ΕΙΔΟΠΟΙΗΣΕΩΝ** — φίλτρα στη διεύθυνση, ομάδες ανά ημέρα, πλήκτρα, παλαιότερες σελίδες.
 * @related ADR-927 · stores/notificationCenter.ts · stores/notification-feed.ts · useNotificationActions.ts
 * @module components/crm/notifications/NotificationInbox
 *
 * 🔑 **ΜΙΑ ΠΗΓΗ**: διαβάζει το `notificationCenter` — το ίδιο store με το κουδούνι και το συρτάρι. Ό,τι
 *    απορρίπτεις εδώ φεύγει και από εκεί, και ο αριθμός «μη αναγνωσμένες» είναι **ένας**.
 * ⚠️ Τα φίλτρα και οι μετρητές κρίνουν **ό,τι έχει φορτωθεί** (το ζωντανό παράθυρο + όσες παλαιότερες σελίδες
 *    ζήτησε ο άνθρωπος). Το «Παλαιότερες» μένει ορατό όσο η βάση έχει κι άλλες — δεν υπόσχεται πληρότητα.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useRouter } from '@/lib/workspace/navigation';
import { useUserTimeZone } from '@/hooks/useUserTimeZone';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { notificationListOf, useNotificationCenter } from '@/stores/notificationCenter';
import { useNotificationActions, type NotificationActions } from '@/components/notifications/useNotificationActions';
import type { Notification } from '@/types/notification';
import {
  categoryFacets,
  dayKeyOf,
  filterInbox,
  groupByDay,
  type DayBucket,
  type InboxFilter,
} from '@/components/notifications/notification-inbox-model';
import { DEFAULT_INBOX_FILTER, inboxFilterOf, inboxHref } from '@/components/notifications/notification-inbox-url';
import { NotificationInboxFilters } from './NotificationInboxFilters';
import { NotificationInboxItem } from './NotificationInboxItem';
import { NotificationInboxOlder } from './NotificationInboxOlder';
import { useInboxKeyboard, type InboxKeyboard, type InboxKeyboardHandlers } from './useInboxKeyboard';

const DAY_CHECK_MS = 60_000;

/** Η σημερινή μέρα στη ζώνη του ανθρώπου· αλλάζει τα μεσάνυχτα χωρίς ανανέωση σελίδας. */
function useTodayKey(timeZone: string): string {
  const [today, setToday] = useState(() => dayKeyOf(new Date(), timeZone));
  useEffect(() => {
    setToday(dayKeyOf(new Date(), timeZone));
    const timer = window.setInterval(() => setToday(dayKeyOf(new Date(), timeZone)), DAY_CHECK_MS);
    return () => window.clearInterval(timer);
  }, [timeZone]);
  return today;
}

function useInboxFilter(): [InboxFilter, (next: InboxFilter) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const filter = useMemo(() => inboxFilterOf(params), [params]);
  const setFilter = useCallback((next: InboxFilter) => router.replace(inboxHref(next), { scroll: false }), [router]);
  return [filter, setFilter];
}

function InboxEmpty({ filter, onClear }: { readonly filter: InboxFilter; readonly onClear: () => void }) {
  const { t } = useTranslation('crm');
  const colors = useSemanticColors();
  const filtered = filter.view !== 'all' || filter.category !== null;
  const message = !filtered ? t('notifications.empty') : filter.view === 'unread' && filter.category === null
    ? t('notifications.inbox.emptyUnread')
    : t('notifications.inbox.emptyFiltered');
  return (
    <section className={cn('flex flex-col items-center justify-center gap-2 py-12 text-center', colors.text.muted)}>
      <Inbox className="h-12 w-12" aria-hidden="true" />
      <p className="text-lg font-medium">{message}</p>
      {filtered
        ? <Button variant="outline" size="sm" onClick={onClear}>{t('notifications.inbox.clearFilter')}</Button>
        : <p className="text-sm">{t('notifications.emptyDescription')}</p>}
    </section>
  );
}

function useDayHeading(): (bucket: DayBucket) => string {
  const { t, i18n } = useTranslation('crm');
  const formatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language || 'el', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    [i18n.language],
  );
  return useCallback((bucket: DayBucket) => {
    if (bucket.kind === 'today') return t('notifications.inbox.groups.today');
    if (bucket.kind === 'yesterday') return t('notifications.inbox.groups.yesterday');
    // Το `dayKey` είναι ήδη η μέρα στη ζώνη του ανθρώπου· μορφοποίηση σε UTC μεσημέρι = καμία μετατόπιση.
    return formatter.format(new Date(`${bucket.dayKey}T12:00:00Z`));
  }, [formatter, t]);
}

/** Ό,τι βλέπει το Inbox — από το ΕΝΑ store, με το φίλτρο της διεύθυνσης. */
function useInboxView(filter: InboxFilter) {
  const timeZone = useUserTimeZone();
  const items = useNotificationCenter((s) => s.items);
  const order = useNotificationCenter((s) => s.order);
  const today = useTodayKey(timeZone);
  const list = useMemo(() => notificationListOf({ items, order }), [items, order]);
  const visible = useMemo(() => filterInbox(list, filter), [list, filter]);
  const facets = useMemo(() => categoryFacets(list, filter.category), [list, filter.category]);
  // Το `today` είναι είσοδος: η ομαδοποίηση ξαναγίνεται τα μεσάνυχτα, όχι μόνο όταν αλλάξει η λίστα.
  const buckets = useMemo(() => groupByDay(visible, today, timeZone), [visible, today, timeZone]);
  const visibleIds = useMemo(() => visible.map((n) => n.id), [visible]);
  return { items, visible, facets, buckets, visibleIds, timeZone };
}

function useKeyboardHandlers(items: ReadonlyMap<string, Notification>, actions: NotificationActions): InboxKeyboardHandlers {
  return useMemo(() => ({
    open: (id: string) => { const n = items.get(id); if (n) void actions.open(n); },
    dismiss: (id: string) => void actions.dismiss(id),
    markRead: (id: string) => void actions.markRead([id]),
    markUnread: (id: string) => void actions.markUnread([id]),
  }), [actions, items]);
}

interface InboxDayListProps {
  readonly buckets: readonly DayBucket[];
  readonly keyboard: InboxKeyboard;
  readonly actions: NotificationActions;
  readonly timeZone: string;
}

function InboxDayList({ buckets, keyboard, actions, timeZone }: InboxDayListProps) {
  const { i18n } = useTranslation('crm');
  const colors = useSemanticColors();
  const dayHeading = useDayHeading();
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language || 'el', { hour: '2-digit', minute: '2-digit', timeZone }),
    [i18n.language, timeZone],
  );
  return (
    <section onKeyDown={keyboard.onKeyDown} className="flex flex-col gap-5">
      {buckets.map((bucket) => (
        <section key={bucket.dayKey} aria-labelledby={`inbox-day-${bucket.dayKey}`} className="flex flex-col gap-2">
          <h2 id={`inbox-day-${bucket.dayKey}`} className={cn('text-xs font-semibold uppercase tracking-wide', colors.text.muted)}>
            {dayHeading(bucket)}
          </h2>
          <ol className="flex flex-col gap-2">
            {bucket.items.map((n) => (
              <li key={n.id}>
                <NotificationInboxItem
                  notification={n}
                  active={keyboard.activeId === n.id}
                  timeFormatter={timeFormatter}
                  actions={actions}
                  onActivate={keyboard.setActiveId}
                  rowRef={keyboard.register(n.id)}
                />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </section>
  );
}

export function NotificationInbox() {
  const { t } = useTranslation('crm');
  const colors = useSemanticColors();
  const unreadTotal = useNotificationCenter((s) => s.unread);
  const [filter, setFilter] = useInboxFilter();
  const actions = useNotificationActions();
  const view = useInboxView(filter);
  const keyboard = useInboxKeyboard(view.visibleIds, useKeyboardHandlers(view.items, actions));

  return (
    <section aria-label={t('notifications.inbox.listLabel')} className="flex flex-col gap-4">
      <NotificationInboxFilters filter={filter} facets={view.facets} unreadTotal={unreadTotal} onChange={setFilter} />
      {view.visible.length === 0
        ? <InboxEmpty filter={filter} onClear={() => setFilter(DEFAULT_INBOX_FILTER)} />
        : <InboxDayList buckets={view.buckets} keyboard={keyboard} actions={actions} timeZone={view.timeZone} />}
      <NotificationInboxOlder />
      <p className={cn('hidden text-xs md:block', colors.text.muted)}>{t('notifications.inbox.shortcutsHint')}</p>
    </section>
  );
}
