/**
 * ADR-929 Φ0.5 — κείμενα του τοπικού OCR ⇒ `PlanReading`: πλαίσιο σε αρχικά px, είδος από τη μορφή, μονάδα ανά σχέδιο,
 * κλίμακα, ταυτότητα μοντέλου από το μητρώο.
 */

import { IDENTITY_HOMOGRAPHY, type Homography, type Quad } from '@/lib/geometry/homography';
import type { OcrText } from '../ocr/ocr-engine';
import { localOcrModelId, OCR_READING_SCHEMA_VERSION, planReadingFromOcr } from '../ocr/ocr-reading';
import type { OcrAssetSet } from '../ocr/ocr-model-assets';

const quad = (x: number, y: number, w: number, h: number): Quad =>
  [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];

const ocr = (text: string, polygon: Quad, recScore = 0.9, rotation: 0 | 90 = 0): OcrText =>
  ({ text, recScore, detScore: 0.8, rotation, polygon, reader: 'primary' });

const read = (texts: readonly OcrText[], toOriginal: Homography = IDENTITY_HOMOGRAPHY) =>
  planReadingFromOcr({ texts, toOriginal, model: 'local-ocr:test' });

describe('planReadingFromOcr', () => {
  it('ids σταθερά με τη σειρά, κενά κείμενα έξω, raw αυτούσιο, βεβαιότητα = recScore ως παράγοντας reading', () => {
    const r = read([ocr('3.50', quad(0, 0, 40, 10), 0.97), ocr('  ', quad(0, 0, 5, 5)), ocr('ΣΑΛΟΝΙ', quad(50, 50, 60, 12), 0.7)]);
    expect(r.texts.map((t) => [t.id, t.raw, t.kind])).toEqual([['t1', '3.50', 'dimension'], ['t2', 'ΣΑΛΟΝΙ', 'other']]);
    expect(r.texts[0].confidence).toEqual({ score: 0.97, factors: { reading: 0.97 } });
    expect(r.model).toBe('local-ocr:test');
    expect(r.schemaVersion).toBe(OCR_READING_SCHEMA_VERSION);
    expect(r.rooms).toEqual([]);
    expect(r.openings).toEqual([]);
  });

  it('το πλαίσιο περνά από την ομογραφία κορυφή-κορυφή και μένει σφιχτό (κατακόρυφο κείμενο = ψηλό και στενό)', () => {
    const shift: Homography = { ...IDENTITY_HOMOGRAPHY, c: 100, f: 200 };
    const r = read([ocr('2.85', quad(10, 20, 8, 40), 0.9, 90)], shift);
    expect(r.texts[0].rect).toEqual({ minX: 110, minY: 220, maxX: 118, maxY: 260 });
  });

  it('μέτρα στο σχέδιο ⇒ οι ακέραιοι γίνονται εκατοστά· segmentIds κενά', () => {
    const r = read([ocr('3.50', quad(0, 0, 40, 10)), ocr('20', quad(0, 20, 20, 10))]);
    expect(r.dimensions.map((d) => [d.textId, d.valueMm, d.segmentIds])).toEqual([['t1', 3500, []], ['t2', 200, []]]);
  });

  it('μόνο ακέραιοι ⇒ κανένας περιορισμός του λύτη, τα κείμενα μένουν ορατά', () => {
    const r = read([ocr('350', quad(0, 0, 40, 10)), ocr('415', quad(0, 20, 40, 10))]);
    expect(r.dimensions).toEqual([]);
    expect(r.texts.map((t) => t.kind)).toEqual(['dimension', 'dimension']);
  });

  it('γραμμένη κλίμακα: η πιο βέβαιη ανάγνωση', () => {
    const r = read([ocr('1:100', quad(0, 0, 40, 10), 0.6), ocr('Κλ. 1:50', quad(0, 20, 60, 10), 0.95)]);
    expect(r.writtenScale).toEqual({ textId: 't2', denominator: 50, confidence: { score: 0.95, factors: { reading: 0.95 } } });
    expect(read([ocr('ΣΑΛΟΝΙ', quad(0, 0, 10, 10))]).writtenScale).toBeNull();
  });
});

describe('localOcrModelId — από το μητρώο, με τα revisions', () => {
  it('ανιχνευτής + αναγνώστες', () => {
    const m = (dir: string) => ({
      onnx: { path: `/models/ocr/${dir}/inference.onnx`, sha256: 'x', bytes: 1 },
      yml: { path: `/models/ocr/${dir}/inference.yml`, sha256: 'x', bytes: 1 },
    });
    const assets: OcrAssetSet = {
      runtime: { path: '/ort/1.30.0/ort-wasm-simd-threaded.wasm', sha256: 'x', bytes: 1 },
      detector: m('det@1'), primary: m('rec@2'), secondary: m('el@3'),
    };
    expect(localOcrModelId(assets)).toBe('local-ocr:det@1+rec@2+el@3');
  });
});
