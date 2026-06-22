/**
 * ADR-507/508 — `tek-export-adapter` pure path (assembleTekDocument).
 *
 * Επαληθεύει: scope filter (BIM-only walls στο 'both', αποκλεισμός στο 'dxf-only')·
 * injection στους markers του (fake) template. Το βαρύ skeleton asset ΔΕΝ φορτώνεται
 * (περνά fake template).
 */

import { assembleTekDocument } from '../tek-export-adapter';
import { computeFurnitureGeometry } from '../../../bim/furniture/furniture-geometry';
import type { FurnitureParams } from '../../../bim/types/furniture-types';
import type { Entity } from '../../../types/entities';
import type { SceneModel } from '../../../types/scene-types';

const FAKE_TPL = 'HEAD<!--TEK_WALL_RECORDS--><!--TEK_OBJECT_RECORDS--><!--TEK_PLANE_RECORDS--><!--TEK_AUTOROOF_RECORDS-->TAIL';

function wall(): Entity {
  return {
    id: 'w1', type: 'wall', kind: 'straight',
    params: { start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 }, height: 3000, thickness: 250, sceneUnits: 'mm' },
  } as unknown as Entity;
}
function chair(): Entity {
  const params: FurnitureParams = {
    kind: 'chair', assetId: 'chair-01', position: { x: 1000, y: 1000, z: 0 }, rotationDeg: 0,
    widthMm: 2000, depthMm: 2000, heightMm: 900, mountingElevationMm: 0, sceneUnits: 'mm',
  };
  return {
    id: 'f1', type: 'furniture', kind: 'chair', params,
    geometry: computeFurnitureGeometry(params),
  } as unknown as Entity;
}
function roof(): Entity {
  return {
    id: 'r1', type: 'roof', kind: 'roof',
    params: {
      outline: { vertices: [{ x: 0, y: 0, z: 0 }, { x: 5000, y: 0, z: 0 }, { x: 5000, y: 5000, z: 0 }, { x: 0, y: 5000, z: 0 }] },
      edges: [{ definesSlope: true, slope: 30 }, { definesSlope: false, slope: 0 },
        { definesSlope: true, slope: 30 }, { definesSlope: false, slope: 0 }],
      slopeUnit: 'deg', thickness: 150, basePivotZ: 3000, sceneUnits: 'mm',
    },
    geometry: { faces: [{ outline: [{ x: 0, y: 0, z: 3000 }, { x: 5000, y: 0, z: 3000 }, { x: 2500, y: 2500, z: 3900 }] }] },
  } as unknown as Entity;
}
function scene(entities: Entity[]): SceneModel {
  return {
    entities,
    layersById: {},
    bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
    units: 'mm',
  } as unknown as SceneModel;
}

describe('assembleTekDocument', () => {
  it('both → ο τοίχος εγχέεται στον wall marker (μέτρα)', () => {
    const { xml, warnings } = assembleTekDocument(FAKE_TPL, scene([wall()]), 'both');
    expect(xml.startsWith('HEAD')).toBe(true);
    expect(xml.endsWith('TAIL')).toBe(true);
    expect(xml).toContain('<x00>5</x00>');
    expect(xml).not.toMatch(/TEK_WALL_RECORDS/); // marker καταναλώθηκε
    expect(warnings).toEqual([]);
  });

  it('dxf-only → BIM τοίχος αποκλείεται (κανένα record)', () => {
    const { xml } = assembleTekDocument(FAKE_TPL, scene([wall()]), 'dxf-only');
    expect(xml).not.toContain('<x00>');
    expect(xml).toBe('HEADTAIL');
  });

  it('both → το έπιπλο εγχέεται στον plane marker ως <plane> record (2×2m κουτί)', () => {
    const { xml } = assembleTekDocument(FAKE_TPL, scene([chair()]), 'both');
    expect(xml).toContain('<type>10</type>'); // plane record
    expect(xml).toContain('<width>0.9</width>'); // ύψος 900mm = εξώθηση
    expect(xml).not.toMatch(/TEK_PLANE_RECORDS/); // marker καταναλώθηκε
  });

  it('both → η στέγη εγχέεται στον autoroof marker ως <autoroof> record (type 8)', () => {
    const { xml } = assembleTekDocument(FAKE_TPL, scene([roof()]), 'both');
    expect(xml).toContain('<type>8</type>');       // autoroof record
    expect(xml).toContain('<elevation>3</elevation>'); // basePivotZ 3000mm → 3m
    expect(xml).toContain('<onev3list>');           // computed «νερό»
    expect(xml).not.toMatch(/TEK_AUTOROOF_RECORDS/); // marker καταναλώθηκε
    expect(xml).not.toContain('<type>10</type>');   // στέγη ΟΧΙ ως plane
  });
});
