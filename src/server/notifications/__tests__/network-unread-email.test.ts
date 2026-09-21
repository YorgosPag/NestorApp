/**
 * @jest-environment node
 *
 * ADR-867 Β6 — ΑΓΚΥΡΕΣ του email «έχεις αδιάβαστο μήνυμα» (Teams missed activity · Slack «when I'm not active»).
 *
 *   Α-1  `realtime` + αναμονή ⇒ **αναβολή** ως το `notBefore` (`unread-grace`)
 *   Α-2  🔴 Η αναμονή **ποτέ** δεν φέρνει νωρίτερα — το `daily` μένει στις 20:00
 *   Α-3  🔴 Οι ώρες ησυχίας εφαρμόζονται **μετά** την αναμονή, στη στιγμή που προκύπτει
 *   Α-4  Τα υποχρεωτικά αγνοούν την αναμονή (φεύγουν αμέσως, όπως πάντα)
 *   Π-1  🔑 Η πύλη: εκκρεμεί ⇒ φεύγει · διαβάστηκε ⇒ `thread-settled`
 *   Π-2  🔴 Email νήματος **χωρίς** παραλήπτη ⇒ `thread-settled` (δεν κρίνεται ⇒ δεν φεύγει)
 *   Π-3  Πέρασμα χωρίς email νήματος ⇒ ο φορτωτής **δεν** καλείται
 *   Κ-1…Κ-6  Ο κριτής: διαβάστηκε · ποτέ δεν άνοιξε · σίγαση · σφράγιση · απουσία · κλειστό νήμα
 *   Κ-7  🔴 (Ε10) Το μόνο αδιάβαστο **ανακλήθηκε** ⇒ δεν φεύγει · υπάρχει κι άλλο ζωντανό ⇒ φεύγει
 *   Γ-1  Ο αναγνώστης γεγονότων: επιστροφή του είδους · σκουπίδι ⇒ `undefined`
 *   Γ-2  🔴 Τα κουμπιά αργιών **δεν** χτίζονται πάνω σε γεγονότα νήματος
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));

import type { PendingEmail } from '@/server/notifications/email-digest';
import { decideEmailDelivery } from '@/server/notifications/email-delivery-window';
import { liveEmailActions } from '@/server/notifications/notification-email-actions';
import { gateQueuedEmails, type NetworkUnreadLoader } from '@/server/notifications/email-send-gate';
import { NOTIFICATION_EVENT_TYPES } from '@/config/notification-events';
import { isUnreadStillPending, type UnreadTruth } from '@/services/network-messaging/network-unread-email';
import {
  getDefaultNotificationSettings,
  type UserNotificationSettings,
} from '@/services/user-notification-settings/user-notification-settings.types';
import type { NetworkAudienceSeat } from '@/types/network-thread';
import { networkUnreadKey, readNotificationEmailFacts } from '@/types/notification-email-facts';

const settings = (patch: Partial<UserNotificationSettings> = {}): UserNotificationSettings =>
  ({ ...getDefaultNotificationSettings('u1'), ...patch });

const NETWORK = { isMandatory: false, setting: { category: 'network', settingKey: 'threadMessage' } } as const;

// =============================================================================
describe('Α — η αναμονή «μόνο αν μείνει αδιάβαστο»', () => {
  const now = new Date('2026-08-18T09:00:00.000Z'); // 12:00 Αθήνα
  const grace = new Date('2026-08-18T09:15:00.000Z');

  it('Α-1 `realtime` + αναμονή ⇒ αναβολή ΑΚΡΙΒΩΣ ως το notBefore', () => {
    expect(decideEmailDelivery(settings({ emailFrequency: 'realtime' }), { ...NETWORK, now, notBefore: grace }))
      .toStrictEqual({ kind: 'defer', deliverAt: grace, reason: 'unread-grace' });
    // Χωρίς αναμονή: αμέσως, όπως πριν.
    expect(decideEmailDelivery(settings({ emailFrequency: 'realtime' }), { ...NETWORK, now }))
      .toStrictEqual({ kind: 'send-now' });
  });

  it('Α-2 🔴 η αναμονή ΠΟΤΕ δεν φέρνει νωρίτερα — το `daily` μένει στις 20:00', () => {
    const decision = decideEmailDelivery(settings({ emailFrequency: 'daily' }), { ...NETWORK, now, notBefore: grace });
    expect(decision).toMatchObject({ kind: 'defer', reason: 'daily-window' });
    expect(decision.kind === 'defer' && decision.deliverAt.getTime() > grace.getTime()).toBe(true);
  });

  it('Α-3 🔴 οι ώρες ησυχίας εφαρμόζονται ΜΕΤΑ: αναμονή που πέφτει στις 22:10 ⇒ 08:00', () => {
    const late = new Date('2026-08-18T18:55:00.000Z'); // 21:55 Αθήνα
    const decision = decideEmailDelivery(
      settings({ emailFrequency: 'realtime', quietHours: { enabled: true, startTime: '22:00', endTime: '08:00' } }),
      { ...NETWORK, now: late, notBefore: new Date(late.getTime() + 15 * 60_000) },
    );
    expect(decision).toStrictEqual({ kind: 'defer', deliverAt: new Date('2026-08-19T05:00:00.000Z'), reason: 'quiet-hours' });
  });

  it('Α-4 τα υποχρεωτικά αγνοούν την αναμονή', () => {
    expect(decideEmailDelivery(settings(), { isMandatory: true, now, notBefore: grace })).toStrictEqual({ kind: 'send-now' });
  });
});

// =============================================================================
const THREAD = 'nthr_1';
const SINCE = '2026-09-18T10:00:00.000Z';

function unreadEmail(id: string, overrides: Partial<PendingEmail> = {}): PendingEmail {
  return {
    id,
    to: 'kostas@example.com',
    subject: id,
    content: '',
    priority: 'normal',
    category: 'notification',
    recipientId: 'u1',
    eventType: NOTIFICATION_EVENT_TYPES.NETWORK_THREAD_MESSAGE,
    facts: { kind: 'network-thread-unread', threadId: THREAD, since: SINCE },
    ...overrides,
  };
}

const defaults = jest.fn(async (uids: readonly string[]) =>
  new Map(uids.map((uid) => [uid, getDefaultNotificationSettings(uid)])));
const noHoliday = jest.fn(async () => new Set<string>());

describe('Π — η πύλη αποστολής ρωτά «εκκρεμεί ακόμη;»', () => {
  it('Π-1 🔑 εκκρεμεί ⇒ φεύγει · διαβάστηκε στο μεταξύ ⇒ `thread-settled`', async () => {
    const pending: NetworkUnreadLoader = jest.fn(async () =>
      new Set([networkUnreadKey({ threadId: THREAD, recipientUid: 'u1', since: SINCE })]));
    const stillUnread = await gateQueuedEmails([unreadEmail('a'), unreadEmail('b', { recipientId: 'u2' })], defaults, noHoliday, pending);

    expect(stillUnread.deliverable.map((m) => m.id)).toStrictEqual(['a']);
    expect(stillUnread.suppressed.map((s) => [s.message.id, s.reason])).toStrictEqual([['b', 'thread-settled']]);
    expect(pending).toHaveBeenCalledWith([
      { threadId: THREAD, recipientUid: 'u1', since: SINCE },
      { threadId: THREAD, recipientUid: 'u2', since: SINCE },
    ]);
  });

  it('Π-2 🔴 email νήματος χωρίς παραλήπτη ⇒ δεν κρίνεται ⇒ δεν φεύγει', async () => {
    const pending: NetworkUnreadLoader = jest.fn(async () => new Set<string>());
    const { recipientId, ...anonymous } = unreadEmail('x');
    expect(recipientId).toBe('u1');
    const result = await gateQueuedEmails([anonymous], defaults, noHoliday, pending);
    expect(result.deliverable).toHaveLength(0);
    expect(result.suppressed.map((s) => s.reason)).toStrictEqual(['thread-settled']);
  });

  it('Π-3 πέρασμα χωρίς email νήματος ⇒ ο φορτωτής ΔΕΝ καλείται', async () => {
    const pending: NetworkUnreadLoader = jest.fn(async () => new Set<string>());
    const { facts, ...plain } = unreadEmail('plain');
    expect(facts?.kind).toBe('network-thread-unread');
    await gateQueuedEmails([plain], defaults, noHoliday, pending);
    expect(pending).not.toHaveBeenCalled();
  });
});

// =============================================================================
const NOW = '2026-09-18T12:00:00.000Z';

function entry(patch: Partial<NetworkAudienceSeat> = {}): NetworkAudienceSeat {
  return {
    uid: 'u1', side: 'host', role: 'responsible', reason: 'creator', addedBy: 'u1',
    since: '2026-09-01T00:00:00.000Z', until: null, lastReadAt: null, muted: false, following: false, threadActivityAt: SINCE, alsoHostRole: null,
    ...patch,
  };
}

/** Νήμα με ζωντανό μήνυμα **μετά** το `SINCE` — η κανονική περίπτωση ενός αδιάβαστου. */
const LIVE_THREAD = { lastMessageAt: '2026-09-18T10:00:00.000Z', lastLiveMessageAt: '2026-09-18T10:00:00.000Z' };

const truth = (patch: Partial<UnreadTruth> = {}): UnreadTruth =>
  ({ threadOpen: true, thread: LIVE_THREAD, entry: entry(), away: null, ...patch });

describe('Κ — ο κριτής «εκκρεμεί;»', () => {
  it('Κ-1 διάβασε ΜΕΤΑ το μήνυμα ⇒ όχι · ΠΡΙΝ ⇒ ναι', () => {
    expect(isUnreadStillPending(truth({ entry: entry({ lastReadAt: '2026-09-18T10:05:00.000Z' }) }), SINCE, NOW)).toBe(false);
    expect(isUnreadStillPending(truth({ entry: entry({ lastReadAt: '2026-09-18T09:00:00.000Z' }) }), SINCE, NOW)).toBe(true);
  });

  it('Κ-2 δεν άνοιξε ποτέ ⇒ ναι', () => {
    expect(isUnreadStillPending(truth(), SINCE, NOW)).toBe(true);
  });

  it('Κ-3 🔴 σίγασε στο μεταξύ ⇒ όχι', () => {
    expect(isUnreadStillPending(truth({ entry: entry({ muted: true }) }), SINCE, NOW)).toBe(false);
  });

  it('Κ-4 🔴 βγήκε από το ακροατήριο (ή η γραμμή λείπει) ⇒ όχι', () => {
    expect(isUnreadStillPending(truth({ entry: entry({ until: '2026-09-18T11:00:00.000Z' }) }), SINCE, NOW)).toBe(false);
    expect(isUnreadStillPending(truth({ entry: null }), SINCE, NOW)).toBe(false);
  });

  it('Κ-5 λείπει ΤΩΡΑ ⇒ όχι (διαβάζουν οι αναπληρωτές του)', () => {
    const away = { id: 'naway_1', uid: 'u1', startsAt: '2026-09-18T00:00:00.000Z', endsAt: '2026-09-25T00:00:00.000Z', updatedAt: NOW };
    expect(isUnreadStillPending(truth({ away }), SINCE, NOW)).toBe(false);
  });

  it('Κ-6 κλειστό νήμα ⇒ όχι', () => {
    expect(isUnreadStillPending(truth({ threadOpen: false }), SINCE, NOW)).toBe(false);
  });

  it('Κ-7 🔴 (Ε10) το μόνο αδιάβαστο ΑΝΑΚΛΗΘΗΚΕ ⇒ όχι · υπάρχει κι άλλο ζωντανό ⇒ ναι (μετάλλαξη: η πύλη αγνοεί τη ζωντάνια)', () => {
    const retractedOnly = { lastMessageAt: '2026-09-18T10:00:00.000Z', lastLiveMessageAt: null };
    expect(isUnreadStillPending(truth({ thread: retractedOnly }), SINCE, NOW)).toBe(false);
    const olderStillLive = { lastMessageAt: '2026-09-18T10:00:00.000Z', lastLiveMessageAt: '2026-09-18T09:30:00.000Z' };
    expect(isUnreadStillPending(truth({ thread: olderStillLive }), SINCE, NOW)).toBe(true);
    // 🔁 Νήμα προ-Ε10 (χωρίς πεδίο) ⇒ ισχύει το `lastMessageAt` — ίδια συμπεριφορά με πριν.
    expect(isUnreadStillPending(truth({ thread: { lastMessageAt: '2026-09-18T10:00:00.000Z' } }), SINCE, NOW)).toBe(true);
  });
});

describe('Γ — τα γεγονότα στην ουρά', () => {
  it('Γ-1 ο αναγνώστης επιστρέφει το είδος — σκουπίδι ⇒ `undefined`', () => {
    const facts = { kind: 'network-thread-unread', threadId: THREAD, since: SINCE } as const;
    expect(readNotificationEmailFacts(JSON.parse(JSON.stringify(facts)))).toStrictEqual(facts);
    expect(readNotificationEmailFacts({ kind: 'network-thread-unread', threadId: THREAD })).toBeUndefined();
    expect(readNotificationEmailFacts({ kind: 'unknown' })).toBeUndefined();
  });

  it('Γ-2 🔴 τα κουμπιά αργιών ΔΕΝ χτίζονται πάνω σε γεγονότα νήματος', () => {
    expect(liveEmailActions(unreadEmail('a'), 'el')).toHaveLength(0);
  });
});
