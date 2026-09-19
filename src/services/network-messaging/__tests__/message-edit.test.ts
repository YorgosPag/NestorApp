/**
 * @jest-environment node
 *
 * ADR-867 Β7 — ΑΓΚΥΡΕΣ του **καθαρού κριτή επεξεργασίας** (`message-edit.ts`) — Ε-1…Ε-7.
 * Κάθε μία κοκκινίζει σε **συγκεκριμένη** μετάλλαξη (γραμμένη δίπλα).
 */

import type { NetworkMessage } from '@/types/network-thread';

import { currentVersionAt, editedMessage, judgeEdit, revisionRecord } from '../message-edit';

const MARIA = 'user_maria';
const T0 = '2026-09-19T10:00:00.000Z';
const T1 = '2026-09-19T11:00:00.000Z';

const MESSAGE: NetworkMessage = {
  id: 'nmsg_1',
  senderUid: MARIA,
  text: 'η τιμή είναι 180.000',
  createdAt: T0,
  editedAt: null,
  retractedAt: null,
  readBeforeRetraction: null,
  readBeforeEdit: null,
};

describe('Ε — ο κριτής επεξεργασίας', () => {
  it('Ε-1 μόνο ο αποστολέας (μετάλλαξη: αγνοείται ο δρων)', () => {
    expect(judgeEdit(MESSAGE, 'user_other', 'κάτι', 4000)).toStrictEqual({ kind: 'refused', reason: 'not-sender' });
  });

  it('Ε-2 🔴 ταφόπλακα δεν επεξεργάζεται — η ανάκληση είναι τελική (μετάλλαξη: αγνοείται το retractedAt)', () => {
    const tomb = { ...MESSAGE, text: '', retractedAt: T1 };
    expect(judgeEdit(tomb, MARIA, 'ξανά', 4000)).toStrictEqual({ kind: 'refused', reason: 'already-retracted' });
  });

  it('Ε-3 🔴 άδειο κείμενο ⇒ άρνηση, ΟΧΙ «σβήσιμο» που παρακάμπτει την ανάκληση (μετάλλαξη: κενό επιτρέπεται)', () => {
    expect(judgeEdit(MESSAGE, MARIA, '   ', 4000)).toStrictEqual({ kind: 'refused', reason: 'empty-text' });
  });

  it('Ε-4 το ίδιο όριο μήκους με την αποστολή (μετάλλαξη: χωρίς όριο)', () => {
    expect(judgeEdit(MESSAGE, MARIA, 'x'.repeat(11), 10)).toStrictEqual({ kind: 'refused', reason: 'too-long' });
  });

  it('Ε-5 ίδιο κείμενο (μετά το trim) ⇒ `unchanged`, καμία ψεύτικη αναθεώρηση (μετάλλαξη: σύγκριση χωρίς trim)', () => {
    expect(judgeEdit(MESSAGE, MARIA, '  η τιμή είναι 180.000  ', 4000)).toStrictEqual({ kind: 'unchanged' });
    expect(judgeEdit(MESSAGE, MARIA, ' η τιμή είναι 185.000 ', 4000)).toStrictEqual({
      kind: 'allowed',
      text: 'η τιμή είναι 185.000',
    });
  });

  it('Ε-6 🔑 ΚΑΝΕΝΑ όριο χρόνου — ένα μήνυμα ενός μήνα διορθώνεται (Teams · Slack · Google Chat)', () => {
    const old = { ...MESSAGE, createdAt: '2026-08-01T00:00:00.000Z' };
    expect(judgeEdit(old, MARIA, 'διόρθωση', 4000).kind).toBe('allowed');
  });
});

describe('Ε — το αντίγραφο και το νέο σώμα', () => {
  it('Ε-7 η αναθεώρηση κρατά την ΤΡΕΧΟΥΣΑ μορφή και πότε γράφτηκε — όχι πάντα την αρχική (μετάλλαξη: previousAt = createdAt)', () => {
    const once = editedMessage(MESSAGE, 'η τιμή είναι 185.000', T1, true);
    expect(once).toMatchObject({ id: 'nmsg_1', createdAt: T0, editedAt: T1, readBeforeEdit: true, text: 'η τιμή είναι 185.000' });
    expect(currentVersionAt(once)).toBe(T1);

    const record = revisionRecord(once, {
      revisionId: 'nmrv_1',
      threadId: 'nthr_1',
      threadKind: 'act',
      nowISO: '2026-09-19T12:00:00.000Z',
      readBefore: false,
    });
    expect(record).toStrictEqual({
      id: 'nmrv_1',
      messageId: 'nmsg_1',
      threadId: 'nthr_1',
      threadKind: 'act',
      senderUid: MARIA,
      previousText: 'η τιμή είναι 185.000',
      previousAt: T1,
      replacedAt: '2026-09-19T12:00:00.000Z',
      readBeforeEdit: false,
    });
  });
});
