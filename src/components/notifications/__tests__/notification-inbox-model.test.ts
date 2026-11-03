/**
 * Το μοντέλο του Inbox (ADR-927): κατηγορία από τον ΔΗΛΩΜΕΝΟ τύπο, φίλτρα, μετρητές, ημέρες στη
 * ζώνη του ανθρώπου, φίλτρο στη διεύθυνση.
 */

import type { Notification } from '@/types/notification';
import {
  categoryFacets,
  dayKeyOf,
  filterInbox,
  groupByDay,
  inboxCategoryOf,
  previousDayKey,
} from '../notification-inbox-model';
import { inboxFilterOf, inboxHref } from '../notification-inbox-url';

function n(id: string, createdAt: string, opts: { eventType?: string; state?: Notification['delivery']['state']; feature?: string } = {}): Notification {
  return {
    id, tenantId: 't', userId: 'u', createdAt, severity: 'info', title: id,
    source: { service: 'test', feature: opts.feature }, channel: 'inapp',
    delivery: { state: opts.state ?? 'delivered', attempts: 1 },
    ...(opts.eventType ? { meta: { eventType: opts.eventType } } : {}),
  };
}

const ATHENS = 'Europe/Athens';

describe('inboxCategoryOf — δηλωμένος τύπος, όχι μαντεψιά', () => {
  it('meta.eventType → EVENT_CATEGORY_MAP', () => {
    expect(inboxCategoryOf(n('a', '2026-11-03T10:00:00Z', { eventType: 'crm.newLead' }))).toBe('crm');
  });

  it('χωρίς eventType ⇒ other — ακόμη κι αν το source.feature «μοιάζει» με lead', () => {
    expect(inboxCategoryOf(n('a', '2026-11-03T10:00:00Z', { feature: 'lead-capture' }))).toBe('other');
  });

  it('άγνωστος τύπος ⇒ other', () => {
    expect(inboxCategoryOf(n('a', '2026-11-03T10:00:00Z', { eventType: 'nope.never' }))).toBe('other');
  });
});

describe('filterInbox / categoryFacets', () => {
  const list = [
    n('1', '2026-11-03T10:00:00Z', { eventType: 'crm.newLead' }),
    n('2', '2026-11-03T09:00:00Z', { eventType: 'crm.newLead', state: 'seen' }),
    n('3', '2026-11-03T08:00:00Z'),
  ];

  it('unread = ούτε αναγνωσμένη ούτε ενεργημένη', () => {
    expect(filterInbox(list, { view: 'unread', category: null }).map((x) => x.id)).toEqual(['1', '3']);
  });

  it('κατηγορία + προβολή μαζί', () => {
    expect(filterInbox(list, { view: 'unread', category: 'crm' }).map((x) => x.id)).toEqual(['1']);
  });

  it('μετρητές με τη σειρά των ρυθμίσεων, other τελευταίο, μόνο μη κενές', () => {
    expect(categoryFacets(list)).toEqual([
      { category: 'crm', total: 2, unread: 1 },
      { category: 'other', total: 1, unread: 1 },
    ]);
  });

  it('η επιλεγμένη κατηγορία μένει ορατή ακόμη και άδεια', () => {
    expect(categoryFacets(list, 'security').map((f) => f.category)).toEqual(['crm', 'security', 'other']);
  });
});

describe('ημέρες στη ζώνη του ανθρώπου', () => {
  it('23:30 UTC είναι ΑΥΡΙΟ στην Αθήνα', () => {
    expect(dayKeyOf(new Date('2026-11-02T23:30:00Z'), ATHENS)).toBe('2026-11-03');
  });

  it('το «χθες» είναι ημερολογιακό — αλλαγή μήνα και ώρας (25ωρη 25/10/2026)', () => {
    expect(previousDayKey('2026-11-01')).toBe('2026-10-31');
    expect(previousDayKey('2026-10-26')).toBe('2026-10-25');
  });

  it('σήμερα · χθες · ημερομηνία, με τη σειρά της λίστας', () => {
    const buckets = groupByDay([
      n('a', '2026-11-03T08:00:00Z'),
      n('b', '2026-11-02T22:30:00Z'), // 00:30 στις 03/11 Αθήνα ⇒ σήμερα
      n('c', '2026-11-02T10:00:00Z'),
      n('d', '2026-10-30T10:00:00Z'),
    ], '2026-11-03', ATHENS);
    expect(buckets.map((b) => [b.kind, b.dayKey, b.items.map((x) => x.id)])).toEqual([
      ['today', '2026-11-03', ['a', 'b']],
      ['yesterday', '2026-11-02', ['c']],
      ['date', '2026-10-30', ['d']],
    ]);
  });
});

describe('φίλτρο στη διεύθυνση', () => {
  it('η προεπιλογή δεν γράφει παράμετρο', () => {
    expect(inboxHref({ view: 'all', category: null })).toBe('/crm/notifications');
  });

  it('γράφει και ξαναδιαβάζει το ίδιο φίλτρο', () => {
    const href = inboxHref({ view: 'unread', category: 'crm' });
    expect(href).toBe('/crm/notifications?view=unread&category=crm');
    expect(inboxFilterOf(new URLSearchParams(href.split('?')[1]))).toEqual({ view: 'unread', category: 'crm' });
  });

  it('άγνωστες τιμές ⇒ προεπιλογή, ποτέ σφάλμα', () => {
    expect(inboxFilterOf(new URLSearchParams('view=bogus&category=nope'))).toEqual({ view: 'all', category: null });
    expect(inboxFilterOf(null)).toEqual({ view: 'all', category: null });
  });
});
