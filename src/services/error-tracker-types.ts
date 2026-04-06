/**
 * 🚨 ERROR TRACKER — TYPE DEFINITIONS
 *
 * Types, interfaces, and configuration for error tracking system.
 *
 * @module services/error-tracker-types
 * @see ErrorTracker.ts (main class)
 */

export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';
export type ErrorCategory = 'user' | 'system' | 'network' | 'validation' | 'performance' | 'security';

/**
 * Type-safe metadata value types for error context
 */
export type MetadataValue = string | number | boolean | null | undefined | MetadataValue[] | { [key: string]: MetadataValue };
export type MetadataRecord = Record<string, MetadataValue>;

export interface ErrorContext {
  userId?: string;
  userType?: 'citizen' | 'professional' | 'technical';
  userAgent?: string;
  url?: string;
  route?: string;
  component?: string;
  action?: string;
  timestamp: number;
  sessionId: string;
  buildVersion?: string;
  metadata?: MetadataRecord;
}

export interface ErrorReport {
  id: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  stack?: string;
  context: ErrorContext;
  fingerprint?: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
}

export interface ErrorTrackerConfig {
  enabled: boolean;
  captureConsoleErrors: boolean;
  captureUnhandledPromises: boolean;
  captureNetworkErrors: boolean;
  maxErrorsPerSession: number;
  ignoredErrors: string[];
  ignoredUrls: string[];
  maxStoredErrors: number;
  persistErrors: boolean;
  customEndpoint?: string;
  debug: boolean;
}
