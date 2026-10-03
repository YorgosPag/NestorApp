/**
 * ⚓ ADR-461 / ADR-903 §6 — ένας κανόνας μοναδικότητας για δημιουργία ΚΑΙ επεξεργασία.
 * Ως τις 2026-10-03 η επεξεργασία αριθμού δεν τον ρωτούσε ⇒ δύο «1ος όροφος» στο ίδιο κτίριο.
 */

import { assertFloorSlotFree } from '../floor-slot';
import type { Firestore } from 'firebase-admin/firestore';

function makeDb(rows: Array<{ id: string; number: number; kind?: string }>): Firestore {
  const query = {
    where: () => query,
    select: () => query,
    get: async () => ({ docs: rows.map((r) => ({ id: r.id, data: () => r })) }),
  };
  return { collection: () => query } as unknown as Firestore;
}

const building = [
  { id: 'f0', number: 0, kind: 'ground' },
  { id: 'f1', number: 1, kind: 'standard' },
  { id: 'fr', number: 5, kind: 'roof' },
];

async function statusOf(p: Promise<void>): Promise<number | undefined> {
  try { await p; return undefined; } catch (e) { return (e as { statusCode?: number }).statusCode; }
}

describe('assertFloorSlotFree', () => {
  it('επεξεργασία: ο όροφος ΔΕΝ συγκρούεται με τον εαυτό του', async () => {
    expect(await statusOf(assertFloorSlotFree(makeDb(building), { buildingId: 'b', companyId: 'c' }, { number: 1, kind: 'standard' }, 'f1'))).toBeUndefined();
  });
  it('🔴 επεξεργασία σε αριθμό που έχει άλλος μετρούμενος όροφος ⇒ 409', async () => {
    expect(await statusOf(assertFloorSlotFree(makeDb(building), { buildingId: 'b', companyId: 'c' }, { number: 0, kind: 'standard' }, 'f1'))).toBe(409);
  });
  it('δεύτερη ειδική στάθμη ίδιου είδους ⇒ 409', async () => {
    expect(await statusOf(assertFloorSlotFree(makeDb(building), { buildingId: 'b', companyId: 'c' }, { number: 6, kind: 'roof' }, 'f1'))).toBe(409);
  });
  it('ειδική στάθμη μοιράζεται αριθμό με μετρούμενο όροφο (θεμελίωση −1 / υπόγειο −1)', async () => {
    expect(await statusOf(assertFloorSlotFree(makeDb(building), { buildingId: 'b', companyId: 'c' }, { number: 0, kind: 'foundation' }))).toBeUndefined();
  });
});
