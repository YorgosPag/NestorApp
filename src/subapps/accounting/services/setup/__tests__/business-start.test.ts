/**
 * @fileoverview business-start — ο ΕΝΑΣ κριτής της έναρξης εργασιών (είσοδος PUT + ανάγνωση)
 * @see ADR-ACC-023 §1 · ADR-ACC-024 §6.1 α
 */

import { parseBusinessStart, storedBusinessStart } from '../business-start';

describe('parseBusinessStart', () => {
  it.each([undefined, null])('%p ⇒ «δεν δηλώθηκε»', (raw) => {
    expect(parseBusinessStart(raw)).toEqual({ kind: 'value', value: null });
  });

  it.each(['new', 'continuation'] as const)('έγκυρη ημέρα + προέλευση %s ⇒ τιμή', (origin) => {
    expect(parseBusinessStart({ date: '2028-02-29', origin })).toEqual({
      kind: 'value',
      value: { date: '2028-02-29', origin },
    });
  });

  it('κρατά μόνο τα γνωστά πεδία', () => {
    expect(parseBusinessStart({ date: '2025-01-01', origin: 'new', extra: 1 })).toEqual({
      kind: 'value',
      value: { date: '2025-01-01', origin: 'new' },
    });
  });

  it.each([
    ['ανύπαρκτη ημέρα', { date: '2027-02-29', origin: 'new' }],
    ['μορφή DD/MM/YYYY', { date: '01/03/2025', origin: 'new' }],
    ['άγνωστη προέλευση', { date: '2025-01-01', origin: 'merger' }],
    ['χωρίς προέλευση', { date: '2025-01-01' }],
    ['σκέτη συμβολοσειρά', '2025-01-01'],
    ['αριθμός', 2025],
  ])('%s ⇒ απόρριψη (400, ποτέ σιωπηλή αποκοπή)', (_label, raw) => {
    expect(parseBusinessStart(raw)).toEqual({ kind: 'invalid' });
  });
});

describe('storedBusinessStart', () => {
  it('άκυρο αποθηκευμένο ⇒ null (⇒ πλήρης προκαταβολή)', () => {
    expect(storedBusinessStart({ date: 'garbage', origin: 'new' })).toBeNull();
    expect(storedBusinessStart(undefined)).toBeNull();
  });

  it('έγκυρο αποθηκευμένο ⇒ τιμή', () => {
    expect(storedBusinessStart({ date: '2024-05-10', origin: 'continuation' })).toEqual({
      date: '2024-05-10',
      origin: 'continuation',
    });
  });
});
