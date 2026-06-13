/**
 * ADR-448 Phase 2 (beam seam) — `beam-completion` storey-aware top-of-beam tests.
 *
 * Locks: a beam's `topElevation` (top face) inherits the active storey ceiling
 * (FLOOR-RELATIVE, `nextFloorElevationMm − floorElevationMm`) — a beam defines the
 * storey ceiling. Explicit override always wins; no storey → legacy const. This is
 * the fix for beams «από κάναβο» being born at 3000 regardless of storey height.
 */

import { buildDefaultBeamParams } from '../beam-completion';
import { DEFAULT_BEAM_TOP_ELEVATION_MM } from '../../../bim/types/beam-types';
import { useActiveStoreyStore } from '../../../systems/levels/active-storey-store';
import { buildActiveStoreyContext } from '../../../systems/levels/active-storey-context';

const S = { x: 0, y: 0 };
const E = { x: 4000, y: 0 };

// Storey @3m FFL with an upper floor @8m → floor-to-floor height = 5000mm.
const setStorey5m = () =>
  useActiveStoreyStore.setState({
    context: buildActiveStoreyContext(
      [
        { id: 'flr1', number: 1, elevation: 3, height: 5, kind: 'standard' },
        { id: 'flr2', number: 2, elevation: 8, height: 3, kind: 'standard' },
      ],
      'flr1',
    ),
  });

afterEach(() => useActiveStoreyStore.setState({ context: null }));

describe('buildDefaultBeamParams — storey-aware topElevation (ADR-448 Phase 2)', () => {
  it('top-of-beam inherits the floor-relative storey ceiling (5000, not 3000)', () => {
    setStorey5m();
    expect(buildDefaultBeamParams(S, E).topElevation).toBe(5000);
  });

  it('explicit topElevation override wins over the storey ceiling', () => {
    setStorey5m();
    expect(buildDefaultBeamParams(S, E, 'straight', { topElevation: 2800 }).topElevation).toBe(2800);
  });

  it('no active storey → legacy DEFAULT_BEAM_TOP_ELEVATION_MM', () => {
    expect(buildDefaultBeamParams(S, E).topElevation).toBe(DEFAULT_BEAM_TOP_ELEVATION_MM);
  });
});
