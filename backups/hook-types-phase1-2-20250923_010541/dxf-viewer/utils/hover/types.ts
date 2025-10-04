/**
 * Hover Types
 * Type definitions for hover system
 */

import type { Point2D } from '../../systems/rulers-grid/config';
import type { EntityModel, RenderOptions } from '../../types/renderer';

export type { Point2D };
export type { EntityModel, RenderOptions };

export type WorldToScreenFn = (p: Point2D) => Point2D;

export interface HoverRenderContext {
  entity: EntityModel;
  ctx: CanvasRenderingContext2D;
  worldToScreen: WorldToScreenFn;
  options: RenderOptions;
}