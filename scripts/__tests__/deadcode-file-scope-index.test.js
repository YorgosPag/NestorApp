/**
 * CHECK 3.22 — η πύλη κρίνει το commit, όχι το δέντρο εργασίας (2026-09-26).
 * Άγκυρα της διαμέρισης `partitionByIndex`: untracked WIP εκτός index δεν μπλοκάρει.
 */
'use strict';

const { partitionByIndex } = require('../lib/knip/file-scope');

describe('partitionByIndex (CHECK 3.22)', () => {
  it('βγάζει από τα μπλοκάροντα ό,τι είναι untracked', () => {
    const { committed, outsideIndex } = partitionByIndex(
      ['src/a.ts', 'src/wip/b.ts', 'src/c.ts'],
      ['src/wip/b.ts', 'src/other.ts'],
    );
    expect(committed).toEqual(['src/a.ts', 'src/c.ts']);
    expect(outsideIndex).toEqual(['src/wip/b.ts']);
  });

  it('χωρίς untracked, κρίνονται όλα — τίποτα δεν χάνεται σιωπηλά', () => {
    const unused = ['src/a.ts', 'src/b.ts'];
    expect(partitionByIndex(unused, [])).toEqual({ committed: unused, outsideIndex: [] });
  });

  it('staged νέο αρχείο (όχι πια untracked) μπλοκάρει κανονικά', () => {
    const { committed } = partitionByIndex(['src/new.ts'], ['src/unrelated.ts']);
    expect(committed).toEqual(['src/new.ts']);
  });
});
