/**
 * Tests — ADR-642 Φ5-B DXF COMPOUND-linetype I/O (LTYPE reader ⇄ writer).
 *
 * Proves the full-enterprise «όπως οι μεγάλοι» (Revit/ArchiCAD) strategy for a multi-layer compound
 * (road = two parallel rails, railway = two rails + centred cross-ties, #9):
 *   - GRACEFUL DEGRADE — a foreign reader sees the base layer (`layers[0]`) geometry in the `49` slots
 *     (a single stroke), never a broken record.
 *   - NESTOR LOSSLESS — a `NESTOR_APP_LTYPE` XDATA block carries every layer's perpendicular
 *     offset/width plus the FULL element list of `layers[1..]`, so a round-trip restores every stroke.
 *   - BASE OFFSET — a base layer whose own offset ≠ 0 (the road's ±0.5 rails, no centre) is preserved.
 *   - DISJOINT NAMESPACE — a record carrying BOTH base symbols (Φ3-B XDATA) and compound layers parses
 *     cleanly with either decoder (the compound keys never corrupt the symbol decoder and vice-versa).
 */

import { writeLayerTable, buildEmbeddedTextStyleHandles } from '../dxf-layer-table-writer';
import { parseLinetypeTable } from '../dxf-linetype-table-parser';
import { layersToComplex } from '../../config/line-pattern-segments';
import { listCompoundPresets } from '../../config/linetype-compound-presets';
import type { LinetypeDef } from '../../config/linetype-iso-catalog';
import type {
  ComplexLinetypeDef,
  StrokeLayer,
  SymbolElement,
  TextElement,
} from '../../config/complex-linetype-types';

/** Wrap a complex def as the LinetypeDef the writer consumes (geometry `pattern` = base-layer fallback). */
function toLinetypeDef(complex: ComplexLinetypeDef): LinetypeDef {
  const pattern = complex.layers[0].elements.map((el) =>
    el.kind === 'dash' ? el.lengthMm : el.kind === 'gap' ? -el.lengthMm : 0,
  );
  return { name: complex.name, description: complex.description, origin: 'user-created', pattern, complex };
}

/** Write one linetype to a token stream and parse it back (with an optional handle→font map). */
function roundTrip(complex: ComplexLinetypeDef, handleFonts?: Record<string, string>): ComplexLinetypeDef {
  const tokens = writeLayerTable({ layers: [], customLinetypes: [toLinetypeDef(complex)] });
  const { linetypes } = parseLinetypeTable(tokens, handleFonts);
  const recovered = linetypes.find((l) => l.name === complex.name);
  expect(recovered).toBeDefined();
  expect(recovered!.complex).toBeDefined();
  return recovered!.complex!;
}

/** A road compound built from the shipped preset (two solid rails at ±0.5, NO centre layer). */
function roadComplex(): ComplexLinetypeDef {
  const preset = listCompoundPresets().find((p) => p.id === 'road')!;
  return layersToComplex('ROAD', preset.build(), 'road', 'user-created');
}

/** A railway compound built from the shipped preset (two rails ±0.75 + a centred cross-tie layer). */
function railwayComplex(): ComplexLinetypeDef {
  const preset = listCompoundPresets().find((p) => p.id === 'railway')!;
  return layersToComplex('RAILWAY', preset.build(), 'railway', 'user-created');
}

describe('DXF compound-linetype round-trip (Φ5-B — road, base offset ≠ 0)', () => {
  it('restores both rails with their perpendicular offsets', () => {
    const road = roadComplex();
    const recovered = roundTrip(road);

    expect(recovered.layers).toHaveLength(2);
    // Base layer (rail 0) keeps its own non-zero offset — recovered from XDATA, not the `49` geometry.
    expect(recovered.layers[0].offsetMm).toBeCloseTo(road.layers[0].offsetMm!, 6);
    expect(recovered.layers[1].offsetMm).toBeCloseTo(road.layers[1].offsetMm!, 6);
    // Opposite signs (±0.5) → a genuine double line, not two coincident strokes.
    expect(Math.sign(recovered.layers[0].offsetMm!)).toBe(-Math.sign(recovered.layers[1].offsetMm!));

    for (const layer of recovered.layers) {
      expect(layer.elements.map((e) => e.kind)).toEqual(['dash']);
    }
  });

  it('degrades to the base rail geometry for a foreign reader (single stroke)', () => {
    const road = roadComplex();
    const tokens = writeLayerTable({ layers: [], customLinetypes: [toLinetypeDef(road)] });
    const { linetypes } = parseLinetypeTable(tokens);
    // The geometry-only `pattern` fallback is the base layer's `49` slots — one solid dash.
    const base = road.layers[0].elements.map((el) => (el.kind === 'dash' ? el.lengthMm : 0));
    expect(linetypes.find((l) => l.name === 'ROAD')!.pattern).toEqual(base);
  });
});

describe('DXF compound-linetype round-trip (Φ5-B — railway, symbol in a sub-layer)', () => {
  it('restores the two rails and the centred cross-tie layer with its symbol', () => {
    const railway = railwayComplex();
    const recovered = roundTrip(railway);

    expect(recovered.layers).toHaveLength(3);
    expect(recovered.layers[0].offsetMm).toBeCloseTo(railway.layers[0].offsetMm!, 6);
    expect(recovered.layers[1].offsetMm).toBeCloseTo(railway.layers[1].offsetMm!, 6);

    // Layer 2 = the tie line (a gap + a `tick` side symbol) at offset 0.
    const tie = recovered.layers[2];
    expect(tie.elements.map((e) => e.kind)).toEqual(['gap', 'symbol']);
    const tick = tie.elements[1] as SymbolElement;
    expect(tick.glyphId).toBe('tick');
    expect(tick.role).toBe('side');
    expect(tick.scale).toBeCloseTo(1.6, 6);
  });
});

describe('DXF compound-linetype round-trip (Φ5-B — field & namespace fidelity)', () => {
  it('preserves a sub-layer symbol scale/rotation/offsets exactly', () => {
    const complex: ComplexLinetypeDef = {
      name: 'CMP_SYM', description: 'compound symbol', origin: 'user-created',
      layers: [
        { elements: [{ kind: 'dash', lengthMm: 5 }], offsetMm: 1 },
        {
          elements: [
            { kind: 'gap', lengthMm: 2 },
            { kind: 'symbol', glyphId: 'arrow', role: 'outerCorner', scale: 2.25, rotationDeg: -45, offsetXMm: 0.3, offsetYMm: -0.7 },
          ],
          offsetMm: -1,
          widthMm: 0.4,
        },
      ],
    };
    const recovered = roundTrip(complex);
    expect(recovered.layers).toHaveLength(2);
    expect(recovered.layers[1].widthMm).toBeCloseTo(0.4, 6);
    const sym = recovered.layers[1].elements[1] as SymbolElement;
    expect(sym.glyphId).toBe('arrow');
    expect(sym.role).toBe('outerCorner');
    expect(sym.scale).toBeCloseTo(2.25, 6);
    expect(sym.rotationDeg).toBeCloseTo(-45, 6);
    expect(sym.offsetXMm).toBeCloseTo(0.3, 6);
    expect(sym.offsetYMm).toBeCloseTo(-0.7, 6);
  });

  it('round-trips a compound carrying BOTH a base symbol (XDATA) and an extra layer — disjoint decoders', () => {
    const complex: ComplexLinetypeDef = {
      name: 'CMP_MIX', description: 'base symbol + extra layer', origin: 'user-created',
      layers: [
        {
          elements: [
            { kind: 'dash', lengthMm: 4 },
            { kind: 'symbol', glyphId: 'cross', role: 'side', scale: 1, rotationDeg: 0, offsetXMm: 0, offsetYMm: 0 },
            { kind: 'gap', lengthMm: 2 },
          ],
        },
        { elements: [{ kind: 'dash', lengthMm: 6 }], offsetMm: 1.5 },
      ],
    };
    const recovered = roundTrip(complex);
    expect(recovered.layers).toHaveLength(2);
    // Base layer symbol survives via the Φ3-B symbol decoder (slot=…), untouched by the compound block.
    expect(recovered.layers[0].elements.map((e) => e.kind)).toEqual(['dash', 'symbol', 'gap']);
    expect((recovered.layers[0].elements[1] as SymbolElement).glyphId).toBe('cross');
    // Extra layer survives via the compound decoder (clayer=…), untouched by the symbol block.
    expect(recovered.layers[1].offsetMm).toBeCloseTo(1.5, 6);
    expect(recovered.layers[1].elements).toEqual([{ kind: 'dash', lengthMm: 6 }]);
  });

  it('round-trips embedded text in a sub-layer (edge case — value/style/follow preserved)', () => {
    const complex: ComplexLinetypeDef = {
      name: 'CMP_TXT', description: 'text sub-layer', origin: 'user-created',
      layers: [
        { elements: [{ kind: 'dash', lengthMm: 5 }], offsetMm: 0.8 },
        {
          elements: [
            { kind: 'gap', lengthMm: 3 },
            { kind: 'text', value: 'A=1;B', styleId: 'romans', scale: 0.75, rotationDeg: 15, offsetXMm: 0.1, offsetYMm: 0.2, followPath: false },
          ],
          offsetMm: -0.8,
        },
      ],
    };
    const recovered = roundTrip(complex);
    const txt = recovered.layers[1].elements[1] as TextElement;
    expect(txt.kind).toBe('text');
    expect(txt.value).toBe('A=1;B'); // delimiter-bearing value survives (own `1000` line, no escape)
    expect(txt.styleId).toBe('romans');
    expect(txt.scale).toBeCloseTo(0.75, 6);
    expect(txt.followPath).toBe(false);
  });

  it('leaves a simple single-layer type completely alone (no compound XDATA emitted)', () => {
    const dashed: LinetypeDef = { name: 'PLAIN', description: 'd', origin: 'user-created', pattern: [12.7, -6.35] };
    const tokens = writeLayerTable({ layers: [], customLinetypes: [dashed] });
    const { linetypes } = parseLinetypeTable(tokens);
    const recovered = linetypes.find((l) => l.name === 'PLAIN')!;
    expect(recovered.pattern).toEqual([12.7, -6.35]);
    expect(recovered.complex).toBeUndefined(); // not promoted to compound
    // And the token stream must NOT contain any compound XDATA marker.
    expect(tokens.some((t) => t.startsWith('clayer='))).toBe(false);
  });
});

describe('DXF compound-linetype — extra-layer element fidelity via presets', () => {
  it('every preset round-trips with identical layer count, offsets and element kinds', () => {
    for (const preset of listCompoundPresets()) {
      const original = layersToComplex(preset.id.toUpperCase(), preset.build(), preset.id, 'user-created');
      const recovered = roundTrip(original);
      expect(recovered.layers).toHaveLength(original.layers.length);
      original.layers.forEach((layer: StrokeLayer, i: number) => {
        expect(recovered.layers[i].elements.map((e) => e.kind)).toEqual(layer.elements.map((e) => e.kind));
        expect(recovered.layers[i].offsetMm ?? 0).toBeCloseTo(layer.offsetMm ?? 0, 6);
      });
    }
  });
});
