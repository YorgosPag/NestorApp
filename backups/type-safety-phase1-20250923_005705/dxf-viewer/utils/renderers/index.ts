/**
 * Export all entity renderers
 */

export { BaseEntityRenderer } from './BaseEntityRenderer';
export type { EntityModel, GripInfo, RenderOptions } from '../../types/renderer';

// Individual renderers
export { LineRenderer } from './LineRenderer';
export { CircleRenderer } from './CircleRenderer';
export { PolylineRenderer } from './PolylineRenderer';
export { ArcRenderer } from './ArcRenderer';
export { TextRenderer } from './TextRenderer';
export { RectangleRenderer } from './RectangleRenderer';
export { EllipseRenderer } from './EllipseRenderer';
export { SplineRenderer } from './SplineRenderer';
export { AngleMeasurementRenderer } from './AngleMeasurementRenderer';
export { PointRenderer } from './PointRenderer';

// Composite renderer
export { EntityRendererComposite } from './EntityRendererComposite';

// Factory function to create a configured renderer
export function createEntityRenderer(ctx: CanvasRenderingContext2D) {
  return new EntityRendererComposite(ctx);
}