/**
 * 🎯 ENTERPRISE PERFORMANCE TYPES - TYPE SAFETY FIRST
 *
 * Comprehensive type definitions για enterprise-grade performance monitoring.
 * Based on industry standards (W3C Performance API, Chrome DevTools, etc.).
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 */

// 📊 CORE PERFORMANCE METRICS
export interface PerformanceMetric {
  readonly id: string;
  readonly name: string;
  readonly value: number;
  readonly unit: PerformanceUnit;
  readonly timestamp: number;
  readonly source: PerformanceSource;
  readonly category: PerformanceCategory;
  readonly severity?: PerformanceSeverity;
  readonly metadata?: Record<string, unknown>;
}

export interface PerformanceSnapshot {
  readonly timestamp: number;
  readonly metrics: PerformanceMetric[];
  readonly systemInfo: SystemInfo;
  readonly applicationContext: ApplicationContext;
}

// 🏷️ ENUMS & CONSTANTS
export enum PerformanceUnit {
  MILLISECONDS = 'ms',
  SECONDS = 'seconds',
  BYTES = 'bytes',
  KILOBYTES = 'kb',
  MEGABYTES = 'mb',
  PERCENTAGE = '%',
  COUNT = 'count',
  FRAMES_PER_SECOND = 'fps',
  REQUESTS_PER_SECOND = 'rps'
}

export enum PerformanceSource {
  BROWSER_API = 'browser-api',
  CUSTOM_MEASUREMENT = 'custom',
  DXF_VIEWER = 'dxf-viewer',
  GEO_CANVAS = 'geo-canvas',
  API_ENDPOINT = 'api-endpoint',
  CACHE_SYSTEM = 'cache-system',
  DATABASE = 'database',
  NETWORK = 'network'
}

export enum PerformanceCategory {
  // 🖼️ RENDERING PERFORMANCE
  RENDERING = 'rendering',
  PAINT = 'paint',
  LAYOUT = 'layout',

  // 🧠 MEMORY PERFORMANCE
  MEMORY = 'memory',
  HEAP = 'heap',
  GARBAGE_COLLECTION = 'gc',

  // 🌐 NETWORK PERFORMANCE
  NETWORK = 'network',
  API_RESPONSE = 'api-response',
  ASSET_LOADING = 'asset-loading',

  // 💾 CACHE PERFORMANCE
  CACHE_HIT = 'cache-hit',
  CACHE_MISS = 'cache-miss',
  CACHE_INVALIDATION = 'cache-invalidation',

  // ⚙️ APPLICATION PERFORMANCE
  APPLICATION = 'application',
  USER_INTERACTION = 'user-interaction',
  BUSINESS_LOGIC = 'business-logic'
}

export enum PerformanceSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// 🖥️ SYSTEM INFORMATION
export interface SystemInfo {
  readonly userAgent: string;
  readonly platform: string;
  readonly memory?: {
    readonly total: number;
    readonly available: number;
    readonly used: number;
  };
  readonly network?: {
    readonly effectiveType: string;
    readonly downlink: number;
    readonly rtt: number;
  };
  readonly screen: {
    readonly width: number;
    readonly height: number;
    readonly pixelRatio: number;
  };
}

export interface ApplicationContext {
  readonly route: string;
  readonly subapp: 'dxf-viewer' | 'geo-canvas' | 'main-app' | 'admin';
  readonly version: string;
  readonly environment: 'development' | 'staging' | 'production' | 'test';
  readonly userId?: string;
  readonly sessionId: string;
}

// ⚡ PERFORMANCE THRESHOLDS & BUDGETS
export interface PerformanceThreshold {
  readonly metric: string;
  readonly category: PerformanceCategory;
  readonly warningThreshold: number;
  readonly errorThreshold: number;
  readonly unit: PerformanceUnit;
}

export interface PerformanceBudget {
  readonly name: string;
  readonly thresholds: PerformanceThreshold[];
  readonly enabled: boolean;
  readonly alerts: PerformanceAlertConfig[];
}

export interface PerformanceAlertConfig {
  readonly type: 'email' | 'webhook' | 'console' | 'notification';
  readonly threshold: PerformanceSeverity;
  readonly enabled: boolean;
  readonly recipients?: string[];
  readonly webhookUrl?: string;
}

// 🎛️ MONITORING CONFIGURATION
export interface MonitoringConfig {
  readonly enabled: boolean;
  readonly interval: number; // ms
  readonly retentionPeriod: number; // ms
  readonly maxSamples: number;
  readonly categories: PerformanceCategory[];
  readonly sources: PerformanceSource[];
  readonly autoOptimization: boolean;
  readonly realTimeUpdates: boolean;
}

// 📈 ANALYTICS & REPORTING
export interface PerformanceReport {
  readonly id: string;
  readonly generatedAt: number;
  readonly period: {
    readonly start: number;
    readonly end: number;
  };
  readonly summary: PerformanceSummary;
  readonly trends: PerformanceTrend[];
  readonly recommendations: PerformanceRecommendation[];
}

export interface PerformanceSummary {
  readonly totalMetrics: number;
  readonly averagePerformance: Record<PerformanceCategory, number>;
  readonly topIssues: PerformanceIssue[];
  readonly improvementOpportunities: string[];
}

export interface PerformanceTrend {
  readonly metric: string;
  readonly category: PerformanceCategory;
  readonly trend: 'improving' | 'degrading' | 'stable';
  readonly changePercent: number;
  readonly timeframe: number; // ms
}

export interface PerformanceRecommendation {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly impact: 'low' | 'medium' | 'high';
  readonly effort: 'low' | 'medium' | 'high';
  readonly category: PerformanceCategory;
  readonly implementation?: string;
}

export interface PerformanceIssue {
  readonly id: string;
  readonly title: string;
  readonly severity: PerformanceSeverity;
  readonly metric: PerformanceMetric;
  readonly threshold: PerformanceThreshold;
  readonly firstOccurrence: number;
  readonly lastOccurrence: number;
  readonly occurrenceCount: number;
}

// 🔧 OPTIMIZATION SETTINGS
export interface OptimizationSettings {
  readonly caching: {
    readonly enabled: boolean;
    readonly strategy: 'aggressive' | 'balanced' | 'conservative';
    readonly ttl: Record<string, number>;
  };
  readonly rendering: {
    readonly enableRequestIdleCallback: boolean;
    readonly enableVirtualization: boolean;
    readonly maxFPS: number;
  };
  readonly memory: {
    readonly enableGarbageCollection: boolean;
    readonly gcThreshold: number;
    readonly enableMemoryMonitoring: boolean;
  };
  readonly network: {
    readonly enableRequestBatching: boolean;
    readonly maxConcurrentRequests: number;
    readonly enableCompression: boolean;
  };
}

// 🎯 REAL-TIME UPDATES
export interface RealTimePerformanceUpdate {
  readonly type: 'metric' | 'alert' | 'recommendation';
  readonly data: PerformanceMetric | PerformanceIssue | PerformanceRecommendation;
  readonly timestamp: number;
}

export interface PerformanceSubscription {
  readonly id: string;
  readonly categories: PerformanceCategory[];
  readonly threshold?: PerformanceSeverity;
  readonly callback: (update: RealTimePerformanceUpdate) => void;
}

// 🏢 ENTERPRISE FEATURES
export interface EnterprisePerformanceConfig {
  readonly multiTenant: boolean;
  readonly crossApplicationTracking: boolean;
  readonly advancedAnalytics: boolean;
  readonly customMetrics: boolean;
  readonly apiIntegration: {
    readonly enabled: boolean;
    readonly endpoints: string[];
    readonly authentication?: Record<string, string>;
  };
  readonly exportFormats: ('json' | 'csv' | 'pdf' | 'excel')[];
}
