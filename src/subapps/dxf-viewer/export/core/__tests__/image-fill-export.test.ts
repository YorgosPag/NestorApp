/**
 * ADR-643 Φ5b — image-fill DXF export pre-pass tests.
 *
 * Δύο επίπεδα:
 *   1. `buildImageTilePlacements` — PURE tile-grid (πραγματική διάσταση + even-odd PIP
 *      culling + overflow caps)· χωρίς DOM/mocks, ντετερμινιστικό.
 *   2. `resolveImageFillsForDxf` — ο async control-flow (solid downgrade / image marker /
 *      overflow fallback / dedup / decode-fail) με mocked resolver + Image + fetch.
 *
 * ⚠️ Σημείωση fidelity: το `averageImageColor` χρειάζεται canvas 2D context, που το jsdom
 * ΔΕΝ υλοποιεί → επιστρέφει `null` → η υποβάθμιση πέφτει στο fallback hex (χρώμα του hatch).
 * Άρα τα solid-mode tests επικυρώνουν τη **ροή** (γίνεται solid, καθαρίζει markers), ΟΧΙ την
 * ακρίβεια του μέσου χρώματος (μη διαθέσιμο εκτός browser — τεκμηριωμένο, όχι κρυφό κενό).
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';

// resolveMaterialImageSrc → σταθερό URL (ο pre-pass κάνει fetch αυτό το src για το raster).
jest.mock('../../../rendering/entities/shared/material-image-resolver', () => ({
  resolveMaterialImageSrc: jest.fn(async () => 'blob:mock-src'),
}));

import {
  buildImageTilePlacements,
  resolveImageFillsForDxf,
  IMAGE_TILE_CAP,
} from '../image-fill-export';
import type { Entity, HatchEntity, HatchImageFill } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';

const square = (side: number): Point2D[] => [
  { x: 0, y: 0 }, { x: side, y: 0 }, { x: side, y: side }, { x: 0, y: side },
];

// ─── 1. PURE tile-grid ────────────────────────────────────────────────────────

describe('buildImageTilePlacements — pure tile-grid (real tile size)', () => {
  const fill = (over: Partial<HatchImageFill> = {}): HatchImageFill => ({
    assetId: 'a', tileWidth: 600, tileHeight: 600, ...over,
  });

  it('τετράγωνο 1200×1200 με tile 600 → 2×2 = 4 tiles (lower-left corners)', () => {
    const g = buildImageTilePlacements([square(1200)], fill());
    expect(g.overflow).toBe(false);
    expect(g.inserts).toHaveLength(4);
    // Κάτω-αριστερές γωνίες, origin = bbox min (0,0).
    expect(g.inserts).toEqual(
      expect.arrayContaining([
        { x: 0, y: 0 }, { x: 600, y: 0 }, { x: 0, y: 600 }, { x: 600, y: 600 },
      ]),
    );
  });

  it('νησίδα (τρύπα) → even-odd PIP: tile με κέντρο μέσα στην τρύπα πέφτει', () => {
    const outer = square(1200);
    // Τρύπα γύρω από το κέντρο του κάτω-αριστερού tile (κέντρο 300,300).
    const hole: Point2D[] = [
      { x: 150, y: 150 }, { x: 450, y: 150 }, { x: 450, y: 450 }, { x: 150, y: 450 },
    ];
    const g = buildImageTilePlacements([outer, hole], fill());
    expect(g.overflow).toBe(false);
    // 4 tiles − 1 (κέντρο του (0,0) tile μέσα στην τρύπα) = 3.
    expect(g.inserts).toHaveLength(3);
    expect(g.inserts).not.toContainEqual({ x: 0, y: 0 });
  });

  it('γωνία 90° → tile-grid εξακολουθεί να καλύπτει το boundary (rotated frame)', () => {
    const g = buildImageTilePlacements([square(1200)], fill({ angle: 90 }));
    expect(g.overflow).toBe(false);
    expect(g.inserts).toHaveLength(4);
  });

  it('degenerate tile (tileWidth=0) → κενό, όχι overflow', () => {
    const g = buildImageTilePlacements([square(1200)], fill({ tileWidth: 0 }));
    expect(g).toEqual({ inserts: [], overflow: false });
  });

  it('grid πάνω από το scan cap (τεράστιο boundary, μικρό tile) → overflow, κενά inserts', () => {
    const g = buildImageTilePlacements([square(100000)], fill({ tileWidth: 10, tileHeight: 10 }));
    expect(g.overflow).toBe(true);
    expect(g.inserts).toHaveLength(0);
  });

  it('πλήθος tiles πάνω από το cap → overflow', () => {
    // 1800×1800 / 600 = 3×3 = 9 tiles· cap=4 → overflow.
    const g = buildImageTilePlacements([square(1800)], fill(), 4);
    expect(g.overflow).toBe(true);
    expect(g.inserts).toHaveLength(0);
  });

  it('IMAGE_TILE_CAP = 400 (σταθερό όριο ασφαλείας)', () => {
    expect(IMAGE_TILE_CAP).toBe(400);
  });
});

// ─── 2. resolveImageFillsForDxf — async control flow ──────────────────────────

/** Ελεγχόμενο Image stub (jsdom δεν κάνει πραγματικό decode). */
let decodeShouldFail = false;
class MockImage {
  crossOrigin = '';
  decoding = '';
  naturalWidth = 512;
  naturalHeight = 512;
  src = '';
  decode(): Promise<void> {
    return decodeShouldFail ? Promise.reject(new Error('decode failed')) : Promise.resolve();
  }
}

const imageHatch = (assetId: string, boundary: Point2D[], over: Partial<HatchImageFill> = {}): HatchEntity => ({
  id: `h_${assetId}`,
  type: 'hatch',
  layerId: 'L',
  boundaryPaths: [boundary],
  fillType: 'image',
  color: '#123456',
  imageFill: { assetId, tileWidth: 600, tileHeight: 600, ...over },
} as HatchEntity);

const lineEntity = (): Entity => ({
  id: 'ln', type: 'line', layerId: 'L', start: { x: 0, y: 0 }, end: { x: 10, y: 0 },
} as unknown as Entity);

describe('resolveImageFillsForDxf — control flow', () => {
  let realImage: typeof Image;
  let realFetch: typeof fetch;

  beforeAll(() => {
    realImage = global.Image;
    realFetch = global.fetch;
    global.Image = MockImage as unknown as typeof Image;
    global.fetch = jest.fn(async () => ({
      ok: true,
      blob: async () => ({ type: 'image/jpeg' } as Blob),
    })) as unknown as typeof fetch;
  });

  afterAll(() => {
    global.Image = realImage;
    global.fetch = realFetch;
  });

  beforeEach(() => { decodeShouldFail = false; });

  it('μη-image entity περνά αυτούσιο (passthrough)', async () => {
    const line = lineEntity();
    const r = await resolveImageFillsForDxf([line], 'solid');
    expect(r.entities).toEqual([line]);
    expect(r.rasters).toHaveLength(0);
    expect(r.warnings).toHaveLength(0);
  });

  it('solid mode → υποβάθμιση σε solid, καθαρίζει imageFill + dxfImageExport', async () => {
    const r = await resolveImageFillsForDxf([imageHatch('bmat_a', square(1200))], 'solid');
    const out = r.entities[0] as HatchEntity;
    expect(out.fillType).toBe('solid');
    expect(typeof out.color).toBe('string');
    expect(out.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(out.imageFill).toBeUndefined();
    expect(out.dxfImageExport).toBeUndefined();
    expect(r.rasters).toHaveLength(0);
  });

  it('image mode → stamp dxfImageExport marker + ένα raster artifact', async () => {
    const r = await resolveImageFillsForDxf([imageHatch('bmat_a', square(1200))], 'image');
    const out = r.entities[0] as HatchEntity;
    expect(out.dxfImageExport).toBeDefined();
    expect(out.dxfImageExport!.inserts.length).toBeGreaterThan(0);
    expect(out.dxfImageExport!.pixelWidth).toBe(512);
    expect(out.dxfImageExport!.filename).toBe('images/bmat_a.jpg');
    expect(r.rasters).toHaveLength(1);
    expect(r.rasters[0].filename).toBe('images/bmat_a.jpg');
  });

  it('image mode overflow → solid fallback + warning', async () => {
    const r = await resolveImageFillsForDxf(
      [imageHatch('bmat_a', square(100000), { tileWidth: 10, tileHeight: 10 })], 'image',
    );
    const out = r.entities[0] as HatchEntity;
    expect(out.fillType).toBe('solid');
    expect(out.dxfImageExport).toBeUndefined();
    expect(r.warnings).toContain('image-fill:tile-overflow');
    expect(r.rasters).toHaveLength(0);
  });

  it('δύο hatch ίδιου assetId (image mode) → ΕΝΑ deduped raster', async () => {
    const r = await resolveImageFillsForDxf(
      [imageHatch('bmat_a', square(1200)), imageHatch('bmat_a', square(1200))], 'image',
    );
    expect(r.entities).toHaveLength(2);
    expect(r.rasters).toHaveLength(1);
  });

  it('αποτυχία decode → solid fallback + warning', async () => {
    decodeShouldFail = true;
    const r = await resolveImageFillsForDxf([imageHatch('bmat_a', square(1200))], 'image');
    const out = r.entities[0] as HatchEntity;
    expect(out.fillType).toBe('solid');
    expect(r.warnings).toContain('image-fill:decode-failed');
  });
});
