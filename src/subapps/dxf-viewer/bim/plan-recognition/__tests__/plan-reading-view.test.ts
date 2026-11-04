/**
 * ADR-929 Φ3 — η όψη που στέλνεται: `view-‰` ↔ ευθυγραμμισμένα px ↔ αρχικά px (Δ3), τμήματα που φαίνονται, πρόταση όψης,
 * τα pixel της όψης (από την **αρχική** εικόνα, με άσπρισμα) και η επιστροφή της ανάγνωσης σε αρχικά px.
 */

import { IDENTITY_HOMOGRAPHY, type Homography } from '@/lib/geometry/homography';
import { blankPlanRaster } from '@/lib/geometry/raster/plan-raster';
import type { RasterSegment } from '../plan-recognition-types';
import type { PlanRegion, SheetLayout } from '../alignment/plan-alignment-types';
import { planReadingFromView } from '../reading/plan-reading-from-view';
import {
  alignedToView,
  proposedReadingView,
  viewBoxToOriginal,
  viewSegmentsOf,
  viewToAligned,
  type PlanReadingView,
} from '../reading/plan-reading-view';
import { renderReadingViewRaster } from '../reading/plan-reading-view-raster';
import type { PlanViewReading } from '../reading/plan-reading-wire';

const VIEW: PlanReadingView = { crop: { minX: 100, minY: 50, maxX: 300, maxY: 150 }, redacted: [{ minX: 250, minY: 100, maxX: 300, maxY: 150 }] };
/** Αρχική = 2 × ευθυγραμμισμένη (συντελεστής εργασίας 2), χωρίς στροφή. */
const DOUBLE: Homography = { a: 2, b: 0, c: 0, d: 0, e: 2, f: 0, g: 0, h: 0 };
const HALF: Homography = { a: 0.5, b: 0, c: 0, d: 0, e: 0.5, f: 0, g: 0, h: 0 };
const conf = { score: 1, factors: {} };

function seg(id: string, x0: number, y0: number, x1: number, y1: number): RasterSegment {
  return { id, start: { x: x0, y: y0 }, end: { x: x1, y: y1 }, style: 'stroke', strokeWidthPx: 2, confidence: conf };
}

function region(minX: number, minY: number, maxX: number, maxY: number): PlanRegion {
  const aligned = { minX, minY, maxX, maxY };
  return { aligned, originalQuad: [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }], originalBounds: aligned };
}

describe('view-‰ ↔ aligned px', () => {
  it('maps the crop corners to 0 and 1000 and round-trips', () => {
    expect(alignedToView({ x: 100, y: 50 }, VIEW)).toEqual({ x: 0, y: 0 });
    expect(alignedToView({ x: 300, y: 150 }, VIEW)).toEqual({ x: 1000, y: 1000 });
    const p = { x: 173.25, y: 91.5 };
    const back = viewToAligned(alignedToView(p, VIEW), VIEW);
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
  });

  it('a view box goes back to ORIGINAL px only through the Φ1 homography', () => {
    expect(viewBoxToOriginal({ x0: 0, y0: 0, x1: 500, y1: 1000 }, VIEW, DOUBLE)).toEqual({ minX: 200, minY: 100, maxX: 400, maxY: 300 });
  });
});

describe('viewSegmentsOf', () => {
  // Τμήματα σε αρχικά px· η όψη είναι σε ευθυγραμμισμένα (αρχικά / 2).
  const segments = [
    seg('ps0', 220, 120, 380, 120), // μέσο (150, 60) ευθυγρ. ⇒ μέσα
    seg('ps1', 0, 0, 20, 0), // έξω από το crop
    seg('ps2', 520, 220, 560, 280), // μέσο (270, 125) ⇒ μέσα στο ασπρισμένο
    seg('ps3', 180, 280, 640, 280), // μέσο (205, 140) μέσα· άκρα έξω από το crop, δεν κόβονται
  ];

  it('keeps what the reader can see, in view-‰, without clipping the ends', () => {
    const out = viewSegmentsOf(segments, HALF, VIEW);
    expect(out.map((s) => s.id)).toEqual(['ps0', 'ps3']);
    expect(out[0]).toEqual({ id: 'ps0', x0: 50, y0: 100, x1: 450, y1: 100, style: 'stroke' });
    expect(out[1].x0).toBe(-50);
    expect(out[1].x1).toBe(1100);
  });

  it('refuses a fractional crop: the pixels sent and the view-‰ must not drift apart', () => {
    expect(() => viewSegmentsOf([], HALF, { crop: { minX: 0.5, minY: 0, maxX: 10, maxY: 10 }, redacted: [] })).toThrow(/whole pixels/);
  });
});

describe('proposedReadingView', () => {
  const image = blankPlanRaster(400, 300);

  it('without a sheet layout the whole aligned image is proposed', () => {
    expect(proposedReadingView({ image, sheet: null })).toEqual({ crop: { minX: 0, minY: 0, maxX: 400, maxY: 300 }, redacted: [] });
  });

  it('crops to the drawing (snapped outward to whole pixels) and redacts the annotation blocks inside it', () => {
    const sheet: SheetLayout = {
      frame: null,
      drawing: region(10.4, 9.6, 390.2, 290.7),
      annotations: [
        { region: region(300, 220, 390, 290), confidence: 0.9, cellCount: 6, anchoredTo: ['right', 'bottom'] },
        { region: region(395, 0, 400, 5), confidence: 0.4, cellCount: 1, anchoredTo: ['top'] },
      ],
    };
    const view = proposedReadingView({ image, sheet });
    expect(view.crop).toEqual({ minX: 10, minY: 9, maxX: 391, maxY: 291 });
    expect(view.redacted).toEqual([{ minX: 300, minY: 220, maxX: 390, maxY: 290 }]);
  });
});

describe('renderReadingViewRaster', () => {
  /** Ούτε μείωση ούτε μεγέθυνση για τα μεγέθη των tests. */
  const NATIVE = { maxPixels: 24_000_000, minPixels: 0 };

  /** Αρχική 400 × 300: η τιμή του κόκκινου κάθε pixel = x mod 256 (για να φαίνεται από πού διαβάστηκε). */
  function ramp(width: number, height: number) {
    const r = blankPlanRaster(width, height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) r.rgba[(y * width + x) * 4] = x % 256;
    return r;
  }

  it('resamples from the ORIGINAL at full resolution, and the redacted area is paper in the bytes', () => {
    const original = ramp(400, 300);
    const { raster, scale } = renderReadingViewRaster(original, { alignedToOriginal: DOUBLE, workingScale: 2 }, VIEW, NATIVE);
    expect([raster.width, raster.height, scale]).toEqual([400, 200, 1]);
    expect(raster.rgba[0]).toBe(200); // όψη (0,0) ⇒ ευθυγρ. (100,50) ⇒ αρχική (200,100)
    const at = (x: number, y: number) => raster.rgba[(y * raster.width + x) * 4];
    expect(at(399, 199)).toBe(255); // ασπρισμένο: πινακίδα
    expect(at(10, 199)).toBe(210);
  });

  it('never exceeds the pixel budget (area-average first, then the homography)', () => {
    const original = ramp(400, 300);
    const small = renderReadingViewRaster(original, { alignedToOriginal: DOUBLE, workingScale: 2 }, VIEW, { maxPixels: 20_000, minPixels: 0 });
    expect(small.raster.width * small.raster.height).toBeLessThanOrEqual(20_000);
    expect(small.scale).toBeCloseTo(0.5, 9);
  });

  it('enlarges a small view up to the minimum, and leaves a mid-size view at native resolution', () => {
    const original = ramp(400, 300);
    const align = { alignedToOriginal: IDENTITY_HOMOGRAPHY, workingScale: 1 };
    const enlarged = renderReadingViewRaster(original, align, VIEW, { maxPixels: 1_000_000, minPixels: 80_000 });
    expect([enlarged.raster.width, enlarged.raster.height]).toEqual([400, 200]);
    expect(enlarged.scale).toBe(2);
    expect(renderReadingViewRaster(original, align, VIEW, NATIVE).scale).toBe(1);
  });
});

describe('planReadingFromView', () => {
  const reading: PlanViewReading = {
    texts: [{ id: 't1', kind: 'dimension', raw: '3.50', box: { x0: 0, y0: 0, x1: 500, y1: 1000 }, confidence: 0.8 }],
    dimensions: [
      { textId: 't1', valueMm: 3500, segmentIds: ['ps0'], confidence: 0.8 },
      { textId: 't1', valueMm: null, segmentIds: [], confidence: 0.3 },
    ],
    writtenScale: null,
    rooms: [{ name: 'ΣΑΛΟΝΙ', nameTextId: null, writtenAreaM2: 0, boundarySegmentIds: [], confidence: 0.5 }],
    openings: [],
  };

  it('returns texts in original px, the reading confidence as its factor, and no unit-less dimension', () => {
    const out = planReadingFromView(reading, VIEW, DOUBLE, { model: 'm', schemaVersion: 1 });
    expect(out.texts[0].rect).toEqual({ minX: 200, minY: 100, maxX: 400, maxY: 300 });
    expect(out.texts[0].confidence).toEqual({ score: 0.8, factors: { reading: 0.8 } });
    expect(out.dimensions).toHaveLength(1);
    expect(out.rooms[0].writtenAreaM2).toBeNull();
    expect([out.model, out.schemaVersion]).toEqual(['m', 1]);
  });
});
