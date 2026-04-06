/**
 * 🚨 ERROR TRACKER SERVICE
 *
 * Enterprise-grade error tracking για GEO-ALERT system.
 * Centralized error handling, logging, και monitoring.
 *
 * Split into SRP modules (ADR-065):
 * - error-tracker-types.ts — type definitions
 * - error-tracker-integrations.ts — persistence, admin notifications, utilities
 *
 * @module services/ErrorTracker
 */

'use client';

import { generateSessionId, generateErrorId } from '@/services/enterprise-id.service';
import { sumByKey } from '@/utils/collection-utils';

// Re-export types for consumers
export type {
  ErrorSeverity,
  ErrorCategory,
  MetadataValue,
  MetadataRecord,
  ErrorContext,
  ErrorReport,
  ErrorTrackerConfig,
} from './error-tracker-types';

import type {
  ErrorSeverity,
  ErrorCategory,
  MetadataRecord,
  ErrorContext,
  ErrorReport,
  ErrorTrackerConfig,
} from './error-tracker-types';

import {
  persistErrors as persistErrorsToStorage,
  loadPersistedErrors,
  clearPersistedErrors,
  getCurrentUserId,
  getCurrentUserType,
  sendToExternalServices,
  sendToAdminAsync,
  generateFingerprint,
} from './error-tracker-integrations';

// ============================================================================
// ERROR TRACKER CLASS
// ============================================================================

export class ErrorTracker {
  private config: ErrorTrackerConfig;
  private sessionId: string;
  private errorQueue: ErrorReport[] = [];
  private errorCounts: Map<string, number> = new Map();

  constructor(config: Partial<ErrorTrackerConfig> = {}) {
    this.config = {
      enabled: true,
      captureConsoleErrors: true,
      captureUnhandledPromises: true,
      captureNetworkErrors: true,
      maxErrorsPerSession: 100,
      ignoredErrors: [
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
        'Script error.'
      ],
      ignoredUrls: [
        'chrome-extension://',
        'moz-extension://',
        'safari-extension://'
      ],
      maxStoredErrors: 50,
      persistErrors: true,
      debug: false,
      ...config
    };

    this.sessionId = generateSessionId();

    if (this.config.enabled) {
      this.initialize();
    }
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private initialize(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      this.handleGlobalError(event.error, {
        component: 'Global',
        action: 'Unhandled Error',
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    });

    if (this.config.captureUnhandledPromises) {
      window.addEventListener('unhandledrejection', (event) => {
        this.handleGlobalError(event.reason, {
          component: 'Global',
          action: 'Unhandled Promise Rejection'
        });
      });
    }

    if (this.config.persistErrors) {
      const errors = loadPersistedErrors();
      if (errors.length > 0) {
        this.errorQueue = errors;
      }
    }

    this.log('ErrorTracker initialized', { sessionId: this.sessionId });
  }

  // ============================================================================
  // ERROR CAPTURE
  // ============================================================================

  captureError(
    error: Error | string,
    severity: ErrorSeverity = 'error',
    category: ErrorCategory = 'system',
    additionalContext: Partial<ErrorContext> = {}
  ): string {
    if (!this.config.enabled) return '';

    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'string' ? undefined : error.stack;

    if (this.shouldIgnoreError(errorMessage)) return '';
    if (this.errorQueue.length >= this.config.maxErrorsPerSession) return '';

    const context: ErrorContext = {
      userId: getCurrentUserId(),
      userType: getCurrentUserType(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      route: window.location.pathname,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      buildVersion: process.env.NEXT_PUBLIC_BUILD_VERSION,
      ...additionalContext
    };

    const fingerprint = generateFingerprint(errorMessage, errorStack, context);

    // Deduplication
    const existingError = this.errorQueue.find(e => e.fingerprint === fingerprint);
    if (existingError) {
      existingError.count++;
      existingError.lastSeen = Date.now();
      return existingError.id;
    }

    const errorReport: ErrorReport = {
      id: generateErrorId(),
      severity,
      category,
      message: errorMessage,
      stack: errorStack,
      context,
      fingerprint,
      count: 1,
      firstSeen: Date.now(),
      lastSeen: Date.now()
    };

    this.errorQueue.push(errorReport);
    this.errorCounts.set(fingerprint, 1);

    if (this.config.persistErrors) {
      persistErrorsToStorage(this.errorQueue, this.config.maxStoredErrors);
    }

    sendToExternalServices(this.config, errorReport);

    if (severity === 'critical' || severity === 'error') {
      sendToAdminAsync(errorReport).catch(() => {
        // Silent fail
      });
    }

    // Analytics integration (dynamic import to avoid circular deps)
    try {
      import('./AnalyticsBridge').then(({ analyticsBridge }) => {
        const errorObj = typeof error === 'string' ? new Error(error) : error;
        analyticsBridge.trackError(errorReport.id, errorObj, additionalContext.component);
      });
    } catch {
      // Silent fail
    }

    return errorReport.id;
  }

  captureUserError(message: string, action: string, metadata?: MetadataRecord): string {
    return this.captureError(new Error(message), 'warning', 'user', {
      component: 'UserAction',
      action,
      metadata
    });
  }

  captureNetworkError(url: string, status: number, statusText: string, method: string = 'GET'): string {
    return this.captureError(
      new Error(`Network Error: ${method} ${url} - ${status} ${statusText}`),
      status >= 500 ? 'error' : 'warning',
      'network',
      { component: 'NetworkRequest', action: method, metadata: { url, status, statusText, method } }
    );
  }

  capturePerformanceIssue(metric: string, value: number, threshold: number): string {
    return this.captureError(
      new Error(`Performance Issue: ${metric} (${value}ms) exceeded threshold (${threshold}ms)`),
      'warning',
      'performance',
      { component: 'PerformanceMonitor', action: 'ThresholdExceeded', metadata: { metric, value, threshold } }
    );
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private handleGlobalError(error: unknown, context: Partial<ErrorContext>): void {
    if (error instanceof Error) {
      this.captureError(error, 'error', 'system', context);
    } else if (typeof error === 'string') {
      this.captureError(error, 'error', 'system', context);
    } else {
      this.captureError(new Error(`Unknown error type: ${JSON.stringify(error)}`), 'error', 'system', context);
    }
  }

  private shouldIgnoreError(message: string): boolean {
    return this.config.ignoredErrors.some(ignored =>
      message.toLowerCase().includes(ignored.toLowerCase())
    );
  }

  private log(_message: string, _data?: unknown): void {
    // Debug logging disabled in production
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  getErrors(): ErrorReport[] {
    return [...this.errorQueue];
  }

  getStats() {
    const errorsBySeverity = sumByKey(this.errorQueue, e => e.severity, e => e.count) as Record<ErrorSeverity, number>;
    const errorsByCategory = sumByKey(this.errorQueue, e => e.category, e => e.count) as Record<ErrorCategory, number>;

    return {
      totalErrors: this.errorQueue.length,
      totalOccurrences: this.errorQueue.reduce((sum, e) => sum + e.count, 0),
      errorsBySeverity,
      errorsByCategory,
      sessionId: this.sessionId
    };
  }

  clearErrors(): void {
    this.errorQueue = [];
    this.errorCounts.clear();
    if (this.config.persistErrors) {
      clearPersistedErrors();
    }
  }

  updateConfig(newConfig: Partial<ErrorTrackerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

import { getErrorConfig } from '@/config/error-reporting';

let _errorTrackerInstance: ErrorTracker | null = null;

function getErrorTrackerInstance(): ErrorTracker {
  if (!_errorTrackerInstance) {
    _errorTrackerInstance = new ErrorTracker(getErrorConfig());
  }
  return _errorTrackerInstance;
}

/** Server-safe proxy object — allows import without breaking API routes */
export const errorTracker = {
  captureError: (...args: Parameters<ErrorTracker['captureError']>) => {
    try { return getErrorTrackerInstance().captureError(...args); }
    catch { return ''; }
  },
  captureUserError: (...args: Parameters<ErrorTracker['captureUserError']>) => {
    try { return getErrorTrackerInstance().captureUserError(...args); }
    catch { return ''; }
  },
  captureNetworkError: (...args: Parameters<ErrorTracker['captureNetworkError']>) => {
    try { return getErrorTrackerInstance().captureNetworkError(...args); }
    catch { return ''; }
  },
  capturePerformanceIssue: (...args: Parameters<ErrorTracker['capturePerformanceIssue']>) => {
    try { return getErrorTrackerInstance().capturePerformanceIssue(...args); }
    catch { return ''; }
  },
  getErrors: () => {
    try { return getErrorTrackerInstance().getErrors(); }
    catch { return []; }
  },
  getStats: () => {
    try { return getErrorTrackerInstance().getStats(); }
    catch { return { totalErrors: 0, totalOccurrences: 0, errorsBySeverity: {}, errorsByCategory: {}, sessionId: 'server-side' }; }
  },
  clearErrors: () => {
    try { getErrorTrackerInstance().clearErrors(); }
    catch { /* Silent fail */ }
  },
  updateConfig: (config: Partial<ErrorTrackerConfig>) => {
    try { getErrorTrackerInstance().updateConfig(config); }
    catch { /* Silent fail */ }
  }
};

// ============================================================================
// REACT INTEGRATION
// ============================================================================

export function useErrorTracker() {
  return {
    captureError: (error: Error | string, context?: Partial<ErrorContext>) =>
      errorTracker.captureError(error, 'error', 'user', context),
    captureUserAction: (action: string, metadata?: MetadataRecord) =>
      errorTracker.captureUserError('User action completed', action, metadata),
    captureNetworkError: (url: string, status: number, statusText: string) =>
      errorTracker.captureNetworkError(url, status, statusText),
    getErrors: () => errorTracker.getErrors(),
    getStats: () => errorTracker.getStats(),
    clearErrors: () => errorTracker.clearErrors()
  };
}

// ============================================================================
// UTILITY WRAPPERS
// ============================================================================

/** Wrapper for async functions with automatic error capture */
export function withErrorTracking<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  context?: Partial<ErrorContext>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      errorTracker.captureError(
        error instanceof Error ? error : new Error(String(error)),
        'error', 'system', context
      );
      throw error;
    }
  };
}

/** Decorator for class methods */
export function TrackErrors(context?: Partial<ErrorContext>) {
  return function <T extends object>(
    target: T,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (this: T, ...args: unknown[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        const targetWithConstructor = target as { constructor: { name: string } };
        errorTracker.captureError(
          error instanceof Error ? error : new Error(String(error)),
          'error', 'system',
          { component: targetWithConstructor.constructor.name, action: propertyKey, ...context }
        );
        throw error;
      }
    };

    return descriptor;
  };
}
