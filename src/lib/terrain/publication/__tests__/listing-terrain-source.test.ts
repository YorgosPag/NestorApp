/**
 * ADR-920 Β3 — the survey source the door accepts: strict shape, one canonical form, the snapshot
 * builder's input in the same frame.
 *
 * Fixture: real ΕΓΣΑ'87 magnitudes in canonical mm (E 400 km, N 4 200 km), elevation 120 m.
 */

import {
  LISTING_TERRAIN_SOURCE_VERSION,
  encodeListingTerrainSource,
  parseListingTerrainSource,
  toListingTerrainInput,
} from '../listing-terrain-source';
import { buildListingTerrainSnapshot } from '../listing-terrain-snapshot';
import { LISTING_TERRAIN_SOURCE_MAX_ABS_MM } from '../listing-terrain-config';

const E0 = 400_000_000;
const N0 = 4_200_000_000;

function rawSource(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: LISTING_TERRAIN_SOURCE_VERSION,
    points: [
      [E0, N0, 120_000],
      [E0 + 20_000, N0, 122_000],
      [E0 + 20_000, N0 + 20_000, 122_000],
      [E0, N0 + 20_000, 120_000],
      [E0 + 10_000, N0 + 10_000],
    ],
    breaklines: [],
    boundary: null,
    envelope: null,
    ...overrides,
  };
}

describe('ADR-920 Β3 — parseListingTerrainSource', () => {
  it('accepts a survey and keeps a point without elevation WITHOUT z (ADR-720)', () => {
    const source = parseListingTerrainSource(rawSource());
    expect(source).not.toBeNull();
    expect(source?.points[4]).toStrictEqual([E0 + 10_000, N0 + 10_000]);
    expect(toListingTerrainInput(source!).points[4]).toStrictEqual({ x: E0 + 10_000, y: N0 + 10_000 });
  });

  it.each([
    ['unknown version', { version: 2 }],
    ['no points', { points: [] }],
    ['a point with four numbers', { points: [[1, 2, 3, 4]] }],
    ['a non-number coordinate', { points: [[E0, 'north', 1]] }],
    ['a coordinate past the Earth', { points: [[LISTING_TERRAIN_SOURCE_MAX_ABS_MM * 2, N0, 1]] }],
    ['a boundary of two vertices', { boundary: [[E0, N0], [E0 + 1, N0]] }],
    ['a zero declared height', { envelope: { footprint: [[0, 0], [1, 0], [1, 1]], maxHeightM: 0 } }],
    ['a breakline of one vertex', { breaklines: [{ closed: false, vertices: [[E0, N0, 1]] }] }],
  ])('refuses %s — never a default', (_label, overrides) => {
    expect(parseListingTerrainSource(rawSource(overrides))).toBeNull();
  });

  it('refuses anything that is not an object', () => {
    expect(parseListingTerrainSource(null)).toBeNull();
    expect(parseListingTerrainSource('{"version":1}')).toBeNull();
  });
});

describe('ADR-920 Β3 — one canonical form', () => {
  it('rounds to whole millimetres and folds -0', () => {
    const source = parseListingTerrainSource(rawSource({ points: [[E0 + 0.4, N0 - 0.6, -0.2]] }));
    expect(source?.points[0]).toStrictEqual([E0, N0 - 1, 0]);
    expect(Object.is(source?.points[0][2], -0)).toBe(false);
  });

  it('drops fields nobody validated and writes keys in one order', () => {
    const shuffled = { envelope: null, boundary: null, smuggled: 'x', breaklines: [], points: rawSource().points, version: 1 };
    const a = encodeListingTerrainSource(parseListingTerrainSource(shuffled)!);
    const b = encodeListingTerrainSource(parseListingTerrainSource(rawSource())!);
    expect(a).toBe(b);
    expect(a).not.toContain('smuggled');
    expect(Object.keys(JSON.parse(a))).toStrictEqual(['version', 'points', 'breaklines', 'boundary', 'envelope']);
  });

  it('re-parses its own encoding to the same value', () => {
    const source = parseListingTerrainSource(rawSource())!;
    expect(parseListingTerrainSource(JSON.parse(encodeListingTerrainSource(source)))).toStrictEqual(source);
  });
});

describe('ADR-920 Β3 — feeds the snapshot builder in the same frame', () => {
  it('a valid source builds a snapshot; the envelope height arrives in centimetres', () => {
    const footprint = [[E0 + 5_000, N0 + 5_000], [E0 + 15_000, N0 + 5_000], [E0 + 15_000, N0 + 15_000], [E0 + 5_000, N0 + 15_000]];
    const source = parseListingTerrainSource(rawSource({ envelope: { footprint, maxHeightM: 7.504 } }))!;
    const input = toListingTerrainInput(source);
    expect(input.envelope?.maxHeightM).toBe(7.5);

    const built = buildListingTerrainSnapshot(input);
    expect(built.ok).toBe(true);
  });

  it('breaklines get positional ids and keep their vertices', () => {
    const source = parseListingTerrainSource(rawSource({
      breaklines: [{ closed: false, vertices: [[E0, N0, 120_000], [E0 + 20_000, N0 + 20_000, 122_000]] }],
    }))!;
    const [line] = toListingTerrainInput(source).breaklines ?? [];
    expect(line).toStrictEqual({
      id: 'breakline-0',
      closed: false,
      vertices: [{ x: E0, y: N0, z: 120_000 }, { x: E0 + 20_000, y: N0 + 20_000, z: 122_000 }],
    });
  });
});
