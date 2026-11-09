/**
 * ADR-929 §6.12 · §6.14 — οι γραμμές τοίχου του σχεδίου δοκιμής **ως πινελιές μιας εικόνας**. ΕΝΑ σημείο για την
 * πηγή-εικόνα των tests: το test συνεδρίας με πηγή-εικόνα και το test ισοτιμίας σχέδιο ↔ εικόνα διαβάζουν τα ΙΔΙΑ
 * pixel, μέσω της ΜΙΑΣ απεικόνισης `sceneToRasterPixel` (όχι αντίγραφα, CHECK 3.28).
 */

import type { Entity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import type { RasterSegment } from '../../plan-recognition/plan-recognition-types';
import { sceneToRasterPixel, type RasterPlacement } from '../../../floorplan-background/geometry/raster-scene-mapping';
import { colorOf, ENTITIES, WALL } from './opening-fixture';

/** 1 px = 10 mm, εικόνα 1200 × 1300 px: καλύπτει το σχέδιο δοκιμής (≈ 0,7–10,3 m × 0,25–11,3 m). */
export const TEST_RASTER_PLACEMENT: RasterPlacement = {
  naturalBounds: { width: 1200, height: 1300 },
  transform: { translateX: 0, translateY: 0, scaleX: 10, scaleY: 10, rotation: 0 },
};

type SceneLine = Entity & { readonly start: Point2D; readonly end: Point2D };

/** Οι 160 γραμμές ρόλου «τοίχος» του σχεδίου δοκιμής. */
export const WALL_LINES = ENTITIES.filter((e) => colorOf(e) === WALL) as readonly SceneLine[];

function toPixel(p: Point2D, shiftPx: number): Point2D {
  const px = sceneToRasterPixel(p, TEST_RASTER_PLACEMENT);
  if (!px) throw new Error('test placement must be invertible');
  return { x: px.x + shiftPx, y: px.y + shiftPx };
}

/** Οι γραμμές τοίχου ως πινελιές της εικόνας· `shiftPx` = η ίδια εικόνα ξαναδιαβασμένη λίγο αλλιώς. */
export function wallLinesAsRasterSegments(shiftPx = 0): RasterSegment[] {
  return WALL_LINES.map((line) => ({
    id: line.id,
    start: toPixel(line.start, shiftPx),
    end: toPixel(line.end, shiftPx),
    style: 'stroke',
    strokeWidthPx: 1,
    confidence: { score: 0.9, factors: { geometry: 0.9 } },
  }));
}
