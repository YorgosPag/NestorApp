/**
 * Centralized Debug System - Main API
 * Ενοποιημένο σύστημα αποσφαλμάτωσης για το DXF Viewer
 *
 * ΧΡΗΣΗ:
 * import { dlog, dwarn, derr, drender, getDebugLogger } from '../debug';
 *
 * const logger = getDebugLogger('MyModule');
 * logger.info('Hello from MyModule');
 *
 * dlog('Canvas', 'Rendering started');
 * drender('Performance', 'Frame rendered');
 */

import type { Logger } from './core/types';

/**
 * 🏢 ENTERPRISE: Window interface for debug globals
 */
interface DxfDebugAPI {
  enable: () => string;
  disable: () => string;
  manager: () => Window['dxfDebugManager'];
  canvas: () => Logger;
  rendering: () => Logger;
  snap: () => Logger;
  performance: () => Logger;
  testSettings: () => Promise<unknown> | undefined;
  testStoreSync: () => Promise<unknown> | undefined;
  help: () => void;
}

declare global {
  interface Window {
    __DXF_DEBUG__?: boolean;
    runEnterpriseSettingsTests?: () => Promise<unknown>;
    runStoreSyncTests?: () => Promise<unknown>;
    dxfDebug?: DxfDebugAPI;
  }
}

// ═══ CORE EXPORTS ═══
export {
  UnifiedDebugManager,
  getDebugLogger,
  dlog,
  dwarn,
  derr,
  drender,
  dperf,
  dhot,
  dbatch
} from './core/UnifiedDebugManager';

export type {
  DebugConfig,
  LogEntry,
  DebugStatistics,
  LogLevel,
  LogFunction,
  DebugModule,
  PerformanceMetrics
} from './core/types';

// ═══ SPECIALIZED LOGGERS ═══
export { SnapDebugLogger } from './loggers/SnapDebugLogger';

// ═══ DEBUG PANELS ═══
export { HierarchyDebugPanel } from './panels/HierarchyDebugPanel';
export { DebugModeTest } from './panels/DebugModeTest';

// ═══ LEGACY COMPATIBILITY ═══
// Για backward compatibility με υπάρχοντα systems
export {
  DXF_DEBUG,
  DXF_RENDER_DEBUG,
  enableEmergencySilence,
  disableEmergencySilence,
  isEmergencySilenced
} from './loggers/OptimizedLogger';

// ═══ CONVENIENT MODULE LOGGERS ═══
import { getDebugLogger } from './core/UnifiedDebugManager';

// Pre-configured loggers για τα κύρια modules
export const CanvasLogger = getDebugLogger('Canvas');
export const RenderingLogger = getDebugLogger('Rendering');
export const SnapLogger = getDebugLogger('Snap');
export const HitTestLogger = getDebugLogger('HitTest');
export const PerformanceLogger = getDebugLogger('Performance');
export const EventsLogger = getDebugLogger('Events');
export const LayerLogger = getDebugLogger('Layer');
export const DxfLogger = getDebugLogger('DxfViewer');

// ═══ QUICK ACCESS FUNCTIONS ═══

/**
 * Quick canvas logging
 */
export const canvasLog = (...args: unknown[]) => CanvasLogger.debug(...args);
export const canvasWarn = (...args: unknown[]) => CanvasLogger.warn(...args);
export const canvasError = (...args: unknown[]) => CanvasLogger.error(...args);

/**
 * Quick rendering logging
 */
export const renderLog = (...args: unknown[]) => RenderingLogger.debug(...args);
export const renderWarn = (...args: unknown[]) => RenderingLogger.warn(...args);
export const renderError = (...args: unknown[]) => RenderingLogger.error(...args);

/**
 * Quick performance logging
 */
export const perfLog = (...args: unknown[]) => PerformanceLogger.debug(...args);
export const perfWarn = (...args: unknown[]) => PerformanceLogger.warn(...args);

/**
 * Quick snap logging
 */
export const snapLog = (...args: unknown[]) => SnapLogger.debug(...args);
export const snapWarn = (...args: unknown[]) => SnapLogger.warn(...args);

/**
 * Quick hit test logging
 */
export const hitTestLog = (...args: unknown[]) => HitTestLogger.debug(...args);
export const hitTestWarn = (...args: unknown[]) => HitTestLogger.warn(...args);

// ═══ ENTERPRISE TESTS ═══
export { runEnterpriseSettingsTests } from './settings-enterprise-test';
export { runStoreSyncTests } from './store-sync-test';

// ═══ DEVELOPMENT HELPERS ═══

/**
 * Global debug utilities (development only)
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  // Enterprise Settings Tests
  import('./settings-enterprise-test').then(({ runEnterpriseSettingsTests }) => {
    window.runEnterpriseSettingsTests = runEnterpriseSettingsTests;
  });

  // Store Sync Tests (Ports & Adapters Architecture)
  import('./store-sync-test').then(({ runStoreSyncTests }) => {
    window.runStoreSyncTests = runStoreSyncTests;
  });

  window.dxfDebug = {
    // Legacy compatibility
    enable: () => {
      window.__DXF_DEBUG__ = true;
      return 'DXF Debug enabled (legacy mode)';
    },
    disable: () => {
      window.__DXF_DEBUG__ = false;
      return 'DXF Debug disabled (legacy mode)';
    },

    // New unified system
    manager: () => window.dxfDebugManager,
    canvas: () => CanvasLogger,
    rendering: () => RenderingLogger,
    snap: () => SnapLogger,
    performance: () => PerformanceLogger,

    // 🆕 Enterprise Settings Tests
    testSettings: () => {
      if (window.runEnterpriseSettingsTests) {
        return window.runEnterpriseSettingsTests();
      } else {
        console.error('Enterprise Settings Tests not loaded yet');
        return undefined;
      }
    },

    // 🆕 Store Sync Tests (Ports & Adapters Architecture)
    testStoreSync: () => {
      if (window.runStoreSyncTests) {
        return window.runStoreSyncTests();
      } else {
        console.error('Store Sync Tests not loaded yet');
        return undefined;
      }
    },

    // Quick help
    help: () => {
      console.log(`
🔧 DXF Debug System Help:

== Quick Loggers ==
dxfDebug.canvas()     - Canvas logger
dxfDebug.rendering()  - Rendering logger
dxfDebug.snap()       - Snap logger
dxfDebug.performance() - Performance logger

== Manager Controls ==
dxfDebug.manager().enable()           - Enable all debug
dxfDebug.manager().disable()          - Disable all debug
dxfDebug.manager().enableModule(name)  - Enable specific module
dxfDebug.manager().disableModule(name) - Disable specific module
dxfDebug.manager().stats()            - View statistics
dxfDebug.manager().modules()          - List all modules

== Emergency Controls ==
dxfDebug.manager().emergencySilence() - Silence all logs except errors
dxfDebug.manager().emergencyRestore() - Restore normal logging

== Enterprise Tests ==
dxfDebug.testSettings()               - Run Enterprise Settings validation suite
dxfDebug.testStoreSync()              - Run Store Sync (Ports & Adapters) tests
runEnterpriseSettingsTests()          - Direct test runner (async)
runStoreSyncTests()                   - Direct store sync test runner (async)

== Legacy Support ==
dxfDebug.enable()  - Enable legacy DXF_DEBUG flag
dxfDebug.disable() - Disable legacy DXF_DEBUG flag
      `);
    }
  };
}