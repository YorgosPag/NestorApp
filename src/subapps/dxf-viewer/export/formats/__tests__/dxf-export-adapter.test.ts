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
  renderDxfBlob,
  resolveUnicodeSafeAcadVer,
  encodingToCodepage,
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

  it('both → BIM γίνεται lwpolyline primitive (+ ADR-505 §C γέμισμα hatch)', () => {
    const { request } = buildDxfExportRequest(scene([native('line', 'l'), column('c')]), {
      entityScope: 'both',
    });
    // line (native) + column outline (lwpolyline, re-layered COLUMNS) + γέμισμα (hatch, COLUMNS_FILL).
    expect(request.scene.entities.map((e) => e.type).sort()).toEqual(['hatch', 'line', 'lwpolyline']);
    const poly = request.scene.entities.find((e) => e.type === 'lwpolyline');
    expect(poly?.layerId).toBe('COLUMNS');
    expect(request.scene.layersById['COLUMNS']).toBeDefined();
    expect(request.scene.layersById['COLUMNS_FILL']).toBeDefined();
    // dxf layer (lyr_a) ΔΕΝ μπαίνει ως category — μένει μόνο ως αρχικό scene layer.
    expect(request.scene.layersById['lyr_a']).toBeDefined();
  });

  it('ADR-583/608 — annotation-symbol αποδομείται σε primitives (όχι raw στο .dxf)', () => {
    const arrow = {
      id: 'na', type: 'annotation-symbol', layerId: 'lyr_a', color: '#00ff00',
      position: { x: 0, y: 0 }, kind: 'north-arrow', symbolId: 'northArrowSimple', sizeMm: 15,
    } as unknown as Entity;
    const { request } = buildDxfExportRequest(scene([arrow]), {
      entityScope: 'both',
      drawingScale: 100,
    });
    const types = request.scene.entities.map((e) => e.type);
    // ΚΑΝΕΝΑ raw annotation-symbol — έγινε shaft line + arrowhead (hatch + outline) + "N".
    expect(types).not.toContain('annotation-symbol');
    expect(types).toContain('line');
    expect(types).toContain('hatch');
    expect(types).toContain('lwpolyline');
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

describe('ADR-636 Στάδιο 1 — professional HEADER', () => {
  it('resolveUnicodeSafeAcadVer bumps pre-Unicode + utf-8 → AC1021', () => {
    expect(resolveUnicodeSafeAcadVer('AC1009', 'utf-8')).toBe('AC1021'); // R12 → R2007
    expect(resolveUnicodeSafeAcadVer('AC1015', 'utf-8')).toBe('AC1021'); // R2000 → R2007
    expect(resolveUnicodeSafeAcadVer('AC1021', 'utf-8')).toBe('AC1021'); // already Unicode
    expect(resolveUnicodeSafeAcadVer('AC1032', 'utf-8')).toBe('AC1032'); // R2018 kept
    expect(resolveUnicodeSafeAcadVer('AC1009', 'cp1253')).toBe('AC1009'); // non-utf-8 kept (Στάδιο 2)
  });

  it('encodingToCodepage: Greek → ANSI_1253, else ANSI_1252', () => {
    expect(encodingToCodepage('cp1253')).toBe('ANSI_1253');
    expect(encodingToCodepage('utf-8')).toBe('ANSI_1252');
    expect(encodingToCodepage('cp1252')).toBe('ANSI_1252');
  });

  it('renderDxfBlob returns a non-empty DXF Blob (HEADER content covered by the writer test)', () => {
    const realLine = { id: 'l', type: 'line', layerId: 'lyr_a', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as unknown as Entity;
    const { request } = buildDxfExportRequest(scene([realLine]), { entityScope: 'dxf-only', unit: 'meters' });
    const blob = renderDxfBlob(request);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/dxf');
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
