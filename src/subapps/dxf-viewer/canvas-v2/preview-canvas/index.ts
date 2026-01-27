/**
 * 🏢 ENTERPRISE PREVIEW CANVAS MODULE
 *
 * Public exports for the PreviewCanvas system.
 * ADR-040: Dedicated Preview Canvas for CAD-grade performance
 *
 * @module preview-canvas
 * @version 1.0.0
 * @since 2026-01-26
 */

// ===== COMPONENTS =====
export { PreviewCanvas } from './PreviewCanvas';

// ===== CLASSES =====
export { PreviewRenderer } from './PreviewRenderer';

// ===== TYPES =====
export type {
  PreviewCanvasProps,
  PreviewCanvasHandle,
} from './PreviewCanvas';

export type {
  PreviewRenderOptions,
} from './PreviewRenderer';

// 🏢 ADR-040: Viewport re-exported from centralized types
export type { Viewport } from '../../rendering/types/Types';
