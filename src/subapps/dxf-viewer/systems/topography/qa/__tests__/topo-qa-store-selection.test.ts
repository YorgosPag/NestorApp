/**
 * ADR-650 M5α.2 — the QA review store's selection half.
 *
 * Two properties here are load-bearing and neither is visible by reading the components:
 *  - a re-run DROPS the selection (flag ids are per-report — a surviving id would highlight a
 *    finding that no longer exists, or a different one that happens to reuse the id);
 *  - selecting PRESERVES the report's object identity, which is what keeps the overlays'
 *    `useMemo(…, [report])` world positions (3D: one TIN sampling per flag) from recomputing on
 *    every row click.
 */

import { topoQaStore } from '../topo-qa-store';
import type { TopoQaReport } from '../topo-qa-types';

function makeReport(ids: readonly string[]): TopoQaReport {
  return {
    surfaceId: 'existing',
    flags: ids.map((id) => ({
      id,
      kind: 'elevation-bust' as const,
      severity: 'high' as const,
      at: { x: 0, y: 0 },
      messageKey: 'topography.qa.flag.elevationBust',
      messageParams: {},
    })),
    counts: { high: ids.length, medium: 0, low: 0 },
    droppedByCap: 0,
    notEnoughData: false,
  };
}

beforeEach(() => {
  topoQaStore.reset();
});

describe('topoQaStore selection', () => {
  it('starts with nothing selected', () => {
    topoQaStore.set(makeReport(['a', 'b']));
    expect(topoQaStore.getSelectedFlagId()).toBeNull();
  });

  it('records the selected flag id', () => {
    topoQaStore.set(makeReport(['a', 'b']));
    topoQaStore.select('b');
    expect(topoQaStore.getSelectedFlagId()).toBe('b');
  });

  it('keeps the report object identity when selecting — overlays must not recompute positions', () => {
    topoQaStore.set(makeReport(['a', 'b']));
    const before = topoQaStore.get();
    topoQaStore.select('a');
    expect(topoQaStore.get()).toBe(before);
  });

  it('drops the selection when a fresh run supersedes the report', () => {
    topoQaStore.set(makeReport(['a']));
    topoQaStore.select('a');
    topoQaStore.set(makeReport(['a'])); // same id, different report — must NOT stay selected
    expect(topoQaStore.getSelectedFlagId()).toBeNull();
  });

  it('drops the selection on clear', () => {
    topoQaStore.set(makeReport(['a']));
    topoQaStore.select('a');
    topoQaStore.reset();
    expect(topoQaStore.getSelectedFlagId()).toBeNull();
    expect(topoQaStore.get()).toBeNull();
  });

  it('replaces, never accumulates, the selection', () => {
    topoQaStore.set(makeReport(['a', 'b', 'c']));
    topoQaStore.select('a');
    topoQaStore.select('c');
    expect(topoQaStore.getSelectedFlagId()).toBe('c');
  });
});
