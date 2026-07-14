/**
 * ADR-650 M4 — `tinToBufferGeometry` ground truth.
 *
 * The test does NOT re-implement the transform (that would only prove the code equals itself).
 * It fixes a TIN on a KNOWN inclined plane (`elev = 0.5 · localX`, at an ΕΓΣΑ'87-magnitude
 * origin), then reads each built vertex back out of the buffer — world metres → plan mm → local
 * mm — and asserts it still satisfies the plane equation. Any error in the LOCAL→WORLD offset,
 * the mm→m scale or the Y-up axis swap breaks that equality.
 */

import { tinToBufferGeometry } from '../tin-to-three';
import { makeWorldToDisplayProjector } from '../../../systems/geo-referencing/geo-transform';
import type { TinSurface } from '../../../systems/topography/topo-types';

const ORIGIN = { x: 500_000, y: 4_200_000 } as const; // ΕΓΣΑ'87 magnitudes (~1e5..1e6 mm)
const SLOPE = 0.5; // elevation rises 0.5 mm per mm of local X
const M_TO_MM = 1000;

/** Unit square (1 m × 1 m, local mm) on the plane `elev = SLOPE · localX`, split into 2 triangles. */
function inclinedPlaneTin(overrides: Partial<TinSurface> = {}): TinSurface {
  const positions = [
    [0, 0],
    [1000, 0],
    [1000, 1000],
    [0, 1000],
  ] as ReadonlyArray<readonly [number, number]>;
  const elevations = positions.map(([lx]) => SLOPE * lx);

  return {
    positions,
    elevations,
    triangles: [
      [0, 1, 2],
      [0, 2, 3],
    ],
    origin: ORIGIN,
    bounds: {
      minX: 0, maxX: 1000, minY: 0, maxY: 1000,
      minZ: Math.min(...elevations), maxZ: Math.max(...elevations),
    },
    flatTriangleCount: 0,
    ...overrides,
  };
}

describe('tinToBufferGeometry', () => {
  it('places every vertex back on the source plane (LOCAL→WORLD, mm→m, Y-up swap)', () => {
    const geo = tinToBufferGeometry(inclinedPlaneTin(), 'shaded');
    expect(geo).not.toBeNull();

    const pos = geo!.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      // three world (m, Y-up) → plan mm → local mm — the inverse of what the converter did.
      const localXMm = pos.getX(i) * M_TO_MM - ORIGIN.x;
      const localYMm = -pos.getZ(i) * M_TO_MM - ORIGIN.y;
      const elevMm = pos.getY(i) * M_TO_MM;

      expect(elevMm).toBeCloseTo(SLOPE * localXMm, 6); // ← the plane equation still holds
      expect(localXMm).toBeGreaterThanOrEqual(-1e-6);
      expect(localYMm).toBeGreaterThanOrEqual(-1e-6);
    }
  });

  it('emits one faceted triangle per TIN triangle (3 own vertices each)', () => {
    const tin = inclinedPlaneTin();
    const geo = tinToBufferGeometry(tin, 'shaded');

    expect(geo!.getIndex()).toBeNull(); // non-indexed → flat per-facet normals
    expect(geo!.getAttribute('position').count).toBe(tin.triangles.length * 3);
    expect(geo!.getAttribute('normal').count).toBe(tin.triangles.length * 3);
  });

  it('returns null for an empty surface — no geometry, no NaN bounds (ADR-537)', () => {
    const empty = inclinedPlaneTin({ triangles: [] });
    expect(tinToBufferGeometry(empty, 'shaded')).toBeNull();
  });

  it('refuses to build a surface carrying a non-finite coordinate (would blank the scene)', () => {
    const poisoned = inclinedPlaneTin({ elevations: [0, NaN, 500, 0] });
    expect(tinToBufferGeometry(poisoned, 'shaded')).toBeNull();
  });

  it('ADR-650 M10b — a geo-ref projector seats the surface in the building-DISPLAY frame (near the origin, not at ΕΓΣΑ)', () => {
    // A translation-only projector whose originWorld == the TIN origin makes DISPLAY == TIN-local, so
    // every vertex must land at small (0..1000 mm) coords near 0 — proof the hill left the ~1e6 ΕΓΣΑ
    // world and now sits under the building. The plane equation (elev = SLOPE·localX) must still hold.
    const projector = makeWorldToDisplayProjector({ originWorld: { x: ORIGIN.x, y: ORIGIN.y }, rotationDeg: 0 });
    const geo = tinToBufferGeometry(inclinedPlaneTin(), 'shaded', { projector });
    expect(geo).not.toBeNull();

    const pos = geo!.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      // three world (m, Y-up) → DISPLAY mm (== TIN-local here). No ORIGIN offset — that is the point.
      const displayXMm = pos.getX(i) * M_TO_MM;
      const displayYMm = -pos.getZ(i) * M_TO_MM;
      const elevMm = pos.getY(i) * M_TO_MM;

      expect(elevMm).toBeCloseTo(SLOPE * displayXMm, 6); // plane still holds in the display frame
      expect(Math.abs(displayXMm)).toBeLessThanOrEqual(1000 + 1e-6); // NOT at ΕΓΣΑ magnitude anymore
      expect(Math.abs(displayYMm)).toBeLessThanOrEqual(1000 + 1e-6);
    }
  });

  it('bakes per-vertex colours only for the hypsometric style', () => {
    const tin = inclinedPlaneTin();

    expect(tinToBufferGeometry(tin, 'shaded')!.getAttribute('color')).toBeUndefined();

    const banded = tinToBufferGeometry(tin, 'hypsometric')!;
    const color = banded.getAttribute('color');
    expect(color.count).toBe(tin.triangles.length * 3);
    // Ramp is normalised over the surface's own range → the low and high ends must differ.
    const channels = Array.from({ length: color.count }, (_, i) => color.getX(i));
    expect(Math.max(...channels)).toBeGreaterThan(Math.min(...channels));
  });
});
