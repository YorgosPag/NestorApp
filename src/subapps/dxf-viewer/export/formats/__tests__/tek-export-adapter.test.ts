/**
 * ADR-507/508 — `tek-export-adapter` pure path (assembleTekDocument).
 *
 * Επαληθεύει: scope filter (BIM-only walls στο 'both', αποκλεισμός στο 'dxf-only')·
 * injection στους markers του (fake) template. Το βαρύ skeleton asset ΔΕΝ φορτώνεται
 * (περνά fake template).
 */

import { assembleTekDocument } from '../tek-export-adapter';
import type { Entity } from '../../../types/entities';
import type { SceneModel } from '../../../types/scene-types';

const FAKE_TPL = 'HEAD<!--TEK_WALL_RECORDS--><!--TEK_OBJECT_RECORDS-->TAIL';

function wall(): Entity {
  return {
    id: 'w1', type: 'wall', kind: 'straight',
    params: { start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 }, height: 3000, thickness: 250, sceneUnits: 'mm' },
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
});
