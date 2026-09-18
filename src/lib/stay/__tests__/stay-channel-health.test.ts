/**
 * **ΠΟΣΟ ΕΜΠΙΣΤΕΥΟΜΑΣΤΕ ΜΙΑ ΠΗΓΗ, ΚΑΙ ΟΙ ΣΥΓΚΡΟΥΣΕΙΣ ΤΗΣ** — ADR-835 §22 · §6.4.
 */

import {
  STAY_CHANNEL_STATUS_NEW,
  type StayChannelFeed,
  type StayChannelFeedStatus,
} from '@/types/stay-channels';
import { stayChannelConflicts } from '../stay-channel-conflicts';
import {
  earliestPollAt,
  nextPollAtFor,
  stayChannelFreshnessAt,
  stayChannelKindOfUrl,
  stayChannelsTrustedAt,
} from '../stay-channel-health';
import { blockEntry, bookingEntry, FEED } from './stay-rules-fixtures';

const NOW = '2026-09-17T12:00:00.000Z';

const statusAt = (lastSuccessAt: string | null, consecutiveFailures = 0): StayChannelFeedStatus => ({
  ...STAY_CHANNEL_STATUS_NEW,
  lastSuccessAt,
  consecutiveFailures,
});

const feedWith = (status: StayChannelFeedStatus): StayChannelFeed => ({
  id: FEED,
  label: 'Airbnb',
  url: 'https://www.airbnb.com/calendar/ical/1.ics?s=x',
  channel: 'airbnb',
  status,
  pendingRemovals: {},
  createdAt: NOW,
  createdBy: 'owner_1',
});

describe('stayChannelKindOfUrl — το κανάλι από το URL, ποτέ από τον άνθρωπο', () => {
  it.each([
    ['https://www.airbnb.com/calendar/ical/123.ics?s=abc', 'airbnb'],
    ['https://ical.airbnb.gr/calendar/ical/9.ics', 'airbnb'],
    ['https://admin.booking.com/hotel/hoteladmin/ical.html?t=x', 'booking'],
    ['https://www.vrbo.com/icalendar/abc.ics', 'vrbo'],
    ['https://example.com/calendar.ics', 'other'],
    // 🔴 Η κατάληξη host, ποτέ το «περιέχει»: αλλιώς κάθε domain θα μπορούσε να ντυθεί Airbnb.
    ['https://airbnb.com.evil.example/x.ics', 'other'],
    ['όχι-url', 'other'],
  ])('%s ⇒ %s', (url, kind) => {
    expect(stayChannelKindOfUrl(url)).toBe(kind);
  });
});

describe('stayChannelFreshnessAt — βαθμίδες με ΟΝΟΜΑ, τα δύο όρια της αγοράς', () => {
  it.each([
    ['πριν 10′', '2026-09-17T11:50:00.000Z', 'fresh'],
    ['πριν 2h (πάνω από 60′)', '2026-09-17T10:00:00.000Z', 'lagging'],
    ['πριν 4h (πάνω από το όριο 3h της Airbnb)', '2026-09-17T08:00:00.000Z', 'stale'],
    ['πριν 30h (πάνω από το 24h της Guesty)', '2026-09-16T06:00:00.000Z', 'paused'],
  ])('%s ⇒ %s', (_label, lastSuccessAt, expected) => {
    expect(stayChannelFreshnessAt(statusAt(lastSuccessAt), NOW)).toBe(expected);
  });

  it('🔴 πηγή που ΔΕΝ πέτυχε ΠΟΤΕ είναι stale — «δεν διαβάστηκε» δεν είναι «ελεύθερο»', () => {
    expect(stayChannelFreshnessAt(statusAt(null), NOW)).toBe('stale');
  });

  it('12 συνεχείς αποτυχίες ⇒ paused, ακόμη κι αν η τελευταία επιτυχία είναι πρόσφατη', () => {
    expect(stayChannelFreshnessAt(statusAt('2026-09-17T11:55:00.000Z', 12), NOW)).toBe('paused');
  });

  it('η εμπιστοσύνη είναι ΟΛΩΝ των πηγών: μία stale αρκεί', () => {
    const fresh = feedWith(statusAt('2026-09-17T11:50:00.000Z'));
    const stale = feedWith(statusAt('2026-09-17T06:00:00.000Z'));
    expect(stayChannelsTrustedAt([fresh], NOW)).toBe(true);
    expect(stayChannelsTrustedAt([fresh, stale], NOW)).toBe(false);
    // Κανένα κανάλι ⇒ τίποτα να μη διαβαστεί ⇒ καμία υπόσχεση δεν σπάει.
    expect(stayChannelsTrustedAt([], NOW)).toBe(true);
  });
});

describe('nextPollAtFor — υποχώρηση που ΔΕΝ σταματά ποτέ', () => {
  it.each([
    [0, '2026-09-17T12:30:00.000Z'],
    [1, '2026-09-17T12:30:00.000Z'],
    [2, '2026-09-17T13:00:00.000Z'],
    [3, '2026-09-17T14:00:00.000Z'],
    [40, '2026-09-17T15:00:00.000Z'],
  ])('%i αποτυχίες ⇒ %s', (failures, expected) => {
    expect(nextPollAtFor(failures, NOW)).toBe(expected);
  });

  it('το ερώτημα του cron είναι το ΕΛΑΧΙΣΤΟ nextPollAt — χωρίς πηγές, «ποτέ»', () => {
    const a = feedWith({ ...STAY_CHANNEL_STATUS_NEW, nextPollAt: '2026-09-17T13:00:00.000Z' });
    const b = feedWith({ ...STAY_CHANNEL_STATUS_NEW, nextPollAt: '2026-09-17T12:10:00.000Z' });
    expect(earliestPollAt([a, b])).toBe('2026-09-17T12:10:00.000Z');
    expect(earliestPollAt([])).toBe('9999-12-31T00:00:00.000Z');
  });
});

describe('stayChannelConflicts — το overbooking που ΗΔΗ συνέβη, με όνομα', () => {
  const TODAY = '2026-09-17';

  it('εισαγόμενο πάνω σε ΚΡΑΤΗΣΗ ⇒ overbooking', () => {
    const entries = [
      bookingEntry('stay_1', '2026-10-12', '2026-10-16'),
      blockEntry('sblk_ext', '2026-10-14', '2026-10-18', 'external', FEED),
    ];
    expect(stayChannelConflicts(entries, { today: TODAY, instant: `${TODAY}T09:00:00.000Z` })).toEqual([
      {
        kind: 'overbooking', feedId: FEED, blockId: 'sblk_ext', from: '2026-10-14', to: '2026-10-18',
        party: { entryKind: 'booking', entryId: 'stay_1', from: '2026-10-12', to: '2026-10-16' },
      },
    ]);
  });

  it('εισαγόμενο πάνω σε block ΙΔΙΟΚΤΗΤΗ ⇒ owner-block (άλλη θεραπεία)', () => {
    const entries = [
      blockEntry('sblk_own', '2026-10-12', '2026-10-16'),
      blockEntry('sblk_ext', '2026-10-14', '2026-10-18', 'external', FEED),
    ];
    expect(stayChannelConflicts(entries, { today: TODAY, instant: `${TODAY}T09:00:00.000Z` }).map((c) => c.kind)).toEqual(['owner-block']);
  });

  it('δύο ΔΙΑΦΟΡΕΤΙΚΑ κανάλια στις ίδιες νύχτες ⇒ other-channel, και για τα δύο', () => {
    const entries = [
      blockEntry('sblk_a', '2026-10-12', '2026-10-16', 'external', FEED),
      blockEntry('sblk_b', '2026-10-14', '2026-10-18', 'external', 'schf_other'),
    ];
    expect(stayChannelConflicts(entries, { today: TODAY, instant: `${TODAY}T09:00:00.000Z` }).map((c) => [c.blockId, c.kind])).toEqual([
      ['sblk_a', 'other-channel'],
      ['sblk_b', 'other-channel'],
    ]);
  });

  it('επικάλυψη ΜΕΣΑ στο ίδιο feed αγνοείται — είναι η δική του συνέπεια', () => {
    const entries = [
      blockEntry('sblk_a', '2026-10-12', '2026-10-16', 'external', FEED),
      blockEntry('sblk_b', '2026-10-14', '2026-10-18', 'external', FEED),
    ];
    expect(stayChannelConflicts(entries, { today: TODAY, instant: `${TODAY}T09:00:00.000Z` })).toEqual([]);
  });

  it('σύγκρουση που ΤΕΛΕΙΩΣΕ δεν αναφέρεται — συναγερμός χωρίς διέξοδο είναι θόρυβος', () => {
    const entries = [
      bookingEntry('stay_old', '2026-08-10', '2026-08-16'),
      blockEntry('sblk_old', '2026-08-14', '2026-08-18', 'external', FEED),
    ];
    expect(stayChannelConflicts(entries, { today: TODAY, instant: `${TODAY}T09:00:00.000Z` })).toEqual([]);
  });

  it('καμία επικάλυψη ⇒ καμία σύγκρουση (ούτε από την προετοιμασία: ο κριτής συγκρίνει εγγραφές)', () => {
    const entries = [
      bookingEntry('stay_1', '2026-10-01', '2026-10-05'),
      blockEntry('sblk_ext', '2026-10-05', '2026-10-09', 'external', FEED),
    ];
    expect(stayChannelConflicts(entries, { today: TODAY, instant: `${TODAY}T09:00:00.000Z` })).toEqual([]);
  });
});
