/**
 * ADR-449/451 — column «Ύψος» read-only/derived (pure helper).
 *
 * Το `params.height` έχει νόημα ΜΟΝΟ σε `unconnected` top. Σε storey/level-bound
 * το πεδίο γίνεται derived → δείχνει τη resolved (rendered) τιμή ύψους μέσω της
 * ΙΔΙΑΣ SSoT με τον πυρήνα (`resolveColumnVerticalExtentMm`).
 */

import { isColumnHeightDerived, deriveStoreyBoundHeightMm } from '../column-height-display';
import { useActiveStoreyStore } from '../../../../../systems/levels/active-storey-store';
import type { ActiveStoreyContext } from '../../../../../systems/levels/active-storey-context';
import type { ColumnEntity } from '../../../../../bim/types/column-types';

const ctx = (over: Partial<ActiveStoreyContext> = {}): ActiveStoreyContext => ({
  floorId: 'flr_test', storeyKind: null, storeyNumber: 0, storeyHeightMm: 3000,
  finishThicknessMm: 50, floorElevationMm: 0, nextFloorElevationMm: 3000,
  isLowestOccupiedStorey: true, buildingHasBasement: false, ...over,
});

function column(over: Partial<ColumnEntity['params']> = {}): ColumnEntity {
  return {
    id: 'col-1', type: 'column', layerId: 'lvl-1', visible: true, ifcType: 'IfcColumn',
    params: {
      kind: 'rectangular', position: { x: 0, y: 0, z: 0 }, anchor: 'center',
      width: 500, depth: 500, height: 2700, rotation: 0, sceneUnits: 'mm',
      baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
      ...over,
    },
    geometry: {
      footprint: { vertices: [{ x: 0, y: 0, z: 0 }, { x: 500, y: 0, z: 0 }, { x: 500, y: 500, z: 0 }, { x: 0, y: 500, z: 0 }] },
      bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 500, y: 500, z: 0 } }, area: 0.25, volume: 0.675, height: 2700,
    },
    validation: { isValid: true, hardErrors: [], softWarnings: [], hasCodeViolations: false },
  } as unknown as ColumnEntity;
}

afterEach(() => useActiveStoreyStore.getState().setContext(null));

describe('isColumnHeightDerived', () => {
  it('storey-ceiling/absolute/attached → derived (read-only)· unconnected → editable', () => {
    expect(isColumnHeightDerived('storey-ceiling')).toBe(true);
    expect(isColumnHeightDerived('absolute')).toBe(true);
    expect(isColumnHeightDerived('attached')).toBe(true);
    expect(isColumnHeightDerived('unconnected')).toBe(false);
  });
});

describe('deriveStoreyBoundHeightMm', () => {
  it('storey-ceiling: resolved height = storey ceiling (3000), ΟΧΙ raw 2700', () => {
    useActiveStoreyStore.getState().setContext(ctx({ floorElevationMm: 0, nextFloorElevationMm: 3000 }));
    expect(deriveStoreyBoundHeightMm(column({ height: 2700 }))).toBe(3000);
  });

  it('storey-ceiling με baseOffset: resolved = ceiling − base', () => {
    useActiveStoreyStore.getState().setContext(ctx({ floorElevationMm: 0, nextFloorElevationMm: 3000 }));
    expect(deriveStoreyBoundHeightMm(column({ height: 2700, baseOffset: 200 }))).toBe(2800);
  });

  it('attached → null (per-corner, ο caller κάνει fallback)', () => {
    useActiveStoreyStore.getState().setContext(ctx());
    expect(deriveStoreyBoundHeightMm(column({ topBinding: 'attached', attachTopToIds: ['b1'] }))).toBeNull();
  });

  it('χωρίς active storey → null', () => {
    expect(deriveStoreyBoundHeightMm(column())).toBeNull();
  });
});
