/**
 * GEO-ALERT SYSTEM - MASTER INDEX
 * Complete Geo-Alert System - Phase 7: Performance Optimization & Testing Complete
 *
 * Κεντρικό σημείο εισόδου για ολόκληρο το Geo-Alert ecosystem.
 * Enterprise-class geospatial alert system με complete performance optimization.
 *
 * SRP-split (C.5.42): `GeoAlertSystem` class + interfaces + factories + mocks
 * moved to `./system/` — this file is now a pure barrel + startup.
 */

// ============================================================================
// PHASE 2: DXF TRANSFORMATION ENGINE (Available via services/)
// ============================================================================

// export * from './transformation/index'; // ❌ REMOVED: Folder doesn't exist
// Transformation services available via services/ folder instead

// ============================================================================
// PHASE 3: MAPLIBRE INTEGRATION (Available via services/)
// ============================================================================

// export * from './mapping/index'; // ❌ REMOVED: Folder doesn't exist
// Mapping services available via services/ folder instead

// ============================================================================
// PHASE 4: POSTGIS DATABASE INTEGRATION
// ============================================================================

export * from '@geo-alert/core/database-system';
export {
  GeoAlertDatabaseService,
  DatabaseManager,
  ProjectRepository,
  ControlPointRepository,
  SpatialQueryEngine
} from '@geo-alert/core/database-system';

// ============================================================================
// PHASE 5: ALERT ENGINE & RULES SYSTEM
// ============================================================================

// 🏢 ENTERPRISE: Only explicit exports to avoid conflicts with export *
export {
  GeoAlertEngine,
  RulesEngine,
  AlertDetectionSystem,
  NotificationDispatchEngine,
  DashboardServiceClass as DashboardService
} from '@geo-alert/core/alert-engine';

// Re-export types (no conflict risk with types)
export type {
  DashboardMetrics,
  RealTimeEvent,
  DashboardConfig
} from '@geo-alert/core/alert-engine';

// ============================================================================
// PHASE 6: ADVANCED UI/UX & DASHBOARD
// ============================================================================

// ⚠️ ENTERPRISE MIGRATION: Design System Deprecation Notice
// The GeoAlertDesignSystem is being deprecated in favor of useBorderTokens
// 🏢 ENTERPRISE: Only explicit exports to avoid conflicts with export *
export {
  GeoAlertDesignSystem, // @deprecated Use useBorderTokens from @/hooks/useBorderTokens instead
  ThemeProvider,
  ResponsiveDashboard,
  SearchSystem,
  LineChart,
  BarChart,
  PieChart,
  VirtualizedList,
  VirtualizedTable,
  LazyImage,
  DebouncedInput,
  Card,
  InfiniteScroll
} from './ui/design-system/index';

// ============================================================================
// PHASE 7: PERFORMANCE OPTIMIZATION & TESTING
// ============================================================================

// Performance Monitoring
export {
  PerformanceMonitor,
  performanceMonitor,
  type PerformanceMetrics
} from './performance/monitoring/PerformanceMonitor';

// Testing Suite
export {
  GeoAlertTestSuite,
  geoAlertTestSuite,
  runAllTests,
  runPhaseTests
} from './testing/TestSuite';

// Bundle Optimization
export {
  GeoAlertBundleOptimizer,
  geoAlertBundleOptimizer,
  analyzeBundles,
  validateBudget
} from './optimization/BundleOptimizer';

// Memory Leak Detection
export {
  GeoAlertMemoryLeakDetector,
  geoAlertMemoryLeakDetector,
  startMemoryMonitoring,
  getMemoryHealth
} from './optimization/MemoryLeakDetector';

// Performance Profiling
export {
  GeoAlertPerformanceProfiler,
  geoAlertPerformanceProfiler,
  startProfiler,
  profileFunction
} from './profiling/PerformanceProfiler';

// Automated Testing Pipeline
export {
  GeoAlertTestingPipeline,
  geoAlertTestingPipeline,
  executePipeline,
  getPipelineStats
} from './automation/TestingPipeline';

// ============================================================================
// UNIFIED GEO-ALERT SYSTEM CLASS (SRP-split → ./system/)
// ============================================================================

export { GeoAlertSystem } from './system/GeoAlertSystem';
export type {
  PerformanceSnapshot,
  SubsystemHealth,
  QualityGateResult,
  PipelineExecution,
  TestExecutionResults,
  SystemStatistics
} from './system/types';

import { GeoAlertSystem } from './system/GeoAlertSystem';

// ============================================================================
// GLOBAL EXPORTS
// ============================================================================

/**
 * Global Geo-Alert System Instance
 */
export const geoAlertSystem = GeoAlertSystem.getInstance();

/**
 * Quick system utilities
 */
export const initializeGeoAlert = () => geoAlertSystem.initialize();
export const getSystemHealth = () => geoAlertSystem.getSystemHealth();
export const runSystemTests = () => geoAlertSystem.runComprehensiveTests();
export const getSystemInfo = () => geoAlertSystem.getSystemInfo();

/**
 * Default export για convenience
 */
export default geoAlertSystem;

// ============================================================================
// SYSTEM STARTUP MESSAGE
// ============================================================================

console.debug(`
   GEO-ALERT SYSTEM v1.0.0 - ENTERPRISE GEOSPATIAL INTELLIGENCE

   Phase 2: DXF Transformation Engine        COMPLETE
   Phase 3: MapLibre Integration             COMPLETE
   Phase 4: PostGIS Database                 COMPLETE
   Phase 5: Alert Engine & Rules             COMPLETE
   Phase 6: Advanced UI/UX & Dashboard       COMPLETE
   Phase 7: Performance & Testing            COMPLETE

   Ready for production deployment.

   Import: import { geoAlertSystem } from './geo-canvas'
   Initialize: await geoAlertSystem.initialize()
`);
