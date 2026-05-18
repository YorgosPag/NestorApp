/**
 * ADR-362 Phase H1 — DIMSTYLE table writer unit + roundtrip tests.
 *
 * Coverage:
 *   - `writeDimStyleTable()` emits correct group codes for each DimStyle field
 *   - Roundtrip: write → feed to `parseDimStyles()` → re-read key fields
 *   - Edge cases: empty style array, multiple styles, boolean flags, decimal separator
 */

import { writeDimStyleTable } from '../dxf-dimstyle-writer';
import { parseDimStyles } from '../dxf-table-parsers';
import type { DimStyle } from '../../types/dimension';
import { ISO_129_TEMPLATE } from '../../systems/dimensions/dim-style-templates';

// ──────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeStyle(overrides: Partial<DimStyle> = {}): DimStyle {
  return { ...ISO_129_TEMPLATE, ...overrides };
}

/** Find the value that follows a given group code in the output. */
function findCode(lines: string[], code: string): string | undefined {
  const idx = lines.indexOf(code);
  return idx >= 0 ? lines[idx + 1] : undefined;
}

/** Collect all occurrences of a code and return the paired values. */
function findAllCodes(lines: string[], code: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i] === code) result.push(lines[i + 1]);
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────────────────
// Structure tests
// ──────────────────────────────────────────────────────────────────────────────

describe('writeDimStyleTable — structure', () => {
  it('wraps output in SECTION/TABLES/ENDTAB/ENDSEC markers', () => {
    const out = writeDimStyleTable([makeStyle()]);
    expect(out).toContain('SECTION');
    expect(out).toContain('TABLES');
    expect(out).toContain('ENDTAB');
    expect(out).toContain('ENDSEC');
  });

  it('empty array emits 0 DIMSTYLE entries', () => {
    const out = writeDimStyleTable([]);
    const entries = findAllCodes(out, '0').filter((v) => v === 'DIMSTYLE');
    expect(entries).toHaveLength(0);
  });

  it('emits one DIMSTYLE entry per style', () => {
    const out = writeDimStyleTable([makeStyle({ name: 'A' }), makeStyle({ name: 'B' })]);
    const entries = findAllCodes(out, '0').filter((v) => v === 'DIMSTYLE');
    expect(entries).toHaveLength(2);
  });

  it('emits style name via code 2', () => {
    const out = writeDimStyleTable([makeStyle({ name: 'MY_STYLE' })]);
    const names = findAllCodes(out, '2').filter((v) => v !== 'TABLES' && v !== 'DIMSTYLE');
    expect(names).toContain('MY_STYLE');
  });

  it('emits TABLE count via code 70', () => {
    const out = writeDimStyleTable([makeStyle(), makeStyle({ name: 'B' })]);
    expect(findCode(out, '70')).toBe('2');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Field value tests
// ──────────────────────────────────────────────────────────────────────────────

describe('writeDimStyleTable — field values', () => {
  it('emits DIMSCALE (code 40)', () => {
    const out = writeDimStyleTable([makeStyle({ dimscale: 2.5 })]);
    const vals = findAllCodes(out, '40');
    expect(vals).toContain('2.5');
  });

  it('emits DIMTXT (code 140)', () => {
    const out = writeDimStyleTable([makeStyle({ dimtxt: 3.5 })]);
    expect(findAllCodes(out, '140')).toContain('3.5');
  });

  it('emits DIMTFAC (code 146)', () => {
    const out = writeDimStyleTable([makeStyle({ dimtfac: 0.75 })]);
    expect(findAllCodes(out, '146')).toContain('0.75');
  });

  it('emits DIMTOL flag (code 71) as 1 when true', () => {
    const out = writeDimStyleTable([makeStyle({ dimtol: true })]);
    const vals = findAllCodes(out, '71');
    expect(vals).toContain('1');
  });

  it('emits DIMLIM flag (code 72) as 0 when false', () => {
    const out = writeDimStyleTable([makeStyle({ dimlim: false })]);
    const vals = findAllCodes(out, '72');
    expect(vals).toContain('0');
  });

  it('emits DIMDSEP as 46 for "." (code 278)', () => {
    const out = writeDimStyleTable([makeStyle({ dimdsep: '.' })]);
    const vals = findAllCodes(out, '278');
    expect(vals).toContain('46');
  });

  it('emits DIMDSEP as 44 for "," (code 278)', () => {
    const out = writeDimStyleTable([makeStyle({ dimdsep: ',' })]);
    const vals = findAllCodes(out, '278');
    expect(vals).toContain('44');
  });

  it('emits DIMTOLJ 0=bottom / 1=middle / 2=top (code 283)', () => {
    const bottom = writeDimStyleTable([makeStyle({ dimtolj: 'bottom' })]);
    const middle = writeDimStyleTable([makeStyle({ dimtolj: 'middle' })]);
    const top    = writeDimStyleTable([makeStyle({ dimtolj: 'top' })]);
    expect(findAllCodes(bottom, '283')).toContain('0');
    expect(findAllCodes(middle, '283')).toContain('1');
    expect(findAllCodes(top,    '283')).toContain('2');
  });

  it('emits DIMLUNIT 2=decimal / 4=architectural (code 270)', () => {
    const dec  = writeDimStyleTable([makeStyle({ dimlunit: 'decimal' })]);
    const arch = writeDimStyleTable([makeStyle({ dimlunit: 'architectural' })]);
    expect(findAllCodes(dec,  '270')).toContain('2');
    expect(findAllCodes(arch, '270')).toContain('4');
  });

  it('emits DIMTM as positive absolute value (code 48)', () => {
    // DimStyle stores dimtm as negative (e.g. -0.05); DXF emits positive.
    const out = writeDimStyleTable([makeStyle({ dimtm: -0.05 })]);
    expect(findAllCodes(out, '48')).toContain('0.05');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Roundtrip tests: write → parseDimStyles → verify key fields
// ──────────────────────────────────────────────────────────────────────────────

describe('writeDimStyleTable → parseDimStyles roundtrip', () => {
  function roundtrip(overrides: Partial<DimStyle> = {}) {
    const style = makeStyle({ name: 'RoundtripStyle', ...overrides });
    const lines = writeDimStyleTable([style]);
    const map = parseDimStyles(lines);
    return { style, entry: map['RoundtripStyle'] };
  }

  it('style appears in parsed map', () => {
    const { entry } = roundtrip();
    expect(entry).toBeDefined();
  });

  it('dimtxt roundtrips', () => {
    const { style, entry } = roundtrip({ dimtxt: 3.5 });
    expect(entry.dimtxt).toBe(style.dimtxt);
  });

  it('dimscale roundtrips', () => {
    const { style, entry } = roundtrip({ dimscale: 2.0 });
    expect(entry.dimscale).toBe(style.dimscale);
  });

  it('dimtfac roundtrips', () => {
    const { style, entry } = roundtrip({ dimtfac: 0.75 });
    expect(entry.dimtfac).toBe(style.dimtfac);
  });

  it('dimtol=true roundtrips', () => {
    const { entry } = roundtrip({ dimtol: true });
    expect(entry.dimtol).toBe(true);
  });

  it('dimlunit decimal → 2 roundtrips', () => {
    const { entry } = roundtrip({ dimlunit: 'decimal' });
    expect(entry.dimlunit).toBe(2);
  });

  it('dimdsep comma → 44 roundtrips', () => {
    const { entry } = roundtrip({ dimdsep: ',' });
    expect(entry.dimdsep).toBe(44);
  });

  it('dimtolj bottom → 0 roundtrips', () => {
    const { entry } = roundtrip({ dimtolj: 'bottom' });
    expect(entry.dimtolj).toBe(0);
  });

  it('multiple styles both appear in parsed map', () => {
    const styleA = makeStyle({ name: 'StyleA' });
    const styleB = makeStyle({ name: 'StyleB', dimtxt: 5 });
    const lines = writeDimStyleTable([styleA, styleB]);
    const map = parseDimStyles(lines);
    expect(map['StyleA']).toBeDefined();
    expect(map['StyleB']).toBeDefined();
    expect(map['StyleB'].dimtxt).toBe(5);
  });
});
