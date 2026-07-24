/**
 * ADR-692 Φ2 — combineMarqueeSelection (SSoT για replace/add/subtract).
 * Το ίδιο SSoT τρέφει ΚΑΙ το BIM marquee ΚΑΙ το raw-DXF marquee.
 */

import { combineMarqueeSelection } from '../marquee-combine';

describe('combineMarqueeSelection', () => {
  it('replace: η επιλογή γίνεται ΑΚΡΙΒΩΣ τα hits', () => {
    expect(combineMarqueeSelection(['a', 'b'], ['c', 'd'], 'replace')).toEqual(['c', 'd']);
  });

  it('replace: αδειάζει όταν δεν υπάρχουν hits', () => {
    expect(combineMarqueeSelection(['a'], [], 'replace')).toEqual([]);
  });

  it('replace: de-dup των hits', () => {
    expect(combineMarqueeSelection([], ['a', 'a', 'b'], 'replace')).toEqual(['a', 'b']);
  });

  it('add: ένωση χωρίς διπλά, κρατά πρώτα τα υπάρχοντα', () => {
    expect(combineMarqueeSelection(['a', 'b'], ['b', 'c'], 'add')).toEqual(['a', 'b', 'c']);
  });

  it('subtract: αφαιρεί μόνο τα hits', () => {
    expect(combineMarqueeSelection(['a', 'b', 'c'], ['b'], 'subtract')).toEqual(['a', 'c']);
  });

  it('subtract: hit εκτός επιλογής = no-op', () => {
    expect(combineMarqueeSelection(['a'], ['z'], 'subtract')).toEqual(['a']);
  });

  it('δεν μεταλλάσσει την είσοδο', () => {
    const current = ['a', 'b'];
    combineMarqueeSelection(current, ['c'], 'add');
    expect(current).toEqual(['a', 'b']);
  });
});
