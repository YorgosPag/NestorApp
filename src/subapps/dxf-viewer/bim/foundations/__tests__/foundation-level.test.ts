/**
 * ADR-441 — `sceneFoundationTopMm` tests (shared foundation-top SSoT).
 *
 * Καταναλωτές: εδαφόπλακα (slab-grid-commit) + κολώνες (column-from-grid). Καλύπτει:
 * min footing top, εξαίρεση συνδετήριων (tie-beam), null όταν δεν υπάρχουν footings.
 */

import { sceneFoundationTopMm } from '../foundation-level';
import type { Entity } from '../../../types/entities';

const foundation = (kind: 'strip' | 'pad' | 'tie-beam', topMm: number) =>
  ({ type: 'foundation', params: { kind, topElevationMm: topMm } } as unknown as Entity);

describe('sceneFoundationTopMm', () => {
  it('min top των footings (strip/pad)', () => {
    expect(sceneFoundationTopMm([foundation('strip', -1000), foundation('pad', -1200)] as Entity[])).toBe(-1200);
  });

  it('εξαιρεί τις συνδετήριες (tie-beam, ψηλότερα)', () => {
    expect(sceneFoundationTopMm([foundation('strip', -1000), foundation('tie-beam', -500)] as Entity[])).toBe(-1000);
  });

  it('μηδέν footings → null', () => {
    expect(sceneFoundationTopMm([])).toBeNull();
    expect(sceneFoundationTopMm([foundation('tie-beam', -500)] as Entity[])).toBeNull();
  });

  it('αγνοεί μη-foundation entities', () => {
    const mixed = [{ type: 'wall' } as Entity, foundation('strip', -1000)] as Entity[];
    expect(sceneFoundationTopMm(mixed)).toBe(-1000);
  });
});
