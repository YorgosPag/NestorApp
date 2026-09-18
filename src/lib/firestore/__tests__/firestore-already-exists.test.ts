/**
 * @fileoverview 🏆 **ΑΓΚΥΡΑ Α36.10 του ADR-866 Φ1.1** — η μία ερμηνεία του «υπάρχει ήδη».
 * @related lib/firestore/firestore-already-exists.ts (N.0.2: ήταν δύο χειρόγραφα, με ΔΙΑΦΟΡΕΤΙΚΟ κριτήριο)
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | μόνο ο αριθμητικός κωδικός | «κειμενικός κωδικός» ⇒ 🔴 |
 * | μόνο ο κειμενικός κωδικός | «gRPC 6» ⇒ 🔴 |
 * | αναγνώριση από το ΜΗΝΥΜΑ | «άλλο σφάλμα που αναφέρει ALREADY_EXISTS» ⇒ 🔴 |
 */

import { isAlreadyExistsError } from '@/lib/firestore/firestore-already-exists';

describe('🏆 Α36.10 — `isAlreadyExistsError`', () => {
  it('gRPC `6` (Admin SDK) ⇒ true', () => {
    expect(isAlreadyExistsError(Object.assign(new Error('6 ALREADY_EXISTS'), { code: 6 }))).toBe(true);
  });

  it("κειμενικός `'already-exists'` ⇒ true", () => {
    expect(isAlreadyExistsError({ code: 'already-exists' })).toBe(true);
  });

  it.each([
    ['άλλος κωδικός', { code: 14 }],
    ['το μήνυμα ΔΕΝ είναι απόδειξη', new Error('ALREADY_EXISTS: pdos_x')],
    ['null', null],
    ['κείμενο', 'already-exists'],
  ])('%s ⇒ false', (_case, error) => {
    expect(isAlreadyExistsError(error)).toBe(false);
  });
});
