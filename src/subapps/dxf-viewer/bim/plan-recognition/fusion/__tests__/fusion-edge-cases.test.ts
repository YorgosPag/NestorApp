/**
 * ⚓ ADR-929 Φ4 — οριακές περιπτώσεις της σύντηξης: λοξοί τοίχοι, διφορούμενη δέση, φρένο αλυσίδας στη συγχώνευση.
 */

import { describe, expect, it } from '@jest/globals';
import { IDENTITY_HOMOGRAPHY } from '@/lib/geometry/homography';
import { blankPlanRaster } from '@/lib/geometry/raster/plan-raster';
import type { RasterSegment } from '../../plan-recognition-types';
import { buildFusionFrame } from '../fusion-frame';
import { fusePlan } from '../plan-fusion';
import { DEFAULT_PLAN_FUSION } from '../plan-fusion-types';
import { KNOWN_SCALE, PX_PER_MM, dimensionOf, fusionInput, reading } from './fusion-fixture';
import type { PlanText } from '../../plan-recognition-types';

const seg = (id: string, x0: number, y0: number, x1: number, y1: number, strokeWidthPx = 1): RasterSegment => ({
  id, start: { x: x0, y: y0 }, end: { x: x1, y: y1 }, style: 'stroke', strokeWidthPx, confidence: { score: 0.9, factors: { geometry: 0.9 } },
});

const text = (id: string, raw: string, cx: number, cy: number, w: number, h: number): PlanText => ({
  id, kind: 'dimension', raw, rect: { minX: cx - w / 2, minY: cy - h / 2, maxX: cx + w / 2, maxY: cy + h / 2 }, confidence: { score: 0.9, factors: { reading: 0.9 } },
});

const read = (r: ReturnType<typeof reading>) => ({ status: 'read' as const, reading: r });

describe('λοξοί τοίχοι — η ίδια γραμμική συνόρθωση σε κάθε γωνία', () => {
  it('διάσταση ανάμεσα σε δύο παρειές 45° δένεται σε αυτές (με την ένδειξη της ανάγνωσης) και μετρά σωστά', () => {
    const gapPx = 50; // 1000 mm
    const n = { x: -Math.SQRT1_2, y: Math.SQRT1_2 };
    const o1 = seg('o1', 200, 200, 300, 300);
    const o2 = seg('o2', 200 + n.x * gapPx, 200 + n.y * gapPx, 300 + n.x * gapPx, 300 + n.y * gapPx);
    const c = { x: 250 + (n.x * gapPx) / 2, y: 250 + (n.y * gapPx) / 2 };
    const r = fusePlan(fusionInput({
      segments: [o1, o2],
      reading: read(reading({ texts: [text('t', '1.00', c.x, c.y, 8, 8)], dimensions: [dimensionOf('t', 1000, ['o1', 'o2'])] })),
      knownScale: KNOWN_SCALE,
    }));
    expect(r.families.length).toBe(3);
    const d = r.dimensions[0];
    expect(d.binding?.source).toBe('geometry+reading');
    expect(d.measuredMm).toBeCloseTo(gapPx / PX_PER_MM, 3);
    expect(d.status).not.toBe('conflict');
  });
});

describe('διφορούμενη δέση — ερώτηση, όχι μαντεψιά', () => {
  it('δύο ζεύγη εξίσου κεντραρισμένα και μέσα στην ανοχή (σκίτσο) ⇒ ambiguous-binding, εκτός λύτη', () => {
    const lines = [100, 103, 197, 200].map((x, i) => seg(`v${i}`, x, 100, x, 300));
    const r = fusePlan(fusionInput({
      kind: 'sketch',
      segments: lines,
      reading: read(reading({ texts: [text('t', '1.94', 150, 200, 24, 8)], dimensions: [dimensionOf('t', 1940)] })),
      knownScale: KNOWN_SCALE,
    }));
    expect(r.dimensions[0].status).toBe('unbound');
    expect(r.dimensions[0].binding?.ambiguous).toBe(true);
    expect(r.questions.map((q) => q.kind)).toEqual(['ambiguous-binding']);
  });
});

describe('συγχώνευση συνευθειακών — φρένο αλυσίδας', () => {
  it('γραμμοσκίαση ανά 1,5 px δεν γίνεται ΜΙΑ ευθεία 13,5 px', () => {
    const hatch = Array.from({ length: 10 }, (_, i) => seg(`h${i}`, 100 + i * 1.5, 100, 100 + i * 1.5, 300));
    const frame = buildFusionFrame(hatch, {
      image: blankPlanRaster(400, 400), originalToAligned: IDENTITY_HOMOGRAPHY, alignedToOriginal: IDENTITY_HOMOGRAPHY, sheet: null,
    }, DEFAULT_PLAN_FUSION);
    const spans = frame.lines.map((l) => l.segmentIds.length);
    expect(frame.lines.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...spans)).toBeLessThan(10);
  });
});
