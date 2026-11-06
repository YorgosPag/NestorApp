/**
 * ADR-923 Ν10 α — ο συμπαγής uuid του τυπωμένου QR: 26 χαρακτήρες Crockford, μία κανονική γραφή, αντιστρέψιμος.
 */
import { randomUUID } from 'crypto';

import { COMPACT_UUID_LENGTH, compactUuidOf, uuidOfCompact } from '../compact-uuid';

/** Διάνυσμα αναφοράς, υπολογισμένο ανεξάρτητα με BigInt: `BigInt('0x' + hex)` σε βάση 32, 26 ψηφία. */
const UUID = '3f2a9c1e-7b4d-4e8a-9c21-5d6e7f809a1b';
const CODE = '1Z5AE1WYTD9T59R8AXDSZR16GV';

describe('compactUuidOf', () => {
  it('το διάνυσμα αναφοράς', () => {
    expect(compactUuidOf(UUID)).toBe(CODE);
  });

  it('πάντα 26 χαρακτήρες, μόνο από το σύνολο της αλφαριθμητικής λειτουργίας του QR', () => {
    for (let index = 0; index < 200; index += 1) {
      const code = compactUuidOf(randomUUID());
      expect(code).toHaveLength(COMPACT_UUID_LENGTH);
      expect(code).toMatch(/^[0-9A-Z]+$/);
    }
  });

  it('τα άκρα: όλα μηδέν και όλα ένα', () => {
    expect(compactUuidOf('00000000-0000-0000-0000-000000000000')).toBe('0'.repeat(26));
    expect(compactUuidOf('ffffffff-ffff-ffff-ffff-ffffffffffff')).toBe(`7${'Z'.repeat(25)}`);
  });

  it.each([['κεφαλαία hex', UUID.toUpperCase()], ['χωρίς παύλες', UUID.replace(/-/g, '')], ['κενό', ''], ['ελεύθερο κείμενο', 'mfp']])(
    '🔒 %s ⇒ null: ο καλών κρατά την παλιά μορφή', (_name, value) => {
      expect(compactUuidOf(value)).toBeNull();
    },
  );
});

describe('uuidOfCompact', () => {
  it('αντιστρέφει το διάνυσμα αναφοράς', () => {
    expect(uuidOfCompact(CODE)).toBe(UUID);
  });

  it('🔑 κύκλος: κάθε uuid επιστρέφει ο ίδιος', () => {
    for (let index = 0; index < 200; index += 1) {
      const uuid = randomUUID();
      expect(uuidOfCompact(compactUuidOf(uuid) ?? '')).toBe(uuid);
    }
  });

  it.each([
    ['πεζά', CODE.toLowerCase()],
    ['ψευδώνυμο I αντί για 1', `I${CODE.slice(1)}`],
    ['ψευδώνυμο O αντί για 0', `O${CODE.slice(1)}`],
    ['γράμμα εκτός Crockford (U)', `${CODE.slice(0, -1)}U`],
    ['bit συμπλήρωσης όχι μηδέν', `8${CODE.slice(1)}`],
    ['ένας χαρακτήρας λιγότερος', CODE.slice(1)],
    ['ένας παραπάνω', `${CODE}0`],
    ['το παλιό id', `cprod_${UUID}`],
  ])('🔒 %s ⇒ null: μία γραφή ανά uuid', (_name, value) => {
    expect(uuidOfCompact(value)).toBeNull();
  });
});
