/**
 * ADR-651 Φάση Ε — `ImageEntity` DXF export pre-pass tests.
 *
 * Mocks `global.Image` / `global.fetch` (ίδιο μοτίβο με `image-fill-export.test.ts`) ώστε να
 * ελεγχθεί η async control-flow χωρίς πραγματικό δίκτυο/decode: marker stamping σε επιτυχία,
 * σιωπηλή παράλειψη (entity αυτούσιο) σε αποτυχία decode/fetch, dedup raster ανά filename, και
 * ότι μη-image entities περνούν ανέγγιχτα.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { resolveImageEntitiesForDxf } from '../image-entity-export';
import type { Entity } from '../../../types/entities';
import type { ImageEntity } from '../../../types/image';

/** Ελεγχόμενο Image stub (jsdom δεν κάνει πραγματικό decode). */
let decodeShouldFail = false;
class MockImage {
  crossOrigin = '';
  decoding = '';
  naturalWidth = 800;
  naturalHeight = 600;
  src = '';
  decode(): Promise<void> {
    return decodeShouldFail ? Promise.reject(new Error('decode failed')) : Promise.resolve();
  }
}

let fetchShouldFail = false;
const realImage = global.Image;
const realFetch = global.fetch;

beforeEach(() => {
  decodeShouldFail = false;
  fetchShouldFail = false;
  global.Image = MockImage as unknown as typeof Image;
  global.fetch = jest.fn(async () => {
    if (fetchShouldFail) return { ok: false } as Response;
    return { ok: true, blob: async () => ({ type: 'image/png' } as Blob) } as unknown as Response;
  }) as unknown as typeof fetch;
});

afterEach(() => {
  global.Image = realImage;
  global.fetch = realFetch;
});

const imageEntity = (id: string, url: string, over: Partial<ImageEntity> = {}): ImageEntity => ({
  id, type: 'image', layerId: 'L',
  position: { x: 10, y: 20 }, width: 300, height: 150, url, rotation: 15,
  ...over,
} as unknown as ImageEntity);

const lineEntity = (): Entity => ({
  id: 'ln', type: 'line', layerId: 'L', start: { x: 0, y: 0 }, end: { x: 10, y: 0 },
} as unknown as Entity);

describe('resolveImageEntitiesForDxf — control flow', () => {
  it('επιτυχές decode+fetch → dxfImageExport marker με ΕΝΑ insert = position', async () => {
    const entity = imageEntity('img1', 'https://example.test/a.png');
    const res = await resolveImageEntitiesForDxf([entity as unknown as Entity]);
    expect(res.warnings).toHaveLength(0);
    expect(res.rasters).toHaveLength(1);
    const out = res.entities[0] as unknown as ImageEntity;
    expect(out.dxfImageExport).toBeDefined();
    expect(out.dxfImageExport?.pixelWidth).toBe(800);
    expect(out.dxfImageExport?.pixelHeight).toBe(600);
    expect(out.dxfImageExport?.tileWorldWidth).toBe(300);
    expect(out.dxfImageExport?.tileWorldHeight).toBe(150);
    expect(out.dxfImageExport?.angleDeg).toBe(15);
    expect(out.dxfImageExport?.inserts).toEqual([{ x: 10, y: 20 }]);
  });

  it('χωρίς rotation → angleDeg default 0', async () => {
    const entity = imageEntity('img1', 'https://example.test/a.png', { rotation: undefined });
    const res = await resolveImageEntitiesForDxf([entity as unknown as Entity]);
    const out = res.entities[0] as unknown as ImageEntity;
    expect(out.dxfImageExport?.angleDeg).toBe(0);
  });

  it('αποτυχία decode → entity περνά ΑΥΤΟΥΣΙΟ (χωρίς marker), warning decode-failed', async () => {
    decodeShouldFail = true;
    const entity = imageEntity('img1', 'https://example.test/a.png');
    const res = await resolveImageEntitiesForDxf([entity as unknown as Entity]);
    expect(res.warnings).toEqual(['image-entity:decode-failed']);
    expect(res.rasters).toHaveLength(0);
    const out = res.entities[0] as unknown as ImageEntity;
    expect(out.dxfImageExport).toBeUndefined();
  });

  it('αποτυχία fetch → entity περνά ΑΥΤΟΥΣΙΟ (χωρίς marker), warning raster-fetch-failed', async () => {
    fetchShouldFail = true;
    const entity = imageEntity('img1', 'https://example.test/a.png');
    const res = await resolveImageEntitiesForDxf([entity as unknown as Entity]);
    expect(res.warnings).toEqual(['image-entity:raster-fetch-failed']);
    expect(res.rasters).toHaveLength(0);
    const out = res.entities[0] as unknown as ImageEntity;
    expect(out.dxfImageExport).toBeUndefined();
  });

  it('δύο ImageEntity ΙΔΙΟΥ url → ΕΝΑ raster deduped (ΕΝΑ IMAGEDEF θα προκύψει downstream)', async () => {
    const a = imageEntity('img1', 'https://example.test/shared.png');
    const b = imageEntity('img2', 'https://example.test/shared.png');
    const res = await resolveImageEntitiesForDxf([a as unknown as Entity, b as unknown as Entity]);
    expect(res.rasters).toHaveLength(1);
    const outA = res.entities[0] as unknown as ImageEntity;
    const outB = res.entities[1] as unknown as ImageEntity;
    expect(outA.dxfImageExport?.filename).toBe(outB.dxfImageExport?.filename);
  });

  it('μη-image entities περνούν ΑΝΕΓΓΙΧΤΑ', async () => {
    const line = lineEntity();
    const res = await resolveImageEntitiesForDxf([line]);
    expect(res.entities).toEqual([line]);
    expect(res.rasters).toHaveLength(0);
    expect(res.warnings).toHaveLength(0);
  });
});
