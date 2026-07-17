/**
 * ADR-659 — SelectionCyclingStore: shared dedup + armed repeated-click state.
 * (Extends ADR-357 Φ15 cycling store.)
 */

import { SelectionCyclingStore, buildCandidatesFromHits } from '../SelectionCyclingStore';
import type { HitTestResult } from '../../../services/HitTestingService';

const hit = (entityId: string, entityType?: string, layer?: string): HitTestResult =>
  ({ entityId, entityType, layer, distance: 0 });

describe('buildCandidatesFromHits (ADR-659 SSoT dedup)', () => {
  it('dedups by entity id, keeps first-hit order (priority→distance)', () => {
    const out = buildCandidatesFromHits([hit('a'), hit('b'), hit('a'), hit('c')]);
    expect(out.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('drops null/empty entity ids and fills type/layer defaults', () => {
    const out = buildCandidatesFromHits([
      { entityId: null, distance: 0 } as HitTestResult,
      hit('x'),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ id: 'x', entityType: 'entity', layer: '0' });
  });

  it('bug fix (2026-07-17) — resolveEntity is optional; omitting it leaves candidates semantics-free', () => {
    const out = buildCandidatesFromHits([hit('a')]);
    expect(out[0].semantics).toBeUndefined();
  });

  it('bug fix (2026-07-17) — resolveEntity is called ONCE per candidate id, at build time', () => {
    const resolveEntity = jest.fn().mockReturnValue(undefined);
    buildCandidatesFromHits([hit('a'), hit('b'), hit('a')], resolveEntity);
    // 'a' deduped away on the 2nd occurrence — resolveEntity only runs for the two unique ids.
    expect(resolveEntity).toHaveBeenCalledTimes(2);
    expect(resolveEntity).toHaveBeenCalledWith('a');
    expect(resolveEntity).toHaveBeenCalledWith('b');
  });
});

describe('SelectionCyclingStore armed repeated-click (ADR-659)', () => {
  beforeEach(() => {
    SelectionCyclingStore.cancel();
    SelectionCyclingStore.clearArmed();
  });

  const cands = [
    { id: 'a', entityType: 'line', layer: '0' },
    { id: 'b', entityType: 'hatch', layer: '0' },
    { id: 'c', entityType: 'text', layer: '0' },
  ];

  it('matchesArmedPoint is false before arming', () => {
    expect(SelectionCyclingStore.matchesArmedPoint(10, 10, 4)).toBe(false);
  });

  it('arms at a point; matches within threshold, not outside', () => {
    SelectionCyclingStore.armFromClick(cands, 100, 100);
    expect(SelectionCyclingStore.matchesArmedPoint(102, 101, 4)).toBe(true); // hypot≈2.24
    expect(SelectionCyclingStore.matchesArmedPoint(110, 100, 4)).toBe(false);
    expect(SelectionCyclingStore.getArmedIndex()).toBe(0);
  });

  it('needs ≥2 candidates to match', () => {
    SelectionCyclingStore.armFromClick([cands[0]], 100, 100);
    expect(SelectionCyclingStore.matchesArmedPoint(100, 100, 4)).toBe(false);
  });

  it('advanceArmed wraps through the candidate list', () => {
    SelectionCyclingStore.armFromClick(cands, 0, 0);
    expect(SelectionCyclingStore.advanceArmed()?.id).toBe('b'); // 0 → 1
    expect(SelectionCyclingStore.advanceArmed()?.id).toBe('c'); // 1 → 2
    expect(SelectionCyclingStore.advanceArmed()?.id).toBe('a'); // 2 → 0 (wrap)
    expect(SelectionCyclingStore.getArmedIndex()).toBe(0);
  });

  it('clearArmed resets matching', () => {
    SelectionCyclingStore.armFromClick(cands, 5, 5);
    SelectionCyclingStore.clearArmed();
    expect(SelectionCyclingStore.matchesArmedPoint(5, 5, 4)).toBe(false);
  });
});

describe('SelectionCyclingStore.startCycling startIndex (ADR-659)', () => {
  beforeEach(() => SelectionCyclingStore.cancel());

  const cands = [
    { id: 'a', entityType: 'line', layer: '0' },
    { id: 'b', entityType: 'hatch', layer: '0' },
  ];

  it('opens the popover synced to the given index', () => {
    SelectionCyclingStore.startCycling(cands, 0, 0, 1);
    expect(SelectionCyclingStore.isActive()).toBe(true);
    expect(SelectionCyclingStore.getCurrentId()).toBe('b');
  });

  it('normalizes out-of-range / negative indices', () => {
    SelectionCyclingStore.startCycling(cands, 0, 0, 3); // 3 % 2 = 1
    expect(SelectionCyclingStore.getCurrentId()).toBe('b');
    SelectionCyclingStore.startCycling(cands, 0, 0, -1); // wraps to 1
    expect(SelectionCyclingStore.getCurrentId()).toBe('b');
  });

  it('defaults to index 0 (keyboard Shift+Space trigger)', () => {
    SelectionCyclingStore.startCycling(cands, 0, 0);
    expect(SelectionCyclingStore.getCurrentId()).toBe('a');
  });
});
