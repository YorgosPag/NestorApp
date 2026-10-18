/**
 * ADR-912 §12.16 — η σειρά του θεατή = η σειρά της ΑΠΟΔΟΣΜΕΝΗΣ λίστας.
 */

/* global describe, it, expect */

import { fileSequenceItem, fileSequenceStopOf, readFileSequence, sameFileSequence } from '../file-sequence';

function listOf(...ids: string[]): HTMLElement {
  const root = document.createElement('section');
  ids.forEach((id) => {
    const row = document.createElement('article');
    Object.entries(fileSequenceItem(id)).forEach(([name, value]) => row.setAttribute(name, value));
    root.appendChild(row);
  });
  return root;
}

describe('file-sequence', () => {
  it('🔴 Σ1 — η σειρά είναι η σειρά του DOM (ό,τι βλέπει ο άνθρωπος), και ένα αρχείο σε δύο ομάδες είναι μία στάση', () => {
    expect(readFileSequence(listOf('c', 'a', 'b', 'a'))).toEqual(['c', 'a', 'b']);
  });

  it('🔴 Σ2 — στα άκρα σταματά: κανένα άλμα από το τελευταίο στο πρώτο', () => {
    expect(fileSequenceStopOf(['a', 'b', 'c'], 'a')).toEqual({ index: 0, total: 3, previousId: null, nextId: 'b' });
    expect(fileSequenceStopOf(['a', 'b', 'c'], 'c')).toEqual({ index: 2, total: 3, previousId: 'b', nextId: null });
  });

  it('✅ Σ3 — αρχείο εκτός λίστας (φίλτρο) ή μόνο του ⇒ καμία σειρά', () => {
    expect(fileSequenceStopOf(['a', 'b'], 'z')).toBeNull();
    expect(fileSequenceStopOf(['a'], 'a')).toBeNull();
  });

  it('✅ Σ4 — ίδια σειρά ⇒ «ίδια» (καμία άσκοπη ανανέωση του θεατή)', () => {
    expect(sameFileSequence(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameFileSequence(['a', 'b'], ['b', 'a'])).toBe(false);
  });
});
