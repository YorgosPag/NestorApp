/**
 * ADR-362 — `parseDimStyles` DIMSTYLE table contract (incident 2026-07-20).
 *
 * The parser used to seed a synthetic `dimStyles['Standard'] = DEFAULT_DIMSTYLE`
 * BEFORE reading the table. AutoCAD writes the style name uppercase (`STANDARD`),
 * which lands under a different key — so the 2.5 paper-mm phantom survived every
 * import, and `dim-style-importer` then elected it as the ACTIVE style. Every
 * imported dimension in `Αδείας.Κάτοψη ισογείου.dxf` rendered ~29× too large
 * while the file's own DIMTXT (0.085–0.3) sat unused.
 *
 * The synthetic default is a **no-table fallback**, never a baseline.
 */

import { parseDimStyles } from '../dxf-table-parsers';
import { DEFAULT_DIMSTYLE, lookupDimStyleEntry } from '../dxf-parser-types';

/** Build the group-code line array `parseDimStyles` consumes (code, value pairs). */
function dxfLines(...pairs: Array<[string, string]>): string[] {
  return pairs.flatMap(([code, value]) => [code, value]);
}

/** A DIMSTYLE table entry: name (2) + DIMTXT (140) + DIMSCALE (40). */
function styleEntry(name: string, dimtxt: number, dimscale = 1): Array<[string, string]> {
  return [
    ['0', 'DIMSTYLE'],
    ['2', name],
    ['40', String(dimscale)],
    ['140', String(dimtxt)],
  ];
}

function tablesSection(...entries: Array<Array<[string, string]>>): string[] {
  return dxfLines(
    ['2', 'TABLES'],
    ['2', 'DIMSTYLE'],
    ...entries.flat(),
    ['0', 'ENDTAB'],
    ['0', 'ENDSEC'],
  );
}

describe('parseDimStyles — synthetic default is a fallback, not a baseline', () => {
  it('does NOT invent a "Standard" when the file declares its own styles', () => {
    const styles = parseDimStyles(tablesSection(styleEntry('CHRIS', 0.085), styleEntry('TEO', 0.3)));

    expect(Object.keys(styles).sort()).toEqual(['CHRIS', 'TEO']);
    expect(styles['Standard']).toBeUndefined();
  });

  it('keeps the file\'s uppercase STANDARD instead of shadowing it with 2.5', () => {
    const styles = parseDimStyles(tablesSection(styleEntry('STANDARD', 0.18)));

    expect(styles['STANDARD'].dimtxt).toBe(0.18);
    // The phantom that used to win the active-style election.
    expect(styles['Standard']).toBeUndefined();
  });

  it('reproduces the incident file\'s table verbatim', () => {
    const styles = parseDimStyles(
      tablesSection(
        styleEntry('CHRIS', 0.085),
        styleEntry('STANDARD', 0.18),
        styleEntry('STAIRS_I', 0.09375, 96),
        styleEntry('ANNOTATIVE', 0.09375, 0),
        styleEntry('CHRIS$0', 0.085),
        styleEntry('TEO', 0.3),
      ),
    );

    expect(Object.keys(styles)).toHaveLength(6);
    expect(styles['CHRIS'].dimtxt).toBe(0.085);
    expect(styles['STAIRS_I'].dimscale).toBe(96);
    expect(styles['ANNOTATIVE'].dimscale).toBe(0);
    // Not one of the six carries the 2.5 default that was being rendered.
    expect(Object.values(styles).every((s) => s.dimtxt !== DEFAULT_DIMSTYLE.dimtxt)).toBe(true);
  });

  it('still falls back to the synthetic default when the file has NO DIMSTYLE table', () => {
    const styles = parseDimStyles(dxfLines(['2', 'TABLES'], ['0', 'ENDSEC']));

    expect(styles['Standard']).toEqual(DEFAULT_DIMSTYLE);
  });
});

describe('lookupDimStyleEntry — case-insensitive per the DXF spec', () => {
  const map = parseDimStyles(tablesSection(styleEntry('STANDARD', 0.18), styleEntry('CHRIS', 0.085)));

  it('finds the uppercase STANDARD when asked for "Standard"', () => {
    expect(lookupDimStyleEntry(map, 'Standard')?.dimtxt).toBe(0.18);
  });

  it('prefers an exact match over a case-folded one', () => {
    expect(lookupDimStyleEntry(map, 'CHRIS')?.dimtxt).toBe(0.085);
  });

  it('returns undefined for an unknown name and for an absent map', () => {
    expect(lookupDimStyleEntry(map, 'NOPE')).toBeUndefined();
    expect(lookupDimStyleEntry(undefined, 'Standard')).toBeUndefined();
  });
});
