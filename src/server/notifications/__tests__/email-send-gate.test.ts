/**
 * @jest-environment node
 *
 * Άγκυρα — **Η ΠΥΛΗ ΤΗΣ ΑΠΟΣΤΟΛΗΣ** (ADR-849 Δ4): η θέληση του ανθρώπου **τώρα**, όχι
 * τη στιγμή που το μήνυμα μπήκε στην ουρά.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));

import { NOTIFICATION_EVENT_TYPES } from '@/config/notification-events';
import type { PendingEmail } from '@/server/notifications/email-digest';
import { gateQueuedEmails, type HolidayQuestionLoader, type SettingsLoader } from '@/server/notifications/email-send-gate';
import {
  getDefaultNotificationSettings,
  type UserNotificationSettings,
} from '@/services/user-notification-settings/user-notification-settings.types';

const LISTING_MATCH = NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_LISTING_MATCH;
const MANDATE_DECIDED = NOTIFICATION_EVENT_TYPES.PROPERTIES_MANDATE_DECIDED;

function message(id: string, overrides: Partial<PendingEmail> = {}): PendingEmail {
  return {
    id,
    to: 'owner@example.com',
    subject: id,
    content: '',
    priority: 'normal',
    category: 'notification',
    recipientId: 'u1',
    eventType: LISTING_MATCH,
    ...overrides,
  };
}

function listingMatchEmailsOff(uid: string): UserNotificationSettings {
  const settings = getDefaultNotificationSettings(uid);
  return { ...settings, emailCategories: { ...settings.emailCategories, properties: { demandListingMatch: 'off' } } };
}

/** Φορτωτής που απαντά από πίνακα και καταγράφει τις κλήσεις του. */
function loaderFrom(table: Record<string, UserNotificationSettings>): jest.MockedFunction<SettingsLoader> {
  return jest.fn(async (uids: readonly string[]) =>
    new Map(uids.map((uid) => [uid, table[uid] ?? getDefaultNotificationSettings(uid)])),
  );
}

const ids = (list: readonly { id: string }[]) => list.map((item) => item.id);

describe('Π — «όχι ταιριάσματα, ναι εντολές», τη στιγμή της αποστολής', () => {
  it('Π1 🔑 — ο σιγασμένος τύπος κόβεται, ο άλλος του ίδιου ανθρώπου φεύγει', async () => {
    const result = await gateQueuedEmails(
      [message('match'), message('mandate', { eventType: MANDATE_DECIDED })],
      loaderFrom({ u1: listingMatchEmailsOff('u1') }),
    );
    expect(ids(result.deliverable)).toEqual(['mandate']);
    expect(result.suppressed).toEqual([{ message: message('match'), reason: 'type-email-disabled' }]);
  });

  it('Π2 🔴 — «Διακοπή» ΜΕΤΑ την ουρά ⇒ κανένα email του ανθρώπου· ο διπλανός ανέγγιχτος', async () => {
    const off = { ...getDefaultNotificationSettings('u1'), emailEnabled: false };
    const result = await gateQueuedEmails(
      [message('a'), message('b', { eventType: MANDATE_DECIDED }), message('c', { recipientId: 'u2' })],
      loaderFrom({ u1: off }),
    );
    expect(ids(result.deliverable)).toEqual(['c']);
    expect(result.suppressed.map((entry) => entry.reason)).toEqual(['email-disabled', 'email-disabled']);
  });
});

describe('Ε — ό,τι ΔΕΝ κρίνεται περνά αυτούσιο', () => {
  const allOff = { ...getDefaultNotificationSettings('u1'), globalEnabled: false };

  it('Ε1 — επείγον (υποχρεωτικό) ⇒ δεν κρίνεται, ούτε διαβάζονται ρυθμίσεις', async () => {
    const load = loaderFrom({ u1: allOff });
    const result = await gateQueuedEmails([message('urgent', { priority: 'urgent' })], load);
    expect(ids(result.deliverable)).toEqual(['urgent']);
    expect(load).not.toHaveBeenCalled();
  });

  it('Ε2 — χωρίς `recipientId` (πριν το ADR-848) ⇒ καμία μαντεψιά από τη διεύθυνση', async () => {
    const load = loaderFrom({ u1: allOff });
    const result = await gateQueuedEmails([message('old', { recipientId: undefined })], load);
    expect(ids(result.deliverable)).toEqual(['old']);
    expect(load).not.toHaveBeenCalled();
  });

  it('Ε3 — ό,τι δεν είναι ειδοποίηση δεν ανήκει σε ρυθμίσεις ειδοποιήσεων', async () => {
    const result = await gateQueuedEmails([message('share', { category: 'marketing' })], loaderFrom({ u1: allOff }));
    expect(ids(result.deliverable)).toEqual(['share']);
  });

  it('Ε4 — άγνωστος/απών τύπος ⇒ μόνο οι καθολικοί έλεγχοι', async () => {
    const load = loaderFrom({ u1: listingMatchEmailsOff('u1') });
    const result = await gateQueuedEmails(
      [message('ghost', { eventType: 'ghost.type' }), message('none', { eventType: undefined })],
      load,
    );
    expect(ids(result.deliverable)).toEqual(['ghost', 'none']);
  });
});

describe('Λ — λογιστική και αποτυχία', () => {
  it('Λ1 — κάθε μήνυμα σε ΑΚΡΙΒΩΣ έναν κάδο· ΜΙΑ ανάγνωση για όλο το πέρασμα', async () => {
    const load = loaderFrom({ u1: listingMatchEmailsOff('u1') });
    const input = [message('a'), message('b', { eventType: MANDATE_DECIDED }), message('c', { recipientId: 'u2' })];
    const result = await gateQueuedEmails(input, load);
    expect(result.deliverable.length + result.suppressed.length).toBe(input.length);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('Λ2 🔴 — αποτυχία ανάγνωσης ⇒ ΡΙΧΝΕΙ (ο αγωγός δεν αγγίζει τίποτα)', async () => {
    const load: SettingsLoader = async () => {
      throw new Error('firestore down');
    };
    await expect(gateQueuedEmails([message('a')], load)).rejects.toThrow('firestore down');
  });
});

/** ADR-841 §7 Α21.21 Φάση Β — γεγονότα ερώτησης αργιών, όπως τα κρατά η ουρά. */
const HOLIDAY = { kind: 'holiday-hours-question' as const, questionId: 'hhq_q1', nonce: 'n1' };

function askingFrom(keys: readonly string[]): jest.MockedFunction<HolidayQuestionLoader> {
  return jest.fn(async () => new Set(keys));
}

describe('Ρ — ερώτηση αργιών: «έχει ακόμη νόημα;» τη στιγμή της αποστολής', () => {
  it('Ρ1 🔴 απαντήθηκε ΜΕΤΑ την ουρά ⇒ σιγή με ΟΝΟΜΑ· ο διπλανός ανέγγιχτος', async () => {
    const asking = askingFrom([]);
    const question = message('q', { facts: HOLIDAY });
    const result = await gateQueuedEmails([question, message('m', { eventType: MANDATE_DECIDED })], loaderFrom({}), asking);
    expect(result.suppressed).toEqual([{ message: question, reason: 'question-settled' }]);
    expect(ids(result.deliverable)).toEqual(['m']);
    expect(asking).toHaveBeenCalledWith([HOLIDAY]);
  });

  it('Ρ2 — ακόμη ρωτά ⇒ φεύγει', async () => {
    const result = await gateQueuedEmails([message('q', { facts: HOLIDAY })], loaderFrom({}), askingFrom(['hhq_q1:n1']));
    expect(ids(result.deliverable)).toEqual(['q']);
  });

  it('Ρ3 — κανένα μήνυμα με γεγονότα ⇒ ο κριτής ΔΕΝ ρωτιέται (μηδέν κόστος)', async () => {
    const asking = askingFrom([]);
    await gateQueuedEmails([message('a'), message('b')], loaderFrom({}), asking);
    expect(asking).not.toHaveBeenCalled();
  });

  it('Ρ4 🔑 γεγονός του ΑΙΤΗΜΑΤΟΣ, όχι ρύθμιση: κρίνεται και το επείγον', async () => {
    const urgent = message('q', { facts: HOLIDAY, priority: 'urgent' });
    const result = await gateQueuedEmails([urgent], loaderFrom({}), askingFrom([]));
    expect(result.suppressed).toEqual([{ message: urgent, reason: 'question-settled' }]);
  });

  it('Ρ5 🔴 ο κριτής αποτυγχάνει ⇒ ΡΙΧΝΕΙ — τίποτα δεν φεύγει ούτε σβήνεται', async () => {
    const asking: HolidayQuestionLoader = async () => {
      throw new Error('firestore down');
    };
    await expect(gateQueuedEmails([message('q', { facts: HOLIDAY })], loaderFrom({}), asking)).rejects.toThrow('firestore down');
  });
});
