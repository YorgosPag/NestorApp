/**
 * SSoT — rotation-aware rectangle vertices ενός standalone raster image entity
 * (ADR-651 Φάση Ε). Διαβάζει `position`/`width`/`height`/`rotation` και δίνει τις 4
 * κορυφές στο WORLD frame μέσω του κοινού `createRectangleVertices` (pivot=`position`).
 *
 * ΕΝΑ μονοπάτι, κοινό για render (`ImageRenderer`), bounds (`entity-bounds-ssot`) ΚΑΙ
 * hit-test (`hit-test-entity-tests`) → click/bbox/draw συμφωνούν πάντα, μηδέν sibling
 * clone (N.18). Επιστρέφει `null` όταν λείπει position/width/height.
 */
import type { Point2D } from '../../types/Types';
import { createRectangleVertices } from './geometry-utils';

/** Δομικό σχήμα ενός image entity όσον αφορά τη γεωμετρία ορθογωνίου. */
export interface ImageRectShape {
  position?: Point2D;
  width?: number;
  height?: number;
  rotation?: number;
}

export function imageEntityRectVertices(entity: ImageRectShape): Point2D[] | null {
  const { position, width, height, rotation } = entity;
  if (!position || width === undefined || height === undefined) return null;
  return createRectangleVertices(
    position,
    { x: position.x + width, y: position.y + height },
    rotation,
  );
}
