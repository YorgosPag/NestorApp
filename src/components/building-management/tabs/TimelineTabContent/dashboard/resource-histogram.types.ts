/**
 * @module resource-histogram.types
 * @enterprise ADR-266 Phase C, Sub-phase 4 — Resource Histogram view-model types
 */

// ─── Histogram Data ─────────────────────────────────────────────────────

/** One bar in the histogram — keyed by resource name */
export interface ResourceHistogramBar {
  /** Display label for the week (e.g. "W13 - 24 Mar") */
  weekLabel: string;
  /** ISO date of week start (Monday) */
  weekStart: string;
  /** Dynamic keys: resourceName → allocatedHours for that week */
  [resourceName: string]: string | number;
}

/** Chart config entry for a single resource (color + label) */
export interface ResourceChartConfigEntry {
  label: string;
  color: string;
}

// ─── Utilization KPIs ───────────────────────────────────────────────────

export interface ResourceUtilizationKPI {
  /** Total unique resources assigned across all tasks */
  totalResources: number;
  /** Average utilization % across all resources and weeks */
  avgUtilization: number;
  /** Resources with >40 hrs/week in at least one week */
  overAllocatedCount: number;
  /** Week with highest total hours */
  peakWeek: string;
  /** Peak week total hours */
  peakHours: number;
}

// ─── Over-allocation Warning ────────────────────────────────────────────

export interface OverAllocationWarning {
  resourceName: string;
  weekLabel: string;
  hours: number;
}
