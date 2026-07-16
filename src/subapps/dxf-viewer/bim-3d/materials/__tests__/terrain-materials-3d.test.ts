/**
 * ADR-665 — terrain material EXCLUSIVITY (the Π1 regression suite).
 *
 * three.js clipping is PER-MATERIAL. The terrain carries its own level cut (a clip plane at the
 * active storey's FFL) while the BUILDING must stay whole. That requirement holds ONLY as long as
 * the terrain never shares a material instance with a BIM mesh.
 *
 * Before ADR-665 it DID: `getTerrainMaterial3D('shaded')` went through the shared `withFaceMode`,
 * which returns app-wide singletons for faceMode `'none'`/`'hidden-line'` — the very same objects
 * every wall/column holds. Writing the terrain's clip plane there would have cut the whole
 * building. These tests are the executable statement of «το κτίριο μένει ακέραιο».
 */

import * as THREE from 'three';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { getElementMaterial3D, getMaterial3D } from '../MaterialCatalog3D';
import { getInvisibleFaceMaterial, getHiddenLineFaceMaterial } from '../face-mode-materials';
import { getTerrainMaterial3D, getTopoContourMaterial3D } from '../terrain-materials-3d';

jest.mock('../../../services/bim-render-settings.service', () => ({
  saveBimRenderSettings: jest.fn().mockResolvedValue(undefined),
}));

type VisualStylePreset = Parameters<
  ReturnType<typeof useBimRenderSettingsStore.getState>['setVisualStyle']
>[0];

function setStyle(preset: VisualStylePreset): void {
  useBimRenderSettingsStore.getState().setVisualStyle(preset);
}

/** Every FACES-axis mode, by the preset that selects it. */
const PRESETS: readonly VisualStylePreset[] = [
  'wireframe',      // faceMode 'none'        — was a SHARED singleton
  'hidden-line',    // faceMode 'hidden-line' — was a SHARED singleton
  'consistent',     // faceMode 'consistent'  — clone keyed by base uuid (already exclusive)
  'shaded',         // faceMode 'shaded'      — pass-through
  'realistic',      // faceMode 'realistic'   — pass-through
];

afterAll(() => { setStyle('realistic-edges'); });

describe('ADR-665 — the terrain never shares a material with a BIM mesh', () => {
  it.each(PRESETS)('faceMode via preset %s → terrain material is not the BIM material', (preset) => {
    setStyle(preset);
    const terrain = getTerrainMaterial3D('shaded');
    expect(terrain).not.toBe(getElementMaterial3D('column'));
    expect(terrain).not.toBe(getMaterial3D('mat-concrete'));
  });

  it('faceMode none → terrain does NOT get the shared invisible singleton', () => {
    setStyle('wireframe');
    expect(getTerrainMaterial3D('shaded')).not.toBe(getInvisibleFaceMaterial());
  });

  it('faceMode hidden-line → terrain does NOT get the shared hidden-line singleton', () => {
    setStyle('hidden-line');
    expect(getTerrainMaterial3D('shaded')).not.toBe(getHiddenLineFaceMaterial());
  });
});

describe('ADR-665 — writing clip planes on the terrain leaves the building whole', () => {
  // The load-bearing assertion of this ADR, exercised in the two modes that used to leak.
  it.each(['wireframe', 'hidden-line'] as const)(
    'preset %s → a clip plane on the terrain does not reach BIM materials',
    (preset) => {
      setStyle(preset);
      const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 3);
      const terrain = getTerrainMaterial3D('shaded');
      const column = getElementMaterial3D('column');
      const concrete = getMaterial3D('mat-concrete');

      (terrain as THREE.Material & { clippingPlanes: THREE.Plane[] | null }).clippingPlanes = [plane];

      expect(column.clippingPlanes).toBeNull();
      expect(concrete.clippingPlanes).toBeNull();

      (terrain as THREE.Material & { clippingPlanes: THREE.Plane[] | null }).clippingPlanes = null;
    },
  );

  it('a clip plane on a contour line does not reach BIM materials', () => {
    setStyle('shaded');
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 3);
    const contour = getTopoContourMaterial3D(true);
    contour.clippingPlanes = [plane];

    expect(getElementMaterial3D('column').clippingPlanes).toBeNull();
    contour.clippingPlanes = null;
  });
});

describe('ADR-665 — zero visual change (parameter parity with the BIM singletons)', () => {
  it('faceMode none → terrain clone matches the shared singleton on every read parameter', () => {
    setStyle('wireframe');
    const terrain = getTerrainMaterial3D('shaded');
    const shared = getInvisibleFaceMaterial();
    expect(terrain.visible).toBe(shared.visible);
  });

  it('faceMode hidden-line → terrain clone matches the shared singleton on every read parameter', () => {
    setStyle('hidden-line');
    const terrain = getTerrainMaterial3D('shaded') as THREE.MeshStandardMaterial;
    const shared = getHiddenLineFaceMaterial();
    expect(terrain.color.getHex()).toBe(shared.color.getHex());
    expect(terrain.emissive.getHex()).toBe(shared.emissive.getHex());
    expect(terrain.emissiveIntensity).toBe(shared.emissiveIntensity);
    expect(terrain.side).toBe(shared.side);
    expect(terrain.polygonOffset).toBe(shared.polygonOffset);
    expect(terrain.polygonOffsetFactor).toBe(shared.polygonOffsetFactor);
    expect(terrain.polygonOffsetUnits).toBe(shared.polygonOffsetUnits);
  });
});

describe('ADR-665 — cache stability (no per-frame allocation)', () => {
  it.each(PRESETS)('preset %s → two calls return the same terrain instance', (preset) => {
    setStyle(preset);
    expect(getTerrainMaterial3D('shaded')).toBe(getTerrainMaterial3D('shaded'));
  });

  it('the shaded terrain base is DoubleSide — a TIN is an open surface (M10c/ADR-665 hollow cut)', () => {
    setStyle('shaded');
    expect((getTerrainMaterial3D('shaded') as THREE.MeshStandardMaterial).side).toBe(THREE.DoubleSide);
  });

  it('analysis styles stay unlit, double-sided and exclusive', () => {
    setStyle('shaded');
    const hypso = getTerrainMaterial3D('hypsometric');
    expect(hypso).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(hypso.side).toBe(THREE.DoubleSide);
    expect(hypso).not.toBe(getTerrainMaterial3D('cutfill'));
    expect(hypso).toBe(getTerrainMaterial3D('hypsometric'));
  });
});
