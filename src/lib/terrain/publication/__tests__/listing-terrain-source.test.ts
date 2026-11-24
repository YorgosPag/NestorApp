/**
 * ADR-920 Β3 — the survey source the door accepts: strict shape, one canonical form, the snapshot
 * builder's input in the same frame.
 *
 * Fixture: real ΕΓΣΑ'87 magnitudes in canonical mm (E 400 km, N 4 200 km), elevation 120 m.
 */

import { GREEK_GRID_CRS } from '@/lib/geo/greek-grid';

import {
  LISTING_TERRAIN_SOURCE_VERSION,
  NO_TERRAIN_GEOREFERENCE_CHOICE,
  TERRAIN_COORDINATE_SYSTEMS,
  encodeListingTerrainSource,
  parseListingTerrainSource,
  plotOutlineChoiceIn,
  toListingTerrainInput,
  withCoordinateSystem,
  withGeoreferenceChoice,
  withLocationConsent,
  withPlotOutline,
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
    plotOutline: null,
    coordinateSystem: null,
    showLocationInListing: false,
    ...overrides,
  };
}

/** The same survey as an OLDER version wrote it: without the fields that version did not have. */
function legacySource(version: 1 | 2): Record<string, unknown> {
  const raw = rawSource({ version });
  delete raw.coordinateSystem;
  delete raw.showLocationInListing;
  if (version === 1) delete raw.plotOutline;
  return raw;
}

describe('ADR-920 Β3 — parseListingTerrainSource', () => {
  it('accepts a survey and keeps a point without elevation WITHOUT z (ADR-720)', () => {
    const source = parseListingTerrainSource(rawSource());
    expect(source).not.toBeNull();
    expect(source?.points[4]).toStrictEqual([E0 + 10_000, N0 + 10_000]);
    expect(toListingTerrainInput(source!, 'owner').points[4]).toStrictEqual({ x: E0 + 10_000, y: N0 + 10_000 });
  });

  it.each([
    ['unknown version', { version: 4 }],
    ['a current source without the plotOutline field', { plotOutline: undefined }],
    ['a current source without the coordinateSystem field', { coordinateSystem: undefined }],
    ['a current source without the location consent', { showLocationInListing: undefined }],
    ['a coordinate system nobody can declare', { coordinateSystem: 'EPSG:4326' }],
    ['a location consent that is not a yes or a no', { showLocationInListing: 'yes' }],
    ['a plot outline of two vertices', { plotOutline: { ring: [[E0, N0], [E0 + 1, N0]], showInListing: true } }],
    ['a plot outline without the public choice', { plotOutline: { ring: [[E0, N0], [E0 + 1, N0], [E0, N0 + 1]] } }],
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
    expect(Object.keys(JSON.parse(a))).toStrictEqual([
      'version', 'points', 'breaklines', 'boundary', 'envelope', 'plotOutline', 'coordinateSystem', 'showLocationInListing',
    ]);
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
    const input = toListingTerrainInput(source, 'owner');
    expect(input.envelope?.maxHeightM).toBe(7.5);

    const built = buildListingTerrainSnapshot(input);
    expect(built.ok).toBe(true);
  });

  it('breaklines get positional ids and keep their vertices', () => {
    const source = parseListingTerrainSource(rawSource({
      breaklines: [{ closed: false, vertices: [[E0, N0, 120_000], [E0 + 20_000, N0 + 20_000, 122_000]] }],
    }))!;
    const [line] = toListingTerrainInput(source, 'owner').breaklines ?? [];
    expect(line).toStrictEqual({
      id: 'breakline-0',
      closed: false,
      vertices: [{ x: E0, y: N0, z: 120_000 }, { x: E0 + 20_000, y: N0 + 20_000, z: 122_000 }],
    });
  });
});

describe('ADR-920 §14.11 Ζ2 — the plot outline in the source', () => {
  const RING = [
    { x: E0 + 2_000.4, y: N0 + 2_000 },
    { x: E0 + 18_000, y: N0 + 2_000 },
    { x: E0 + 18_000, y: N0 + 18_000 },
    { x: E0 + 2_000, y: N0 + 18_000 },
  ];

  it('a v1 source is read as the current one WITHOUT an outline, and is stored as the current version', () => {
    const source = parseListingTerrainSource(legacySource(1))!;
    expect(source.version).toBe(LISTING_TERRAIN_SOURCE_VERSION);
    expect(source.plotOutline).toBeNull();
    expect(JSON.parse(encodeListingTerrainSource(source)).version).toBe(3);
  });

  it('withPlotOutline writes the ring in canonical mm and leaves everything else as it was', () => {
    const source = parseListingTerrainSource(rawSource())!;
    const outlined = withPlotOutline(source, { ringWorldMm: RING, showInListing: false })!;
    expect(outlined.plotOutline).toStrictEqual({
      ring: [[E0 + 2_000, N0 + 2_000], [E0 + 18_000, N0 + 2_000], [E0 + 18_000, N0 + 18_000], [E0 + 2_000, N0 + 18_000]],
      showInListing: false,
    });
    expect({ ...outlined, plotOutline: null }).toStrictEqual(source);
  });

  it('withPlotOutline is idempotent, survives its own encoding, and `null` removes the outline', () => {
    const source = parseListingTerrainSource(rawSource())!;
    const once = withPlotOutline(source, { ringWorldMm: RING, showInListing: true })!;
    expect(withPlotOutline(once, { ringWorldMm: RING, showInListing: true })).toStrictEqual(once);
    expect(parseListingTerrainSource(JSON.parse(encodeListingTerrainSource(once)))).toStrictEqual(once);
    expect(withPlotOutline(once, null)).toStrictEqual(source);
  });

  it('withPlotOutline refuses a ring the contract does not accept — never a half-written source', () => {
    const source = parseListingTerrainSource(rawSource())!;
    expect(withPlotOutline(source, { ringWorldMm: RING.slice(0, 2), showInListing: true })).toBeNull();
    expect(withPlotOutline(source, { ringWorldMm: [...RING.slice(0, 3), { x: Number.NaN, y: N0 }], showInListing: true })).toBeNull();
  });

  it('Π9 — the owner always gets the outline; the public only when the owner ticked it', () => {
    const source = parseListingTerrainSource(rawSource())!;
    const hidden = withPlotOutline(source, { ringWorldMm: RING, showInListing: false })!;
    const shown = withPlotOutline(source, { ringWorldMm: RING, showInListing: true })!;
    expect(toListingTerrainInput(hidden, 'owner').plotOutlineWorldMm).toHaveLength(4);
    expect(toListingTerrainInput(hidden, 'public').plotOutlineWorldMm).toBeNull();
    expect(toListingTerrainInput(shown, 'public').plotOutlineWorldMm).toHaveLength(4);
    expect(toListingTerrainInput(source, 'owner').plotOutlineWorldMm).toBeNull();
  });

  it('Ζ3c — plotOutlineChoiceIn is the inverse road: carrying an outline to the next relief changes nothing', () => {
    const source = parseListingTerrainSource(rawSource())!;
    const outlined = withPlotOutline(source, { ringWorldMm: RING, showInListing: false })!;
    expect(plotOutlineChoiceIn(source)).toBeNull();
    expect(plotOutlineChoiceIn(outlined)).toStrictEqual({
      ringWorldMm: [
        { x: E0 + 2_000, y: N0 + 2_000 }, { x: E0 + 18_000, y: N0 + 2_000 },
        { x: E0 + 18_000, y: N0 + 18_000 }, { x: E0 + 2_000, y: N0 + 18_000 },
      ],
      showInListing: false,
    });
    expect(encodeListingTerrainSource(withPlotOutline(outlined, plotOutlineChoiceIn(outlined))!)).toBe(encodeListingTerrainSource(outlined));
  });
});

describe('ADR-920 §14.12 Α — the declared coordinate system and the location consent (v3)', () => {
  it('v1 and v2 sources read as «nobody was asked» and «no» — the version speaks, nothing is guessed', () => {
    for (const version of [1, 2] as const) {
      const source = parseListingTerrainSource(legacySource(version))!;
      expect(source).toMatchObject({ version: 3, coordinateSystem: null, showLocationInListing: false });
    }
  });

  it('the declarable Greek grid IS the registry\'s name — bound by type in the module, anchored at run time here', () => {
    expect(TERRAIN_COORDINATE_SYSTEMS).toStrictEqual([GREEK_GRID_CRS.name, 'local']);
  });

  it('each field has ONE writer, and neither touches anything else', () => {
    const source = parseListingTerrainSource(rawSource())!;
    const declared = withCoordinateSystem(source, 'EPSG:2100')!;
    expect(declared).toStrictEqual({ ...source, coordinateSystem: 'EPSG:2100' });
    const consented = withLocationConsent(declared, true)!;
    expect(consented).toStrictEqual({ ...declared, showLocationInListing: true });
    expect(withCoordinateSystem(consented, null)).toStrictEqual({ ...consented, coordinateSystem: null });
  });

  it('the writers are idempotent and survive their own encoding', () => {
    const source = withLocationConsent(withCoordinateSystem(parseListingTerrainSource(rawSource())!, 'local')!, true)!;
    expect(withCoordinateSystem(source, 'local')).toStrictEqual(source);
    expect(withLocationConsent(source, true)).toStrictEqual(source);
    expect(parseListingTerrainSource(JSON.parse(encodeListingTerrainSource(source)))).toStrictEqual(source);
  });

  it('the encoding writes the two keys last, in one order', () => {
    const encoded = encodeListingTerrainSource(parseListingTerrainSource(rawSource({ showLocationInListing: true, coordinateSystem: 'EPSG:2100' }))!);
    expect(Object.keys(JSON.parse(encoded))).toStrictEqual([
      'version', 'points', 'breaklines', 'boundary', 'envelope', 'plotOutline', 'coordinateSystem', 'showLocationInListing',
    ]);
  });

  it('withGeoreferenceChoice REPLACES whatever the source carried — a browser\'s claim never survives', () => {
    const claimed = parseListingTerrainSource(rawSource({ coordinateSystem: 'EPSG:2100', showLocationInListing: true }))!;
    expect(withGeoreferenceChoice(claimed, NO_TERRAIN_GEOREFERENCE_CHOICE)).toMatchObject({ coordinateSystem: null, showLocationInListing: false });
  });

  it('the plot outline and the location are independent ticks', () => {
    const source = parseListingTerrainSource(rawSource())!;
    const ring = [{ x: E0 + 2_000, y: N0 + 2_000 }, { x: E0 + 18_000, y: N0 + 2_000 }, { x: E0 + 18_000, y: N0 + 18_000 }];
    const outlineOnly = withPlotOutline(withCoordinateSystem(source, 'EPSG:2100')!, { ringWorldMm: ring, showInListing: true })!;
    expect(toListingTerrainInput(outlineOnly, 'public')).toMatchObject({ georeference: null });
    expect(toListingTerrainInput(outlineOnly, 'public').plotOutlineWorldMm).toHaveLength(3);
    const locationOnly = withLocationConsent(withPlotOutline(outlineOnly, { ringWorldMm: ring, showInListing: false })!, true)!;
    expect(toListingTerrainInput(locationOnly, 'public')).toMatchObject({ plotOutlineWorldMm: null, georeference: { coordinateSystem: 'EPSG:2100' } });
  });

  it('the owner is always asked for a georeference; the public only with the consent', () => {
    const source = withCoordinateSystem(parseListingTerrainSource(rawSource())!, 'EPSG:2100')!;
    expect(toListingTerrainInput(source, 'owner').georeference).toStrictEqual({ coordinateSystem: 'EPSG:2100' });
    expect(toListingTerrainInput(source, 'public').georeference).toBeNull();
    expect(toListingTerrainInput(withLocationConsent(source, true)!, 'public').georeference).toStrictEqual({ coordinateSystem: 'EPSG:2100' });
  });
});
