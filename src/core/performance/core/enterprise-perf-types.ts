/**
 * ENTERPRISE PERFORMANCE MANAGER - Local Type Definitions
 *
 * @module core/performance/core/enterprise-perf-types
 * Extracted from EnterprisePerformanceManager.ts (ADR-065 Phase 3, #18)
 */

import type { PerformanceCategory } from '../types/performance.types';

/** Chrome-specific Performance.memory interface */
export interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

/** Extended Performance interface with Chrome-specific memory */
export interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

/** Extended PerformanceEntry with loadEventEnd for navigation entries */
export interface PerformanceEntryWithLoad extends PerformanceEntry {
  loadEventEnd?: number;
}

/** Performance budget threshold */
export interface BudgetThreshold {
  metric: string;
  category: PerformanceCategory;
  warningThreshold: number;
  errorThreshold: number;
}

/** Window with optional gc function (Chrome DevTools) */
export interface WindowWithGC extends Window {
  gc?: () => void;
}
