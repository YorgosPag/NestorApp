/**
 * ADR-505 §A — `export-floor-scope` SSoT (level resolution + layer prefix).
 *
 * Επαληθεύει: active → μόνο ενεργός (throw αν λείπει)· all-zip → όλοι, μηδέν
 * prefix· all-single → όλοι με σταθερό FLnn_ prefix· ταξινόμηση κατά order.
 */

import {
  resolveExportFloors,
  makeFloorLayerPrefix,
  floorScopeProducesMultipleFiles,
} from '../export-floor-scope';
import type { ExportLevelScene } from '../../types';
import type { Level } from '../../../systems/levels/config';
import type { SceneModel } from '../../../types/entities';

function level(id: string, order: number, name: string): Level {
  return { id, order, name } as unknown as Level;
}
function scene(tag: string): SceneModel {
  return { entities: [], tag } as unknown as SceneModel;
}

// Out of order on purpose to verify sorting.
const LEVELS: ExportLevelScene[] = [
  { level: level('L2', 1, 'Όροφος 1'), scene: scene('s2') },
  { level: level('L1', 0, 'Ισόγειο'), scene: scene('s1') },
  { level: level('L3', 2, 'Όροφος 2'), scene: scene('s3') },
];

describe('resolveExportFloors — active', () => {
  it('επιστρέφει μόνο τον ενεργό όροφο, μηδέν prefix', () => {
    const r = resolveExportFloors(LEVELS, 'L2', 'active');
    expect(r).toHaveLength(1);
    expect(r[0].level.id).toBe('L2');
    expect(r[0].layerPrefix).toBe('');
  });

  it('throw όταν ο ενεργός όροφος δεν έχει scene', () => {
    expect(() => resolveExportFloors(LEVELS, 'NOPE', 'active')).toThrow('EXPORT_NO_ACTIVE_SCENE');
  });
});

describe('resolveExportFloors — all-zip', () => {
  it('όλοι οι όροφοι, ταξινομημένοι κατά order, μηδέν prefix', () => {
    const r = resolveExportFloors(LEVELS, 'L2', 'all-zip');
    expect(r.map((f) => f.level.id)).toEqual(['L1', 'L2', 'L3']);
    expect(r.every((f) => f.layerPrefix === '')).toBe(true);
  });
});

describe('resolveExportFloors — all-single', () => {
  it('όλοι με σταθερό FLnn_ prefix κατά σειρά', () => {
    const r = resolveExportFloors(LEVELS, 'L2', 'all-single');
    expect(r.map((f) => f.layerPrefix)).toEqual(['FL01_', 'FL02_', 'FL03_']);
  });
});

describe('helpers', () => {
  it('makeFloorLayerPrefix → 1-based, zero-padded', () => {
    expect(makeFloorLayerPrefix(level('x', 0, 'a'))).toBe('FL01_');
    expect(makeFloorLayerPrefix(level('x', 9, 'a'))).toBe('FL10_');
  });

  it('floorScopeProducesMultipleFiles μόνο για all-zip', () => {
    expect(floorScopeProducesMultipleFiles('all-zip')).toBe(true);
    expect(floorScopeProducesMultipleFiles('active')).toBe(false);
    expect(floorScopeProducesMultipleFiles('all-single')).toBe(false);
  });
});
