/**
 * CANVAS MODULE - Unified Canvas System
 * ✅ ΦΑΣΗ 7: Central exports για complete canvas unification
 */

// Core canvas infrastructure
export { CanvasManager } from './core/CanvasManager';
export { CanvasEventSystem, globalCanvasEventSystem, canvasEventBus, subscribeToTransformChanges, CANVAS_EVENTS } from './core/CanvasEventSystem';
export { CanvasSettings } from './core/CanvasSettings';

// ✅ INTERNAL IMPORTS: Για τη createUnifiedCanvasSystem function
import { CanvasEventSystem } from './core/CanvasEventSystem';
import { CanvasSettings } from './core/CanvasSettings';
import { CanvasManager } from './core/CanvasManager';

// Canvas utilities
export { CanvasUtils } from './utils/CanvasUtils';

// Types
export type {
  CanvasInstance,
  CanvasManagerOptions
} from './core/CanvasManager';

export type {
  CanvasEvent,
  TransformChangeEvent,
  MouseEvent,
  RenderEvent,
  EventCallback
} from './core/CanvasEventSystem';

export type {
  CanvasRenderSettings,
  CanvasDisplayOptions,
  CanvasValidationResult
} from './core/CanvasSettings';

// Factory functions για easy setup
export const createUnifiedCanvasSystem = (options: {
  enableCoordination?: boolean;
  enableMetrics?: boolean;
  debugMode?: boolean;
} = {}) => {
  const eventSystem = new CanvasEventSystem();
  const settings = new CanvasSettings();
  const manager = new CanvasManager(eventSystem, settings, {
    enableCoordination: options.enableCoordination !== false,
    enableMetrics: options.enableMetrics !== false,
    sharedResources: true
  });

  if (options.debugMode) {
    eventSystem.setDebugMode(true);
    settings.setDebugMode(true);
  }

  return {
    manager,
    eventSystem,
    settings
  };
};

// 🏢 ADR-084: Canvas State Helpers
export {
  withCanvasState,
  withCanvasStateAsync,
  applyCanvasStyle,
  setFillStyle,
  setStrokeStyle,
  resetCanvasState
} from './withCanvasState';

export type { CanvasStyleOptions } from './withCanvasState';

// Legacy compatibility exports
export { CanvasUtils as CanvasUtilsLegacy } from './utils/CanvasUtils';
export { globalCanvasEventSystem as CanvasEventBusLegacy } from './core/CanvasEventSystem';