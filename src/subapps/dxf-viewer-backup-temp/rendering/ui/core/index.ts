/**
 * UI CORE MODULE - Public API
 * ✅ ΦΑΣΗ 6: Centralized exports για UI rendering infrastructure
 */

// Core interfaces και types
export type {
  UIRenderer,
  UIRenderContext,
  UICoordinateSystem,
  UITransform,
  UIElementSettings,
  UIRenderMetrics,
  UIRendererFactory,
  UIRenderOptions
} from './UIRenderer';

// Concrete implementations
export {
  ScreenUICoordinateSystem,
  UIRenderContextImpl,
  createUIRenderContext,
  DEFAULT_UI_TRANSFORM
} from './UIRenderContext';

// Main composite renderer
export {
  UIRendererComposite,
  type UICategory
} from './UIRendererComposite';