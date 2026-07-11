/**
 * ADR-635 Φ C.7 — MLINE converter → N parallel element polylines (MLINESTYLE-driven).
 * Reference path from 11/21 vertices; each element = path offset by (offset+justAdjust)×scale.
 */
import { convertMline } from '../dxf-mline-converter';
import type { MlineStyleMap, MlineStyleDef } from '../dxf-mline-style-parser';

type Pairs = ReadonlyArray<readonly [string, string]>;
function pairs(entries: Array<[string, string]>): Pairs {
  return entries;
}
function styleMap(def: MlineStyleDef): MlineStyleMap {
  const m: MlineStyleMap = new Map();
  m.set(def.name, def);
  if (def.handle) m.set(def.handle, def);
  return m;
}

interface PolyLike {
  id: string;
  type: string;
  groupId?: string;
  closed: boolean;
  color?: string;
  vertices: Array<{ x: number; y: number }>;
}
const as = (e: unknown): PolyLike[] => e as PolyLike[];

describe('convertMline (ADR-635 Φ C.7 — N parallel element polylines)', () => {
  it('χωρίς MLINESTYLE → STANDARD default (2 elements @ ±0.5), κοινό groupId', () => {
    // Zero justification (70=1) ώστε τα offsets να μένουν ±0.5 (συμμετρικά).
    const out = as(convertMline(pairs([
      ['70', '1'], ['40', '1'],
      ['11', '0'], ['21', '0'], ['11', '100'], ['21', '0'],
    ]), 'L1', 0));
    expect(out).toHaveLength(2);
    expect(out[0].type).toBe('polyline');
    expect(out[0].groupId).toBe('mline_0');
    expect(out[1].groupId).toBe('mline_0');
    expect(out[0].id).toBe('mline_0_e0');
    expect(out[1].id).toBe('mline_0_e1');
    // travel = +x ⇒ CCW perp = (0,1): +0.5 → +y, −0.5 → −y.
    expect(out[0].vertices).toEqual([{ x: 0, y: 0.5 }, { x: 100, y: 0.5 }]);
    expect(out[1].vertices).toEqual([{ x: 0, y: -0.5 }, { x: 100, y: -0.5 }]);
  });

  it('scale (code 40) πολλαπλασιάζει τα offsets', () => {
    const out = as(convertMline(pairs([
      ['70', '1'], ['40', '2'],
      ['11', '0'], ['21', '0'], ['11', '10'], ['21', '0'],
    ]), 'L1', 1));
    expect(out[0].vertices).toEqual([{ x: 0, y: 1 }, { x: 10, y: 1 }]);
    expect(out[1].vertices).toEqual([{ x: 0, y: -1 }, { x: 10, y: -1 }]);
  });

  it('Top justification (70=0) φέρνει το max-offset element πάνω στην reference path', () => {
    // STANDARD ±0.5, Top ⇒ adjust=-0.5 ⇒ elements @ 0 και -1.
    const out = as(convertMline(pairs([
      ['70', '0'], ['40', '1'],
      ['11', '0'], ['21', '0'], ['11', '10'], ['21', '0'],
    ]), 'L1', 2));
    expect(out[0].vertices).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    expect(out[1].vertices).toEqual([{ x: 0, y: -1 }, { x: 10, y: -1 }]);
  });

  it('χρησιμοποιεί το MLINESTYLE (by name, code 2) με τα δικά του offsets/colors', () => {
    const styles = styleMap({
      name: 'WALL',
      handle: 'A1',
      elements: [{ offset: 3, aci: '1' }, { offset: -3 }],
    });
    const out = as(convertMline(pairs([
      ['2', 'WALL'], ['70', '1'], ['40', '1'],
      ['11', '0'], ['21', '0'], ['11', '10'], ['21', '0'],
    ]), 'L1', 3, styles));
    expect(out).toHaveLength(2);
    expect(out[0].vertices).toEqual([{ x: 0, y: 3 }, { x: 10, y: 3 }]);
    expect(out[1].vertices).toEqual([{ x: 0, y: -3 }, { x: 10, y: -3 }]);
    expect(out[0].color).toBeDefined(); // element ACI 1 (red)
    expect(out[1].color).toBeUndefined(); // κανένα element/entity color
  });

  it('resolve by handle (code 340) όταν λείπει το όνομα', () => {
    const styles = styleMap({ name: 'WALL', handle: 'A1', elements: [{ offset: 1 }] });
    const out = as(convertMline(pairs([
      ['340', 'A1'], ['70', '1'],
      ['11', '0'], ['21', '0'], ['11', '10'], ['21', '0'],
    ]), 'L1', 4, styles));
    expect(out).toHaveLength(1);
    expect(out[0].vertices).toEqual([{ x: 0, y: 1 }, { x: 10, y: 1 }]);
  });

  it('entity color (code 62) γίνεται fallback για elements χωρίς δικό τους χρώμα', () => {
    const styles = styleMap({ name: 'WALL', handle: 'A1', elements: [{ offset: 1 }] });
    const out = as(convertMline(pairs([
      ['2', 'WALL'], ['62', '5'], ['70', '1'],
      ['11', '0'], ['21', '0'], ['11', '10'], ['21', '0'],
    ]), 'L1', 5, styles));
    expect(out[0].color).toBeDefined();
  });

  it('closed=true όταν code 71 bit 2 — σε ΚΑΘΕ element', () => {
    const out = as(convertMline(pairs([
      ['70', '1'], ['71', '2'],
      ['11', '0'], ['21', '0'], ['11', '10'], ['21', '0'], ['11', '10'], ['21', '10'],
    ]), 'L1', 6));
    expect(out.every(e => e.closed === true)).toBe(true);
  });

  it('αγνοεί direction (12/22) / miter (13/23) codes ανάμεσα σε vertices', () => {
    const styles = styleMap({ name: 'ZERO', elements: [{ offset: 0 }] });
    const out = as(convertMline(pairs([
      ['2', 'ZERO'], ['70', '1'],
      ['11', '0'], ['21', '0'], ['12', '5'], ['22', '5'], ['13', '9'], ['23', '9'],
      ['11', '50'], ['21', '50'],
    ]), 'L1', 7, styles));
    expect(out[0].vertices).toEqual([{ x: 0, y: 0 }, { x: 50, y: 50 }]);
  });

  it('επιστρέφει [] όταν <2 vertices (ελλιπές MLINE)', () => {
    expect(convertMline(pairs([['11', '0'], ['21', '0']]), 'L1', 8)).toEqual([]);
  });
});
