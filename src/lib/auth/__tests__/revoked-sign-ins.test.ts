/**
 * @jest-environment node
 *
 * @fileoverview **Η ΛΙΣΤΑ ΑΝΑΚΛΗΜΕΝΩΝ ΣΥΝΔΕΣΕΩΝ** — ADR-894 §10 Β1.
 * @related lib/auth/revoked-sign-ins.ts · lib/auth/revocation-watermark.ts (ο αναγνώστης)
 *
 * | Μετάλλαξη | Άγκυρα που κοκκινίζει |
 * |---|---|
 * | ο φρουρός εαυτού αφαιρείται | Λ2 |
 * | καμία κλάδευση όσων καλύπτει η σφραγίδα | Λ3 |
 * | πάνω από το όριο γράφεται σιωπηλά αντί για κλιμάκωση | Λ4 |
 */

jest.mock('server-only', () => ({}));

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';

const fake = new FakeFirestore();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore => fake as unknown as AdminFirestore,
}));

import {
  clearRevokedSignIns,
  planRevokedSignIns,
  readRevokedSignIns,
  recordRevokedSignIns,
  type RevokedSignIn,
} from '../revoked-sign-ins';

const T = 1_790_000_000;
const NOW = (T + 86_400) * 1000;
const policy = { callerAuthTimeSec: undefined, validAfterMs: 0, nowMs: NOW };
const entry = (authTimeSec: number): RevokedSignIn => ({ authTimeSec, revokedAtMs: NOW - 1 });

beforeEach(() => fake.reset());

describe('Λ — η καθαρή απόφαση', () => {
  it('Λ1 — νέα σύνδεση γράφεται· η ίδια ξανά ⇒ unchanged (ιδεμποτία)', () => {
    const first = planRevokedSignIns([], [T], policy);
    expect(first).toEqual({ kind: 'write', entries: [{ authTimeSec: T, revokedAtMs: NOW }] });
    expect(planRevokedSignIns([entry(T)], [T], policy)).toEqual({ kind: 'unchanged' });
  });

  it('Λ2 🔴 φρουρός εαυτού: το auth_time του ΚΑΛΟΥΝΤΑ δεν ανακαλείται ποτέ', () => {
    expect(planRevokedSignIns([], [T], { ...policy, callerAuthTimeSec: T })).toEqual({ kind: 'unchanged' });
    expect(planRevokedSignIns([], [T, T + 5], { ...policy, callerAuthTimeSec: T }))
      .toEqual({ kind: 'write', entries: [{ authTimeSec: T + 5, revokedAtMs: NOW }] });
  });

  it('Λ3 — ό,τι καλύπτει ήδη η σφραγίδα του λογαριασμού σβήνει (και δεν μπαίνει)', () => {
    const validAfterMs = (T + 10) * 1000;
    expect(planRevokedSignIns([entry(T), entry(T + 20)], [T + 1], { ...policy, validAfterMs }))
      .toEqual({ kind: 'write', entries: [entry(T + 20)] });
  });

  it('Λ4 🔴 πάνω από το όριο ⇒ κλιμάκωση σε «όλες», ποτέ σιωπηλή απώλεια', () => {
    expect(planRevokedSignIns([entry(T), entry(T + 1)], [T + 2], { ...policy, cap: 2 })).toEqual({ kind: 'escalate' });
  });

  it('Λ5 — σκουπίδια (undefined · 0 · δεκαδικά) αγνοούνται', () => {
    expect(planRevokedSignIns([], [undefined, 0, 1.5, -3], policy)).toEqual({ kind: 'unchanged' });
  });
});

describe('Ε — η εγγραφή πάνω σε Firestore', () => {
  it('Ε1 — γράφει, διαβάζεται πίσω, και αδειάζει', async () => {
    await expect(recordRevokedSignIns('u1', [T, T + 7], { callerAuthTimeSec: undefined, validAfterMs: 0 })).resolves.toBe('write');
    expect([...(await readRevokedSignIns('u1'))].sort()).toEqual([T, T + 7]);
    await expect(recordRevokedSignIns('u1', [T], { callerAuthTimeSec: undefined, validAfterMs: 0 })).resolves.toBe('unchanged');
    await clearRevokedSignIns('u1');
    expect((await readRevokedSignIns('u1')).size).toBe(0);
  });

  it('Ε2 — ο λογαριασμός κάποιου άλλου δεν επηρεάζεται', async () => {
    await recordRevokedSignIns('u1', [T], { callerAuthTimeSec: undefined, validAfterMs: 0 });
    expect((await readRevokedSignIns('u2')).size).toBe(0);
  });
});
