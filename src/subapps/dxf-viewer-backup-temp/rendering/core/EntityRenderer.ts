/**
 * ENTITY RENDERER INTERFACE
 * ✅ UNIFIED: Κοινό interface για όλους τους entity renderers
 */

import type { EntityModel, GripInfo, RenderOptions, Point2D, ViewTransform, GripSettings, GripInteractionState } from '../types/Types';

/**
 * Κοινό interface που πρέπει να εφαρμόζουν όλοι οι entity renderers
 */
export interface IEntityRenderer {
  // ===== RENDERING =====
  render(entity: EntityModel, options?: RenderOptions): void;

  // ===== HIT TESTING =====
  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean;

  // ===== GRIPS =====
  getGrips(entity: EntityModel): GripInfo[];
  findGripAtPoint(entity: EntityModel, screenPoint: Point2D, tolerance: number): GripInfo | null;

  // ===== CONFIGURATION =====
  setTransform(transform: ViewTransform): void;
  setGripSettings(settings: GripSettings): void;
  setGripInteractionState(state: GripInteractionState): void;

  // ===== METADATA =====
  getSupportedEntityTypes(): string[];
  getEntityBounds(entity: EntityModel): { min: Point2D; max: Point2D } | null;
}

/**
 * Αποτελέσματα rendering για debugging/profiling
 */
export interface RenderResult {
  success: boolean;
  entityId: string;
  entityType: string;
  renderTime: number;
  gripsCount: number;
  error?: string;
}

/**
 * Context πληροφορίες που περνάνε στους renderers
 */
export interface RenderContext {
  transform: ViewTransform;
  viewport: { width: number; height: number };
  phase: 'normal' | 'preview' | 'selected' | 'highlighted';
  showGrips: boolean;
  showBounds: boolean;
  debugMode: boolean;
}

/**
 * Performance metrics για renderer optimization
 */
export interface RendererMetrics {
  totalRenderCalls: number;
  totalRenderTime: number;
  averageRenderTime: number;
  hitTestCalls: number;
  cacheHits: number;
  cacheMisses: number;
}