/**
 * 🚨 ERROR TRACKER SERVICE
 *
 * Enterprise-grade error tracking για GEO-ALERT system
 * Centralized error handling, logging, και monitoring
 *
 * Features:
 * - Error categorization (User, System, Network, etc.)
 * - Context capture (user info, URL, component stack)
 * - Severity levels (Critical, Error, Warning, Info)
 * - Local storage για offline error queuing
 * - Integration ready για Sentry/external services
 */

'use client';

import { generateSessionId, generateErrorId } from '@/services/enterprise-id.service';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
import { safeJsonParse } from '@/lib/json-utils';
import { safeGetItem, safeSetItem, safeRemoveItem, STORAGE_KEYS } from '@/lib/storage';
import { sumByKey } from '@/utils/collection-utils';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';
export type ErrorCategory = 'user' | 'system' | 'network' | 'validation' | 'performance' | 'security';

/**
 * 🏢 ENTERPRISE: Type-safe metadata value types for error context
 */
export type MetadataValue = string | number | boolean | null | undefined | MetadataValue[] | { [key: string]: MetadataValue };
export type MetadataRecord = Record<string, MetadataValue>;

export interface ErrorContext {
  // User context
  userId?: string;
  userType?: 'citizen' | 'professional' | 'technical';
  userAgent?: string;

  // Application context
  url?: string;
  route?: string;
  component?: string;
  action?: string;

  // Technical context
  timestamp: number;
  sessionId: string;
  buildVersion?: string;

  // Additional context
  metadata?: MetadataRecord;
}

export interface ErrorReport {
  id: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  stack?: string;
  context: ErrorContext;
  fingerprint?: string; // For deduplication
  count: number; // How many times this error occurred
  firstSeen: number;
  lastSeen: number;
}

export interface ErrorTrackerConfig {
  // Feature flags
  enabled: boolean;
  captureConsoleErrors: boolean;
  captureUnhandledPromises: boolean;
  captureNetworkErrors: boolean;

  // Filtering
  maxErrorsPerSession: number;
  ignoredErrors: string[]; // Error messages to ignore
  ignoredUrls: string[]; // URLs to ignore

  // Storage
  maxStoredErrors: number;
  persistErrors: boolean;

  // External integration
  sentryDsn?: string;
  customEndpoint?: string;

  // Debug
  debug: boolean;
}

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

    this.sessionId = this.generateSessionIdInternal();

    if (this.config.enabled) {
      this.initialize();
    }
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private initialize(): void {
    if (typeof window === 'undefined') return; // SSR safety

    // Global error handler
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

    // Unhandled promise rejections
    if (this.config.captureUnhandledPromises) {
      window.addEventListener('unhandledrejection', (event) => {
        this.handleGlobalError(event.reason, {
          component: 'Global',
          action: 'Unhandled Promise Rejection'
        });
      });
    }

    // Console error capture
    if (this.config.captureConsoleErrors) {
      this.interceptConsoleError();
    }

    // Load persisted errors
    if (this.config.persistErrors) {
      this.loadPersistedErrors();
    }

    this.log('ErrorTracker initialized', { sessionId: this.sessionId });
  }

  private generateSessionIdInternal(): string {
    // 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
    return generateSessionId();
  }

  // ============================================================================
  // ERROR CAPTURE METHODS
  // ============================================================================

  /**
   * Capture an error with full context
   */
  captureError(
    error: Error | string,
    severity: ErrorSeverity = 'error',
    category: ErrorCategory = 'system',
    additionalContext: Partial<ErrorContext> = {}
  ): string {
    if (!this.config.enabled) return '';

    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'string' ? undefined : error.stack;

    // Check if error should be ignored
    if (this.shouldIgnoreError(errorMessage)) {
      return '';
    }

    // Check session error limit
    if (this.errorQueue.length >= this.config.maxErrorsPerSession) {
      this.log('Error queue full, ignoring new errors');
      return '';
    }

    // Create error context
    const context: ErrorContext = {
      userId: this.getCurrentUserId(),
      userType: this.getCurrentUserType(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      route: window.location.pathname,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      buildVersion: process.env.NEXT_PUBLIC_BUILD_VERSION,
      ...additionalContext
    };

    // Generate fingerprint for deduplication
    const fingerprint = this.generateFingerprint(errorMessage, errorStack, context);

    // Check if this error already exists
    const existingError = this.errorQueue.find(e => e.fingerprint === fingerprint);
    if (existingError) {
      existingError.count++;
      existingError.lastSeen = Date.now();
      this.log('Duplicate error detected, incrementing count', { fingerprint, count: existingError.count });
      return existingError.id;
    }

    // Create new error report
    const errorReport: ErrorReport = {
      id: this.generateErrorIdInternal(),
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

    // Add to queue
    this.errorQueue.push(errorReport);
    this.errorCounts.set(fingerprint, 1);

    // Log error
    this.log('Error captured', {
      id: errorReport.id,
      severity,
      category,
      message: errorMessage,
      fingerprint
    });

    // Persist if enabled
    if (this.config.persistErrors) {
      this.persistErrors();
    }

    // Send to external services
    this.sendToExternalServices(errorReport);

    // **🚀 AUTO ADMIN EMAIL FOR CRITICAL/ERROR SEVERITY**
    if (severity === 'critical' || severity === 'error') {
      this.sendToAdminAsync(errorReport).catch(emailError => {
        this.log('Failed to send admin email', emailError);
      });
    }

    // **🚀 ANALYTICS INTEGRATION** - Track error στο AnalyticsBridge
    try {
      // Dynamically import για να αποφύγουμε circular dependencies
      import('./AnalyticsBridge').then(({ analyticsBridge }) => {
        const errorObj = typeof error === 'string' ? new Error(error) : error;
        analyticsBridge.trackError(errorReport.id, errorObj, additionalContext.component);
      });
    } catch (analyticsError) {
      this.log('Failed to track error in analytics', analyticsError);
    }

    return errorReport.id;
  }

  /**
   * Capture user action errors
   */
  captureUserError(message: string, action: string, metadata?: MetadataRecord): string {
    return this.captureError(
      new Error(message),
      'warning',
      'user',
      {
        component: 'UserAction',
        action,
        metadata
      }
    );
  }

  /**
   * Capture network errors
   */
  captureNetworkError(
    url: string,
    status: number,
    statusText: string,
    method: string = 'GET'
  ): string {
    return this.captureError(
      new Error(`Network Error: ${method} ${url} - ${status} ${statusText}`),
      status >= 500 ? 'error' : 'warning',
      'network',
      {
        component: 'NetworkRequest',
        action: method,
        metadata: { url, status, statusText, method }
      }
    );
  }

  /**
   * Capture performance issues
   */
  capturePerformanceIssue(metric: string, value: number, threshold: number): string {
    return this.captureError(
      new Error(`Performance Issue: ${metric} (${value}ms) exceeded threshold (${threshold}ms)`),
      'warning',
      'performance',
      {
        component: 'PerformanceMonitor',
        action: 'ThresholdExceeded',
        metadata: { metric, value, threshold }
      }
    );
  }

  // ============================================================================
  // ERROR HANDLING UTILITIES
  // ============================================================================

  private handleGlobalError(error: unknown, context: Partial<ErrorContext>): void {
    if (error instanceof Error) {
      this.captureError(error, 'error', 'system', context);
    } else if (typeof error === 'string') {
      this.captureError(error, 'error', 'system', context);
    } else {
      this.captureError(
        new Error(`Unknown error type: ${JSON.stringify(error)}`),
        'error',
        'system',
        context
      );
    }
  }

  private shouldIgnoreError(message: string): boolean {
    return this.config.ignoredErrors.some(ignored =>
      message.toLowerCase().includes(ignored.toLowerCase())
    );
  }

  /**
   * ✅ ENTERPRISE: Safe base64 encoding with UTF-8 support
   */
  private safeBase64Encode(input: string): string {
    try {
      // Method 1: Use Buffer (Node.js environment)
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(input, 'utf8').toString('base64');
      }

      // Method 2: Use TextEncoder for UTF-8 → base64 (browser environment)
      const encoder = new TextEncoder();
      const bytes = encoder.encode(input);
      let binary = '';
      bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
      });
      return btoa(binary);
    } catch (error) {
      // Fallback: Use simple hash-like approach
      let hash = 0;
      for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash).toString(36);
    }
  }

  private generateFingerprint(message: string, stack?: string, context?: ErrorContext): string {
    const key = `${message}_${context?.component}_${context?.action}`;
    return this.safeBase64Encode(key).substr(0, 16);
  }

  private generateErrorIdInternal(): string {
    // 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
    return generateErrorId();
  }

  // ============================================================================
  // USER CONTEXT HELPERS
  // ============================================================================

  private getCurrentUserId(): string | undefined {
    // Try to get user ID from various sources
    const userObj = safeGetItem<{ id?: string; email?: string } | null>(STORAGE_KEYS.USER, null);
    if (userObj) {
      return userObj.id || userObj.email;
    }

    // From session storage (not migrated — sessionStorage is separate)
    const sessionUser = sessionStorage.getItem('currentUser');
    if (sessionUser) {
      const user = safeJsonParse<{ id?: string; email?: string }>(sessionUser, { });
      const userId = user.id || user.email;
      if (userId) return userId;
    }

    return undefined;
  }

  private getCurrentUserType(): 'citizen' | 'professional' | 'technical' | undefined {
    const userObj = safeGetItem<{ userType?: 'citizen' | 'professional' | 'technical' } | null>(STORAGE_KEYS.USER, null);
    return userObj?.userType;
  }

  // ============================================================================
  // PERSISTENCE
  // ============================================================================

  private persistErrors(): void {
    const errorsToStore = this.errorQueue.slice(-this.config.maxStoredErrors);
    safeSetItem(STORAGE_KEYS.ERROR_LOG, errorsToStore);
  }

  private loadPersistedErrors(): void {
    try {
      const errors = safeGetItem<ErrorReport[]>(STORAGE_KEYS.ERROR_LOG, []);
      if (errors.length > 0) {
        this.errorQueue = errors;
        this.log('Loaded persisted errors', { count: errors.length });
      }
    } catch (error) {
      this.log('Failed to load persisted errors', error);
    }
  }

  // ============================================================================
  // EXTERNAL INTEGRATIONS
  // ============================================================================

  private sendToExternalServices(error: ErrorReport): void {
    // Sentry integration
    if (this.config.sentryDsn && typeof window !== 'undefined') {
      this.sendToSentry(error);
    }

    // Custom endpoint
    if (this.config.customEndpoint) {
      this.sendToCustomEndpoint(error);
    }
  }

  private sendToSentry(error: ErrorReport): void {
    // Placeholder για Sentry integration
    // Θα υλοποιηθεί όταν προστεθεί το Sentry SDK
    this.log('Would send to Sentry', { errorId: error.id });
  }

  private sendToCustomEndpoint(error: ErrorReport): void {
    fetch(this.config.customEndpoint!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(error)
    }).catch(err => {
      this.log('Failed to send error to custom endpoint', err);
    });
  }

  // **🚀 ADMIN NOTIFICATION FUNCTIONALITY - ENTERPRISE INTEGRATION**
  // 🏢 ENTERPRISE: Direct Firestore notification (no email dependency)
  private async sendToAdminAsync(errorReport: ErrorReport): Promise<void> {
    try {
      // 🏢 ENTERPRISE: Use direct notification endpoint (replaces email-based flow)
      const notificationPayload = {
        errorId: errorReport.id,
        message: errorReport.message,
        stack: errorReport.stack,
        componentStack: undefined, // ErrorTracker doesn't have component stack
        component: errorReport.context.component || 'Application',
        severity: errorReport.severity as 'critical' | 'error' | 'warning',
        timestamp: new Date(errorReport.lastSeen).toISOString(),
        url: errorReport.context.url || (typeof window !== 'undefined' ? window.location.href : 'unknown'),
        userAgent: errorReport.context.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR'),
        retryCount: errorReport.count - 1
      };

      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      await apiClient.post('/api/notifications/error-report', notificationPayload);

      this.log('Admin notification sent successfully', { errorId: errorReport.id });

    } catch (error) {
      this.log('Failed to send admin notification', error);
      // Don't throw - we don't want admin notification failure to break error tracking
    }
  }

  private formatErrorForAdminEmail(errorReport: ErrorReport): string {
    const { context } = errorReport;

    return `
🚨 AUTOMATIC ERROR REPORT - GEO-ALERT SYSTEM

📋 ERROR SUMMARY:
• Error ID: ${errorReport.id}
• Severity: ${errorReport.severity.toUpperCase()}
• Category: ${errorReport.category}
• Message: ${errorReport.message}
• Count: ${errorReport.count} occurrence(s)

⏰ TIMING:
• First Seen: ${new Date(errorReport.firstSeen).toLocaleString('el-GR')}
• Last Seen: ${new Date(errorReport.lastSeen).toLocaleString('el-GR')}

👤 USER CONTEXT:
• User ID: ${context.userId || 'Anonymous'}
• User Type: ${context.userType || 'Unknown'}
• Session: ${context.sessionId}

🌐 LOCATION:
• URL: ${context.url}
• Route: ${context.route}
• Component: ${context.component || 'Unknown'}
• Action: ${context.action || 'N/A'}

🔧 TECHNICAL:
• User Agent: ${context.userAgent}
• Build Version: ${context.buildVersion || 'Unknown'}

📚 STACK TRACE:
${errorReport.stack || 'Stack trace not available'}

${context.metadata ? `\n📊 ADDITIONAL METADATA:\n${JSON.stringify(context.metadata, null, 2)}` : ''}

---
⚡ Αυτό το email στάλθηκε αυτόματα από το ErrorTracker service
🕒 Timestamp: ${new Date().toLocaleString('el-GR')}
    `.trim();
  }

  // ============================================================================
  // CONSOLE INTERCEPTION
  // ============================================================================

  /**
   * ✅ ENTERPRISE: Safe JSON stringify with circular reference handling
   */
  private safeStringify(obj: unknown): string {
    try {
      // Simple types - no need for JSON.stringify
      if (obj === null || obj === undefined) return String(obj);
      if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
        return String(obj);
      }

      // Handle circular references with replacer function
      const seen = new WeakSet();
      return JSON.stringify(obj, (key, value: unknown) => {
        // Skip common circular reference properties
        if (key === '_map' || key === '_controls' || key === 'map' || key === 'target') {
          return '[Circular Reference]';
        }

        if (value !== null && typeof value === 'object') {
          if (seen.has(value as object)) {
            return '[Circular Reference]';
          }
          seen.add(value as object);
        }
        return value;
      });
    } catch {
      // Fallback: return object type and basic info
      const objWithConstructor = obj as { constructor?: { name?: string } };
      return `[Object: ${objWithConstructor?.constructor?.name || 'Unknown'}]`;
    }
  }

  private interceptConsoleError(): void {
    // const originalError = console.error;
    // console.error = (...args: any[]) => {
    //   const message = args.map(arg =>
    //     typeof arg === 'string' ? arg : this.safeStringify(arg)
    //   ).join(' ');

    //   // ✅ ENTERPRISE FIX: Defer error capture to avoid setState during render
    //   setTimeout(() => {
    //     this.captureError(
    //       new Error(message),
    //       'error',
    //       'system',
    //       {
    //         component: 'Console',
    //         action: 'console.error'
    //       }
    //     );
    //   }, 0);

    //   originalError.apply(console, args);
    // };
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Get all captured errors
   */
  getErrors(): ErrorReport[] {
    return [...this.errorQueue];
  }

  /**
   * Get error statistics
   */
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

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.errorQueue = [];
    this.errorCounts.clear();

    if (this.config.persistErrors) {
      safeRemoveItem(STORAGE_KEYS.ERROR_LOG);
    }

    this.log('All errors cleared');
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ErrorTrackerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.log('Configuration updated', newConfig);
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private log(message: string, data?: unknown): void {
    if (this.config.debug) {
      // Debug logging removed //(`[ErrorTracker] ${message}`, data || '');
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

// **🚀 ENTERPRISE CONFIGURATION INTEGRATION**
import { getErrorConfig } from '@/config/error-reporting';

// 🏢 ENTERPRISE: Lazy initialization για server-side safety
// Αποφεύγει errors σε API routes που τρέχουν server-side
let _errorTrackerInstance: ErrorTracker | null = null;

function getErrorTrackerInstance(): ErrorTracker {
  if (!_errorTrackerInstance) {
    _errorTrackerInstance = new ErrorTracker(getErrorConfig());
  }
  return _errorTrackerInstance;
}

// 🏢 ENTERPRISE: Server-safe proxy object
// Επιτρέπει το import χωρίς να σπάει τα API routes
export const errorTracker = {
  captureError: (...args: Parameters<ErrorTracker['captureError']>) => {
    try {
      return getErrorTrackerInstance().captureError(...args);
    } catch (error) {
      // Silent fail σε server-side - δεν θέλουμε να σπάσει το API
      console.warn('[ErrorTracker] Failed to capture error (server-side):', error);
      return '';
    }
  },
  captureUserError: (...args: Parameters<ErrorTracker['captureUserError']>) => {
    try {
      return getErrorTrackerInstance().captureUserError(...args);
    } catch (error) {
      console.warn('[ErrorTracker] Failed to capture user error (server-side):', error);
      return '';
    }
  },
  captureNetworkError: (...args: Parameters<ErrorTracker['captureNetworkError']>) => {
    try {
      return getErrorTrackerInstance().captureNetworkError(...args);
    } catch (error) {
      console.warn('[ErrorTracker] Failed to capture network error (server-side):', error);
      return '';
    }
  },
  capturePerformanceIssue: (...args: Parameters<ErrorTracker['capturePerformanceIssue']>) => {
    try {
      return getErrorTrackerInstance().capturePerformanceIssue(...args);
    } catch (error) {
      console.warn('[ErrorTracker] Failed to capture performance issue (server-side):', error);
      return '';
    }
  },
  getErrors: () => {
    try {
      return getErrorTrackerInstance().getErrors();
    } catch {
      return [];
    }
  },
  getStats: () => {
    try {
      return getErrorTrackerInstance().getStats();
    } catch {
      return {
        totalErrors: 0,
        totalOccurrences: 0,
        errorsBySeverity: {},
        errorsByCategory: {},
        sessionId: 'server-side'
      };
    }
  },
  clearErrors: () => {
    try {
      getErrorTrackerInstance().clearErrors();
    } catch {
      // Silent fail
    }
  },
  updateConfig: (config: Partial<ErrorTrackerConfig>) => {
    try {
      getErrorTrackerInstance().updateConfig(config);
    } catch {
      // Silent fail
    }
  }
};

// ============================================================================
// REACT INTEGRATION HOOKS
// ============================================================================

/**
 * React hook για error tracking
 */
export function useErrorTracker() {
  const captureError = (error: Error | string, context?: Partial<ErrorContext>) => {
    return errorTracker.captureError(error, 'error', 'user', context);
  };

  const captureUserAction = (action: string, metadata?: MetadataRecord) => {
    return errorTracker.captureUserError('User action completed', action, metadata);
  };

  const captureNetworkError = (url: string, status: number, statusText: string) => {
    return errorTracker.captureNetworkError(url, status, statusText);
  };

  return {
    captureError,
    captureUserAction,
    captureNetworkError,
    getErrors: () => errorTracker.getErrors(),
    getStats: () => errorTracker.getStats(),
    clearErrors: () => errorTracker.clearErrors()
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Wrapper για async functions με automatic error capture
 */
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
        'error',
        'system',
        context
      );
      throw error;
    }
  };
}

/**
 * Decorator για class methods
 * 🏢 ENTERPRISE: Type-safe decorator with proper TypeScript types
 */
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
          'error',
          'system',
          {
            component: targetWithConstructor.constructor.name,
            action: propertyKey,
            ...context
          }
        );
        throw error;
      }
    };

    return descriptor;
  };
}