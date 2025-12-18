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
 */

// 🎯 UNIFIED EXPORTS - SINGLE SOURCE OF TRUTH
export { EnterprisePerformanceManager } from './core/EnterprisePerformanceManager';
export { PerformanceMonitoringService } from './monitoring/PerformanceMonitoringService';
export { CachePerformanceService } from './cache/CachePerformanceService';
export { RealTimePerformanceService } from './realtime/RealTimePerformanceService';
export { PerformanceDashboardService } from './dashboard/PerformanceDashboardService';

// 🔧 HOOKS & UTILITIES
export { useEnterprisePerformance } from './hooks/useEnterprisePerformance';
export { usePerformanceMetrics } from './hooks/usePerformanceMetrics';
export { usePerformanceOptimization } from './hooks/usePerformanceOptimization';

// 🎨 UI COMPONENTS
export { PerformanceDashboard } from './components/PerformanceDashboard';
export { PerformanceMetricCard } from './components/PerformanceMetricCard';
export { RealTimeChart } from './components/RealTimeChart';

// 📊 TYPES & INTERFACES
export * from './types/performance.types';
export * from './types/monitoring.types';
export * from './types/cache.types';

// ⚙️ CONFIGURATION
export { PERFORMANCE_CONFIG } from './config/performance.config';
export { MONITORING_CONFIG } from './config/monitoring.config';

// 🔗 INTEGRATIONS
export { CachePerformanceIntegration, cachePerformanceIntegration } from './integrations/CachePerformanceIntegration';

// 🏢 ENTERPRISE FEATURES
export { EnterpriseAnalytics } from './enterprise/EnterpriseAnalytics';
export { PerformanceAlerting } from './enterprise/PerformanceAlerting';
export { AutoOptimization } from './enterprise/AutoOptimization';

/**
 * 📋 ENTERPRISE PERFORMANCE FEATURES:
 *
 * ✅ Real-time Performance Monitoring
 * ✅ Automatic Performance Optimization
 * ✅ Enterprise-grade Caching
 * ✅ Memory Management & Leak Detection
 * ✅ Performance Analytics & Reporting
 * ✅ Alerting & Threshold Management
 * ✅ Cross-application Performance Tracking
 * ✅ Performance Budgets & SLA Monitoring
 * ✅ Predictive Performance Analysis
 * ✅ Production Performance Debugging
 */