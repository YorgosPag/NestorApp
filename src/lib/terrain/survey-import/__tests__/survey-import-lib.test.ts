/**
 * ADR-920 Β4.1α — the survey-import parsers in `src/lib`: the boundary they must keep, and the one behaviour that
 * changed on the move (the delimited reader's «is this cell a number?» is now the field judge the sniffer uses).
 *
 * The parsing behaviour itself stays anchored by the viewer suites (`systems/topography/__tests__`), which import
 * through the re-export shims and therefore exercise THIS code.
 */

import fs from 'node:fs';
import path from 'node:path';

import { readDelimitedText } from '../topo-delimited-reader';
import { parseTopoField } from '../topo-text-lines';

const TERRAIN_ROOT = path.resolve(__dirname, '..', '..');
/** ADR-920 Β4.1β — the DXF leaves the survey scanner stands on live here; they may not reach back either. */
const DXF_ROOT = path.resolve(TERRAIN_ROOT, '..', 'dxf');
const LIB_ROOT = path.resolve(TERRAIN_ROOT, '..');

/** Every `.ts` source under a lib folder, tests excluded. */
function terrainSources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : terrainSources(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

/** The module specifiers a file actually imports (static, dynamic, re-export) — comments are not imports. */
function specifiersOf(source: string): string[] {
  const found: string[] = [];
  const pattern = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) found.push(match[1]);
  return found;
}

describe('src/lib/terrain + src/lib/dxf — never import from the DXF Viewer subapp (ADR-920 Α1, CHECK 3.62)', () => {
  const sources = [...terrainSources(TERRAIN_ROOT), ...terrainSources(DXF_ROOT)];

  it('sees the survey-import parsers and the DXF leaves (the scan is not empty)', () => {
    const names = sources.map((file) => path.basename(file));
    expect(names).toEqual(expect.arrayContaining([
      'topo-delimited-reader.ts', 'topo-excel-reader.ts', 'topo-column-mapping.ts', 'dxf-survey-points.ts',
      'dxf-section-scan.ts', 'dxf-line-stream.ts', 'dxf-embedded-object.ts', 'dxf-insunits.ts',
    ]));
  });

  it.each(sources.map((file) => [path.relative(LIB_ROOT, file), file]))('%s', (_name, file) => {
    const leaks = specifiersOf(fs.readFileSync(file, 'utf8')).filter((spec) => spec.includes('subapps/'));
    expect(leaks).toEqual([]);
  });
});

describe('readDelimitedText — header detection uses the field judge of the sniffer', () => {
  it('reads a Greek-locale `;` file with comma decimals as DATA, not as a header', () => {
    const table = readDelimitedText('345678,123;4201234,456;125,30\n345679,5;4201235,1;125,4');
    expect(table.delimiter).toBe(';');
    expect(table.headers).toEqual([]);
    expect(table.rows).toHaveLength(2);
  });

  it('keeps a label row whose cells merely CONTAIN digits as a header («P1» is never the number 1)', () => {
    const table = readDelimitedText('P1;E1;N1\n345678,1;4201234,4;125,3');
    expect(table.headers).toEqual(['P1', 'E1', 'N1']);
    expect(table.rows).toHaveLength(1);
  });

  it('agrees cell-by-cell with `parseTopoField`, so a row is data exactly when the mapper can read it', () => {
    for (const cell of ['384512.3', '384512,3', '-12', 'X', 'P1', '', '1e5']) {
      const headerless = readDelimitedText(`${cell};${cell};1\n1;2;3`).headers.length === 0;
      expect(headerless).toBe(parseTopoField(cell) !== null);
    }
  });
});
