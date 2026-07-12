/**
 * Tests — ADR-642 Φ3-B DXF embedded-symbol I/O (LTYPE reader ⇄ writer).
 *
 * Proves the 3-tier symbol resolution:
 *   Tier 1 — an authored `──×──` fence survives `writeLayerTable() → parseLinetypeTable()` with its
 *            SymbolElement intact (glyph/role/scale/rotation/offsets) via Nestor XDATA — lossless.
 *   Tier 2 — a FOREIGN shape (`74 & 0x4`, no Nestor XDATA) in a well-known `acad.lin` linetype
 *            (`FENCELINE1`) is recovered to the mapped builtin glyph (`circle`).
 *   Tier 3 — a FOREIGN shape in an unrecognised linetype is gracefully skipped (geometry kept, no
 *            `complex`), never wrong geometry.
 * Plus: a simple geometry-only linetype is unaffected, and the well-known name map itself.
 */

import { writeLayerTable, buildEmbeddedTextStyleHandles } from '../dxf-layer-table-writer';
import { parseLinetypeTable } from '../dxf-linetype-table-parser';
import {
  resolveWellKnownLinetypeSymbol,
  listWellKnownLinetypeNames,
} from '../../config/linetype-shape-import-map';
import type { LinetypeDef } from '../../config/linetype-iso-catalog';
import type {
  ComplexLinetypeDef,
  SymbolElement,
  TextElement,
} from '../../config/complex-linetype-types';

function fenceLinetype(): LinetypeDef {
  const complex: ComplexLinetypeDef = {
    name: 'FENCE_X', description: 'fence', origin: 'user-created',
    layers: [{ elements: [
      { kind: 'dash', lengthMm: 5 },
      { kind: 'symbol', glyphId: 'cross', role: 'side', scale: 1.5, rotationDeg: 30, offsetXMm: -1, offsetYMm: 2 },
      { kind: 'gap', lengthMm: 3 },
    ] }],
  };
  return { name: 'FENCE_X', description: 'fence', origin: 'user-created', pattern: [5, 0, -3], complex };
}

/** A FOREIGN LTYPE token stream: one dash, one shape slot (`74 4` + `75`), one gap. No Nestor XDATA. */
function foreignShapeTokens(name: string): string[] {
  return [
    '0', 'SECTION', '2', 'TABLES',
    '0', 'TABLE', '2', 'LTYPE',
    '0', 'LTYPE', '2', name, '70', '0', '3', 'foreign', '72', '65', '73', '3', '40', '8',
    '49', '5.0',
    '49', '0.0', '74', '4', '75', '5',
    '49', '-3.0',
    '0', 'ENDTAB',
    '0', 'ENDSEC',
  ];
}

describe('DXF complex-linetype symbol round-trip (Tier 1 — Nestor XDATA)', () => {
  it('recovers the embedded symbol with all fields intact', () => {
    const lt = fenceLinetype();
    const tokens = writeLayerTable({ layers: [], customLinetypes: [lt] });
    const { linetypes } = parseLinetypeTable(tokens);

    const fence = linetypes.find((l) => l.name === 'FENCE_X');
    expect(fence).toBeDefined();
    expect(fence!.complex).toBeDefined();

    const els = fence!.complex!.layers[0].elements;
    expect(els.map((e) => e.kind)).toEqual(['dash', 'symbol', 'gap']);
    expect(els[0]).toEqual({ kind: 'dash', lengthMm: 5 });
    expect(els[2]).toEqual({ kind: 'gap', lengthMm: 3 });

    const sym = els[1] as SymbolElement;
    expect(sym.kind).toBe('symbol');
    expect(sym.glyphId).toBe('cross');
    expect(sym.role).toBe('side');
    expect(sym.scale).toBeCloseTo(1.5, 6);
    expect(sym.rotationDeg).toBeCloseTo(30, 6);
    expect(sym.offsetXMm).toBeCloseTo(-1, 6);
    expect(sym.offsetYMm).toBeCloseTo(2, 6);
  });

  it('the geometry-only fallback pattern degrades the symbol to a zero-length slot', () => {
    const lt = fenceLinetype();
    const tokens = writeLayerTable({ layers: [], customLinetypes: [lt] });
    const { linetypes } = parseLinetypeTable(tokens);
    // dash 5, symbol → 0 (universal-valid zero-length slot), gap −3.
    expect(linetypes.find((l) => l.name === 'FENCE_X')!.pattern).toEqual([5, 0, -3]);
  });

  it('round-trips a corner-role symbol via XDATA (role survives, ADR-642 Φ4)', () => {
    const complex: ComplexLinetypeDef = {
      name: 'CORNER', description: 'corner post', origin: 'user-created',
      layers: [{ elements: [
        { kind: 'dash', lengthMm: 5 },
        { kind: 'symbol', glyphId: 'square', role: 'innerCorner', scale: 1, rotationDeg: 0, offsetXMm: 0, offsetYMm: 0 },
        { kind: 'gap', lengthMm: 3 },
      ] }],
    };
    const lt: LinetypeDef = { name: 'CORNER', description: 'corner', origin: 'user-created', pattern: [5, 0, -3], complex };

    const tokens = writeLayerTable({ layers: [], customLinetypes: [lt] });
    const { linetypes } = parseLinetypeTable(tokens);
    const sym = linetypes.find((l) => l.name === 'CORNER')!.complex!.layers[0].elements[1] as SymbolElement;
    expect(sym.role).toBe('innerCorner');
    expect(sym.glyphId).toBe('square');
  });

  it('round-trips text AND symbol in one linetype, preserving element order', () => {
    const complex: ComplexLinetypeDef = {
      name: 'MIX', description: 'text+symbol', origin: 'user-created',
      layers: [{ elements: [
        { kind: 'dash', lengthMm: 4 },
        { kind: 'text', value: 'W', styleId: 'romans', scale: 0.5, rotationDeg: 0, offsetXMm: 0, offsetYMm: 0, followPath: true },
        { kind: 'symbol', glyphId: 'arrow', role: 'side', scale: 1, rotationDeg: 0, offsetXMm: 0, offsetYMm: 0 },
        { kind: 'gap', lengthMm: 2 },
      ] }],
    };
    const lt: LinetypeDef = { name: 'MIX', description: 'mix', origin: 'user-created', pattern: [4, 0, 0, -2], complex };

    const tokens = writeLayerTable({ layers: [], customLinetypes: [lt] });
    // Reconstruct the reader's handle→font map from the writer's deterministic styleId handles.
    const styleToHandle = buildEmbeddedTextStyleHandles([lt]);
    const handleFonts: Record<string, string> = {};
    for (const [styleId, handle] of styleToHandle) handleFonts[handle.toUpperCase()] = styleId;

    const { linetypes } = parseLinetypeTable(tokens, handleFonts);
    const els = linetypes.find((l) => l.name === 'MIX')!.complex!.layers[0].elements;
    expect(els.map((e) => e.kind)).toEqual(['dash', 'text', 'symbol', 'gap']);
    expect((els[1] as TextElement).value).toBe('W');
    expect((els[2] as SymbolElement).glyphId).toBe('arrow');
  });
});

describe('DXF complex-linetype symbol import (Tier 2 — well-known name / Tier 3 — skip)', () => {
  it('recovers a foreign FENCELINE1 shape as the mapped `circle` glyph', () => {
    const { linetypes } = parseLinetypeTable(foreignShapeTokens('FENCELINE1'));
    const lt = linetypes.find((l) => l.name === 'FENCELINE1');
    expect(lt!.complex).toBeDefined();
    const els = lt!.complex!.layers[0].elements;
    expect(els.map((e) => e.kind)).toEqual(['dash', 'symbol', 'gap']);
    expect((els[1] as SymbolElement).glyphId).toBe('circle');
  });

  it('recovers a foreign FENCELINE2 shape as `square` (case-insensitive name)', () => {
    const { linetypes } = parseLinetypeTable(foreignShapeTokens('fenceline2'));
    const els = linetypes.find((l) => l.name === 'fenceline2')!.complex!.layers[0].elements;
    expect((els[1] as SymbolElement).glyphId).toBe('square');
  });

  it('gracefully skips an unrecognised foreign shape — geometry kept, no complex', () => {
    const { linetypes } = parseLinetypeTable(foreignShapeTokens('SOME_VENDOR_LINE'));
    const lt = linetypes.find((l) => l.name === 'SOME_VENDOR_LINE');
    expect(lt!.complex).toBeUndefined();
    expect(lt!.pattern).toEqual([5, 0, -3]); // shape slot stays a zero-length dot, dashes intact
  });

  it('a simple geometry-only linetype keeps the plain 49 emission, no complex', () => {
    const dashed: LinetypeDef = { name: 'MyDash', description: 'd', origin: 'user-created', pattern: [12.7, -6.35] };
    const tokens = writeLayerTable({ layers: [], customLinetypes: [dashed] });
    const { linetypes } = parseLinetypeTable(tokens);
    const recovered = linetypes.find((l) => l.name === 'MyDash');
    expect(recovered!.pattern).toEqual([12.7, -6.35]);
    expect(recovered!.complex).toBeUndefined();
  });
});

describe('resolveWellKnownLinetypeSymbol (acad.lin standard-name map)', () => {
  it('maps documented standards to shipped glyphs', () => {
    expect(resolveWellKnownLinetypeSymbol('FENCELINE1')).toEqual({ glyphId: 'circle', role: 'side' });
    expect(resolveWellKnownLinetypeSymbol('FENCELINE2')).toEqual({ glyphId: 'square', role: 'side' });
    expect(resolveWellKnownLinetypeSymbol('BATTING')).toEqual({ glyphId: 'insulation', role: 'side' });
    expect(resolveWellKnownLinetypeSymbol('TRACKS')).toEqual({ glyphId: 'tick', role: 'side' });
  });

  it('is case-insensitive and trims, and returns null for unknown/empty', () => {
    expect(resolveWellKnownLinetypeSymbol('  zigzag ')).toEqual({ glyphId: 'insulation', role: 'side' });
    expect(resolveWellKnownLinetypeSymbol('NOPE')).toBeNull();
    expect(resolveWellKnownLinetypeSymbol(undefined)).toBeNull();
  });

  it('every mapped glyph exists in the symbol catalog (map stays honest)', () => {
    for (const name of listWellKnownLinetypeNames()) {
      expect(resolveWellKnownLinetypeSymbol(name)).not.toBeNull();
    }
  });
});
