/**
 * Δείγμα των tests της σύντηξης (ADR-929 Φ4): το σπίτι 6 × 4 m του `SAMPLE_HOUSE_WALLS` ως **παρειές** (όχι εικόνα),
 * με ταυτοτική ευθυγράμμιση, ώστε η αλήθεια να είναι ακριβής και κάθε απόκλιση να οφείλεται στη σύντηξη.
 *
 * Παρειές x (mm): −125 · 125 · 3450 · 3550 · 5875 · 6125 — παρειές y: −125 · 125 · 3875 · 4125.
 * px = ORIGIN + mm · PX_PER_MM (1 px = 20 mm, όπως μια σάρωση 1:100 σε ~127 dpi).
 */

import { IDENTITY_HOMOGRAPHY } from '@/lib/geometry/homography';
import { blankPlanRaster } from '@/lib/geometry/raster/plan-raster';
import type { RasterRectPx } from '../../../../types/coordinate-space';
import type { PlanDimension, PlanReading, PlanRoomReading, PlanText, RasterSegment } from '../../plan-recognition-types';
import type { PlanFusionInput } from '../plan-fusion-types';

export const PX_PER_MM = 0.05;
export const ORIGIN_PX = 100;
export const px = (mm: number): number => ORIGIN_PX + mm * PX_PER_MM;

export const X_FACES_MM = [-125, 125, 3450, 3550, 5875, 6125] as const;
export const Y_FACES_MM = [-125, 125, 3875, 4125] as const;

const confidence = (score: number) => ({ score, factors: { geometry: score } });

/** Τμήμα-πινελιά 2 px από (x0, y0) σε (x1, y1), σε mm του δείγματος. */
export function segment(id: string, x0: number, y0: number, x1: number, y1: number): RasterSegment {
  return { id, start: { x: px(x0), y: px(y0) }, end: { x: px(x1), y: px(y1) }, style: 'stroke', strokeWidthPx: 2, confidence: confidence(0.9) };
}

/** Παρειές του σπιτιού· `shiftMm` μετακινεί **μία** κατακόρυφη παρειά (σχέδιο που δεν είναι «σε κλίμακα» εκεί). */
export function houseSegments(shift?: { readonly faceIndex: number; readonly mm: number }): RasterSegment[] {
  const vertical = X_FACES_MM.map((x, i) => {
    const xx = x + (shift && shift.faceIndex === i ? shift.mm : 0);
    const interior = i === 2 || i === 3;
    return segment(`v${i}`, xx, interior ? 125 : -125, xx, interior ? 3875 : 4125);
  });
  const horizontal = Y_FACES_MM.map((y, i) => {
    const outer = i === 0 || i === 3;
    return segment(`h${i}`, outer ? -125 : 125, y, outer ? 6125 : 5875, y);
  });
  return [...vertical, ...horizontal];
}

/** Κείμενο με κέντρο στο σημείο (mm): οριζόντιο (πλατύ) ή κατακόρυφο (ψηλό, περιστραμμένο). */
export function textAt(id: string, raw: string, xMm: number, yMm: number, orientation: 'h' | 'v', kind: PlanText['kind'] = 'dimension'): PlanText {
  const [w, h] = orientation === 'h' ? [24, 8] : [8, 24];
  const rect: RasterRectPx = { minX: px(xMm) - w / 2, minY: px(yMm) - h / 2, maxX: px(xMm) + w / 2, maxY: px(yMm) + h / 2 };
  return { id, kind, raw, rect, confidence: { score: 0.9, factors: { reading: 0.9 } } };
}

export const dimensionOf = (textId: string, valueMm: number, segmentIds: readonly string[] = []): PlanDimension => ({
  textId,
  valueMm,
  segmentIds,
  confidence: { score: 0.9, factors: { reading: 0.9 } },
});

/** Η αλυσίδα κάτω από το σπίτι + δύο κατακόρυφες: οι διαστάσεις μιας τυπικής κάτοψης άδειας. */
export function houseDimensions(overrides: Readonly<Record<string, { raw: string; valueMm: number }>> = {}): { texts: PlanText[]; dimensions: PlanDimension[] } {
  const spec = [
    { id: 't-overall', raw: '6.25', valueMm: 6250, x: 3000, y: 4800, o: 'h' as const },
    { id: 't-west', raw: '3.325', valueMm: 3325, x: 1787.5, y: 2000, o: 'h' as const },
    { id: 't-east', raw: '2.325', valueMm: 2325, x: 4712.5, y: 2000, o: 'h' as const },
    { id: 't-depth', raw: '4.25', valueMm: 4250, x: -800, y: 2000, o: 'v' as const },
    { id: 't-depth-in', raw: '3.75', valueMm: 3750, x: 800, y: 2000, o: 'v' as const },
  ];
  const texts = spec.map((s) => textAt(s.id, overrides[s.id]?.raw ?? s.raw, s.x, s.y, s.o));
  const dimensions = spec.map((s) => dimensionOf(s.id, overrides[s.id]?.valueMm ?? s.valueMm));
  return { texts, dimensions };
}

export function reading(parts: { texts?: PlanText[]; dimensions?: PlanDimension[]; rooms?: PlanRoomReading[] }): PlanReading {
  return {
    model: 'test',
    schemaVersion: 1,
    texts: parts.texts ?? [],
    dimensions: parts.dimensions ?? [],
    writtenScale: null,
    rooms: parts.rooms ?? [],
    openings: [],
  };
}

export function fusionInput(partial: Partial<PlanFusionInput> & Pick<PlanFusionInput, 'segments' | 'reading'>): PlanFusionInput {
  return {
    kind: 'scan',
    alignment: { image: blankPlanRaster(500, 400), originalToAligned: IDENTITY_HOMOGRAPHY, alignedToOriginal: IDENTITY_HOMOGRAPHY, sheet: null },
    knownScale: null,
    sourceDpi: null,
    roomAreaProbe: () => null,
    ...partial,
  };
}

/** Η γνωστή κλίμακα του δείγματος, με τη σημασιολογία του `RasterPixelScale`. */
export const KNOWN_SCALE = { metresPerPixelX: 1 / (PX_PER_MM * 1000), metresPerPixelY: 1 / (PX_PER_MM * 1000), source: 'gallery-scale' as const };
