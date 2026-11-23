/**
 * ADR-949 Α-2 · Α-3 — το μητρώο αναγνωστών συσκευής: από σελίδες σε γραμμές στη γλώσσα του υπολογιστή.
 */

import { ENFIA_E_PAGES, ENFIA_PAYMENT_NOTE_PAGES } from '@/lib/document-validity/__tests__/enfia-assessment-text.fixture';
import { E9_A_PAGES } from '@/lib/document-validity/__tests__/e9-text.fixture';
import {
  PERMIT_INITIAL_PAGES,
  PERMIT_MINOR_WORKS_PAGES,
  PERMIT_UPDATE_PAGES,
} from '@/lib/document-validity/__tests__/unit-permit-text.fixture';

import { deviceReaderOf } from '../objective-value-device-readers';

const readerOf = (document: Parameters<typeof deviceReaderOf>[0]) => {
  const reader = deviceReaderOf(document);
  if (reader === null) throw new Error(`no reader for ${document}`);
  return reader;
};

describe('μητρώο αναγνωστών συσκευής', () => {
  it('Ε9 · πράξη ΕΝΦΙΑ · άδεια διαβάζονται· το συμβόλαιο όχι', () => {
    expect(deviceReaderOf('owner-e9')).not.toBeNull();
    expect(deviceReaderOf('owner-enfia-assessment')).not.toBeNull();
    expect(deviceReaderOf('unit-permit')).not.toBeNull();
    expect(deviceReaderOf('title-deed')).toBeNull();
  });

  it('Ε9 → γραμμές ακινήτου: κατοικία όροφος 1 · αποθήκη υπόγειο = −1 · καμία τιμή ζώνης', () => {
    expect(readerOf('owner-e9').read(E9_A_PAGES)).toEqual([
      expect.objectContaining({ kind: 'property', page: 2, form: 'residence', floor: 1, area: 93.51, zoneEvidence: null }),
      expect.objectContaining({ kind: 'property', page: 2, form: 'storage', floor: -1, area: 8.61, encumbrance: null }),
    ]);
  });

  it('ΕΝΦΙΑ → ίδιες γραμμές με το Ε9 + τεκμήριο τιμής ζώνης με το έτος· επαγγελματική στέγη = είδος που δεν αποτιμάται', () => {
    const rows = readerOf('owner-enfia-assessment').read(ENFIA_E_PAGES) ?? [];
    expect(rows).toHaveLength(16);
    expect(rows[0]).toMatchObject({ kind: 'property', form: 'storage', floor: -1, area: 101.5, zoneEvidence: { price: 650, year: 2020 } });
    expect(rows[2]).toMatchObject({ kind: 'property', form: null });
    expect(rows[15]).toMatchObject({ kind: 'property', form: 'residence', floor: 1, area: 113.51, ownership: { kind: 'full', pct: 100 } });
  });

  it('σημείωμα πληρωμής ΕΝΦΙΑ ⇒ «άλλο έγγραφο» (null)', () => {
    expect(readerOf('owner-enfia-assessment').read(ENFIA_PAYMENT_NOTE_PAGES)).toBeNull();
  });

  it('άδεια → μία γραμμή πράξης: τύπος + ημερομηνία (+ αρχική άδεια για ενημέρωση)', () => {
    const permit = readerOf('unit-permit');
    expect(permit.read(PERMIT_INITIAL_PAGES)).toEqual([
      { kind: 'permit', page: 1, act: 'initial', issuedOn: '2020-06-09', originalPermit: null },
    ]);
    expect(permit.read(PERMIT_UPDATE_PAGES)).toEqual([
      { kind: 'permit', page: 1, act: 'update', issuedOn: '2026-11-10', originalPermit: { number: '417', year: 2008 } },
    ]);
    expect(permit.read(PERMIT_MINOR_WORKS_PAGES)).toEqual([
      { kind: 'permit', page: 1, act: 'minor-works', issuedOn: '2018-11-27', originalPermit: null },
    ]);
    expect(permit.read(E9_A_PAGES)).toBeNull();
  });
});
