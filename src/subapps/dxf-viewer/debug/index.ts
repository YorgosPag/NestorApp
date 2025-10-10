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
export const canvasLog = (...args: any[]) => CanvasLogger.debug(...args);
export const canvasWarn = (...args: any[]) => CanvasLogger.warn(...args);
export const canvasError = (...args: any[]) => CanvasLogger.error(...args);

/**
 * Quick rendering logging
 */
export const renderLog = (...args: any[]) => RenderingLogger.debug(...args);
export const renderWarn = (...args: any[]) => RenderingLogger.warn(...args);
export const renderError = (...args: any[]) => RenderingLogger.error(...args);

/**
 * Quick performance logging
 */
export const perfLog = (...args: any[]) => PerformanceLogger.debug(...args);
export const perfWarn = (...args: any[]) => PerformanceLogger.warn(...args);

/**
 * Quick snap logging
 */
export const snapLog = (...args: any[]) => SnapLogger.debug(...args);
export const snapWarn = (...args: any[]) => SnapLogger.warn(...args);

/**
 * Quick hit test logging
 */
export const hitTestLog = (...args: any[]) => HitTestLogger.debug(...args);
export const hitTestWarn = (...args: any[]) => HitTestLogger.warn(...args);

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
    (window as any).runEnterpriseSettingsTests = runEnterpriseSettingsTests;
  });

  // Store Sync Tests (Ports & Adapters Architecture)
  import('./store-sync-test').then(({ runStoreSyncTests }) => {
    (window as any).runStoreSyncTests = runStoreSyncTests;
  });

  (window as any).dxfDebug = {
    // Legacy compatibility
    enable: () => {
      (window as any).__DXF_DEBUG__ = true;
      return 'DXF Debug enabled (legacy mode)';
    },
    disable: () => {
      (window as any).__DXF_DEBUG__ = false;
      return 'DXF Debug disabled (legacy mode)';
    },

    // New unified system
    manager: () => (window as any).dxfDebugManager,
    canvas: () => CanvasLogger,
    rendering: () => RenderingLogger,
    snap: () => SnapLogger,
    performance: () => PerformanceLogger,

    // 🆕 Enterprise Settings Tests
    testSettings: () => {
      if ((window as any).runEnterpriseSettingsTests) {
        return (window as any).runEnterpriseSettingsTests();
      } else {
        console.error('Enterprise Settings Tests not loaded yet');
      }
    },

    // 🆕 Store Sync Tests (Ports & Adapters Architecture)
    testStoreSync: () => {
      if ((window as any).runStoreSyncTests) {
        return (window as any).runStoreSyncTests();
      } else {
        console.error('Store Sync Tests not loaded yet');
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