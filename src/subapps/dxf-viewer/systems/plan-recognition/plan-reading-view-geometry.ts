/**
 * ADR-929 Φ5.3β — η **γέφυρα** ανάμεσα στον χώρο της όψης (aligned px της ευθυγραμμισμένης εικόνας) και στη σκηνή, για
 * το φύλλο που επεξεργάζεται την όψη πάνω στον καμβά.
 *
 *   aligned px ──(ομογραφία Φ1: `alignedToOriginal`)──▶ raster px ──(`rasterPixelToScene`, Δ3)──▶ σκηνή
 *
 * Ένα ορθογώνιο της όψης είναι **τετράπλευρο** στη σκηνή (η εικόνα μπορεί να είναι στραβή ή με προοπτική): ο άνθρωπος
 * βλέπει το crop να ακολουθεί το σχέδιο, όχι τους άξονες της οθόνης. Καμία δεύτερη αντιστοίχιση: μόνο οι δύο SSoT.
 *
 * ΚΑΘΑΡΟ — zero React/DOM/store.
 */

import { applyHomography, type Homography, type PlanePoint } from '@/lib/geometry/homography';
import type { Point2D } from '../../rendering/types/Types';
import type { AlignedRectPx, PlanAlignment } from '../../bim/plan-recognition/alignment/plan-alignment-types';
import type { RectHandle } from '../../bim/plan-recognition/reading/plan-reading-view-edit';
import {
  rasterPixelToScene,
  sceneToRasterPixel,
  type RasterPlacement,
} from '../../floorplan-background/geometry/raster-scene-mapping';

export type ViewGeometryAlignment = Pick<PlanAlignment, 'alignedToOriginal' | 'originalToAligned'>;

/** Τετράπλευρο σκηνής, γωνίες με τη σειρά πάνω-αριστερά · πάνω-δεξιά · κάτω-δεξιά · κάτω-αριστερά (της εικόνας). */
export type SceneQuad = readonly [Point2D, Point2D, Point2D, Point2D];

const toScene = (p: PlanePoint, h: Homography, placement: RasterPlacement): Point2D => {
  const raster = applyHomography(h, p.x, p.y);
  return rasterPixelToScene({ x: raster.x, y: raster.y }, placement);
};

export function alignedPointToScene(p: PlanePoint, alignment: ViewGeometryAlignment, placement: RasterPlacement): Point2D {
  return toScene(p, alignment.alignedToOriginal, placement);
}

/** Σημείο σκηνής (ο δείκτης) → aligned px· `null` όταν η τοποθέτηση είναι εκφυλισμένη. */
export function sceneToAlignedPoint(p: Point2D, alignment: ViewGeometryAlignment, placement: RasterPlacement): PlanePoint | null {
  const raster = sceneToRasterPixel(p, placement);
  return raster ? applyHomography(alignment.originalToAligned, raster.x, raster.y) : null;
}

export function alignedRectToSceneQuad(r: AlignedRectPx, alignment: ViewGeometryAlignment, placement: RasterPlacement): SceneQuad {
  const at = (x: number, y: number): Point2D => alignedPointToScene({ x, y }, alignment, placement);
  return [at(r.minX, r.minY), at(r.maxX, r.minY), at(r.maxX, r.maxY), at(r.minX, r.maxY)];
}

/** Η θέση μιας λαβής πάνω στο ορθογώνιο, σε aligned px. */
export function rectHandlePoint(r: AlignedRectPx, handle: RectHandle): PlanePoint {
  const cx = (r.minX + r.maxX) / 2;
  const cy = (r.minY + r.maxY) / 2;
  const x = handle.includes('w') ? r.minX : handle.includes('e') ? r.maxX : cx;
  const y = handle.includes('n') ? r.minY : handle.includes('s') ? r.maxY : cy;
  return { x, y };
}
