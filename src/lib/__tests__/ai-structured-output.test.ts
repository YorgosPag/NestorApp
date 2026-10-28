/**
 * Κείμενο από δομημένη έξοδο μοντέλου (ADR-327, 2026-10-28) — το «null» ως ΚΕΙΜΕΝΟ δεν είναι τιμή.
 */

/* global describe, it, expect */

import { isAbsentText, structuredText, structuredTextList } from '../ai-structured-output';

describe('structuredText — σύνορο κειμένου μοντέλου', () => {
  it('🔴 Σ1 — τα κείμενα-δείκτες απουσίας γίνονται `null` (μετρημένο: "null" σε 8 πεδία προσφοράς)', () => {
    for (const absent of ['null', 'NULL', ' null ', 'undefined', 'None', 'N/A', '', '   ', '-', '–', '—']) {
      expect(structuredText(absent)).toBeNull();
      expect(isAbsentText(absent)).toBe(true);
    }
  });

  it('Σ2 — πραγματική τιμή περνά, με `trim`· ακόμη και όταν ΠΕΡΙΕΧΕΙ τη λέξη', () => {
    expect(structuredText('  MACON ATEE ')).toBe('MACON ATEE');
    expect(structuredText('099999999')).toBe('099999999');
    expect(structuredText('nullable fittings')).toBe('nullable fittings');
    expect(structuredText('0')).toBe('0');
  });

  it('Σ3 — `null`/`undefined` μένουν `null`', () => {
    expect(structuredText(null)).toBeNull();
    expect(structuredText(undefined)).toBeNull();
  });

  it('Σ4 — λίστα: κρατά μόνο τις πραγματικές τιμές', () => {
    expect(structuredTextList(['info@macon.gr', 'null', '', ' sales@macon.gr '])).toEqual(['info@macon.gr', 'sales@macon.gr']);
    expect(structuredTextList(null)).toEqual([]);
  });
});
