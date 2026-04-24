/**
 * @module types/reports/saved-report
 * @enterprise ADR-268 Phase 7 — Saved Reports
 *
 * Type definitions for the Saved Reports feature.
 * Research: Salesforce, HubSpot, QuickBooks, Xero, Power BI, Google Analytics.
 * Pattern: Config-only persistence (QuickBooks "Memorized Reports")
 * with relative date ranges (industry standard) and role-based visibility.
 */

import type {
  BuilderDomainId,
  ReportBuilderFilter,
  GroupByConfig,
} from '@/config/report-builder/report-builder-types';

// ============================================================================
// Enums & Constants
// ============================================================================

/** Report categories for organization (QuickBooks Groups pattern) */
export type SavedReportCategory =
  | 'monthly'
  | 'tax'
  | 'expenses'
  | 'bank'
  | 'efka'
  | 'general';

/** All valid categories */
export const SAVED_REPORT_CATEGORIES: readonly SavedReportCategory[] = [
  'monthly', 'tax', 'expenses', 'bank', 'efka', 'general',
] as const;

/** Visibility levels (Salesforce/Xero pattern — role-based ready) */
export type SavedReportVisibility = 'personal' | 'shared' | 'system';

/** Relative date presets (industry standard — all platforms use these) */
export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_fiscal_year'
  | 'last_fiscal_year'
  | 'last_30_days'
  | 'last_90_days'
  | 'last_12_months'
  | 'year_to_date';


// ============================================================================
// Date Range Configuration
// ============================================================================

/** Date range — relative (auto-updating) or absolute (fixed) */
export interface SavedReportDateRange {
  type: 'relative' | 'absolute';
  /** Relative preset (e.g., 'this_month', 'last_quarter') — null for absolute */
  preset: DateRangePreset | null;
  /** Absolute start date (ISO 8601) — null for relative */
  startDate: string | null;
  /** Absolute end date (ISO 8601) — null for relative */
  endDate: string | null;
}

// ============================================================================
// Report Configuration (the "recipe" — no data stored)
// ============================================================================

/** The saved report configuration — what gets persisted */
export interface SavedReportConfig {
  /** Which domain to query */
  domain: BuilderDomainId;
  /** Which columns to display */
  columns: string[];
  /** Active filters */
  filters: ReportBuilderFilter[];
  /** Sort field (null = default sort) */
  sortField: string | null;
  /** Sort direction */
  sortDirection: 'asc' | 'desc';
  /** Row limit */
  limit: number;
  /** Grouping configuration (Phase 2) */
  groupByConfig: GroupByConfig | null;
  /** Date range filter */
  dateRange: SavedReportDateRange | null;
}

// ============================================================================
// Saved Report Document (Firestore)
// ============================================================================

/** Full saved report document as stored in Firestore */
export interface SavedReport {
  /** Enterprise ID: srpt_xxxx */
  id: string;
  /** User-provided name (required) */
  name: string;
  /** Optional description */
  description: string | null;
  /** Organization category */
  category: SavedReportCategory;

  /** Visibility level (role-based ready) */
  visibility: SavedReportVisibility;
  /** Creator user ID */
  createdBy: string;
  /** Users who favorited this report (per-user favorites) */
  favoritedBy: string[];

  /** The report "recipe" */
  config: SavedReportConfig;

  /** Last time this report was executed */
  lastRunAt: string | null;
  /** Total execution count (for "Frequently Run") */
  runCount: number;

  /** ISO timestamps */
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/** Create saved report request */
export interface CreateSavedReportInput {
  name: string;
  description?: string;
  category?: SavedReportCategory;
  visibility?: SavedReportVisibility;
  config: SavedReportConfig;
}

/** Update saved report request (partial) */
export interface UpdateSavedReportInput {
  name?: string;
  description?: string | null;
  category?: SavedReportCategory;
  visibility?: SavedReportVisibility;
  config?: SavedReportConfig;
}

/** List saved reports filter */
export interface ListSavedReportsFilter {
  visibility?: SavedReportVisibility;
  category?: SavedReportCategory;
  favoritesOnly?: boolean;
  searchQuery?: string;
}

/** Tabs for the saved reports list UI */
export type SavedReportsTab = 'all' | 'favorites' | 'recent' | 'shared';
