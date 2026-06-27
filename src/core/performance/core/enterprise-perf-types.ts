/**
 * ENTERPRISE PERFORMANCE MANAGER - Local Type Definitions
 *
 * @module core/performance/core/enterprise-perf-types
 * Extracted from EnterprisePerformanceManager.ts (ADR-065 Phase 3, #18)
 */

import type { PerformanceCategory } from '../types/performance.types';

// Chrome `performance.memory` shape — SSoT in src/lib/platform (ADR-546). Re-exported
// here for backward-compatible imports within core/performance.
export type { PerformanceMemory, PerformanceWithMemory } from '@/lib/platform/browser-performance-memory';

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
