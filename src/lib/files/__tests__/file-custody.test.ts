/**
 * ADR-866 §7 — άγκυρα **Α2, σκέλος συλλογής**: κάθε κάτοχος γράφει/διαβάζει στο **δικό του** διαμέρισμα.
 *
 * Μετάλλαξη που πρέπει να πιάσει: ανταλλαγή κλάδων στο `FILE_COLLECTION` ή στο `fileCustodyKindOf`.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  FILE_COLLECTION,
  companyReadCustodyOf,
  fileCustodyKey,
  fileCustodyKindOf,
  requireFileCustody,
} from '@/lib/files/file-custody';
import { CUSTODY_KINDS } from '@/lib/workspace/custody-scope';

describe('FILE_COLLECTION — ένα διαμέρισμα ανά κάτοχο', () => {
  test('εταιρεία ⇒ `files` · άνθρωπος ⇒ `files_personal`', () => {
    expect(COLLECTIONS[FILE_COLLECTION.company]).toBe('files');
    expect(COLLECTIONS[FILE_COLLECTION.personal]).toBe('files_personal');
  });

  test('κάθε είδος κατόχου έχει ΔΙΚΗ του συλλογή — ποτέ κοινή', () => {
    const names = CUSTODY_KINDS.map((kind) => COLLECTIONS[FILE_COLLECTION[kind]]);
    expect(new Set(names).size).toBe(CUSTODY_KINDS.length);
  });
});

describe('fileCustodyKindOf — το έγγραφο αποδεικνύει το διαμέρισμά του', () => {
  test('`companyId` ⇒ company · `userId` ⇒ personal', () => {
    expect(fileCustodyKindOf({ companyId: 'comp_1' })).toBe('company');
    expect(fileCustodyKindOf({ userId: 'uid_1' })).toBe('personal');
  });

  test.each([
    ['κανένας κάτοχος', {}],
    ['και οι δύο', { companyId: 'comp_1', userId: 'uid_1' }],
    ['κενό id', { userId: '' }],
    ['μη συμβολοσειρά', { companyId: 42 }],
  ])('%s ⇒ null (ο καλών αρνείται, δεν μαντεύει)', (_label, record) => {
    expect(fileCustodyKindOf(record)).toBeNull();
  });
});

describe('requireFileCustody — ο φρουρός του γραφέα', () => {
  test('επιστρέφει ΜΟΝΟ το πεδίο κατόχου, ποτέ τα υπόλοιπα της εισόδου', () => {
    expect(requireFileCustody({ userId: 'uid_1', entityId: 'e1' } as { userId: string })).toEqual({ userId: 'uid_1' });
    expect(requireFileCustody({ companyId: 'comp_1' })).toEqual({ companyId: 'comp_1' });
  });

  test('όχι ακριβώς ένας κάτοχος ⇒ σφάλμα', () => {
    expect(() => requireFileCustody({})).toThrow('Exactly one owner');
    expect(() => requireFileCustody({ companyId: 'c', userId: 'u' })).toThrow('Exactly one owner');
  });
});

describe('βοηθοί αναγνώστη', () => {
  test('companyReadCustodyOf: απών/κενός ⇒ undefined', () => {
    expect(companyReadCustodyOf('comp_1')).toEqual({ companyId: 'comp_1' });
    expect(companyReadCustodyOf(null)).toBeUndefined();
    expect(companyReadCustodyOf('')).toBeUndefined();
  });

  test('fileCustodyKey: ίδιο id σε διαφορετικό είδος ⇒ διαφορετικό κλειδί', () => {
    expect(fileCustodyKey({ companyId: 'x' })).not.toBe(fileCustodyKey({ userId: 'x' }));
  });
});
