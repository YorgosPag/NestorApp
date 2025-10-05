/**
 * Export all entity renderers
 */

export { BaseEntityRenderer } from './BaseEntityRenderer';
export type { EntityModel, GripInfo, RenderOptions } from '../types/Types';

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

// ✅ ΔΙΟΡΑΘΩΣΗ ΔΙΠΛΟΤΥΠΟΥ: EntityRendererComposite αφαιρέθηκε - χρήση direct import από ../core/EntityRendererComposite

// Factory function to create a configured renderer
export function createEntityRenderer(ctx: CanvasRenderingContext2D) {
  // Direct import χρειάζεται για τη factory function
  const { EntityRendererComposite } = require('../core/EntityRendererComposite');
  return new EntityRendererComposite(ctx);
}