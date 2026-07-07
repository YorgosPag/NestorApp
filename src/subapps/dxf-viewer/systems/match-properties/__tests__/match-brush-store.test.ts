/**
 * ADR-581 — Match brush store (σταγονόμετρο/σύριγγα state) tests.
 */

import {
  getMatchBrushSource,
  setMatchBrushSource,
  clearMatchBrushSource,
  hasMatchBrushSource,
  subscribeMatchBrush,
  __resetMatchBrushStore,
} from '../match-brush-store';

beforeEach(() => __resetMatchBrushStore());

describe('MatchBrushStore', () => {
  it('ξεκινά κενό', () => {
    expect(getMatchBrushSource()).toBeNull();
    expect(hasMatchBrushSource()).toBe(false);
  });

  it('φορτώνει και καθαρίζει πηγή', () => {
    setMatchBrushSource({ id: 'c1', type: 'column' });
    expect(getMatchBrushSource()).toEqual({ id: 'c1', type: 'column' });
    expect(hasMatchBrushSource()).toBe(true);

    clearMatchBrushSource();
    expect(getMatchBrushSource()).toBeNull();
    expect(hasMatchBrushSource()).toBe(false);
  });

  it('ειδοποιεί τους subscribers σε αλλαγή', () => {
    let hits = 0;
    const unsub = subscribeMatchBrush(() => { hits += 1; });
    setMatchBrushSource({ id: 'b1', type: 'beam' });
    clearMatchBrushSource();
    unsub();
    setMatchBrushSource({ id: 'b2', type: 'beam' });
    expect(hits).toBe(2); // μόνο οι 2 αλλαγές πριν το unsub
  });
});
