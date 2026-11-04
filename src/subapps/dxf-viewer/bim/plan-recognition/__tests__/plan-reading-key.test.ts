/** ADR-929 Δ11 — ένα κλειδί ανάγνωσης, μία σύνθεση, καμία σύμπτωση. */

import { describe, it, expect } from '@jest/globals';
import { planReadingKey, type PlanReadingKeyParts } from '../plan-reading-key';

const PARTS: PlanReadingKeyParts = {
  fileId: 'file_1',
  pageNumber: 2,
  inputHash: 'abc123',
  model: 'gpt-x',
  schemaVersion: 1,
};

describe('planReadingKey', () => {
  it('ίδια μέρη ⇒ ίδιο κλειδί', () => {
    expect(planReadingKey(PARTS)).toBe(planReadingKey({ ...PARTS }));
  });

  it.each<[keyof PlanReadingKeyParts, string | number]>([
    ['fileId', 'file_2'],
    ['pageNumber', 3],
    ['inputHash', 'abc124'],
    ['model', 'gpt-y'],
    ['schemaVersion', 2],
  ])('αλλαγή του %s ⇒ άλλο κλειδί (άλλη ανάγνωση, όχι μπαγιάτικη)', (field, value) => {
    expect(planReadingKey({ ...PARTS, [field]: value })).not.toBe(planReadingKey(PARTS));
  });

  it('ο διαχωριστής μέσα σε μέρος ΔΕΝ μπορεί να κάνει δύο αναγνώσεις να συμπέσουν', () => {
    const a = planReadingKey({ ...PARTS, fileId: 'f|1', inputHash: 'h' });
    const b = planReadingKey({ ...PARTS, fileId: 'f', inputHash: '1|h' });
    expect(a).not.toBe(b);
  });

  it.each<Partial<PlanReadingKeyParts>>([
    { fileId: '' },
    { inputHash: '  ' },
    { model: '' },
    { pageNumber: 0 },
    { pageNumber: 1.5 },
    { schemaVersion: 0 },
  ])('κενό ή άκυρο μέρος ⇒ σφάλμα, ποτέ κοινό έγγραφο (%o)', (bad) => {
    expect(() => planReadingKey({ ...PARTS, ...bad })).toThrow();
  });
});
