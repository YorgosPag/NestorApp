/**
 * DXF LAYER Table Parser unit tests — ADR-358 Phase 3A.
 *
 * One micro-fixture per consumed group code (2, 6, 62, 70, 290, 370, 420),
 * plus XDATA AppId coverage (AcCmTransparency, NestorAec, NestorLayerMeta,
 * NestorBimCategory, NestorVpOverride). Confirms `parseLayerTable()` produces
 * a `SceneLayer` with the expected field populated and defaults elsewhere.
 *
 * Linetype resolution depends on the LTYPE pre-pass; each test that uses a
 * non-baseline linetype registers it via `parseLinetypeTable` first.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  __resetLinetypeRegistryForTesting,
  registerLinetypes,
} from '../../stores/LinetypeRegistry';
import { parseLinetypeTable } from '../dxf-linetype-table-parser';
import { parseLayerTable } from '../dxf-layer-table-parser';

beforeEach(() => {
  __resetLinetypeRegistryForTesting();
});

function tablesSection(layerEntryLines: string[]): string[] {
  return [
    '0', 'SECTION',
    '2', 'TABLES',
    '0', 'TABLE',
    '2', 'LAYER',
    '70', '1',
    '0', 'LAYER',
    ...layerEntryLines,
    '0', 'ENDTAB',
    '0', 'ENDSEC',
  ];
}

describe('parseLayerTable — DXF group code coverage', () => {
  it('group 2: extracts layer name', () => {
    const result = parseLayerTable(tablesSection(['2', 'WALLS']));
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0].name).toBe('WALLS');
  });

  it('group 62: parses ACI and visible=true for positive', () => {
    const result = parseLayerTable(tablesSection(['2', 'L', '62', '5']));
    expect(result.layers[0].colorAci).toBe(5);
    expect(result.layers[0].visible).toBe(true);
  });

  it('group 62 negative: layer OFF (visible=false), abs ACI preserved', () => {
    const result = parseLayerTable(tablesSection(['2', 'L', '62', '-3']));
    expect(result.layers[0].colorAci).toBe(3);
    expect(result.layers[0].visible).toBe(false);
  });

  it('group 70 bit 1: frozen=true', () => {
    const result = parseLayerTable(tablesSection(['2', 'L', '70', '1']));
    expect(result.layers[0].frozen).toBe(true);
    expect(result.layers[0].locked).toBe(false);
  });

  it('group 70 bit 4: locked=true', () => {
    const result = parseLayerTable(tablesSection(['2', 'L', '70', '4']));
    expect(result.layers[0].frozen).toBe(false);
    expect(result.layers[0].locked).toBe(true);
  });

  it('group 70 bit 1 + bit 4: frozen AND locked', () => {
    const result = parseLayerTable(tablesSection(['2', 'L', '70', '5']));
    expect(result.layers[0].frozen).toBe(true);
    expect(result.layers[0].locked).toBe(true);
  });

  it('group 6: resolves ISO baseline linetype', () => {
    const result = parseLayerTable(tablesSection(['2', 'L', '6', 'Dashed']));
    expect(result.layers[0].linetype).toBe('Dashed');
    expect(result.warnings).toHaveLength(0);
  });

  it('group 6: unknown linetype warns and falls back to Continuous', () => {
    const result = parseLayerTable(tablesSection(['2', 'L', '6', 'NotARealLinetype']));
    expect(result.layers[0].linetype).toBe('Continuous');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('group 6: resolves custom linetype after LTYPE pre-pass', () => {
    registerLinetypes([{
      name: 'CustomBlue', description: '_._', pattern: [10, -5], origin: 'dxf-import',
    }]);
    const result = parseLayerTable(tablesSection(['2', 'L', '6', 'CustomBlue']));
    expect(result.layers[0].linetype).toBe('CustomBlue');
    expect(result.warnings).toHaveLength(0);
  });

  it('group 370: encodes ISO lineweight (25 → 0.25mm)', () => {
    const result = parseLayerTable(tablesSection(['2', 'L', '370', '25']));
    expect(result.layers[0].lineweight).toBe(0.25);
  });

  it('group 370: -3 sentinel = DEFAULT', () => {
    const result = parseLayerTable(tablesSection(['2', 'L', '370', '-3']));
    expect(result.layers[0].lineweight).toBe(-3);
  });

  it('group 290: plottable=true for "1"', () => {
    const result = parseLayerTable(tablesSection(['2', 'L', '290', '1']));
    expect(result.layers[0].plottable).toBe(true);
  });

  it('group 290: plottable=false for "0"', () => {
    const result = parseLayerTable(tablesSection(['2', 'L', '290', '0']));
    expect(result.layers[0].plottable).toBe(false);
  });

  it('group 290: plottable default=true when absent', () => {
    const result = parseLayerTable(tablesSection(['2', 'L']));
    expect(result.layers[0].plottable).toBe(true);
  });

  it('group 420: parses true color', () => {
    const result = parseLayerTable(tablesSection(['2', 'L', '420', String(0xff8040)]));
    expect(result.layers[0].colorTrueColor).toBe(0xff8040);
  });
});

describe('parseLayerTable — XDATA AppId coverage', () => {
  it('AcCmTransparency 1071: decodes alpha → transparency 0-90', () => {
    // alpha = 128 → transparency = round((1 - 128/255) * 90) = round(44.8) = 45
    const encoded = 0x02000000 | 128;
    const result = parseLayerTable(tablesSection([
      '2', 'L',
      '1001', 'AcCmTransparency',
      '1071', String(encoded),
    ]));
    expect(result.layers[0].transparency).toBe(45);
  });

  it('NestorAec: extracts category + tags', () => {
    const result = parseLayerTable(tablesSection([
      '2', 'L',
      '1001', 'NestorAec',
      '1000', 'category=architectural',
      '1000', 'tag=load-bearing',
      '1000', 'tag=fire-rated',
    ]));
    expect(result.layers[0].category).toBe('architectural');
    expect(result.layers[0].tags).toEqual(['load-bearing', 'fire-rated']);
  });

  it('NestorAec: rejects unknown category enum, falls back to general', () => {
    const result = parseLayerTable(tablesSection([
      '2', 'L',
      '1001', 'NestorAec',
      '1000', 'category=notReal',
    ]));
    expect(result.layers[0].category).toBe('general');
  });

  it('NestorAec: caps tags at 8 entries', () => {
    const tagEntries = Array.from({ length: 12 }, (_, i) => ['1000', `tag=t${i}`]).flat();
    const result = parseLayerTable(tablesSection([
      '2', 'L',
      '1001', 'NestorAec',
      ...tagEntries,
    ]));
    expect(result.layers[0].tags).toHaveLength(8);
  });

  it('NestorLayerMeta: extracts description', () => {
    const result = parseLayerTable(tablesSection([
      '2', 'L',
      '1001', 'NestorLayerMeta',
      '1000', 'description=Main load-bearing walls (ISO 128)',
    ]));
    expect(result.layers[0].description).toBe('Main load-bearing walls (ISO 128)');
  });

  it('NestorBimCategory: extracts IFC category (Q15 scaffold round-trip)', () => {
    const result = parseLayerTable(tablesSection([
      '2', 'L',
      '1001', 'NestorBimCategory',
      '1000', 'category=IfcWall',
    ]));
    expect(result.layers[0].bimCategory).toBe('IfcWall');
  });

  it('NestorVpOverride: extracts JSON-encoded overrides (Q16 scaffold round-trip)', () => {
    const overrides = { vp_1: { visible: false, frozen: true } };
    const result = parseLayerTable(tablesSection([
      '2', 'L',
      '1001', 'NestorVpOverride',
      '1000', `vpOverrides=${JSON.stringify(overrides)}`,
    ]));
    expect(result.layers[0].vpOverrides).toEqual(overrides);
  });
});

describe('parseLayerTable — missing data warnings', () => {
  it('warns when layer entry has no name', () => {
    const result = parseLayerTable([
      '0', 'SECTION',
      '2', 'TABLES',
      '0', 'TABLE',
      '2', 'LAYER',
      '70', '1',
      '0', 'LAYER',
      '62', '5',
      '0', 'ENDTAB',
      '0', 'ENDSEC',
    ]);
    expect(result.layers).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].message).toMatch(/missing required group code 2/);
  });
});

describe('parseLinetypeTable + parseLayerTable pre-pass integration', () => {
  it('LTYPE table parsed, then registered, then LAYER resolves the custom name', () => {
    const dxf = [
      '0', 'SECTION',
      '2', 'TABLES',
      '0', 'TABLE',
      '2', 'LTYPE',
      '70', '1',
      '0', 'LTYPE',
      '2', 'TripleDash',
      '70', '0',
      '3', '___ ___ ___',
      '72', '65',
      '73', '2',
      '40', '15',
      '49', '10',
      '49', '-5',
      '0', 'ENDTAB',
      '0', 'TABLE',
      '2', 'LAYER',
      '70', '1',
      '0', 'LAYER',
      '2', 'CUSTOM_L',
      '6', 'TripleDash',
      '0', 'ENDTAB',
      '0', 'ENDSEC',
    ];

    const lt = parseLinetypeTable(dxf);
    expect(lt.linetypes).toHaveLength(1);
    expect(lt.linetypes[0].name).toBe('TripleDash');
    expect(lt.linetypes[0].pattern).toEqual([10, -5]);
    expect(lt.linetypes[0].origin).toBe('dxf-import');

    registerLinetypes(lt.linetypes);

    const layers = parseLayerTable(dxf);
    expect(layers.layers).toHaveLength(1);
    expect(layers.layers[0].linetype).toBe('TripleDash');
    expect(layers.warnings).toHaveLength(0);
  });
});
