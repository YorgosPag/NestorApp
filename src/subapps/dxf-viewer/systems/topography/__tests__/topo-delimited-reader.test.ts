/**
 * ADR-650 Milestone 2 — delimiter detection / header detection / quoting.
 */

import { detectDelimiter, readDelimitedText, splitDelimitedLine } from '../topo-delimited-reader';

describe('detectDelimiter', () => {
  it('picks the separator that splits consistently', () => {
    expect(detectDelimiter(['1,2,3', '4,5,6'])).toBe(',');
    expect(detectDelimiter(['1;2;3', '4;5;6'])).toBe(';');
    expect(detectDelimiter(['1\t2\t3', '4\t5\t6'])).toBe('\t');
    expect(detectDelimiter(['384512.3 4201233.1 12.4'])).toBe(' ');
  });

  it('is not fooled by a comma inside a description when the file is tab-separated', () => {
    expect(detectDelimiter(['1\t2\t3\tWALL, north', '4\t5\t6\tKERB'])).toBe('\t');
  });
});

describe('splitDelimitedLine', () => {
  it('keeps a quoted description containing the delimiter as ONE cell', () => {
    expect(splitDelimitedLine('1,2,3,"WALL, north side"', ',')).toEqual(['1', '2', '3', 'WALL, north side']);
  });

  it('collapses runs of spaces (column-aligned dumps) but NOT tabs (empty cell is a column)', () => {
    expect(splitDelimitedLine('10    20   5', ' ')).toEqual(['10', '20', '5']);
    expect(splitDelimitedLine('10\t\t5', '\t')).toEqual(['10', '', '5']);
  });
});

describe('readDelimitedText', () => {
  it('treats a non-numeric first row as headers', () => {
    const t = readDelimitedText('X,Y,Z\n10,20,5');
    expect(t.headers).toEqual(['X', 'Y', 'Z']);
    expect(t.rows).toEqual([['10', '20', '5']]);
  });

  it('starts at data when the first row is already numeric', () => {
    const t = readDelimitedText('10,20,5\n11,21,6');
    expect(t.headers).toEqual([]);
    expect(t.rows).toHaveLength(2);
  });

  it('drops blank lines and # / // comments', () => {
    const t = readDelimitedText('# survey 2026\n10,20,5\n\n// note\n11,21,6');
    expect(t.rows).toEqual([['10', '20', '5'], ['11', '21', '6']]);
  });

  it('honours an explicit delimiter override (auto-detect would have picked the comma)', () => {
    const t = readDelimitedText('10,5;20,3;7', { delimiter: ';' });
    expect(t.rows).toEqual([['10,5', '20,3', '7']]); // Greek decimals — the comma is NOT a separator
  });

  it('returns an empty table for empty input', () => {
    expect(readDelimitedText('')).toEqual({ headers: [], rows: [] });
  });
});
