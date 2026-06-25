/**
 * ADR-526 — tests για τον Tekton stair extractor. Fixture που αναπαράγει τις
 * ΠΡΑΓΜΑΤΙΚΕΣ τιμές του δείγματος `ΣΚΑΛΑ.tek` (FESPA 9.1.0.46): steps=16,
 * start=0, end=2.9, width=0.8, horiz_b≈0.2743, vert_b≈0.17059, slope_h=0.15.
 */

import { parseTekStairs, extractStairRecords } from '../tek-stair-extract';
import { parseTektonXml, TekParseError } from '../tek-xml-reader';

/** Μία `<point2d>` λίστα από [x,y] ζεύγη (μέτρα). */
function point2d(pts: readonly (readonly [number, number])[]): string {
  const records = pts.map(([x, y]) => `<record><pX>${x}</pX><pY>${y}</pY></record>`).join('');
  return `<point2d>${records}</point2d>`;
}

const STAIR_RECORD = `
<record>
<type>21</type><n>1</n><taglist></taglist>
${point2d([[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]])}
${point2d([[0.1, 0.1], [1.9, 1.9]])}
<intlist><i>2</i><i>1</i></intlist>
<start_elevation>0</start_elevation><end_elevation>2.9</end_elevation>
<stair_width>0.8</stair_width><min_step_width>0.07</min_step_width>
<steps_numbering>1</steps_numbering><steps>16</steps><landings>0</landings>
<wlength>4.38943344817213</wlength>
<horiz_b>0.27433959051075801</horiz_b><vert_b>0.17058823529411801</vert_b>
<slope_h>0.14999999999999999</slope_h>
</record>`;

function buildTek(opts: { floorsWithStair?: number; emptyFloors?: number } = {}): string {
  const withStair = opts.floorsWithStair ?? 1;
  const empty = opts.emptyFloors ?? 1;
  const stairFloors = Array.from(
    { length: withStair },
    () => `<floor><stair>${STAIR_RECORD}</stair></floor>`,
  ).join('');
  const emptyFloors = Array.from(
    { length: empty },
    () => `<floor><stair></stair></floor>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<tekton>
<head><fileversion>516</fileversion><version>9.1.0.46</version><numfloors>${withStair + empty}</numfloors></head>
<body>${stairFloors}${emptyFloors}</body>
</tekton>`;
}

describe('parseTektonXml', () => {
  it('ρίχνει για μη-XML περιεχόμενο', () => {
    expect(() => parseTektonXml('<<<not xml')).toThrow(TekParseError);
  });

  it('ρίχνει όταν λείπει το <tekton> root', () => {
    expect(() => parseTektonXml('<?xml version="1.0"?><other></other>')).toThrow(TekParseError);
  });
});

describe('extractStairRecords', () => {
  it('βρίσκει τη σκάλα και αγνοεί τους άδειους ορόφους', () => {
    const root = parseTektonXml(buildTek({ floorsWithStair: 1, emptyFloors: 3 }));
    const { stairs, warnings } = extractStairRecords(root);
    expect(stairs).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });

  it('εξάγει σωστά ΟΛΑ τα scalar πεδία (τιμές δείγματος)', () => {
    const root = parseTektonXml(buildTek());
    const [stair] = extractStairRecords(root).stairs;
    expect(stair.startElevationM).toBe(0);
    expect(stair.endElevationM).toBeCloseTo(2.9, 6);
    expect(stair.steps).toBe(16);
    expect(stair.landings).toBe(0);
    expect(stair.stairWidthM).toBeCloseTo(0.8, 6);
    expect(stair.treadGoingM).toBeCloseTo(0.27434, 5);
    expect(stair.riserHeightM).toBeCloseTo(0.170588, 5);
    expect(stair.waistThicknessM).toBeCloseTo(0.15, 6);
    expect(stair.minStepWidthM).toBeCloseTo(0.07, 6);
    expect(stair.stepsNumbering).toBe(true);
  });

  it('διατηρεί τις μη-κενές point2d πολυγραμμές με σειρά', () => {
    const root = parseTektonXml(buildTek());
    const [stair] = extractStairRecords(root).stairs;
    expect(stair.polylines).toHaveLength(2);
    expect(stair.polylines[0]).toHaveLength(5);
    expect(stair.polylines[0][0]).toEqual({ x: 0, y: 0 });
    expect(stair.polylines[1]).toHaveLength(2);
  });
});

describe('parseTekStairs', () => {
  it('διαβάζει head metadata + σκάλες', () => {
    const result = parseTekStairs(buildTek({ floorsWithStair: 1, emptyFloors: 5 }));
    expect(result.fileVersion).toBe(516);
    expect(result.tektonVersion).toBe('9.1.0.46');
    expect(result.floorCount).toBe(6);
    expect(result.stairs).toHaveLength(1);
  });
});
