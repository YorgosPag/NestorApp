/**
 * ADR-920 §14.5 — η σκηνή ανεβάζει τα buffers του Β6.4 όπως είναι, με τα σωστά υλικά, και κάθε πόρος έχει κάτοχο.
 * Χωρίς renderer: τα αντικείμενα του three χτίζονται και σε jsdom.
 */

import { buildTerrain3dGeometry, type Terrain3dGeometry } from '@/lib/terrain/publication/terrain-3d-geometry';
import { REAL_PLANE, squareSnapshot } from '@/lib/terrain/publication/__tests__/fixtures/terrain-3d-fixtures';
import type { ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';

import { createTerrain3dScene } from '../terrain-3d-scene';

function geometryOf(snapshot: ListingTerrainSnapshot, exaggeration: 1 | 2 | 3 = 1): Terrain3dGeometry {
  const built = buildTerrain3dGeometry(snapshot, { verticalExaggeration: exaggeration });
  if (!built.ok) throw new Error('fixture geometry did not build');
  return built.geometry;
}

describe('createTerrain3dScene', () => {
  it('επιφάνεια με χρώμα ανά κορυφή + επίπεδη σκίαση, χώμα, ισοϋψείς — όλα από τα ίδια buffers', () => {
    const geometry = geometryOf(REAL_PLANE());
    const { objects, scene } = createTerrain3dScene(geometry);
    expect(objects.surface.geometry.getAttribute('position').array).toBe(geometry.surface.positions);
    expect(objects.surface.geometry.getAttribute('color').array).toBe(geometry.surface.colors);
    expect(objects.surface.material.vertexColors).toBe(true);
    expect(objects.surface.material.flatShading).toBe(true);
    expect(objects.soil.geometry.getIndex()!.array).toBe(geometry.soil.indices);
    expect(objects.major.visible).toBe(geometry.contours.major.length > 0);
    expect(scene.children).toEqual(expect.arrayContaining([objects.surface, objects.soil, objects.major, objects.minor]));
  });

  it('τα στερεά υποχωρούν στο βάθος (polygonOffset) ώστε η ισοϋψής να κερδίζει', () => {
    const { objects } = createTerrain3dScene(geometryOf(REAL_PLANE()));
    for (const solid of [objects.surface, objects.soil]) {
      expect(solid.material.polygonOffset).toBe(true);
      expect(solid.material.polygonOffsetFactor).toBeGreaterThan(0);
    }
  });

  it('replace: νέα buffers, ΤΑ ΠΑΛΙΑ ΑΠΕΛΕΥΘΕΡΩΝΟΝΤΑΙ, τα υλικά μένουν', () => {
    const terrain = createTerrain3dScene(geometryOf(REAL_PLANE(), 1));
    const old = [terrain.objects.surface, terrain.objects.soil, terrain.objects.major, terrain.objects.minor].map((o) => {
      const spy = jest.spyOn(o.geometry, 'dispose');
      return { object: o, geometry: o.geometry, material: o.material, spy };
    });
    const next = geometryOf(REAL_PLANE(), 3);
    terrain.replace(next);
    for (const { object, geometry, material, spy } of old) {
      expect(spy).toHaveBeenCalledTimes(1);
      expect(object.geometry).not.toBe(geometry);
      expect(object.material).toBe(material);
    }
    expect(terrain.objects.surface.geometry.getAttribute('position').array).toBe(next.surface.positions);
  });

  it('χωρίς δευτερεύουσες ισοϋψείς ⇒ η γραμμή κρύβεται (κανένα κενό instanced draw)', () => {
    const geometry = geometryOf(squareSnapshot());
    const { objects } = createTerrain3dScene(geometry);
    expect(objects.minor.visible).toBe(geometry.contours.minor.length > 0);
  });

  it('dispose: κάθε γεωμετρία και κάθε υλικό', () => {
    const terrain = createTerrain3dScene(geometryOf(REAL_PLANE()));
    const spies = [terrain.objects.surface, terrain.objects.soil, terrain.objects.major, terrain.objects.minor].flatMap((o) => [
      jest.spyOn(o.geometry, 'dispose'),
      jest.spyOn(o.material, 'dispose'),
    ]);
    terrain.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  });

  it('setLineResolution: το πάχος μετρά σε CSS px του καμβά', () => {
    const terrain = createTerrain3dScene(geometryOf(REAL_PLANE()));
    terrain.setLineResolution(390, 292);
    expect(terrain.objects.major.material.resolution.toArray()).toEqual([390, 292]);
    expect(terrain.objects.minor.material.resolution.toArray()).toEqual([390, 292]);
  });
});

describe('createTerrain3dScene — περίγραμμα οικοπέδου (ADR-920 §14.11 Ζ5)', () => {
  const OUTLINED: ListingTerrainSnapshot = {
    ...REAL_PLANE(), plotOutline: { ring: [-5, -5, 5, -5, 5, 5, -5, 5], areaM2: 100, coverage: 'covered', coveredFraction: 1 },
  };

  it('χωρίς περίγραμμα ⇒ η γραμμή είναι στη σκηνή αλλά κρυφή', () => {
    const { objects, scene } = createTerrain3dScene(geometryOf(REAL_PLANE()));
    expect(scene.children).toContain(objects.plotOutline);
    expect(objects.plotOutline.visible).toBe(false);
  });

  it('με περίγραμμα ⇒ ορατή, διακεκομμένη (ποτέ μόνο χρώμα), με παύλες στο μέγεθος της σκηνής', () => {
    const { objects } = createTerrain3dScene(geometryOf(OUTLINED));
    expect(objects.plotOutline.visible).toBe(true);
    expect(objects.plotOutline.material.dashed).toBe(true);
    expect(objects.plotOutline.material.dashSize).toBeCloseTo(20 / 40, 6);
    expect(objects.plotOutline.material.gapSize).toBeCloseTo(20 / 100, 6);
  });

  it('replace σε στιγμιότυπο χωρίς περίγραμμα ⇒ κρύβεται ξανά', () => {
    const terrain = createTerrain3dScene(geometryOf(OUTLINED));
    terrain.replace(geometryOf(REAL_PLANE()));
    expect(terrain.objects.plotOutline.visible).toBe(false);
  });
});
