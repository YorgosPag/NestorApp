/**
 * `getInboxRelativeTime` — ο ΕΝΑΣ κανόνας «πότε» του inbox (ήταν τρία αυτολεξεί αντίγραφα).
 */

import { getInboxRelativeTime } from '../inbox-relative-time';

const NOW = new Date('2026-10-29T12:00:00.000Z').getTime();
const HOUR = 60 * 60 * 1000;
const t = (key: string, options?: Record<string, unknown>) => (options ? `${key}:${JSON.stringify(options)}` : key);

describe('getInboxRelativeTime', () => {
  beforeEach(() => { jest.useFakeTimers().setSystemTime(NOW); });
  afterEach(() => { jest.useRealTimers(); });

  it('κενό ⇒ κενό', () => {
    expect(getInboxRelativeTime(undefined, t)).toBe('');
    expect(getInboxRelativeTime('', t)).toBe('');
  });

  it('< 1 ώρα ⇒ «τώρα» · < 24 ⇒ «πριν N ώρες» (ακέραιες) · < 48 ⇒ «χθες»', () => {
    expect(getInboxRelativeTime(new Date(NOW - 30 * 60 * 1000), t)).toBe('inbox.time.now');
    expect(getInboxRelativeTime(new Date(NOW - 5.7 * HOUR).toISOString(), t)).toBe('inbox.time.hoursAgo:{"hours":5}');
    expect(getInboxRelativeTime(new Date(NOW - 30 * HOUR), t)).toBe('inbox.time.yesterday');
  });

  it('≥ 48 ώρες ⇒ ημερομηνία, ΟΧΙ κλειδί i18n (σκόπιμη διαφορά από το formatRelativeTime)', () => {
    const out = getInboxRelativeTime(new Date(NOW - 72 * HOUR), t);
    expect(out).not.toMatch(/^inbox\.time\./);
    expect(out.length).toBeGreaterThan(0);
  });
});
