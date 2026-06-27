/**
 * ADR-539 Φ2 — polygon-material-dnd serialize/parse SSoT tests (drag source ↔ drop target).
 * Pure (no DOM); a tiny DataTransfer stub mirrors `getData(mime)`.
 */

import {
  BIM_MATERIAL_MIME,
  serializeFaceAppearanceDrag,
  parseFaceAppearanceDrag,
} from '../polygon-material-dnd';

/** Minimal DataTransfer stub holding one MIME → value. */
function dt(mime: string, value: string): DataTransfer {
  return { getData: (m: string) => (m === mime ? value : '') } as unknown as DataTransfer;
}

describe('polygon-material-dnd', () => {
  it('round-trips a materialId payload', () => {
    const raw = serializeFaceAppearanceDrag({ materialId: 'paint-red' });
    expect(parseFaceAppearanceDrag(dt(BIM_MATERIAL_MIME, raw))).toEqual({ materialId: 'paint-red' });
  });

  it('round-trips a colorHex payload', () => {
    const raw = serializeFaceAppearanceDrag({ colorHex: '#C0392B' });
    expect(parseFaceAppearanceDrag(dt(BIM_MATERIAL_MIME, raw))).toEqual({ colorHex: '#C0392B' });
  });

  it('returns null when the MIME is absent', () => {
    expect(parseFaceAppearanceDrag(dt('text/plain', 'hello'))).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseFaceAppearanceDrag(dt(BIM_MATERIAL_MIME, '{not json'))).toBeNull();
  });

  it('returns null for a payload without materialId/colorHex', () => {
    expect(parseFaceAppearanceDrag(dt(BIM_MATERIAL_MIME, JSON.stringify({ foo: 1 })))).toBeNull();
  });

  it('drops unknown keys (Firestore-safe — only materialId/colorHex pass)', () => {
    const raw = JSON.stringify({ materialId: 'paint-red', evil: 'x' });
    expect(parseFaceAppearanceDrag(dt(BIM_MATERIAL_MIME, raw))).toEqual({ materialId: 'paint-red' });
  });
});
