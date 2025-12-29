/**
 * Hover Types
 * Type definitions for hover system
 */

import type { Point2D } from '../../rendering/types/Types';
// ✅ ENTERPRISE FIX: Use centralized Entity type instead of EntityModel
import type { Entity } from '../../types/entities';
import type { RenderOptions } from '../../rendering/types/Types';

export type { Point2D };
export type { Entity, RenderOptions };

export type WorldToScreenFn = (p: Point2D) => Point2D;

export interface HoverRenderContext {
  entity: Entity;
  ctx: CanvasRenderingContext2D;
  worldToScreen: WorldToScreenFn;
  options: RenderOptions;
}