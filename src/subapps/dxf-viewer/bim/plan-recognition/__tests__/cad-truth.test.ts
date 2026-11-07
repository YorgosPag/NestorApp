/**
 * ADR-929 §6.9 — αλήθεια από το CAD: παρειές τοίχου Τέκτονα κομμένες στα ανοίγματα, γραμμή διάστασης DXF από τα
 * `defPoints`, ρόλος τοίχου μόνο από δηλωμένη στρώση.
 */

import { describe, it, expect } from '@jest/globals';
import { tekWallFaces } from '../testing/cad-truth/tek-truth';
import { dxfDimensionTruth, dxfTruthFromScene } from '../testing/cad-truth/dxf-truth';
import type { TekOpeningRecord, TekWallRecord } from '../../../io/tek/tek-import-types';
import type { DimensionEntity } from '../../../types/dimension';
import type { SceneModel } from '../../../types/scene-types';

const opening = (x: number, width: number): TekOpeningRecord => ({
  matrix: { x00: width, x01: 0, x10: 0, x11: 0.3, x20: x - width / 2, x21: 0 },
  elevationM: 0, topM: 2.1, style: 0, side: 2, frameWidthM: 0, frameThicknessM: 0,
  jambWidthM: 0, jambThicknessM: 0, ledgeHeightM: 0, color: '000000',
});

const wall = (openings: readonly TekOpeningRecord[]): TekWallRecord => ({
  matrix: { x00: 5, x01: 0, x10: 0, x11: 0.3, x20: 0, x21: 0 },
  heightM: 3, elevationM: 0, innerWidthM: 0.3, color: '000000', openings,
});

describe('tekWallFaces', () => {
  it('δύο παρειές σε απόσταση το πάχος του τοίχου', () => {
    const faces = tekWallFaces(wall([]));
    expect(faces).toEqual([
      { a: { x: 0, y: 0 }, b: { x: 5, y: 0 }, role: 'wall-face' },
      { a: { x: 0, y: 0.3 }, b: { x: 5, y: 0.3 }, role: 'wall-face' },
    ]);
  });

  it('το άνοιγμα κόβει και τις δύο παρειές (εκεί η εικόνα δεν έχει γραμμή τοίχου)', () => {
    const faces = tekWallFaces(wall([opening(2, 1)]));
    expect(faces.map((f) => [f.a.x, f.b.x])).toEqual([[0, 1.5], [2.5, 5], [0, 1.5], [2.5, 5]]);
  });

  it('τοίχος μηδενικού μήκους ⇒ καμία παρειά', () => {
    expect(tekWallFaces({ ...wall([]), matrix: { x00: 0, x01: 0, x10: 0, x11: 0.3, x20: 1, x21: 1 } })).toEqual([]);
  });
});

const dim = (patch: Partial<DimensionEntity>): DimensionEntity => ({
  id: 'd', type: 'dimension', layerId: 'L', dimensionType: 'linear', styleId: 's', rotation: 0,
  defPoints: [{ x: 0, y: 0 }, { x: 4, y: 1 }, { x: 0, y: -2 }], ...patch,
} as DimensionEntity);

describe('dxfDimensionTruth', () => {
  it('linear: η γραμμή διάστασης περνά από το defPoints[2] στη διεύθυνση της στροφής', () => {
    const t = dxfDimensionTruth(dim({}) as Extract<DimensionEntity, { dimensionType: 'linear' }>);
    expect(t?.line).toEqual([{ x: 0, y: -2 }, { x: 4, y: -2 }]);
    expect(t?.measured).toEqual([{ x: 0, y: 0 }, { x: 4, y: 1 }]);
  });

  it('το «<>» σημαίνει μετρημένη τιμή, όχι κείμενο', () => {
    expect(dxfDimensionTruth(dim({ userText: '<>' }) as Extract<DimensionEntity, { dimensionType: 'linear' }>)?.text).toBe('');
  });

  it('άλλο είδος διάστασης ⇒ null (δεν μαντεύεται)', () => {
    expect(dxfDimensionTruth(dim({ dimensionType: 'radius' } as Partial<DimensionEntity>))).toBeNull();
  });
});

describe('dxfTruthFromScene', () => {
  const scene = {
    entities: [
      { id: 'a', type: 'line', layerId: 'W', start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
      { id: 'b', type: 'line', layerId: 'F', start: { x: 0, y: 1 }, end: { x: 1, y: 1 } },
      { id: 'c', type: 'circle', layerId: 'F', center: { x: 0, y: 0 }, radius: 1 },
    ],
    layersById: { W: { id: 'W', name: 'renamed', sourceName: 'TOIXOI' }, F: { id: 'F', name: 'EPIPLA' } },
  } as unknown as SceneModel;

  it('τοίχος μόνο από τη δηλωμένη στρώση (με το ΑΡΧΙΚΟ όνομα) · ό,τι δεν διαβάζεται μετριέται', () => {
    const truth = dxfTruthFromScene(scene, { isWallLayer: (n) => n === 'TOIXOI' });
    expect(truth.segments.map((s) => s.role)).toEqual(['wall-face', 'other']);
    expect(truth.skipped).toEqual({ circle: 1 });
  });
});
