/**
 * ADR-905 §6 — το συμβόλαιο trigger ↔ αποδέκτη: σειριοποίηση και ανάλυση από το ΙΔΙΟ αρχείο.
 */

import { parseDependencyChangeEvent, toWireDocument, toWireValue } from '../dependency-change-event';

describe('toWireValue', () => {
  it('χρονοσφραγίδα Firestore (δομικά) και Date → ISO', () => {
    const at = new Date('2026-10-04T10:00:00.000Z');
    expect(toWireValue({ toDate: () => at })).toBe('2026-10-04T10:00:00.000Z');
    expect(toWireValue(at)).toBe('2026-10-04T10:00:00.000Z');
  });

  it('ό,τι δεν σειριοποιείται → null, φωλιασμένα μένουν δομή', () => {
    expect(toWireValue({ a: undefined, b: Number.NaN, c: [1, () => 1], d: { e: 'x' } })).toEqual({ a: null, b: null, c: [1, null], d: { e: 'x' } });
  });

  it('απόν έγγραφο → null', () => {
    expect(toWireDocument(undefined)).toBeNull();
  });
});

describe('parseDependencyChangeEvent', () => {
  const valid = { eventId: 'e1', source: 'file', docId: 'file_1', before: null, after: { companyId: 'c1' } };

  it('δέχεται έγκυρο γεγονός', () => {
    expect(parseDependencyChangeEvent(valid)).toEqual(valid);
  });

  it.each([
    ['άγνωστη πηγή', { ...valid, source: 'files_personal' }],
    ['χωρίς eventId', { ...valid, eventId: '' }],
    ['χωρίς docId', { ...valid, docId: 42 }],
    ['και οι δύο καταστάσεις απούσες', { ...valid, after: null }],
    ['before λείπει (όχι ρητό null)', { eventId: 'e1', source: 'file', docId: 'f', after: {} }],
    ['πίνακας ως έγγραφο', { ...valid, after: [] }],
    ['όχι αντικείμενο', 'x'],
  ])('απορρίπτει: %s', (_label, raw) => {
    expect(parseDependencyChangeEvent(raw)).toBeNull();
  });
});
