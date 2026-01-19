/**
 * 🚀 ENTERPRISE PERFORMANCE SYSTEM - CENTRALIZED ARCHITECTURE
 *
 * Κεντρικοποιημένο Performance & Monitoring System σε επίπεδο Microsoft/Google/AWS.
 * Αντικαθιστά όλα τα διάσπαρτα performance systems με ένα unified enterprise solution.
 *
 * ΚΟΝΣΟΛΙΔΩΝΕΙ:
 * - src/subapps/dxf-viewer/performance/ (DXF performance)
 * - src/subapps/geo-canvas/performance/ (Geo performance)
 * - src/utils/performanceMonitor.ts (Generic monitoring)
 * - src/lib/cache/ (Cache performance)
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0 - Enterprise Consolidation
 * @since 2025-12-18
 * @updated 2026-01-19 - Removed non-existent module exports (PR-002)
 */

// 🎯 UNIFIED EXPORTS - SINGLE SOURCE OF TRUTH
// 🏢 ENTERPRISE FIX (2026-01-19): Only export modules that actually exist
export { EnterprisePerformanceManager } from './core/EnterprisePerformanceManager';
// ❌ REMOVED: PerformanceMonitoringService, CachePerformanceService, RealTimePerformanceService, PerformanceDashboardService
// (modules do not exist - 0 consumers found)

// 🔧 HOOKS & UTILITIES
export { useEnterprisePerformance } from './hooks/useEnterprisePerformance';
// ❌ REMOVED: usePerformanceMetrics, usePerformanceOptimization (modules do not exist - 0 consumers)

// 🎨 UI COMPONENTS
// ❌ REMOVED: PerformanceDashboard, PerformanceMetricCard, RealTimeChart (modules do not exist)
// ✅ Available components are in ./components/ subdirectory

// 📊 TYPES & INTERFACES
export * from './types/performance.types';
// ❌ REMOVED: monitoring.types, cache.types (modules do not exist)

// ⚙️ CONFIGURATION
// ❌ REMOVED: PERFORMANCE_CONFIG, MONITORING_CONFIG (modules do not exist)

// 🔗 INTEGRATIONS
export { CachePerformanceIntegration, cachePerformanceIntegration } from './integrations/CachePerformanceIntegration';

// 🏢 ENTERPRISE FEATURES
// ❌ REMOVED: EnterpriseAnalytics, PerformanceAlerting, AutoOptimization (modules do not exist)

// 🔧 UTILITIES (actually exist)
export { PERFORMANCE_THRESHOLDS } from './components/utils/performance-utils';

/**
 * 📋 ENTERPRISE PERFORMANCE FEATURES (Current Implementation):
 *
 * ✅ EnterprisePerformanceManager - Core performance tracking
 * ✅ useEnterprisePerformance - React hook for performance monitoring
 * ✅ CachePerformanceIntegration - Cache performance tracking
 * ✅ PERFORMANCE_THRESHOLDS - Configurable performance thresholds
 * ✅ PerformanceCategory types - Type-safe performance categories
 *
 * 🚧 PLANNED (not yet implemented):
 * - Real-time Performance Monitoring
 * - Automatic Performance Optimization
 * - Performance Analytics & Reporting
 * - Alerting & Threshold Management
 */