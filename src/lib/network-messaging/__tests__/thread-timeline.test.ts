/**
 * @fileoverview Άγκυρες του χρονολογίου νήματος (ADR-867 Β7) — Χ-1…Χ-11.
 * Κάθε μία κοκκινίζει σε **συγκεκριμένη** μετάλλαξη (γραμμένη δίπλα).
 */

import {
  affordancesOf,
  buildTimeline,
  continuesPrevious,
  pendingNotArrived,
  retractMinutesLeft,
  type TimelineItem,
} from '../thread-timeline';
import type { NetworkMessage } from '@/types/network-thread';

const ME = 'uid_me';
const OTHER = 'uid_other';

function msg(id: string, senderUid: string, createdAt: string, extra: Partial<NetworkMessage> = {}): NetworkMessage {
  return {
    id,
    senderUid,
    text: `t-${id}`,
    createdAt,
    editedAt: null,
    retractedAt: null,
    readBeforeRetraction: null,
    readBeforeEdit: null,
    ...extra,
  };
}

const dayKeyOf = (iso: string) => iso.slice(0, 10);

const kinds = (items: readonly TimelineItem[]) =>
  items.map((item) => (item.kind === 'message' ? `m:${item.message.id}${item.continuation ? '+' : ''}` : item.kind));

describe('thread-timeline — η γραμμή «νέα μηνύματα»', () => {
  it('Χ-1 μπαίνει ΜΙΑ φορά, πριν από το πρώτο ξένο μήνυμα μετά την άγκυρα (μετάλλαξη: κάθε αδιάβαστο παίρνει γραμμή)', () => {
    const items = buildTimeline({
      messages: [
        msg('a', OTHER, '2026-09-19T10:00:00.000Z'),
        msg('b', OTHER, '2026-09-19T10:30:00.000Z'),
        msg('c', OTHER, '2026-09-19T10:31:00.000Z'),
      ],
      viewerUid: ME,
      anchorReadAt: '2026-09-19T10:10:00.000Z',
      nowISO: '2026-09-19T11:00:00.000Z',
      dayKeyOf,
    });
    expect(kinds(items)).toStrictEqual(['day', 'm:a', 'new-messages', 'm:b', 'm:c+']);
  });

  it('Χ-2 το ΔΙΚΟ μου μήνυμα δεν είναι ποτέ αδιάβαστο (μετάλλαξη: αγνοείται ο αποστολέας)', () => {
    const items = buildTimeline({
      messages: [msg('a', ME, '2026-09-19T10:30:00.000Z')],
      viewerUid: ME,
      anchorReadAt: null,
      nowISO: '2026-09-19T11:00:00.000Z',
      dayKeyOf,
    });
    expect(kinds(items)).toStrictEqual(['day', 'm:a']);
  });

  it('Χ-3 άγκυρα null ⇒ το πρώτο ξένο μήνυμα είναι ήδη νέο (μετάλλαξη: null ⇒ «όλα διαβασμένα»)', () => {
    const items = buildTimeline({
      messages: [msg('a', OTHER, '2026-09-19T10:30:00.000Z')],
      viewerUid: ME,
      anchorReadAt: null,
      nowISO: '2026-09-19T11:00:00.000Z',
      dayKeyOf,
    });
    expect(kinds(items)).toStrictEqual(['day', 'new-messages', 'm:a']);
  });
});

describe('thread-timeline — ημέρες και συνέχεια', () => {
  it('Χ-4 αλλαγή ημέρας ⇒ νέα κεφαλίδα ημέρας ΚΑΙ καμία συνέχεια (μετάλλαξη: συνέχεια πάνω από ημέρα)', () => {
    const items = buildTimeline({
      messages: [msg('a', ME, '2026-09-18T23:58:00.000Z'), msg('b', ME, '2026-09-19T00:01:00.000Z')],
      viewerUid: ME,
      anchorReadAt: null,
      nowISO: '2026-09-19T01:00:00.000Z',
      dayKeyOf,
    });
    expect(kinds(items)).toStrictEqual(['day', 'm:a', 'day', 'm:b']);
  });

  it('Χ-5 ταφόπλακα δεν συνεχίζει και δεν συνεχίζεται (μετάλλαξη: αγνοείται το retractedAt)', () => {
    const first = msg('a', ME, '2026-09-19T10:00:00.000Z');
    const tomb = msg('b', ME, '2026-09-19T10:01:00.000Z', { text: '', retractedAt: '2026-09-19T10:02:00.000Z' });
    expect(continuesPrevious(first, tomb)).toBe(false);
    expect(continuesPrevious(tomb, msg('c', ME, '2026-09-19T10:02:00.000Z'))).toBe(false);
    expect(continuesPrevious(first, msg('d', ME, '2026-09-19T10:04:59.000Z'))).toBe(true);
    expect(continuesPrevious(first, msg('e', ME, '2026-09-19T10:05:01.000Z'))).toBe(false);
    expect(continuesPrevious(first, msg('f', OTHER, '2026-09-19T10:01:00.000Z'))).toBe(false);
  });
});

describe('thread-timeline — δυνατότητες του θεατή', () => {
  it('Χ-6 το παράθυρο ανάκλησης στρογγυλεύεται ΠΡΟΣ ΤΑ ΠΑΝΩ και κλείνει στα 60′ (μετάλλαξη: floor ⇒ «0 λεπτά»)', () => {
    expect(retractMinutesLeft('2026-09-19T10:00:00.000Z', '2026-09-19T10:59:30.000Z')).toBe(1);
    expect(retractMinutesLeft('2026-09-19T10:00:00.000Z', '2026-09-19T10:00:00.000Z')).toBe(60);
    expect(retractMinutesLeft('2026-09-19T10:00:00.000Z', '2026-09-19T11:00:00.000Z')).toBeNull();
  });

  it('Χ-7 χαλασμένη ημερομηνία ⇒ καμία ανάκληση, ποτέ «επιτρέπεται επειδή δεν κατάλαβα»', () => {
    expect(retractMinutesLeft('not-a-date', '2026-09-19T10:00:00.000Z')).toBeNull();
  });

  it('Χ-8 ξένο μήνυμα ⇒ ούτε ανάκληση ούτε επεξεργασία (μετάλλαξη: αγνοείται ο αποστολέας)', () => {
    expect(affordancesOf(msg('a', OTHER, '2026-09-19T10:00:00.000Z'), ME, '2026-09-19T10:01:00.000Z')).toStrictEqual({
      retractMinutesLeft: null,
      canEdit: false,
    });
  });

  it('Χ-9 δικό μου: επεξεργασία ΧΩΡΙΣ όριο χρόνου — ταφόπλακα ⇒ τίποτα (μετάλλαξη: η επεξεργασία κλείνει με το παράθυρο)', () => {
    const old = msg('a', ME, '2026-09-01T10:00:00.000Z');
    expect(affordancesOf(old, ME, '2026-09-19T10:00:00.000Z')).toStrictEqual({ retractMinutesLeft: null, canEdit: true });
    const tomb = msg('b', ME, '2026-09-19T10:00:00.000Z', { text: '', retractedAt: '2026-09-19T10:01:00.000Z' });
    expect(affordancesOf(tomb, ME, '2026-09-19T10:02:00.000Z')).toStrictEqual({ retractMinutesLeft: null, canEdit: false });
  });
});

describe('thread-timeline — εκκρεμείς αποστολές απέναντι στο snapshot', () => {
  const entry = (messageId: string | null) => ({ clientKey: `k-${messageId}`, messageId });

  it('Χ-10 φτασμένο id ⇒ η φούσκα φεύγει· άγνωστο ή ακόμη χωρίς id ⇒ μένει (μετάλλαξη: `!arrived.has` ⇒ `arrived.has`)', () => {
    const pending = [entry(null), entry('m1'), entry('m2')];
    expect(pendingNotArrived(pending, [msg('m1', ME, '2026-09-22T07:33:00.000Z')])).toStrictEqual([entry(null), entry('m2')]);
  });

  it('Χ-11 τίποτα δεν φεύγει ⇒ η ΙΔΙΑ αναφορά (μετάλλαξη: πάντα νέος πίνακας ⇒ βρόχος effect)', () => {
    const pending = [entry(null), entry('m2')];
    expect(pendingNotArrived(pending, [msg('m1', ME, '2026-09-22T07:33:00.000Z')])).toBe(pending);
  });
});
