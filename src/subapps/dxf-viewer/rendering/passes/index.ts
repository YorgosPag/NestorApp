/**
 * RENDER PASSES - Export όλων των render passes
 * ✅ ΦΑΣΗ 4: Public API για το 3-pass rendering system
 */

// Core pipeline
export { RenderPipeline, createRenderPipeline, createCustomRenderPipeline } from '../core/RenderPipeline';
export type { IRenderPass, RenderPassOptions, PipelineState } from '../core/RenderPipeline';

// Individual passes
export { BackgroundPass, createBackgroundPass } from './BackgroundPass';
export type { BackgroundConfig } from './BackgroundPass';

export { EntityPass, createEntityPass } from './EntityPass';
export type { EntityBatch, EntityPassConfig } from './EntityPass';

export { OverlayPass, createOverlayPass } from './OverlayPass';
export type { GripInfo, SelectionInfo, CursorInfo, OverlayPassConfig } from './OverlayPass';

// Render context
export { Canvas2DContext, createCanvas2DContext } from '../adapters/canvas2d/Canvas2DContext';
export type {
  IRenderContext,
  RenderState,
  Transform2D,
  BoundingBox,
  IRenderContextFactory,
  RenderContextOptions
} from '../core/IRenderContext';
export type { Point2D } from '../types/Types';