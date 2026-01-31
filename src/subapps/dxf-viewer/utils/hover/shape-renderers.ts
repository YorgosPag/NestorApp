/**
 * Shape Hover Renderers
 *
 * ⚠️ ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ: Οι hover renderers για shapes είναι προσωρινά
 * απενεργοποιημένοι για testing κίτρινων grips.
 *
 * Οι συναρτήσεις διατηρούνται ως stubs για backward compatibility.
 */

import type { HoverRenderContext } from './types';
import {
  isCircleEntity,
  isRectangleEntity,
  isRectEntity,
  isArcEntity,
  isPolylineEntity,
  isLWPolylineEntity,
  isEllipseEntity
} from '../../types/entities';

/**
 * Render circle hover - ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ
 * @stub Επιστρέφει αμέσως χωρίς να κάνει τίποτα
 */
export function renderCircleHover({ entity }: HoverRenderContext): void {
  if (!isCircleEntity(entity)) return;
  // ⚠️ ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ ΓΙΑ TESTING
}

/**
 * Render rectangle hover - ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ
 * @stub Επιστρέφει αμέσως χωρίς να κάνει τίποτα
 */
export function renderRectangleHover({ entity }: HoverRenderContext): void {
  if (!isRectangleEntity(entity) && !isRectEntity(entity) &&
      !isPolylineEntity(entity) && !isLWPolylineEntity(entity)) return;
  // ⚠️ ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ ΓΙΑ TESTING
}

/**
 * Render arc hover - ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ
 * @stub Επιστρέφει αμέσως χωρίς να κάνει τίποτα
 */
export function renderArcHover({ entity }: HoverRenderContext): void {
  if (!isArcEntity(entity)) return;
  // ⚠️ ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ ΓΙΑ TESTING
}

/**
 * Render ellipse hover - ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ
 * @stub Επιστρέφει αμέσως χωρίς να κάνει τίποτα
 */
export function renderEllipseHover({ entity }: HoverRenderContext): void {
  if (!isEllipseEntity(entity)) return;
  // ⚠️ ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ ΓΙΑ TESTING
}

