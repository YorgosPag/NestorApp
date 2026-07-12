/**
 * DXF HATCH Roundtrip Integrity — ADR-507 Φ1a.
 *
 * Αποδεικνύει ότι `writeDxfAscii([hatch]) → convertHatch()` ανακατασκευάζει τα
 * boundaryPaths + fillType + islandStyle + lineAngle/lineSpacing της αρχικής
 * γραμμοσκίασης (full SSoT write→read). Ο writer εκπέμπει native `HATCH` (boundary
 * loops + pattern meta)· ο reader το διαβάζει μέσω ordered pairs (τα επαναλαμβανόμενα
 * 10/20 δεν χωράνε στο flat `Record`).
 */

import { describe, it, expect } from '@jest/globals';
import { writeDxfAscii } from '../../export/core/dxf-ascii-writer';
import { convertHatch } from '../dxf-entity-converters';
import { extractEntityTransparency } from '../dxf-entity-style-extract';
import {
  buildHatchEntitySegments,
  hatchMinWorldSpacing,
} from '../../bim/geometry/shared/hatch-pattern-geometry';
import type { Entity, HatchEntity } from '../../types/entities';

const LAYERS = { L: { name: 'HATCHES' } };

/** Tokenize writer output + extract το HATCH block ως ordered pairs + layer. */
function extractHatch(dxf: string): { pairs: Array<[string, string]>; layer: string } | null {
  const tokens = dxf.split('\n');
  // Βρες το «0 HATCH».
  let start = -1;
  for (let i = 0; i < tokens.length - 1; i += 2) {
    if (tokens[i] === '0' && tokens[i + 1] === 'HATCH') { start = i + 2; break; }
  }
  if (start < 0) return null;
  const pairs: Array<[string, string]> = [];
  let layer = '0';
  for (let i = start; i < tokens.length - 1; i += 2) {
    const code = tokens[i];
    const value = tokens[i + 1];
    if (code === '0') break; // επόμενη οντότητα / ENDSEC
    if (code === '8') layer = value;
    pairs.push([code, value]);
  }
  return { pairs, layer };
}

function roundtrip(entity: Entity, scale?: number) {
  const dxf = writeDxfAscii([entity], { layersById: LAYERS, ...(scale != null && { scale }) });
  const extracted = extractHatch(dxf);
  expect(extracted).not.toBeNull();
  return convertHatch(extracted!.pairs, extracted!.layer, 0);
}

const SQUARE = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];

function solidHatch(over: Record<string, unknown> = {}): Entity {
  return {
    id: 'h', type: 'hatch', layerId: 'L', fillType: 'solid',
    boundaryPaths: [SQUARE], ...over,
  } as unknown as Entity;
}
function userHatch(over: Record<string, unknown> = {}): Entity {
  return {
    id: 'u', type: 'hatch', layerId: 'L', fillType: 'user-defined',
    lineAngle: 30, lineSpacing: 5, boundaryPaths: [SQUARE], ...over,
  } as unknown as Entity;
}
function predefinedHatch(over: Record<string, unknown> = {}): Entity {
  return {
    id: 'p', type: 'hatch', layerId: 'L', fillType: 'predefined',
    patternName: 'ANSI31', patternScale: 1, boundaryPaths: [SQUARE], ...over,
  } as unknown as Entity;
}

describe('convertHatch — roundtrip (write → read)', () => {
  it('solid hatch — boundaryPaths + fillType διατηρούνται', () => {
    const r = roundtrip(solidHatch());
    expect(r).not.toBeNull();
    if (!r || r.type !== 'hatch') return;
    expect(r.fillType).toBe('solid');
    expect(r.patternType).toBe('solid');
    expect(r.boundaryPaths).toHaveLength(1);
    expect(r.boundaryPaths[0]).toHaveLength(4);
    expect(r.boundaryPaths[0][0].x).toBeCloseTo(0, 6);
    expect(r.boundaryPaths[0][2].x).toBeCloseTo(100, 6);
    expect(r.boundaryPaths[0][2].y).toBeCloseTo(100, 6);
    expect(r.layerId).toBe('HATCHES');
  });

  it('user-defined hatch — lineAngle/lineSpacing + fillType διατηρούνται', () => {
    const r = roundtrip(userHatch());
    expect(r).not.toBeNull();
    if (!r || r.type !== 'hatch') return;
    expect(r.fillType).toBe('user-defined');
    expect(r.lineAngle).toBeCloseTo(30, 6);
    expect(r.lineSpacing).toBeCloseTo(5, 6);
  });

  it('islandStyle ignore → roundtrips (DXF code 75 = 2)', () => {
    const r = roundtrip(solidHatch({ islandStyle: 'ignore' }));
    expect(r?.type === 'hatch' && r.islandStyle).toBe('ignore');
  });

  it('islandStyle outer → roundtrips (DXF code 75 = 1)', () => {
    const r = roundtrip(solidHatch({ islandStyle: 'outer' }));
    expect(r?.type === 'hatch' && r.islandStyle).toBe('outer');
  });

  it('hatch με νησίδα (2 paths) → 2 boundaryPaths', () => {
    const hole = [{ x: 30, y: 30 }, { x: 70, y: 30 }, { x: 70, y: 70 }, { x: 30, y: 70 }];
    const r = roundtrip(solidHatch({ boundaryPaths: [SQUARE, hole] }));
    expect(r).not.toBeNull();
    if (!r || r.type !== 'hatch') return;
    expect(r.boundaryPaths).toHaveLength(2);
    expect(r.boundaryPaths[1]).toHaveLength(4);
    expect(r.boundaryPaths[1][0].x).toBeCloseTo(30, 6);
  });

  it('coordinate scale εφαρμόζεται στις κορυφές (mm→m ×0.001)', () => {
    const r = roundtrip(solidHatch(), 0.001);
    expect(r).not.toBeNull();
    if (!r || r.type !== 'hatch') return;
    // 100 × 0.001 = 0.1
    expect(r.boundaryPaths[0][2].x).toBeCloseTo(0.1, 6);
  });

  it('seedPoints διατηρούνται', () => {
    const r = roundtrip(solidHatch({ seedPoints: [{ x: 50, y: 50 }] }));
    expect(r).not.toBeNull();
    if (!r || r.type !== 'hatch') return;
    expect(r.seedPoints).toHaveLength(1);
    expect(r.seedPoints![0].x).toBeCloseTo(50, 6);
    expect(r.seedPoints![0].y).toBeCloseTo(50, 6);
  });

  it('κενά pairs (χωρίς 91) → null', () => {
    expect(convertHatch([], '0', 0)).toBeNull();
  });
});

describe('convertHatch — transparency (DXF 440) roundtrip — ADR-507', () => {
  /** Build a code→value Record από τα ordered pairs του HATCH block (για τους style extractors). */
  function hatchCodes(dxf: string): Record<string, string> {
    const extracted = extractHatch(dxf);
    expect(extracted).not.toBeNull();
    const rec: Record<string, string> = {};
    for (const [code, value] of extracted!.pairs) rec[code] = value;
    return rec;
  }

  it('διαφανής γραμμοσκίαση (45) → γράφεται group 440 + διαβάζεται πίσω ως 45', () => {
    const rec = hatchCodes(writeDxfAscii([solidHatch({ transparency: 45 })], { layersById: LAYERS }));
    expect(rec['440']).toBeDefined();
    expect(extractEntityTransparency(rec)).toBe(45);
  });

  it('max διαφάνεια (90) → roundtrips ως 90', () => {
    const rec = hatchCodes(writeDxfAscii([solidHatch({ transparency: 90 })], { layersById: LAYERS }));
    expect(extractEntityTransparency(rec)).toBe(90);
  });

  it('αδιαφανής (0) → ΚΑΝΕΝΑΣ κωδικός 440 (default, μηδέν regression)', () => {
    const rec = hatchCodes(writeDxfAscii([solidHatch({ transparency: 0 })], { layersById: LAYERS }));
    expect(rec['440']).toBeUndefined();
  });

  it('χωρίς transparency → κανένας κωδικός 440', () => {
    const rec = hatchCodes(writeDxfAscii([solidHatch()], { layersById: LAYERS }));
    expect(rec['440']).toBeUndefined();
  });
});

describe('convertHatch — predefined scale idempotency + inline pattern (ADR-507 Φ6)', () => {
  it('predefined ANSI31 (scale=2) → ανακτά user scale (όχι διπλό scaling)', () => {
    const orig = predefinedHatch({ patternName: 'ANSI31', patternScale: 2 });
    const r = roundtrip(orig);
    expect(r).not.toBeNull();
    if (!r || r.type !== 'hatch') return;
    expect(r.fillType).toBe('predefined');
    expect(r.patternName).toBe('ANSI31');
    // group 41 = suggested(20) × user(2) = 40 → reader το διαιρεί πάλι με suggested.
    expect(r.patternScale).toBeCloseTo(2, 6);
  });

  it('predefined ANSI31 → ΙΔΙΑ effective πυκνότητα μετά round-trip (write→read→render)', () => {
    const orig = predefinedHatch({ patternName: 'ANSI31', patternScale: 2 });
    const r = roundtrip(orig);
    expect(r).not.toBeNull();
    if (!r || r.type !== 'hatch') return;
    // Idempotency: η πυκνότητα γραμμών (min world spacing) ΚΑΙ το πλήθος segments
    // πρέπει να ταυτίζονται με το αρχικό — αλλιώς διπλό scaling.
    expect(hatchMinWorldSpacing(r)).toBeCloseTo(hatchMinWorldSpacing(orig as HatchEntity), 6);
    expect(buildHatchEntitySegments(r).length).toBe(
      buildHatchEntitySegments(orig as HatchEntity).length,
    );
  });

  it('predefined BRICK (multi-line) → density idempotent', () => {
    const orig = predefinedHatch({ patternName: 'BRICK', patternScale: 3 });
    const r = roundtrip(orig);
    expect(r).not.toBeNull();
    if (!r || r.type !== 'hatch') return;
    expect(r.patternName).toBe('BRICK');
    expect(hatchMinWorldSpacing(r)).toBeCloseTo(hatchMinWorldSpacing(orig as HatchEntity), 6);
    expect(buildHatchEntitySegments(r).length).toBe(
      buildHatchEntitySegments(orig as HatchEntity).length,
    );
  });

  it('άγνωστο pattern (εκτός catalog) → inlinePattern parsed, γραμμοσκίαση ΟΡΑΤΗ', () => {
    const orig = predefinedHatch({ patternName: 'THIRDPARTY_X', patternScale: 1 });
    const r = roundtrip(orig);
    expect(r).not.toBeNull();
    if (!r || r.type !== 'hatch') return;
    expect(r.fillType).toBe('predefined');
    expect(r.inlinePattern).toBeDefined();
    expect(r.inlinePattern!.lines.length).toBeGreaterThan(0);
    // Κρίσιμο: ΔΕΝ μένει αόρατη — ο geometry resolver βγάζει segments.
    expect(buildHatchEntitySegments(r).length).toBeGreaterThan(0);
  });
});
