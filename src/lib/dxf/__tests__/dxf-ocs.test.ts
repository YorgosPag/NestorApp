/**
 * DXF OCS → WCS (arbitrary axis algorithm) — ground truth with numbers, not shapes.
 * The (0,0,−1) case is the one that matters in practice: mirrored AutoCAD entities, where reading the raw elevation
 * would give the WRONG SIGN silently.
 */

import {
  DXF_DEFAULT_EXTRUSION,
  dxfOcsToWcs,
  dxfRealOr,
  isDefaultDxfExtrusion,
  readDxfExtrusion,
} from '../dxf-ocs';

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 12);

describe('readDxfExtrusion', () => {
  it('absent 210/220/230 ⇒ the default (0,0,1)', () => {
    expect(readDxfExtrusion({})).toEqual(DXF_DEFAULT_EXTRUSION);
  });

  it('normalizes a non-unit vector', () => {
    const n = readDxfExtrusion({ '210': '0', '220': '0', '230': '-5' });
    expect(n).toEqual({ x: 0, y: 0, z: -1 });
  });

  it('a zero-length / garbage vector falls back to the default, never an invented axis', () => {
    expect(readDxfExtrusion({ '210': '0', '220': '0', '230': '0' })).toEqual(DXF_DEFAULT_EXTRUSION);
    expect(readDxfExtrusion({ '230': 'abc' })).toEqual(DXF_DEFAULT_EXTRUSION);
  });
});

describe('dxfRealOr', () => {
  it('reads exponents exactly (ezdxf writes 1.5E+02)', () => {
    expect(dxfRealOr('1.5E+02', 0)).toBe(150);
  });
  it('absent / empty / non-finite ⇒ fallback', () => {
    expect(dxfRealOr(undefined, 7)).toBe(7);
    expect(dxfRealOr('', 7)).toBe(7);
    expect(dxfRealOr('x', 7)).toBe(7);
  });
});

describe('dxfOcsToWcs', () => {
  it('default extrusion is the identity', () => {
    const p = { x: 3, y: 4, z: 5 };
    expect(isDefaultDxfExtrusion(DXF_DEFAULT_EXTRUSION)).toBe(true);
    expect(dxfOcsToWcs(p, DXF_DEFAULT_EXTRUSION)).toBe(p);
  });

  it('(0,0,−1): X and Z flip sign, Y stays — the mirrored-entity case', () => {
    const w = dxfOcsToWcs({ x: 3, y: 4, z: 5 }, { x: 0, y: 0, z: -1 });
    close(w.x, -3);
    close(w.y, 4);
    close(w.z, -5);
  });

  it('(1,0,0) — a vertical plane facing +X: OCS x→WCS +Y, OCS y→WCS +Z, elevation→WCS +X', () => {
    const w = dxfOcsToWcs({ x: 1, y: 2, z: 3 }, { x: 1, y: 0, z: 0 });
    close(w.x, 3);
    close(w.y, 1);
    close(w.z, 2);
  });

  it('a tilted normal: the OCS Z axis maps onto the normal, lengths and right angles are preserved', () => {
    const n = { x: 0.3, y: -0.4, z: Math.sqrt(1 - 0.25) };
    const ax = dxfOcsToWcs({ x: 1, y: 0, z: 0 }, n);
    const ay = dxfOcsToWcs({ x: 0, y: 1, z: 0 }, n);
    const az = dxfOcsToWcs({ x: 0, y: 0, z: 1 }, n);
    const dot = (a: typeof ax, b: typeof ax) => a.x * b.x + a.y * b.y + a.z * b.z;
    close(az.x, n.x);
    close(az.y, n.y);
    close(az.z, n.z);
    close(dot(ax, ay), 0);
    close(dot(ax, az), 0);
    close(dot(ax, ax), 1);
    // ax × ay = az (right-handed — the arbitrary axis algorithm never yields a left-handed system)
    close(ax.y * ay.z - ax.z * ay.y, az.x);
    close(ax.z * ay.x - ax.x * ay.z, az.y);
    close(ax.x * ay.y - ax.y * ay.x, az.z);
  });
});
