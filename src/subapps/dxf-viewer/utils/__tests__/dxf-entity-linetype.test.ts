/**
 * ADR-635 Φ C.4 — per-entity linetype import (DXF group codes 6 + 48) + $LTSCALE + LTYPE pre-pass.
 *
 * Proves the AutoCAD linetype cascade at IMPORT time:
 *   - group 6 (linetype name) → concrete `linetypeName` baked on the entity
 *   - the BYLAYER/BYBLOCK sentinels + absent → undefined (layer cascade); `Continuous`
 *     is a REAL linetype → baked (overrides a dashed layer)
 *   - group 48 (CELTSCALE) → per-object `ltscale`; absent/invalid/trivial-1 → undefined
 *   - the router (`convertEntityToScene`) applies both uniformly to every entity type
 *   - no 6/48 ⇒ the emitted entity is UNCHANGED (native/Tekton/bare gate, zero regression)
 *   - `$LTSCALE` parsed into the header (fidelity/round-trip) — NOT applied
 *   - `DxfSceneBuilder` registers the LTYPE table so custom names resolve at render
 *
 * The dash-px conversion + LTSCALE/CELTSCALE stacking are tested downstream
 * (`rendering/__tests__/linetype-dash-resolver.test.ts`, ADR-510 Φ2); here we only assert
 * the imported name/scale reach the entity + registry.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  extractEntityLinetype,
  extractEntityLtscale,
} from '../dxf-converter-helpers';
import { convertEntityToScene, type EntityData } from '../dxf-entity-converters';
import { DxfEntityParser } from '../dxf-entity-parser';
import { DxfSceneBuilder } from '../dxf-scene-builder';
import {
  resolveLinetype,
  __resetLinetypeRegistryForTesting,
} from '../../stores/LinetypeRegistry';

describe('extractEntityLinetype — concrete name (group 6)', () => {
  it('bakes a concrete linetype name verbatim', () => {
    expect(extractEntityLinetype({ '6': 'Dashed' })).toBe('Dashed');
    expect(extractEntityLinetype({ '6': 'HIDDEN' })).toBe('HIDDEN'); // case forwarded — resolver is case-insensitive
    expect(extractEntityLinetype({ '6': 'MyCustomLT' })).toBe('MyCustomLT');
  });

  it('bakes Continuous (a real linetype, not a sentinel → overrides a dashed layer)', () => {
    expect(extractEntityLinetype({ '6': 'Continuous' })).toBe('Continuous');
  });

  it('returns undefined for the ByLayer/ByBlock sentinels (any case)', () => {
    expect(extractEntityLinetype({ '6': 'ByLayer' })).toBeUndefined();
    expect(extractEntityLinetype({ '6': 'BYLAYER' })).toBeUndefined();
    expect(extractEntityLinetype({ '6': 'ByBlock' })).toBeUndefined();
    expect(extractEntityLinetype({ '6': 'BYBLOCK' })).toBeUndefined();
  });

  it('returns undefined when 6 is absent or blank', () => {
    expect(extractEntityLinetype({})).toBeUndefined();
    expect(extractEntityLinetype({ '62': '1' })).toBeUndefined();
    expect(extractEntityLinetype({ '6': '   ' })).toBeUndefined();
  });
});

describe('extractEntityLtscale — per-object CELTSCALE (group 48)', () => {
  it('returns a finite positive scale', () => {
    expect(extractEntityLtscale({ '48': '2' })).toBe(2);
    expect(extractEntityLtscale({ '48': '0.5' })).toBe(0.5);
  });

  it('returns undefined for the trivial default 1 (gate → no-op)', () => {
    expect(extractEntityLtscale({ '48': '1' })).toBeUndefined();
  });

  it('returns undefined when 48 is absent / non-positive / non-numeric', () => {
    expect(extractEntityLtscale({})).toBeUndefined();
    expect(extractEntityLtscale({ '48': '0' })).toBeUndefined();
    expect(extractEntityLtscale({ '48': '-3' })).toBeUndefined();
    expect(extractEntityLtscale({ '48': 'xx' })).toBeUndefined();
  });
});

/** Minimal well-formed LINE entity data (start 10/20, end 11/21). */
function lineData(extra: Record<string, string>): EntityData {
  return {
    type: 'LINE',
    layer: '0',
    data: { '10': '0', '20': '0', '11': '100', '21': '0', ...extra },
  };
}

describe('convertEntityToScene — bakes imported linetype + ltscale (router SSoT)', () => {
  it('sets linetypeName from a concrete group 6 on the emitted entity', () => {
    const entity = convertEntityToScene(lineData({ '6': 'Dashed' }), 0);
    expect(entity).not.toBeNull();
    expect((entity as { linetypeName?: string }).linetypeName).toBe('Dashed');
  });

  it('sets ltscale from a non-trivial group 48', () => {
    const entity = convertEntityToScene(lineData({ '6': 'Dashed', '48': '2' }), 0);
    expect((entity as { ltscale?: number }).ltscale).toBe(2);
  });

  it('leaves linetypeName + ltscale absent when there is no 6/48 (native/Tekton gate)', () => {
    const entity = convertEntityToScene(lineData({}), 0);
    expect(entity).not.toBeNull();
    expect((entity as { linetypeName?: string }).linetypeName).toBeUndefined();
    expect((entity as { ltscale?: number }).ltscale).toBeUndefined();
  });

  it('leaves linetypeName absent for a ByLayer sentinel (6 = ByLayer)', () => {
    const entity = convertEntityToScene(lineData({ '6': 'ByLayer' }), 0);
    expect((entity as { linetypeName?: string }).linetypeName).toBeUndefined();
  });

  it('applies to a non-LINE type too (CIRCLE) — router is type-agnostic', () => {
    const circle = convertEntityToScene(
      { type: 'CIRCLE', layer: '0', data: { '10': '0', '20': '0', '40': '5', '6': 'Hidden', '48': '3' } },
      1,
    );
    expect((circle as { linetypeName?: string }).linetypeName).toBe('Hidden');
    expect((circle as { ltscale?: number }).ltscale).toBe(3);
  });

  it('coexists with the C.3 lineweight bake (both fields on one entity)', () => {
    const entity = convertEntityToScene(lineData({ '6': 'Dashed', '370': '50' }), 0);
    expect((entity as { linetypeName?: string }).linetypeName).toBe('Dashed');
    expect((entity as { lineweightMm?: number }).lineweightMm).toBe(0.5);
  });
});

describe('parseHeader — $LTSCALE (group 40, parsed not applied)', () => {
  const withHeader = (vars: string[]): string[] => [
    '0', 'SECTION', '2', 'HEADER', ...vars, '0', 'ENDSEC',
  ];

  it('parses a finite positive $LTSCALE', () => {
    const header = DxfEntityParser.parseHeader(withHeader(['9', '$LTSCALE', '40', '2.5']));
    expect(header.ltscale).toBe(2.5);
  });

  it('leaves ltscale undefined when absent', () => {
    const header = DxfEntityParser.parseHeader(withHeader(['9', '$INSUNITS', '70', '4']));
    expect(header.ltscale).toBeUndefined();
  });

  it('ignores a non-positive $LTSCALE (AutoCAD rejects LTSCALE <= 0)', () => {
    const header = DxfEntityParser.parseHeader(withHeader(['9', '$LTSCALE', '40', '0']));
    expect(header.ltscale).toBeUndefined();
  });
});

describe('DxfSceneBuilder — LTYPE table pre-pass registers custom linetypes', () => {
  beforeEach(() => {
    __resetLinetypeRegistryForTesting();
  });

  it('registers the DXF custom linetype so it resolves at render, and bakes it on the entity', () => {
    const dxf = [
      '0', 'SECTION',
      '2', 'TABLES',
      '0', 'TABLE',
      '2', 'LTYPE',
      '70', '1',
      '0', 'LTYPE',
      '2', 'TripleDash',
      '73', '2',
      '40', '15',
      '49', '10',
      '49', '-5',
      '0', 'ENDTAB',
      '0', 'ENDSEC',
      '0', 'SECTION',
      '2', 'ENTITIES',
      '0', 'LINE',
      '8', '0',
      '6', 'TripleDash',
      '10', '0',
      '20', '0',
      '11', '100',
      '21', '0',
      '0', 'ENDSEC',
      '0', 'EOF',
    ].join('\n');

    // Before import the custom name is unknown to the registry.
    expect(resolveLinetype('TripleDash')).toBeNull();

    const scene = DxfSceneBuilder.buildScene(dxf, 'mm');

    // Pre-pass registered it (with the DXF-import pattern).
    const def = resolveLinetype('TripleDash');
    expect(def).not.toBeNull();
    expect(def?.pattern).toEqual([10, -5]);
    expect(def?.origin).toBe('dxf-import');

    // And the LINE carries the per-entity linetype name.
    const line = scene.entities.find((e) => e.type === 'line');
    expect(line).toBeDefined();
    expect((line as { linetypeName?: string }).linetypeName).toBe('TripleDash');
  });
});
