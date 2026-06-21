/**
 * wall-covering core — ADR-511 Slice A (types + catalog + factory).
 *
 * Επαληθεύει τον pure πυρήνα: geometry derivation από params, total thickness,
 * kind resolution από assembly, catalog accessors, factory (kind/ifcType auto-fill).
 */

import {
  computeWallCoveringGeometry,
  totalCoveringThicknessMm,
  resolveWallCoveringKind,
  DEFAULT_WALL_COVERING_LAYERS,
  type WallCoveringLayer,
  type WallCoveringParams,
} from '../../types/wall-covering-types';
import {
  listWallCoveringMaterials,
  getWallCoveringMaterial,
  getWallCoveringColor,
  getWallCoveringDefaultThicknessMm,
  getWallCoveringDefaultFunction,
} from '../wall-covering-material-catalog';
import { createWallCovering } from '@/services/factories/wall-covering.factory';

const layers = (...ls: WallCoveringLayer[]): WallCoveringLayer[] => ls;
const plaster: WallCoveringLayer = { materialId: 'plaster-traditional', thicknessMm: 20, function: 'body' };
const paint: WallCoveringLayer = { materialId: 'paint-red', thicknessMm: 0, function: 'surface', colorOverride: '#C0392B' };
const tile: WallCoveringLayer = { materialId: 'tile-ceramic', thicknessMm: 8, function: 'body' };
const adhesive: WallCoveringLayer = { materialId: 'adhesive-mortar', thicknessMm: 4, function: 'adhesive' };

const baseParams = (extra: Partial<WallCoveringParams> = {}): WallCoveringParams => ({
  hostWallId: 'wall-1',
  faceSide: 'inner',
  spanStartMm: 1000,
  spanEndMm: 4000,       // length 3000mm = 3m
  heightBottomMm: 0,
  heightTopMm: 2700,     // height 2.7m
  layers: layers(plaster, paint),
  ...extra,
});

describe('computeWallCoveringGeometry — params-only derivation', () => {
  it('length/height/area από span + height', () => {
    const g = computeWallCoveringGeometry(baseParams());
    expect(g.lengthM).toBeCloseTo(3);
    expect(g.heightM).toBeCloseTo(2.7);
    expect(g.areaM2).toBeCloseTo(8.1); // 3 × 2.7
  });

  it('totalThicknessMm = άθροισμα στρώσεων (paint 0 + plaster 20)', () => {
    const g = computeWallCoveringGeometry(baseParams());
    expect(g.totalThicknessMm).toBe(20);
  });

  it('clamp σε 0 όταν span/height αντεστραμμένα', () => {
    const g = computeWallCoveringGeometry(baseParams({ spanEndMm: 500, heightTopMm: -10 }));
    expect(g.lengthM).toBe(0);
    expect(g.heightM).toBe(0);
    expect(g.areaM2).toBe(0);
  });
});

describe('totalCoveringThicknessMm', () => {
  it('αθροίζει + αγνοεί αρνητικά', () => {
    expect(totalCoveringThicknessMm(layers(plaster, tile, adhesive))).toBe(32);
    expect(totalCoveringThicknessMm(layers({ materialId: 'paint-white', thicknessMm: -5, function: 'surface' }))).toBe(0);
  });
});

describe('resolveWallCoveringKind — βαρύτερο υλικό ορίζει κατηγορία', () => {
  it('tiles > knauf > plaster > paint', () => {
    expect(resolveWallCoveringKind(layers(adhesive, tile))).toBe('tiles');
    expect(resolveWallCoveringKind(layers({ materialId: 'knauf-gypsum-board', thicknessMm: 12.5, function: 'body' }, paint))).toBe('knauf');
    expect(resolveWallCoveringKind(layers(plaster, paint))).toBe('plaster');
    expect(resolveWallCoveringKind(layers(paint))).toBe('paint');
    expect(resolveWallCoveringKind([])).toBe('mixed');
  });
});

describe('material catalog', () => {
  it('8 υλικά, μοναδικά ids', () => {
    const all = listWallCoveringMaterials();
    expect(all).toHaveLength(8);
    expect(new Set(all.map((m) => m.id)).size).toBe(8);
  });

  it('accessors επιστρέφουν catalog values', () => {
    expect(getWallCoveringMaterial('tile-ceramic')?.hatch).toBe('tile');
    expect(getWallCoveringColor('paint-red')).toBe('#C0392B');
    expect(getWallCoveringDefaultThicknessMm('plaster-traditional')).toBe(20);
    expect(getWallCoveringDefaultThicknessMm('paint-white')).toBe(0);
    expect(getWallCoveringDefaultFunction('adhesive-mortar')).toBe('adhesive');
  });

  it('default assembly = σοβάς + λευκή μπογιά', () => {
    expect(DEFAULT_WALL_COVERING_LAYERS.map((l) => l.materialId)).toEqual([
      'plaster-traditional', 'paint-white',
    ]);
  });
});

describe('createWallCovering factory', () => {
  it('auto-fill kind (derived) + ifcType IfcCovering + id', () => {
    const params = baseParams({ layers: layers(adhesive, tile) });
    const geometry = computeWallCoveringGeometry(params);
    const e = createWallCovering({ params, geometry, layerId: 'lyr_x', visible: true });
    expect(e.type).toBe('wall-covering');
    expect(e.ifcType).toBe('IfcCovering');
    expect(e.kind).toBe('tiles');
    expect(e.id).toMatch(/^wcv/);
    expect(e.ifcGuid).toMatch(/^[0-9A-Za-z_$]{22}$/);
    expect(e.params.hostWallId).toBe('wall-1');
  });

  it('test-only id override', () => {
    const params = baseParams();
    const e = createWallCovering({ params, geometry: computeWallCoveringGeometry(params), layerId: 'l', id: 'wcv_test', ifcGuid: 'A'.repeat(22) });
    expect(e.id).toBe('wcv_test');
  });
});
