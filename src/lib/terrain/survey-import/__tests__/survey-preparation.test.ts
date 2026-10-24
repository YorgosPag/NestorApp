/**
 * ADR-920 Β4.2 — the pure core of the owner's survey import: one verdict (shared with the door), the exact body,
 * the facts the big tools resolve silently, the unit suggestion with its evidence, and the file-kind sniffer.
 */

import { isWithinGreekGridAreaOfUse } from '@/lib/geo/greek-grid';
import { LISTING_TERRAIN_SOURCE_MAX_POINTS } from '../../publication/listing-terrain-config';
import { judgeListingTerrainSource } from '../../publication/listing-terrain-judge';
import { encodeListingTerrainSource } from '../../publication/listing-terrain-source';
import type { TopoPoint } from '../../terrain-types';
import { surveyFileKindOf } from '../survey-file-kind';
import { suggestSurveyUnit } from '../survey-units';
import type { SnapshotFrame } from '../../publication/listing-terrain-frame';
import { prepareSurveyUpload, surveyFactsOf, surveyMarksOf, surveySourceOf } from '../survey-upload-preparation';

/** A 20 × 20 m plot in ΕΓΣΑ'87, WORLD mm, sloping 10 % east — five points, one of them planimetric. */
const E0 = 384_512_000;
const N0 = 4_201_233_000;
const PLOT: TopoPoint[] = [
  { x: E0, y: N0, z: 100_000 },
  { x: E0 + 20_000, y: N0, z: 102_000 },
  { x: E0 + 20_000, y: N0 + 20_000, z: 102_000 },
  { x: E0, y: N0 + 20_000, z: 100_000 },
  { x: E0 + 10_000, y: N0 + 10_000 },
];

const asFileUnits = (points: readonly TopoPoint[], mmPerUnit: number): TopoPoint[] =>
  points.map((p) => ({ x: p.x / mmPerUnit, y: p.y / mmPerUnit }));

describe('judgeListingTerrainSource — the ONE verdict (door + preview)', () => {
  it('a shape the contract rejects is MALFORMED', () => {
    expect(judgeListingTerrainSource({ version: 99 })).toEqual({ ok: false, code: 'TERRAIN_SOURCE_MALFORMED' });
  });

  it('a surface the builder rejects keeps its own name', () => {
    const twoPoints = surveySourceOf(PLOT.slice(0, 2));
    expect(judgeListingTerrainSource(twoPoints)).toEqual({ ok: false, code: 'TERRAIN_INSUFFICIENT_SURFACE' });
  });

  it('returns the CANONICAL source (integer mm) with the snapshot it would publish', () => {
    const verdict = judgeListingTerrainSource(surveySourceOf([...PLOT.slice(0, 3), { x: E0 + 0.4, y: N0 + 20_000.6, z: 100_000 }]));
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.source.points[3]).toEqual([E0, N0 + 20_001, 100_000]);
    expect(verdict.snapshot.stats.minElevationM).toBe(100);
  });
});

describe('prepareSurveyUpload — exactly what the door receives', () => {
  it('keeps a planimetric point as [x, y], never z = 0 (ADR-720)', () => {
    expect(surveySourceOf(PLOT).points[4]).toEqual([E0 + 10_000, N0 + 10_000]);
  });

  it('the body IS the canonical encoding, and the facts count what shapes the surface', () => {
    const prepared = prepareSurveyUpload(PLOT);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.encoded).toBe(encodeListingTerrainSource(prepared.source));
    expect(prepared.facts).toEqual({ points: 5, withElevation: 4, coincident: 0, conflictingElevations: 0 });
  });

  it('refuses more points than the door accepts, with the door’s code', () => {
    const tooMany = Array.from({ length: LISTING_TERRAIN_SOURCE_MAX_POINTS + 1 }, (_, i) => ({ x: i, y: i, z: 0 }));
    expect(prepareSurveyUpload(tooMany)).toEqual({ ok: false, code: 'TERRAIN_SOURCE_MALFORMED', facts: null });
  });

  it('passes the builder’s refusal through by name', () => {
    expect(prepareSurveyUpload(PLOT.slice(0, 2))).toMatchObject({ ok: false, code: 'TERRAIN_INSUFFICIENT_SURFACE' });
  });
});

describe('surveyFactsOf — what the TIN would resolve silently', () => {
  it('counts coincident points, and separately those whose elevation CONTRADICTS the kept one', () => {
    const facts = surveyFactsOf([[1, 1, 5], [1, 1, 5], [1, 1, 7], [2, 2], [2, 2, 3], [3, 3, 1]]);
    expect(facts).toEqual({ points: 6, withElevation: 5, coincident: 3, conflictingElevations: 2 });
  });
});

describe('surveyMarksOf — the repeats ON the preview map (ADR-920 Β4.8), never on the wire', () => {
  /** A frame that only divides by 1000 — the marks must go through whatever frame they are given. */
  const METRES: SnapshotFrame = { planM: (x, y) => [x / 1000, y / 1000], elevationM: (z) => z / 1000 };

  it('one mark per repeated position, source order; a contradiction wins over a plain repeat', () => {
    const marks = surveyMarksOf(
      [[1000, 1000, 5], [1000, 1000, 5], [1000, 1000, 7], [2000, 2000], [2000, 2000, 3], [3000, 3000, 1], [4000, 4000, 2], [4000, 4000, 2]],
      METRES,
    );
    expect(marks).toEqual([
      { x: 1, y: 1, kind: 'conflicting' },
      { x: 2, y: 2, kind: 'conflicting' },
      { x: 4, y: 4, kind: 'coincident' },
    ]);
  });

  it('a survey without repeats has no marks', () => {
    expect(surveyMarksOf([[1, 1, 1], [2, 2, 2]], METRES)).toEqual([]);
  });

  it('the preview places the mark through the SNAPSHOT frame: it lands on the published vertex', () => {
    const prepared = prepareSurveyUpload([...PLOT, { x: E0, y: N0, z: 100_500 }]);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    // The surface centre is (E0 + 10 m, N0 + 10 m) ⇒ the SW corner is (−10, −10) in the published frame.
    expect(prepared.marks).toEqual([{ x: -10, y: -10, kind: 'conflicting' }]);
    const { positions } = prepared.snapshot.mesh;
    const vertices = Array.from({ length: positions.length / 3 }, (_, i) => `${positions[3 * i]}:${positions[3 * i + 1]}`);
    expect(vertices).toContain('-10:-10');
    expect(prepared.facts.conflictingElevations).toBe(1);
  });
});

describe('suggestSurveyUnit — a suggestion WITH its evidence', () => {
  it('ΕΓΣΑ\'87 in metres → m (greek-grid)', () => {
    expect(suggestSurveyUnit(asFileUnits(PLOT, 1000))).toEqual({ unit: 'm', evidence: 'greek-grid' });
  });

  it('ΕΓΣΑ\'87 in millimetres → mm (greek-grid)', () => {
    expect(suggestSurveyUnit(asFileUnits(PLOT, 1))).toEqual({ unit: 'mm', evidence: 'greek-grid' });
  });

  it('a stray origin point does not veto a Greek-grid survey (≥ 90 %)', () => {
    const survey = Array.from({ length: 19 }, (_, i) => ({ x: 384_512 + i, y: 4_201_233 + i }));
    expect(suggestSurveyUnit([...survey, { x: 0, y: 0 }])).toEqual({ unit: 'm', evidence: 'greek-grid' });
  });

  it('local coordinates: the plot extent decides (30 m in m → m · 30 m in mm → mm)', () => {
    expect(suggestSurveyUnit([{ x: 0, y: 0 }, { x: 30, y: 0 }])).toEqual({ unit: 'm', evidence: 'extent' });
    expect(suggestSurveyUnit([{ x: 0, y: 0 }, { x: 30_000, y: 0 }])).toEqual({ unit: 'mm', evidence: 'extent' });
  });

  it('says NOTHING where both readings are plausible, or with fewer than two points — the human decides', () => {
    expect(suggestSurveyUnit([{ x: 0, y: 0 }, { x: 2_500, y: 0 }])).toBeNull();
    expect(suggestSurveyUnit([{ x: 384_512, y: 4_201_233 }])).toBeNull();
  });

  it('the Greek-grid test is the EPSG:2100 area of use', () => {
    expect(isWithinGreekGridAreaOfUse(384_512, 4_201_233)).toBe(true); // Αθήνα
    expect(isWithinGreekGridAreaOfUse(94_000, 4_201_233)).toBe(false);
    expect(isWithinGreekGridAreaOfUse(384_512, 4_700_000)).toBe(false);
  });
});

describe('surveyFileKindOf — the bytes decide, the name only breaks ties', () => {
  const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

  it.each([
    ['plot.xlsx', Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14]), 'xlsx'],
    ['plot.dat', Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14]), 'xlsx'],
    ['plot.xls', Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1]), 'xls-legacy'],
    ['plot.dxf', bytes('AutoCAD Binary DXF\r\n\u001a\u0000'), 'dxf-binary'],
    ['plot.dxf', bytes('  0\nSECTION\n  2\nHEADER\n'), 'dxf'],
    ['from-surveyor.txt', bytes('999\nDXF created by X\n0\r\nSECTION\r\n'), 'dxf'],
    ['points.csv', bytes('P,E,N,H\n1,384512.3,4201233.1,12.4\n'), 'delimited'],
    ['points', bytes('1 384512.3 4201233.1 12.4\n'), 'delimited'],
    ['broken.dxf', bytes('hello world'), 'unsupported'],
    ['scan.pdf', bytes('%PDF-1.7'), 'unsupported'],
    ['blob.csv', Uint8Array.from([0x31, 0x00, 0x32]), 'unsupported'],
  ])('%s → %s', (name, head, expected) => {
    expect(surveyFileKindOf(name, head)).toBe(expected);
  });
});
