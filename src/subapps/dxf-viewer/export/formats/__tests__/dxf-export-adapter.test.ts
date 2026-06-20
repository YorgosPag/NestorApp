/**
 * ADR-505 §B — `dxf-export-adapter` pure paths.
 *
 * Επαληθεύει: buildDxfExportRequest φιλτράρει by scope + κάνει BIM→primitive·
 * mergeFloorsToSingleDxfScene namespaces layers/entities ανά FLnn_ prefix·
 * buildFloorFilename filesystem-safe.
 */

import {
  buildDxfExportRequest,
  mergeFloorsToSingleDxfScene,
  buildFloorFilename,
} from '../dxf-export-adapter';
import type { ResolvedExportFloor } from '../../core/export-floor-scope';
import type { Entity } from '../../../types/entities';
import type { SceneModel } from '../../../types/scene-types';

function native(type: string, id: string): Entity {
  return { id, type, layerId: 'lyr_a' } as unknown as Entity;
}
function column(id: string): Entity {
  return {
    id, type: 'column', layerId: 'lyr_a',
    geometry: { footprint: { vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] } },
  } as unknown as Entity;
}
function scene(entities: Entity[]): SceneModel {
  return {
    entities,
    layersById: { lyr_a: { id: 'lyr_a', name: 'Walls', color: '#fff', visible: true } },
    bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
    units: 'mm',
  } as unknown as SceneModel;
}

describe('buildDxfExportRequest', () => {
  it('dxf-only αποκλείει BIM', () => {
    const { request } = buildDxfExportRequest(scene([native('line', 'l'), column('c')]), {
      entityScope: 'dxf-only',
    });
    expect(request.scene.entities.map((e) => e.type)).toEqual(['line']);
  });

  it('both → BIM γίνεται lwpolyline primitive', () => {
    const { request } = buildDxfExportRequest(scene([native('line', 'l'), column('c')]), {
      entityScope: 'both',
    });
    expect(request.scene.entities.map((e) => e.type).sort()).toEqual(['line', 'lwpolyline']);
  });

  it('περνά version/unit overrides στα settings', () => {
    const { request } = buildDxfExportRequest(scene([native('line', 'l')]), {
      entityScope: 'both',
      version: 'AC1032',
      unit: 'meters',
    });
    expect(request.settings.version).toBe('AC1032');
    expect(request.settings.units).toBe('meters');
  });
});

describe('mergeFloorsToSingleDxfScene', () => {
  it('namespaces layers + entity layerId ανά FLnn_ prefix', () => {
    const floors: ResolvedExportFloor[] = [
      { level: { id: 'L1', order: 0, name: 'Ισόγειο' } as never, scene: scene([native('line', 'a')]), layerPrefix: 'FL01_' },
      { level: { id: 'L2', order: 1, name: 'Όροφος' } as never, scene: scene([native('line', 'b')]), layerPrefix: 'FL02_' },
    ];
    const { scene: merged } = mergeFloorsToSingleDxfScene(floors, 'both');

    expect(merged.entities).toHaveLength(2);
    expect(merged.entities.map((e) => e.layerId).sort()).toEqual(['FL01_lyr_a', 'FL02_lyr_a']);
    expect(Object.keys(merged.layersById).sort()).toEqual(['FL01_lyr_a', 'FL02_lyr_a']);
    expect(merged.layersById['FL01_lyr_a'].name).toBe('FL01_Walls');
  });
});

describe('buildFloorFilename', () => {
  it('filesystem-safe με ελληνικά', () => {
    expect(buildFloorFilename('Έργο Α', 'Όροφος 1', 'dxf')).toBe('Έργο_Α_Όροφος_1.dxf');
  });
  it('κενό floor → μόνο base', () => {
    expect(buildFloorFilename('Proj', '', 'zip')).toBe('Proj.zip');
  });
});
