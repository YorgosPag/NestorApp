/**
 * ADR-422 L2 — tests για το space↔radiator assignment (point-in-polygon).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Επιβεβαιώνει: σώμα μέσα/έξω από footprint, N σώματα → siblingCount, χώρος
 * χωρίς σώμα, κενά inputs. Χώροι σε scene units 'm' (mirror του L1 derive test).
 */

import { createThermalSpace } from '@/services/factories/thermal-space.factory';
import { createMepRadiator } from '@/services/factories/mep-radiator.factory';
import {
  computeThermalSpaceGeometry,
  type ThermalSpaceEntity,
} from '../../../types/thermal-space-types';
import {
  computeMepRadiatorGeometry,
} from '../../../mep-radiators/mep-radiator-geometry';
import type { MepRadiatorEntity, MepRadiatorParams } from '../../../types/mep-radiator-types';
import { assignRadiatorsToSpaces } from '../space-radiator-assignment';

/** Τετράγωνο δωμάτιο [x0,x0+4] × [y0,y0+4] m. */
function makeSpace(id: string, x0: number, y0: number): ThermalSpaceEntity {
  const params = {
    footprint: {
      vertices: [
        { x: x0, y: y0 },
        { x: x0 + 4, y: y0 },
        { x: x0 + 4, y: y0 + 4 },
        { x: x0, y: y0 + 4 },
      ],
    },
    useType: 'living-room' as const,
    ceilingHeightMm: 3000,
    sceneUnits: 'm' as const,
  };
  return createThermalSpace({
    id,
    params,
    geometry: computeThermalSpaceGeometry(params),
    layerId: 'layer-0',
  });
}

/** Σώμα στη θέση (x,y) σε scene units 'm'. */
function makeRadiator(id: string, x: number, y: number): MepRadiatorEntity {
  const params: MepRadiatorParams = {
    kind: 'panel-radiator',
    shape: 'rectangular',
    position: { x, y, z: 0 },
    rotation: 0,
    width: 1000,
    length: 100,
    bodyHeightMm: 600,
    mountingElevationMm: 450,
    connectorDiameterMm: 15,
    sceneUnits: 'm',
  };
  return createMepRadiator({
    id,
    params,
    geometry: computeMepRadiatorGeometry(params),
    layerId: 'layer-0',
  });
}

describe('assignRadiatorsToSpaces', () => {
  it('αντιστοιχεί σώμα μέσα στο footprint του χώρου', () => {
    const space = makeSpace('sp-1', 0, 0);
    const rad = makeRadiator('rad-1', 2, 2);
    const { byRadiator, bySpace } = assignRadiatorsToSpaces([rad], [space]);
    expect(byRadiator.get('rad-1')).toEqual({ spaceId: 'sp-1', siblingCount: 1 });
    expect(bySpace.get('sp-1')).toEqual(['rad-1']);
  });

  it('αγνοεί σώμα εκτός κάθε footprint', () => {
    const space = makeSpace('sp-1', 0, 0);
    const rad = makeRadiator('rad-out', 100, 100);
    const { byRadiator, bySpace } = assignRadiatorsToSpaces([rad], [space]);
    expect(byRadiator.has('rad-out')).toBe(false);
    expect(bySpace.size).toBe(0);
  });

  it('N σώματα στον ίδιο χώρο → siblingCount = N', () => {
    const space = makeSpace('sp-1', 0, 0);
    const r1 = makeRadiator('r1', 1, 1);
    const r2 = makeRadiator('r2', 3, 3);
    const { byRadiator, bySpace } = assignRadiatorsToSpaces([r1, r2], [space]);
    expect(byRadiator.get('r1')).toEqual({ spaceId: 'sp-1', siblingCount: 2 });
    expect(byRadiator.get('r2')).toEqual({ spaceId: 'sp-1', siblingCount: 2 });
    expect(bySpace.get('sp-1')).toEqual(['r1', 'r2']);
  });

  it('δύο χώροι → κάθε σώμα στον δικό του', () => {
    const a = makeSpace('sp-a', 0, 0);
    const b = makeSpace('sp-b', 10, 0);
    const ra = makeRadiator('ra', 2, 2);
    const rb = makeRadiator('rb', 12, 2);
    const { byRadiator } = assignRadiatorsToSpaces([ra, rb], [a, b]);
    expect(byRadiator.get('ra')?.spaceId).toBe('sp-a');
    expect(byRadiator.get('rb')?.spaceId).toBe('sp-b');
  });

  it('χώρος χωρίς σώμα δεν εμφανίζεται στο bySpace', () => {
    const a = makeSpace('sp-a', 0, 0);
    const empty = makeSpace('sp-empty', 10, 0);
    const ra = makeRadiator('ra', 2, 2);
    const { bySpace } = assignRadiatorsToSpaces([ra], [a, empty]);
    expect(bySpace.has('sp-empty')).toBe(false);
  });

  it('κενά inputs → κενά ευρετήρια', () => {
    const { byRadiator, bySpace } = assignRadiatorsToSpaces([], []);
    expect(byRadiator.size).toBe(0);
    expect(bySpace.size).toBe(0);
  });
});
