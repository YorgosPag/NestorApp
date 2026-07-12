/**
 * Tests — ADR-642 Φ2-B DXF `[TEXT,...]` embedded-text I/O (LTYPE reader ⇄ writer).
 *
 * Proves an authored `──GAS──` complex linetype survives `writeLayerTable() →
 * parseLinetypeTable()` with its embedded text intact (value/style/scale/rotation/
 * offsets/followPath), and that a real STYLE table's `340` handle resolves to the font.
 */

import { writeLayerTable, buildEmbeddedTextStyleHandles } from '../dxf-layer-table-writer';
import { parseLinetypeTable } from '../dxf-linetype-table-parser';
import { buildStyleHandleFontMap } from '../../text-engine/parser/style-table-reader';
import type { LinetypeDef } from '../../config/linetype-iso-catalog';
import type { ComplexLinetypeDef, TextElement } from '../../config/complex-linetype-types';

function gasLinetype(followPath = true): LinetypeDef {
  const complex: ComplexLinetypeDef = {
    name: 'GAS', description: 'gas line', origin: 'user-created',
    layers: [{ elements: [
      { kind: 'dash', lengthMm: 5 },
      { kind: 'gap', lengthMm: 2 },
      { kind: 'text', value: 'GAS', styleId: 'romans', scale: 0.5, rotationDeg: 15, offsetXMm: -2, offsetYMm: 1, followPath },
      { kind: 'gap', lengthMm: 5 },
    ] }],
  };
  return { name: 'GAS', description: 'gas line', origin: 'user-created', pattern: [5, -2, 0, -5], complex };
}

/** The reader needs `handle → font`; reconstruct it from the writer's deterministic styleId map. */
function handleFontMapFor(linetypes: LinetypeDef[]): Record<string, string> {
  const styleToHandle = buildEmbeddedTextStyleHandles(linetypes);
  const out: Record<string, string> = {};
  for (const [styleId, handle] of styleToHandle) out[handle.toUpperCase()] = styleId;
  return out;
}

describe('DXF complex-linetype round-trip (writer → reader)', () => {
  it('recovers the embedded text with all fields intact', () => {
    const lt = gasLinetype(true);
    const tokens = writeLayerTable({ layers: [], customLinetypes: [lt] });
    const { linetypes } = parseLinetypeTable(tokens, handleFontMapFor([lt]));

    const gas = linetypes.find((l) => l.name === 'GAS');
    expect(gas).toBeDefined();
    expect(gas!.complex).toBeDefined();

    const els = gas!.complex!.layers[0].elements;
    expect(els.map((e) => e.kind)).toEqual(['dash', 'gap', 'text', 'gap']);
    expect(els[0]).toEqual({ kind: 'dash', lengthMm: 5 });
    expect(els[1]).toEqual({ kind: 'gap', lengthMm: 2 });
    expect(els[3]).toEqual({ kind: 'gap', lengthMm: 5 });

    const text = els[2] as TextElement;
    expect(text.kind).toBe('text');
    expect(text.value).toBe('GAS');
    expect(text.styleId).toBe('romans'); // 340 handle → font via the reconstructed map
    expect(text.scale).toBeCloseTo(0.5, 6);
    expect(text.rotationDeg).toBeCloseTo(15, 6);
    expect(text.offsetXMm).toBeCloseTo(-2, 6);
    expect(text.offsetYMm).toBeCloseTo(1, 6);
    expect(text.followPath).toBe(true);
  });

  it('round-trips followPath=false (absolute rotation, 74 bit 1)', () => {
    const lt = gasLinetype(false);
    const tokens = writeLayerTable({ layers: [], customLinetypes: [lt] });
    const { linetypes } = parseLinetypeTable(tokens, handleFontMapFor([lt]));
    const text = linetypes.find((l) => l.name === 'GAS')!.complex!.layers[0].elements[2] as TextElement;
    expect(text.followPath).toBe(false);
  });

  it('unresolved 340 handle falls back to the Standard style (never throws)', () => {
    const lt = gasLinetype(true);
    const tokens = writeLayerTable({ layers: [], customLinetypes: [lt] });
    const { linetypes } = parseLinetypeTable(tokens); // no handle map
    const text = linetypes.find((l) => l.name === 'GAS')!.complex!.layers[0].elements[2] as TextElement;
    expect(text.value).toBe('GAS');
    expect(text.styleId).toBe('Standard');
  });

  it('a simple (geometry-only) linetype keeps the plain 49 emission, no complex', () => {
    const dashed: LinetypeDef = { name: 'MyDash', description: 'd', origin: 'user-created', pattern: [12.7, -6.35] };
    const tokens = writeLayerTable({ layers: [], customLinetypes: [dashed] });
    const { linetypes } = parseLinetypeTable(tokens);
    const recovered = linetypes.find((l) => l.name === 'MyDash');
    expect(recovered!.pattern).toEqual([12.7, -6.35]);
    expect(recovered!.complex).toBeUndefined();
  });
});

describe('buildStyleHandleFontMap — real STYLE table 340 resolution', () => {
  it('maps a STYLE record handle (group 5) to its stripped font family', () => {
    const dxf = [
      '0', 'SECTION', '2', 'TABLES',
      '0', 'TABLE', '2', 'STYLE',
      '0', 'STYLE', '5', 'A0', '2', 'GasText', '3', 'romans.shx', '40', '0', '41', '1', '50', '0', '70', '0', '71', '0',
      '0', 'ENDTAB',
      '0', 'ENDSEC',
    ].join('\n');
    const map = buildStyleHandleFontMap(dxf);
    expect(map['A0']).toBe('romans');
  });

  it('a full DXF (STYLE + LTYPE) resolves the embedded-text style by handle', () => {
    const dxf = [
      '0', 'SECTION', '2', 'TABLES',
      '0', 'TABLE', '2', 'STYLE',
      '0', 'STYLE', '5', '2C', '2', 'GasText', '3', 'romans.shx', '40', '0', '41', '1', '50', '0', '70', '0', '71', '0',
      '0', 'ENDTAB',
      '0', 'TABLE', '2', 'LTYPE',
      '0', 'LTYPE', '2', 'GAS', '70', '0', '3', 'gas', '72', '65', '73', '4', '40', '12',
      '49', '5.0',
      '49', '-2.0',
      '49', '0.0', '74', '2', '75', '0', '340', '2C', '46', '1.0', '50', '0.0', '44', '0.0', '45', '0.0', '9', 'GAS',
      '49', '-5.0',
      '0', 'ENDTAB',
      '0', 'ENDSEC',
    ];
    const map = buildStyleHandleFontMap(dxf.join('\n'));
    const { linetypes } = parseLinetypeTable(dxf, map);
    const text = linetypes.find((l) => l.name === 'GAS')!.complex!.layers[0].elements[2] as TextElement;
    expect(text.value).toBe('GAS');
    expect(text.styleId).toBe('romans'); // 340 2C → STYLE GasText → romans.shx → 'romans'
  });
});
