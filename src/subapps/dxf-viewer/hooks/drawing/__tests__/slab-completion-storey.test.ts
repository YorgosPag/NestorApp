/**
 * ADR-448 Phase 2 — `slab-completion` storey-aware ceiling/roof FFL tests.
 *
 * Locks: ceiling/roof slabs inherit the active storey ceiling (FLOOR-RELATIVE,
 * `nextFloorElevationMm − floorElevationMm`); floor/ground/foundation keep their
 * per-kind datum default; explicit override always wins; no storey → legacy.
 */

import { buildDefaultSlabParams } from '../slab-completion';
import { SLAB_KIND_DEFAULT_LEVEL_ELEVATION_MM } from '../../../bim/types/slab-types';
import { useActiveStoreyStore } from '../../../systems/levels/active-storey-store';
import { buildActiveStoreyContext } from '../../../systems/levels/active-storey-context';

const SQUARE = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 4000 },
  { x: 0, y: 4000 },
];

// Ground (FFL=0) with an upper floor @3.5m → ground ceiling floor-relative = 3500.
const setGroundStorey = () =>
  useActiveStoreyStore.setState({
    context: buildActiveStoreyContext(
      [
        { id: 'grd', number: 0, elevation: 0, height: 3.5, kind: 'ground' },
        { id: 'upr', number: 1, elevation: 3.5, height: 3, kind: 'standard' },
      ],
      'grd',
    ),
  });

afterEach(() => useActiveStoreyStore.setState({ context: null }));

describe('buildDefaultSlabParams — storey-aware ceiling/roof FFL (ADR-448 Phase 2)', () => {
  it('ceiling inherits the floor-relative storey ceiling (3500, not datum)', () => {
    setGroundStorey();
    const params = buildDefaultSlabParams(SQUARE, { kind: 'ceiling' });
    expect(params.levelElevation).toBe(3500);
  });

  it('roof inherits the floor-relative storey ceiling too', () => {
    setGroundStorey();
    const params = buildDefaultSlabParams(SQUARE, { kind: 'roof' });
    expect(params.levelElevation).toBe(3500);
  });

  it('floor/ground/foundation keep their per-kind datum (0) even with a storey', () => {
    setGroundStorey();
    expect(buildDefaultSlabParams(SQUARE, { kind: 'floor' }).levelElevation).toBe(0);
    expect(buildDefaultSlabParams(SQUARE, { kind: 'ground' }).levelElevation).toBe(0);
    expect(buildDefaultSlabParams(SQUARE, { kind: 'foundation' }).levelElevation).toBe(0);
  });

  it('explicit levelElevation override wins for ceiling', () => {
    setGroundStorey();
    const params = buildDefaultSlabParams(SQUARE, { kind: 'ceiling', levelElevation: 2900 });
    expect(params.levelElevation).toBe(2900);
  });

  it('no active storey → legacy per-kind default (ceiling 3000)', () => {
    const params = buildDefaultSlabParams(SQUARE, { kind: 'ceiling' });
    expect(params.levelElevation).toBe(SLAB_KIND_DEFAULT_LEVEL_ELEVATION_MM['ceiling']);
  });
});
