/**
 * ADR-635 Φ C.3 — per-entity lineweight import (DXF group code 370).
 *
 * Proves the AutoCAD lineweight cascade at IMPORT time:
 *   - group 370 (hundredths of mm) → concrete `lineweightMm` baked on the entity
 *   - the -1/-2/-3 sentinels + out-of-catalog + absent → undefined (layer cascade)
 *   - the router (`convertEntityToScene`) applies it uniformly to every entity type
 *   - no 370 ⇒ the emitted entity is UNCHANGED (native/Tekton/bare gate, zero regression)
 *
 * The screen-px conversion + the global LWDISPLAY gate are tested downstream
 * (`dxf-renderer-style-resolve-lineweight.test.ts`, ADR-510 Φ2G); here we only assert
 * the imported mm value reaches `entity.lineweightMm`.
 */

import { describe, it, expect } from '@jest/globals';
import { extractEntityLineweight } from '../dxf-converter-helpers';
import { convertEntityToScene, type EntityData } from '../dxf-entity-converters';

describe('extractEntityLineweight — concrete mm (group 370)', () => {
  it('decodes hundredths-of-mm to the ISO mm value', () => {
    expect(extractEntityLineweight({ '370': '25' })).toBe(0.25);
    expect(extractEntityLineweight({ '370': '50' })).toBe(0.5);
    expect(extractEntityLineweight({ '370': '200' })).toBe(2.0);
    expect(extractEntityLineweight({ '370': '13' })).toBe(0.13);
  });

  it('returns undefined for the inheritance sentinels (-1/-2/-3)', () => {
    expect(extractEntityLineweight({ '370': '-1' })).toBeUndefined(); // ByBlock
    expect(extractEntityLineweight({ '370': '-2' })).toBeUndefined(); // ByLayer
    expect(extractEntityLineweight({ '370': '-3' })).toBeUndefined(); // Default
  });

  it('returns undefined when 370 is absent', () => {
    expect(extractEntityLineweight({})).toBeUndefined();
    expect(extractEntityLineweight({ '62': '1' })).toBeUndefined();
  });

  it('returns undefined for a non-numeric or out-of-catalog value', () => {
    expect(extractEntityLineweight({ '370': 'xx' })).toBeUndefined();
    // 999 → 9.99mm, no ISO match → parseDxfCode370 → -3 DEFAULT → undefined.
    expect(extractEntityLineweight({ '370': '999' })).toBeUndefined();
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

describe('convertEntityToScene — bakes imported lineweight (router SSoT)', () => {
  it('sets lineweightMm from a concrete group 370 on the emitted entity', () => {
    const entity = convertEntityToScene(lineData({ '370': '50' }), 0);
    expect(entity).not.toBeNull();
    expect((entity as { lineweightMm?: number }).lineweightMm).toBe(0.5);
  });

  it('leaves lineweightMm absent when there is no 370 (native/Tekton gate)', () => {
    const entity = convertEntityToScene(lineData({}), 0);
    expect(entity).not.toBeNull();
    expect((entity as { lineweightMm?: number }).lineweightMm).toBeUndefined();
  });

  it('leaves lineweightMm absent for a ByLayer sentinel (370 = -2)', () => {
    const entity = convertEntityToScene(lineData({ '370': '-2' }), 0);
    expect(entity).not.toBeNull();
    expect((entity as { lineweightMm?: number }).lineweightMm).toBeUndefined();
  });

  it('applies to a non-LINE type too (CIRCLE) — router is type-agnostic', () => {
    const circle = convertEntityToScene(
      { type: 'CIRCLE', layer: '0', data: { '10': '0', '20': '0', '40': '5', '370': '35' } },
      1,
    );
    expect(circle).not.toBeNull();
    expect((circle as { lineweightMm?: number }).lineweightMm).toBe(0.35);
  });

  it('does not mutate the emitted entity when the converter returns null', () => {
    // Invalid LINE (missing coords) → converter returns null → gate returns null.
    const nothing = convertEntityToScene({ type: 'LINE', layer: '0', data: { '370': '50' } }, 0);
    expect(nothing).toBeNull();
  });
});
