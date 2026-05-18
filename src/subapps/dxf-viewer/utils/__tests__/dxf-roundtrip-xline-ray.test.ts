/**
 * DXF XLINE + RAY Roundtrip Integrity — ADR-359 Phase 9.
 *
 * Proves `writeXLineRayEntities() → convertXLine() / convertRay()` reconstructs
 * the original entity's basePoint and direction (tolerance 1e-6) byte-equivalent.
 *
 * Test groups:
 *   1. Writer structure — SECTION/ENTITIES/ENDSEC + per-entity group codes.
 *   2. Direction normalisation — writer normalises at export; parser re-normalises on
 *      import → result always unit vector.
 *   3. ByLayer integrity — colorMode ByLayer → code 62 absent; Concrete → code 62 present.
 *   4. Roundtrip fixtures — simulated AutoCAD / BricsCAD / ezdxf token arrays fed
 *      directly to convertXLine / convertRay → assert basePoint + direction ±1e-6.
 *   5. Roundtrip write → parse — write entities → extract tokens → re-import → diff zero.
 */

import { describe, it, expect } from '@jest/globals';
import { writeXLineRayEntities } from '../dxf-xline-ray-writer';
import { convertXLine, convertRay } from '../dxf-entity-converters';
import type { XLineEntity, RayEntity } from '../../types/entities';

// ──────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeXLine(overrides: Partial<XLineEntity> = {}): XLineEntity {
  return {
    id: 'xline-test-1',
    type: 'xline',
    layerId: '0',
    visible: true,
    basePoint: { x: 100, y: 200 },
    direction: { x: 1, y: 0 },
    ...overrides,
  };
}

function makeRay(overrides: Partial<RayEntity> = {}): RayEntity {
  return {
    id: 'ray-test-1',
    type: 'ray',
    layerId: '0',
    visible: true,
    basePoint: { x: 50, y: 75 },
    direction: { x: 0, y: 1 },
    ...overrides,
  };
}

/** Find first value following a group code (scans even positions). */
function findCode(tokens: string[], code: string): string | undefined {
  for (let i = 0; i < tokens.length - 1; i += 2) {
    if (tokens[i] === code) return tokens[i + 1];
  }
  return undefined;
}

/** All values following a group code (scans even positions). */
function findAllCodes(tokens: string[], code: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < tokens.length - 1; i += 2) {
    if (tokens[i] === code) result.push(tokens[i + 1]);
  }
  return result;
}

/**
 * Extract group-code data for each XLINE/RAY entity from token array.
 * Returns one Record<string,string> per entity, suitable for convertXLine/convertRay.
 */
function extractEntities(
  tokens: string[],
): Array<{ type: 'XLINE' | 'RAY'; layer: string; data: Record<string, string> }> {
  const result: Array<{ type: 'XLINE' | 'RAY'; layer: string; data: Record<string, string> }> = [];
  let current: { type: 'XLINE' | 'RAY'; layer: string; data: Record<string, string> } | null = null;

  for (let i = 0; i < tokens.length - 1; i += 2) {
    const code = tokens[i];
    const value = tokens[i + 1];

    if (code === '0' && (value === 'XLINE' || value === 'RAY')) {
      if (current) result.push(current);
      current = { type: value as 'XLINE' | 'RAY', layer: '0', data: {} };
    } else if (code === '0' && current) {
      result.push(current);
      current = null;
    } else if (current) {
      if (code === '8') {
        current.layer = value;
      } else if (code !== '100') {
        current.data[code] = value;
      }
    }
  }

  if (current) result.push(current);
  return result;
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. Writer structure
// ──────────────────────────────────────────────────────────────────────────────

describe('writeXLineRayEntities — structure', () => {
  it('wraps output in SECTION / ENTITIES / ENDSEC', () => {
    const out = writeXLineRayEntities([makeXLine()]);
    expect(out).toContain('SECTION');
    expect(out).toContain('ENTITIES');
    expect(out).toContain('ENDSEC');
  });

  it('empty array emits wrapper with no XLINE or RAY entries', () => {
    const out = writeXLineRayEntities([]);
    expect(findAllCodes(out, '0').filter((v) => v === 'XLINE' || v === 'RAY')).toHaveLength(0);
  });

  it('emits one XLINE marker per XLineEntity', () => {
    const out = writeXLineRayEntities([makeXLine(), makeXLine({ id: 'xline-2' })]);
    expect(findAllCodes(out, '0').filter((v) => v === 'XLINE')).toHaveLength(2);
  });

  it('emits one RAY marker per RayEntity', () => {
    const out = writeXLineRayEntities([makeRay(), makeRay({ id: 'ray-2' })]);
    expect(findAllCodes(out, '0').filter((v) => v === 'RAY')).toHaveLength(2);
  });

  it('emits mixed XLINE + RAY in order', () => {
    const out = writeXLineRayEntities([makeXLine(), makeRay()]);
    const markers = findAllCodes(out, '0').filter((v) => v === 'XLINE' || v === 'RAY');
    expect(markers).toEqual(['XLINE', 'RAY']);
  });

  it('emits AcDbEntity subclass marker', () => {
    const out = writeXLineRayEntities([makeXLine()]);
    expect(findAllCodes(out, '100')).toContain('AcDbEntity');
  });

  it('emits AcDbXline subclass marker for XLINE', () => {
    const out = writeXLineRayEntities([makeXLine()]);
    expect(findAllCodes(out, '100')).toContain('AcDbXline');
  });

  it('emits AcDbRay subclass marker for RAY', () => {
    const out = writeXLineRayEntities([makeRay()]);
    expect(findAllCodes(out, '100')).toContain('AcDbRay');
  });

  it('emits layer name in code 8', () => {
    const out = writeXLineRayEntities([makeXLine({ layerId: 'Construction' })]);
    expect(findCode(out, '8')).toBe('Construction');
  });

  it('emits basePoint in codes 10/20/30', () => {
    const out = writeXLineRayEntities([makeXLine({ basePoint: { x: 123.45, y: -67.89 } })]);
    expect(findCode(out, '10')).toBe('123.45');
    expect(findCode(out, '20')).toBe('-67.89');
    expect(findCode(out, '30')).toBe('0');
  });

  it('emits direction in codes 11/21/31', () => {
    const out = writeXLineRayEntities([makeXLine({ direction: { x: 1, y: 0 } })]);
    expect(findCode(out, '11')).toBe('1');
    expect(findCode(out, '21')).toBe('0');
    expect(findCode(out, '31')).toBe('0');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. Direction normalisation
// ──────────────────────────────────────────────────────────────────────────────

describe('writeXLineRayEntities — direction normalisation', () => {
  it('normalises a non-unit direction at export', () => {
    const out = writeXLineRayEntities([makeXLine({ direction: { x: 3, y: 4 } })]);
    const ndx = parseFloat(findCode(out, '11')!);
    const ndy = parseFloat(findCode(out, '21')!);
    expect(Math.sqrt(ndx * ndx + ndy * ndy)).toBeCloseTo(1, 10);
    expect(ndx).toBeCloseTo(0.6, 10);
    expect(ndy).toBeCloseTo(0.8, 10);
  });

  it('preserves an already-unit direction', () => {
    const inv = 1 / Math.sqrt(2);
    const out = writeXLineRayEntities([makeXLine({ direction: { x: inv, y: inv } })]);
    const ndx = parseFloat(findCode(out, '11')!);
    const ndy = parseFloat(findCode(out, '21')!);
    expect(Math.sqrt(ndx * ndx + ndy * ndy)).toBeCloseTo(1, 10);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. ByLayer integrity
// ──────────────────────────────────────────────────────────────────────────────

describe('writeXLineRayEntities — ByLayer integrity', () => {
  it('omits code 62 when colorMode is ByLayer (default)', () => {
    const out = writeXLineRayEntities([makeXLine()]);
    expect(findCode(out, '62')).toBeUndefined();
  });

  it('omits code 62 when colorMode is undefined', () => {
    const entity = makeXLine();
    delete (entity as Partial<XLineEntity>).colorMode;
    const out = writeXLineRayEntities([entity]);
    expect(findCode(out, '62')).toBeUndefined();
  });

  it('emits code 62 when colorMode is Concrete with colorAci', () => {
    const out = writeXLineRayEntities([
      makeXLine({ colorMode: 'Concrete', colorAci: 4 }),
    ]);
    expect(findCode(out, '62')).toBe('4');
  });

  it('omits code 62 when colorMode is Concrete but colorAci is undefined', () => {
    const out = writeXLineRayEntities([makeXLine({ colorMode: 'Concrete' })]);
    expect(findCode(out, '62')).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. Roundtrip fixtures — simulated AutoCAD / BricsCAD / ezdxf token arrays
//    Fed directly to convertXLine / convertRay → assert basePoint + direction ±1e-6
// ──────────────────────────────────────────────────────────────────────────────

describe('convertXLine / convertRay — reference fixtures (simulated CAD output)', () => {
  // Fixture 1 — AutoCAD-style: normalised direction, z=0 explicit
  it('fixture 1 (AutoCAD): XLINE with z=0 explicit parses correctly', () => {
    const data: Record<string, string> = {
      '10': '0', '20': '0', '30': '0',
      '11': '0.7071067811865476', '21': '0.7071067811865476', '31': '0',
    };
    const entity = convertXLine(data, 'Construction', 0);
    expect(entity).not.toBeNull();
    if (!entity || entity.type !== 'xline') return;
    expect(entity.basePoint.x).toBeCloseTo(0, 6);
    expect(entity.basePoint.y).toBeCloseTo(0, 6);
    expect(entity.direction.x).toBeCloseTo(0.7071067811865476, 6);
    expect(entity.direction.y).toBeCloseTo(0.7071067811865476, 6);
    expect(entity.layerId).toBe('Construction');
  });

  // Fixture 2 — BricsCAD-style: non-zero basePoint, vertical direction
  it('fixture 2 (BricsCAD): RAY with non-zero basePoint parses correctly', () => {
    const data: Record<string, string> = {
      '10': '250.5', '20': '-100.25',
      '11': '0', '21': '1',
    };
    const entity = convertRay(data, 'Layer1', 0);
    expect(entity).not.toBeNull();
    if (!entity || entity.type !== 'ray') return;
    expect(entity.basePoint.x).toBeCloseTo(250.5, 6);
    expect(entity.basePoint.y).toBeCloseTo(-100.25, 6);
    expect(entity.direction.x).toBeCloseTo(0, 6);
    expect(entity.direction.y).toBeCloseTo(1, 6);
    expect(entity.layerId).toBe('Layer1');
  });

  // Fixture 3 — ezdxf-style: horizontal XLINE, large coordinates
  it('fixture 3 (ezdxf): XLINE horizontal at large coords parses correctly', () => {
    const data: Record<string, string> = {
      '10': '10000', '20': '5000',
      '11': '1', '21': '0',
    };
    const entity = convertXLine(data, '0', 0);
    expect(entity).not.toBeNull();
    if (!entity || entity.type !== 'xline') return;
    expect(entity.basePoint.x).toBeCloseTo(10000, 6);
    expect(entity.basePoint.y).toBeCloseTo(5000, 6);
    expect(entity.direction.x).toBeCloseTo(1, 6);
    expect(entity.direction.y).toBeCloseTo(0, 6);
  });

  // Negative: degenerate direction vector → null
  it('degenerate direction vector (len < 1e-10) → returns null', () => {
    const data: Record<string, string> = {
      '10': '0', '20': '0', '11': '0', '21': '0',
    };
    expect(convertXLine(data, '0', 0)).toBeNull();
    expect(convertRay(data, '0', 0)).toBeNull();
  });

  // Negative: missing coordinates → null
  it('missing coordinates → returns null', () => {
    expect(convertXLine({ '10': 'abc', '20': '0', '11': '1', '21': '0' }, '0', 0)).toBeNull();
    expect(convertRay({ '10': '0', '20': '0', '11': 'NaN', '21': '1' }, '0', 0)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. Roundtrip: write → parse → compare (diff zero entity-by-entity)
// ──────────────────────────────────────────────────────────────────────────────

describe('writeXLineRayEntities → convertXLine / convertRay — roundtrip', () => {
  it('roundtrips a simple XLINE (horizontal)', () => {
    const original = makeXLine({ basePoint: { x: 10, y: 20 }, direction: { x: 1, y: 0 } });
    const tokens = writeXLineRayEntities([original]);
    const [parsed] = extractEntities(tokens);
    const recovered = convertXLine(parsed.data, parsed.layer, 0);

    expect(recovered).not.toBeNull();
    if (!recovered || recovered.type !== 'xline') return;
    expect(recovered.basePoint.x).toBeCloseTo(original.basePoint.x, 6);
    expect(recovered.basePoint.y).toBeCloseTo(original.basePoint.y, 6);
    expect(recovered.direction.x).toBeCloseTo(original.direction.x, 6);
    expect(recovered.direction.y).toBeCloseTo(original.direction.y, 6);
    expect(recovered.layerId).toBe(original.layerId);
  });

  it('roundtrips a simple RAY (vertical)', () => {
    const original = makeRay({ basePoint: { x: -50, y: 300 }, direction: { x: 0, y: 1 } });
    const tokens = writeXLineRayEntities([original]);
    const [parsed] = extractEntities(tokens);
    const recovered = convertRay(parsed.data, parsed.layer, 0);

    expect(recovered).not.toBeNull();
    if (!recovered || recovered.type !== 'ray') return;
    expect(recovered.basePoint.x).toBeCloseTo(original.basePoint.x, 6);
    expect(recovered.basePoint.y).toBeCloseTo(original.basePoint.y, 6);
    expect(recovered.direction.x).toBeCloseTo(original.direction.x, 6);
    expect(recovered.direction.y).toBeCloseTo(original.direction.y, 6);
  });

  it('roundtrips a diagonal XLINE with non-unit direction', () => {
    const original = makeXLine({ direction: { x: 3, y: 4 } }); // len=5, normalised to (0.6, 0.8)
    const tokens = writeXLineRayEntities([original]);
    const [parsed] = extractEntities(tokens);
    const recovered = convertXLine(parsed.data, parsed.layer, 0);

    expect(recovered).not.toBeNull();
    if (!recovered || recovered.type !== 'xline') return;
    expect(recovered.direction.x).toBeCloseTo(0.6, 6);
    expect(recovered.direction.y).toBeCloseTo(0.8, 6);
  });

  it('roundtrips mixed XLINE + RAY array — entity-by-entity diff zero', () => {
    const entities = [
      makeXLine({ id: 'xl-1', basePoint: { x: 0, y: 0 }, direction: { x: 1, y: 0 } }),
      makeRay({ id: 'r-1', basePoint: { x: 100, y: 100 }, direction: { x: 0, y: -1 } }),
      makeXLine({ id: 'xl-2', basePoint: { x: 500, y: -200 }, direction: { x: 3, y: 4 } }),
    ];

    const tokens = writeXLineRayEntities(entities);
    const parsed = extractEntities(tokens);
    expect(parsed).toHaveLength(3);

    const r0 = convertXLine(parsed[0].data, parsed[0].layer, 0);
    const r1 = convertRay(parsed[1].data, parsed[1].layer, 1);
    const r2 = convertXLine(parsed[2].data, parsed[2].layer, 2);

    expect(r0?.type).toBe('xline');
    expect(r1?.type).toBe('ray');
    expect(r2?.type).toBe('xline');

    if (r0?.type === 'xline') {
      expect(r0.basePoint.x).toBeCloseTo(0, 6);
      expect(r0.direction.x).toBeCloseTo(1, 6);
    }
    if (r1?.type === 'ray') {
      expect(r1.basePoint.x).toBeCloseTo(100, 6);
      expect(r1.direction.y).toBeCloseTo(-1, 6);
    }
    if (r2?.type === 'xline') {
      expect(r2.direction.x).toBeCloseTo(0.6, 6);
      expect(r2.direction.y).toBeCloseTo(0.8, 6);
    }
  });

  it('roundtrips ByLayer entity — code 62 absent post-write, layer preserved', () => {
    const original = makeXLine({
      layerId: 'Construction',
      basePoint: { x: 1, y: 2 },
      direction: { x: 1, y: 0 },
    });
    const tokens = writeXLineRayEntities([original]);

    // No color code in output
    expect(findCode(tokens, '62')).toBeUndefined();

    const [parsed] = extractEntities(tokens);
    expect(parsed.layer).toBe('Construction');

    const recovered = convertXLine(parsed.data, parsed.layer, 0);
    expect(recovered?.layerId).toBe('Construction');
  });

  it('roundtrips Concrete-color entity — code 62 preserved', () => {
    const original = makeXLine({ colorMode: 'Concrete', colorAci: 4 });
    const tokens = writeXLineRayEntities([original]);
    expect(findCode(tokens, '62')).toBe('4');
  });
});
