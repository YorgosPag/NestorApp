/**
 * ⚓ ADR-929 §6.21.9 (Ε2) — η επικάλυψη αναγνώρισης ζωγραφίζει ΜΙΑ αλήθεια: τα **συνορθωμένα** τμήματα (ό,τι θα γραφτεί,
 * το ίδιο με την προεπισκόπηση του βοηθού), όχι τα ακατέργαστα της Φ2· και οι γωνίες της σύντηξης γίνονται γωνίες
 * πινελιάς (μία υποδιαδρομή, `Z` στον βρόχο, `miter`), όχι απολήξεις που προεξέχουν.
 */

import React from 'react';
import { render } from '@testing-library/react';
import type { RasterSegment } from '../../../bim/plan-recognition/plan-recognition-types';
import type { SegmentJunction } from '../../../bim/plan-recognition/fusion/segment-junctions';
import { rasterPixelToScene } from '../../../floorplan-background/geometry/raster-scene-mapping';
import { updateImmediateTransform, getImmediateTransform } from '../../../systems/cursor/ImmediateTransformStore';
import type { Viewport } from '../../../rendering/types/Types';
import { worldRingToSvgPath } from '../preview-zone/world-ring-path';
import { PlanRecognitionOverlay } from '../PlanRecognitionOverlay';

const MOCK_PLACEMENT = {
  transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  naturalBounds: { width: 100, height: 100 },
};

const mockSeg = (id: string, x0: number, y0: number, x1: number, y1: number): RasterSegment => ({
  id, start: { x: x0, y: y0 }, end: { x: x1, y: y1 }, style: 'stroke', strokeWidthPx: 2, confidence: { score: 0.5, factors: {} },
});

/**
 * Ορθογώνιο 20 × 10. Τα ακατέργαστα απέχουν ~½ px σε ΚΑΘΕ άκρο (η συνόρθωση τα μετακίνησε) και οι γωνίες τους δεν
 * κλείνουν: αν η επικάλυψη τα ζωγράφιζε, ΚΑΘΕ κορυφή του path θα ήταν άλλη.
 */
const MOCK_RAW = [
  mockSeg('a', 0.5, 0.5, 20.5, 0.5), mockSeg('b', 19.5, -1, 19.5, 10.5),
  mockSeg('c', 20.5, 9.5, -0.5, 9.5), mockSeg('d', 0.5, 10.5, 0.5, -1),
];
const MOCK_ADJUSTED = [mockSeg('a', 0, 0, 20, 0), mockSeg('b', 20, 0, 20, 10), mockSeg('c', 20, 10, 0, 10), mockSeg('d', 0, 10, 0, 0)];
const MOCK_JUNCTIONS: SegmentJunction[] = [
  { segmentId: 'a', end: 'end', neighbourId: 'b' }, { segmentId: 'b', end: 'start', neighbourId: 'a' },
  { segmentId: 'b', end: 'end', neighbourId: 'c' }, { segmentId: 'c', end: 'start', neighbourId: 'b' },
  { segmentId: 'c', end: 'end', neighbourId: 'd' }, { segmentId: 'd', end: 'start', neighbourId: 'c' },
  { segmentId: 'd', end: 'end', neighbourId: 'a' }, { segmentId: 'a', end: 'start', neighbourId: 'd' },
];
const MOCK_HIGH = { score: 0.95, factors: {} };

jest.mock('../../../systems/plan-recognition/plan-recognition-store', () => ({
  usePlanRecognitionState: () => ({
    run: { floorId: 'f1', segments: MOCK_RAW },
    fusion: {
      adjustedSegments: MOCK_ADJUSTED,
      segmentJunctions: MOCK_JUNCTIONS,
      segmentConfidence: new Map(['a', 'b', 'c', 'd'].map((id) => [id, MOCK_HIGH])),
      segmentRoles: new Map(),
    },
  }),
}));

jest.mock('../../../floorplan-background/stores/floorplanBackgroundStore', () => ({
  useFloorplanBackgroundStore: (select: (s: unknown) => unknown) => select({ floors: { f1: { background: MOCK_PLACEMENT } } }),
}));

updateImmediateTransform({ scale: 1, offsetX: 0, offsetY: 0 });
const viewport = { width: 800, height: 600 } as unknown as Viewport;

describe('PlanRecognitionOverlay — §6.21.9 (Ε2): μία γεωμετρία, κλειστές γωνίες', () => {
  it('ζωγραφίζει τα ΣΥΝΟΡΘΩΜΕΝΑ τμήματα ως ΕΝΑΝ κλειστό βρόχο με γωνίες πινελιάς', () => {
    const { container } = render(<PlanRecognitionOverlay viewport={viewport} />);
    const path = container.querySelector('path[data-tier="high"]');
    const ring = [MOCK_ADJUSTED[0].start, MOCK_ADJUSTED[1].start, MOCK_ADJUSTED[2].start, MOCK_ADJUSTED[3].start].map((p) => rasterPixelToScene(p, MOCK_PLACEMENT));
    expect(path?.getAttribute('d')).toBe(worldRingToSvgPath(ring, getImmediateTransform(), viewport, true));
    expect(path?.getAttribute('data-count')).toBe('4');
    expect(path?.getAttribute('stroke-linejoin')).toBe('miter');
    expect(path?.getAttribute('stroke-linecap')).toBe('butt');
  });
});
