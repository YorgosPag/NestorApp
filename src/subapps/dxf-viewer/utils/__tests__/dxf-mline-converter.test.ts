/**
 * ADR-635 Φάση B — MLINE converter (MVP: reference line από 11/21 vertices).
 */
import { convertMline } from '../dxf-mline-converter';

type Pairs = ReadonlyArray<readonly [string, string]>;
function pairs(entries: Array<[string, string]>): Pairs {
  return entries;
}

describe('convertMline (ADR-635 Φάση B MVP — reference line)', () => {
  it('εξάγει reference polyline από 11/21 vertex pairs (ΟΧΙ 10/20)', () => {
    const e = convertMline(pairs([
      ['2', 'STANDARD'], ['40', '1.0'], ['70', '0'], ['71', '1'], ['72', '3'], ['73', '2'],
      ['10', '0'], ['20', '0'], ['30', '0'],
      ['11', '0'], ['21', '0'], ['31', '0'], ['12', '1'], ['22', '0'],
      ['11', '100'], ['21', '0'], ['31', '0'], ['12', '0'], ['22', '1'],
      ['11', '100'], ['21', '100'], ['31', '0'],
    ]), 'L1', 0);
    expect(e).not.toBeNull();
    expect(e!.type).toBe('polyline');
    expect((e as unknown as { vertices: unknown }).vertices).toEqual([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 },
    ]);
  });

  it('αγνοεί direction (12/22) / miter (13/23) codes ανάμεσα σε vertices', () => {
    const e = convertMline(pairs([
      ['11', '0'], ['21', '0'], ['12', '5'], ['22', '5'], ['13', '9'], ['23', '9'],
      ['11', '50'], ['21', '50'],
    ]), 'L1', 1) as unknown as { vertices: unknown };
    expect(e.vertices).toEqual([{ x: 0, y: 0 }, { x: 50, y: 50 }]);
  });

  it('θέτει closed=true όταν code 71 bit 2 (ΟΧΙ code 70 όπως LWPOLYLINE)', () => {
    const e = convertMline(pairs([
      ['71', '3'], // 1(has-vertex) | 2(closed) = 3
      ['11', '0'], ['21', '0'], ['11', '10'], ['21', '0'], ['11', '10'], ['21', '10'],
    ]), 'L1', 2) as unknown as { closed: boolean };
    expect(e.closed).toBe(true);
  });

  it('επιστρέφει null όταν <2 vertices (ελλιπές MLINE)', () => {
    expect(convertMline(pairs([['11', '0'], ['21', '0']]), 'L1', 3)).toBeNull();
  });

  it('εξάγει χρώμα από code 62 (ACI)', () => {
    const e = convertMline(pairs([
      ['62', '1'], ['11', '0'], ['21', '0'], ['11', '10'], ['21', '10'],
    ]), 'L1', 4) as unknown as { color?: string };
    expect(e.color).toBeDefined();
  });
});
