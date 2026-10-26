/**
 * ADR-923 §5.10.4 Β4 — πολλά πρόχειρα, ένας φύλακας: «βρώμικο» αν **οποιοδήποτε** μέρος είναι βρώμικο.
 *
 * Ζωντανά ο επεξεργαστής μοντέλου έχει δύο πρόχειρα (ιδιότητες · πλέγμα παραλλαγών)· με μία boolean και δύο γραφείς,
 * το «καθαρό» των ιδιοτήτων θα έσβηνε το «βρώμικο» μιας επικόλλησης 7 γραμμών.
 */
import { act, renderHook } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }) }));

import { useDirtyParts } from '../use-unsaved-guard';

describe('useDirtyParts', () => {
  it('🔴 ένα μέρος βρώμικο + ένα καθαρό ⇒ βρώμικο · και τα δύο καθαρά ⇒ καθαρό', () => {
    const report = jest.fn();
    const { result } = renderHook(() => useDirtyParts(report));
    act(() => { result.current('variants')(true); });
    act(() => { result.current('attributes')(false); });
    expect(report).toHaveBeenLastCalledWith(true);
    act(() => { result.current('variants')(false); });
    expect(report).toHaveBeenLastCalledWith(false);
  });

  it('σταθερός reporter ανά μέρος (ασφαλής εξάρτηση effect — κανένας βρόχος)', () => {
    const { result, rerender } = renderHook(() => useDirtyParts(jest.fn()));
    const first = result.current('variants');
    rerender();
    expect(result.current('variants')).toBe(first);
  });
});
