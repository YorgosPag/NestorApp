/**
 * ADR-475 — beam-size-patch (auto-size ως undoable params patch + convergence guard).
 */

import type { BeamEntity, BeamParams } from '../../../types/beam-types';
import type { ColumnEntity } from '../../../types/column-types';
import { GREEK_LEGACY_PROVIDER } from '../../codes/greek-legacy-provider';
import { buildBeamSizePatch, isBeamAutoSized } from '../beam-size-patch';

function makeBeam(over: Partial<BeamParams> = {}, lengthM = 9.6): BeamEntity {
  const params: BeamParams = {
    kind: 'straight',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: lengthM * 1000, y: 0, z: 0 },
    width: 250,
    depth: 500,
    topElevation: 3000,
    ...over,
  };
  return { type: 'beam', id: 'beam_test', params, geometry: { length: lengthM } } as unknown as BeamEntity;
}

describe('isBeamAutoSized', () => {
  it('defaults to AUTO when the flag is absent', () => {
    expect(isBeamAutoSized(makeBeam().params)).toBe(true);
  });
  it('is locked only when explicitly false', () => {
    expect(isBeamAutoSized(makeBeam({ autoSized: false }).params)).toBe(false);
    expect(isBeamAutoSized(makeBeam({ autoSized: true }).params)).toBe(true);
  });
});

describe('buildBeamSizePatch', () => {
  it('deepens an undersized AUTO beam (500 → 850, greek-legacy 9.6 m)', () => {
    const patch = buildBeamSizePatch(makeBeam(), GREEK_LEGACY_PROVIDER);
    expect(patch).not.toBeNull();
    expect(patch?.next.depth).toBe(850);
    expect(patch?.next.autoSized).toBe(true);
  });

  it('keeps width unchanged (depth-only sizing)', () => {
    const patch = buildBeamSizePatch(makeBeam({ width: 300 }), GREEK_LEGACY_PROVIDER);
    expect(patch?.next.width).toBe(300);
  });

  it('returns null for a locked beam (manual override wins)', () => {
    expect(buildBeamSizePatch(makeBeam({ autoSized: false }), GREEK_LEGACY_PROVIDER)).toBeNull();
  });

  it('returns null once converged (depth already adequate)', () => {
    expect(buildBeamSizePatch(makeBeam({ depth: 850 }), GREEK_LEGACY_PROVIDER)).toBeNull();
  });

  it('returns null for a non-beam entity', () => {
    const column = { type: 'column', id: 'col_x', params: {} } as unknown as ColumnEntity;
    expect(buildBeamSizePatch(column, GREEK_LEGACY_PROVIDER)).toBeNull();
  });

  // ADR-486 §C — topology-aware support type → ο πρόβολος (wL²/2 + αυστηρό l/d)
  // διαστασιολογείται ΒΑΘΥΤΕΡΑ από το stored 'simple' (αλλιώς ρ > ρ_max, η ρίζα του bug).
  it('sizes a cantilever DEEPER than the simple default (supportType override)', () => {
    const simple = buildBeamSizePatch(makeBeam(), GREEK_LEGACY_PROVIDER);
    const cantilever = buildBeamSizePatch(makeBeam(), GREEK_LEGACY_PROVIDER, 'cantilever');
    expect(cantilever).not.toBeNull();
    expect(cantilever!.next.depth).toBeGreaterThan(simple!.next.depth);
  });
});
