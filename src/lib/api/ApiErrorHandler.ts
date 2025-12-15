/**
 * 🚨 API ERROR HANDLER - ENTERPRISE CENTRALIZED SYSTEM
 *
 * Enterprise-grade API error handling που επεκτείνει το ErrorTracker system
 * Provides standardized error responses για όλα τα API routes
 *
 * Features:
 * - Integration με υπάρχον ErrorTracker.ts (708 lines)
 * - Standardized NextResponse format
 * - HTTP status code mapping
 * - Error categorization και severity
 * - Request context capture
 * - Performance monitoring
 * - Security error filtering
 */


import { NextRequest, NextResponse } from 'next/server';
import { errorTracker, type ErrorSeverity, type ErrorCategory } from '@/services/ErrorTracker';
import { getErrorConfig } from '@/config/error-reporting';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ApiErrorContext {
  // Request context
  method?: string;
  url?: string;
  path?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;

  // User context
  userId?: string;
  userAgent?: string;

  // API context
  endpoint?: string;
  operation?: string;

  // Technical context
  requestId?: string;
  timestamp?: number;

  // Performance context
  duration?: number;
  memoryUsage?: number;

  // Business context
  entityId?: string;
  entityType?: string;

  // Additional metadata
  metadata?: Record<string, any>;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  errorCode?: string;
  errorId?: string;
  timestamp: string;
  requestId?: string;
  details?: any;
  context?: Record<string, any>;
}

export interface ApiSuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
  timestamp: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export type ApiResponse<T = any> = ApiErrorResponse | ApiSuccessResponse<T>;

export interface ErrorMappingRule {
  pattern: string | RegExp;
  httpStatus: number;
  errorCode: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  userMessage?: string;
  shouldLog?: boolean;
  shouldReport?: boolean;
}

// ============================================================================
// ERROR MAPPING RULES - ENTERPRISE PATTERNS
// ============================================================================

const ERROR_MAPPING_RULES: ErrorMappingRule[] = [
  // **🔐 Authentication & Authorization Errors**
  {
    pattern: /authentication.*failed|unauthorized|invalid.*token/i,
    httpStatus: 401,
    errorCode: 'AUTHENTICATION_FAILED',
    severity: 'critical',
    category: 'security',
    userMessage: 'Authentication required. Please log in.',
    shouldLog: true,
    shouldReport: true
  },
  {
    pattern: /forbidden|access.*denied|insufficient.*permissions/i,
    httpStatus: 403,
    errorCode: 'ACCESS_DENIED',
    severity: 'error',
    category: 'security',
    userMessage: 'You do not have permission to perform this action.',
    shouldLog: true,
    shouldReport: true
  },

  // **💾 Database & Storage Errors**
  {
    pattern: /firestore.*error|database.*connection|collection.*not.*found/i,
    httpStatus: 503,
    errorCode: 'DATABASE_ERROR',
    severity: 'critical',
    category: 'system',
    userMessage: 'Database temporarily unavailable. Please try again.',
    shouldLog: true,
    shouldReport: true
  },
  {
    pattern: /document.*not.*found|record.*not.*found/i,
    httpStatus: 404,
    errorCode: 'RESOURCE_NOT_FOUND',
    severity: 'warning',
    category: 'user',
    userMessage: 'The requested resource was not found.',
    shouldLog: false,
    shouldReport: false
  },

  // **🌐 Network & External API Errors**
  {
    pattern: /network.*error|fetch.*failed|timeout/i,
    httpStatus: 502,
    errorCode: 'NETWORK_ERROR',
    severity: 'error',
    category: 'network',
    userMessage: 'Network error occurred. Please check your connection.',
    shouldLog: true,
    shouldReport: true
  },
  {
    pattern: /rate.*limit.*exceeded|too.*many.*requests/i,
    httpStatus: 429,
    errorCode: 'RATE_LIMIT_EXCEEDED',
    severity: 'warning',
    category: 'system',
    userMessage: 'Too many requests. Please try again later.',
    shouldLog: true,
    shouldReport: false
  },

  // **📝 Validation Errors**
  {
    pattern: /validation.*failed|invalid.*input|required.*field/i,
    httpStatus: 400,
    errorCode: 'VALIDATION_ERROR',
    severity: 'warning',
    category: 'validation',
    userMessage: 'Please check your input and try again.',
    shouldLog: false,
    shouldReport: false
  },
  {
    pattern: /json.*parse.*error|invalid.*json|malformed.*request/i,
    httpStatus: 400,
    errorCode: 'MALFORMED_REQUEST',
    severity: 'warning',
    category: 'validation',
    userMessage: 'Request format is invalid.',
    shouldLog: true,
    shouldReport: false
  },

  // **🔧 Business Logic Errors**
  {
    pattern: /project.*not.*found|company.*not.*found|building.*not.*found/i,
    httpStatus: 404,
    errorCode: 'ENTITY_NOT_FOUND',
    severity: 'warning',
    category: 'user',
    userMessage: 'The requested item was not found.',
    shouldLog: false,
    shouldReport: false
  },
  {
    pattern: /duplicate.*entry|already.*exists|constraint.*violation/i,
    httpStatus: 409,
    errorCode: 'DUPLICATE_RESOURCE',
    severity: 'warning',
    category: 'user',
    userMessage: 'This item already exists.',
    shouldLog: false,
    shouldReport: false
  },

  // **📁 File & Upload Errors**
  {
    pattern: /file.*too.*large|upload.*failed|invalid.*file.*type/i,
    httpStatus: 413,
    errorCode: 'FILE_UPLOAD_ERROR',
    severity: 'warning',
    category: 'user',
    userMessage: 'File upload failed. Please check file size and type.',
    shouldLog: true,
    shouldReport: false
  },

  // **⚡ Performance Errors**
  {
    pattern: /timeout.*exceeded|operation.*too.*slow/i,
    httpStatus: 408,
    errorCode: 'OPERATION_TIMEOUT',
    severity: 'warning',
    category: 'performance',
    userMessage: 'Operation timed out. Please try again.',
    shouldLog: true,
    shouldReport: true
  },

  // **🔧 Default Fallback**
  {
    pattern: /.*/,
    httpStatus: 500,
    errorCode: 'INTERNAL_SERVER_ERROR',
    severity: 'error',
    category: 'system',
    userMessage: 'An unexpected error occurred. Please try again.',
    shouldLog: true,
    shouldReport: true
  }
];

// ============================================================================
// API ERROR HANDLER CLASS
// ============================================================================

export class ApiErrorHandler {
  private static instance: ApiErrorHandler;
  private config = getErrorConfig();

  // Singleton pattern για enterprise consistency
  static getInstance(): ApiErrorHandler {
    if (!ApiErrorHandler.instance) {
      ApiErrorHandler.instance = new ApiErrorHandler();
    }
    return ApiErrorHandler.instance;
  }

  /**
   * 🚨 MAIN ERROR HANDLER - Handle any error και return NextResponse
   */
  async handleError(
    error: Error | string | any,
    request: NextRequest,
    additionalContext: Partial<ApiErrorContext> = {}
  ): Promise<NextResponse<ApiErrorResponse>> {
    const startTime = Date.now();

    try {
      // Extract error information
      const errorMessage = this.extractErrorMessage(error);
      const errorMapping = this.mapErrorToRule(errorMessage);

      // Generate unique request ID
      const requestId = this.generateRequestId();

      // Build comprehensive context
      const context = await this.buildErrorContext(request, additionalContext, {
        errorCode: errorMapping.errorCode,
        httpStatus: errorMapping.httpStatus,
        requestId,
        duration: Date.now() - startTime
      });

      // Log error to ErrorTracker (if should report)
      let errorId = '';
      if (errorMapping.shouldReport && this.shouldReportError(errorMessage)) {
        errorId = errorTracker.captureError(
          error instanceof Error ? error : new Error(errorMessage),
          errorMapping.severity,
          errorMapping.category,
          {
            component: 'ApiErrorHandler',
            action: `${request.method} ${context.path}`,
            ...context
          }
        );
      }

      // Log to console (if should log)
      if (errorMapping.shouldLog) {
        this.logError(errorMessage, errorMapping, context, errorId);
      }

      // Build standardized error response
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: errorMapping.userMessage || errorMessage,
        errorCode: errorMapping.errorCode,
        errorId: errorId || undefined,
        timestamp: new Date().toISOString(),
        requestId,
        details: this.shouldIncludeDetails(errorMapping) ? this.sanitizeErrorDetails(error) : undefined,
        context: this.shouldIncludeContext() ? {
          path: context.path,
          method: context.method,
          operation: context.operation
        } : undefined
      };

      return NextResponse.json(errorResponse, {
        status: errorMapping.httpStatus,
        headers: {
          'X-Request-ID': requestId,
          'X-Error-Code': errorMapping.errorCode,
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });

    } catch (handlerError) {
      // Fallback error handling (για περιπτώσεις που ο handler αποτύχει)
      console.error('🚨 ApiErrorHandler failed:', handlerError);

      return NextResponse.json({
        success: false,
        error: 'Internal server error',
        errorCode: 'HANDLER_FAILURE',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  }

  /**
   * 🎯 SUCCESS RESPONSE HELPER - Standardized success responses
   */
  static success<T>(
    data?: T,
    message?: string,
    metadata?: Record<string, any>,
    status: number = 200
  ): NextResponse<ApiSuccessResponse<T>> {
    const requestId = ApiErrorHandler.getInstance().generateRequestId();

    const response: ApiSuccessResponse<T> = {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
      requestId,
      metadata
    };

    return NextResponse.json(response, {
      status,
      headers: {
        'X-Request-ID': requestId,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }

  /**
   * 🔍 ASYNC WRAPPER - Wrap async functions με automatic error handling
   */
  static withErrorHandling<T extends any[], R>(
    handler: (request: NextRequest, ...args: T) => Promise<NextResponse<R>>,
    context?: Partial<ApiErrorContext>
  ) {
    return async (request: NextRequest, ...args: T): Promise<NextResponse<R | ApiErrorResponse>> => {
      const errorHandler = ApiErrorHandler.getInstance();

      try {
        return await handler(request, ...args);
      } catch (error) {
        return await errorHandler.handleError(error, request, context);
      }
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private extractErrorMessage(error: any): string {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (error?.message) return error.message;
    if (error?.error) return error.error;

    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error occurred';
    }
  }

  private mapErrorToRule(errorMessage: string): ErrorMappingRule {
    for (const rule of ERROR_MAPPING_RULES) {
      if (typeof rule.pattern === 'string') {
        if (errorMessage.toLowerCase().includes(rule.pattern.toLowerCase())) {
          return rule;
        }
      } else {
        if (rule.pattern.test(errorMessage)) {
          return rule;
        }
      }
    }

    // Return fallback rule
    return ERROR_MAPPING_RULES[ERROR_MAPPING_RULES.length - 1];
  }

  private async buildErrorContext(
    request: NextRequest,
    additionalContext: Partial<ApiErrorContext>,
    errorInfo: {
      errorCode: string;
      httpStatus: number;
      requestId: string;
      duration: number;
    }
  ): Promise<ApiErrorContext> {
    const url = new URL(request.url);

    return {
      // Request context
      method: request.method,
      url: request.url,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),

      // Headers (filtered για security)
      headers: this.sanitizeHeaders(request.headers),

      // User context
      userAgent: request.headers.get('user-agent') || undefined,

      // API context
      endpoint: url.pathname.split('/').slice(-2).join('/'),

      // Technical context
      requestId: errorInfo.requestId,
      timestamp: Date.now(),

      // Performance context
      duration: errorInfo.duration,
      memoryUsage: this.getMemoryUsage(),

      // Additional context
      ...additionalContext,

      // Error-specific metadata
      metadata: {
        errorCode: errorInfo.errorCode,
        httpStatus: errorInfo.httpStatus,
        ...additionalContext.metadata
      }
    };
  }

  private sanitizeHeaders(headers: Headers): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const allowedHeaders = [
      'content-type',
      'content-length',
      'accept',
      'accept-language',
      'cache-control'
    ];

    headers.forEach((value, key) => {
      if (allowedHeaders.includes(key.toLowerCase())) {
        sanitized[key] = value;
      }
    });

    return sanitized;
  }

  private shouldReportError(errorMessage: string): boolean {
    // Use existing configuration
    return !this.config.ignoredErrors.some(ignored =>
      errorMessage.toLowerCase().includes(ignored.toLowerCase())
    );
  }

  private shouldIncludeDetails(mapping: ErrorMappingRule): boolean {
    // Include details in development, exclude in production για security
    return process.env.NODE_ENV === 'development' || mapping.category !== 'security';
  }

  private shouldIncludeContext(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  private sanitizeErrorDetails(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        // Include stack only in development
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      };
    }

    return error;
  }

  private logError(
    message: string,
    mapping: ErrorMappingRule,
    context: ApiErrorContext,
    errorId: string
  ): void {
    const logLevel = mapping.severity === 'critical' ? 'error' : mapping.severity;
    const logData = {
      errorCode: mapping.errorCode,
      errorId,
      path: context.path,
      method: context.method,
      duration: context.duration,
      httpStatus: mapping.httpStatus
    };

    if (logLevel === 'error') {
      console.error(`🚨 API Error: ${message}`, logData);
    } else {
      console.warn(`⚠️ API Warning: ${message}`, logData);
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getMemoryUsage(): number {
    try {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        return process.memoryUsage().heapUsed;
      }
    } catch {
      // Fallback για browser environment
    }
    return 0;
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

// Singleton instance
export const apiErrorHandler = ApiErrorHandler.getInstance();

// Shorthand functions
export const handleApiError = (error: any, request: NextRequest, context?: Partial<ApiErrorContext>) =>
  apiErrorHandler.handleError(error, request, context);

export const apiSuccess = ApiErrorHandler.success;
export const withErrorHandling = ApiErrorHandler.withErrorHandling;

// ============================================================================
// DECORATOR PATTERNS για ENTERPRISE APIs
// ============================================================================

/**
 * Method decorator για automatic error handling
 */
export function HandleApiErrors(context?: Partial<ApiErrorContext>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (request: NextRequest, ...args: any[]) {
      try {
        return await originalMethod.apply(this, [request, ...args]);
      } catch (error) {
        return await apiErrorHandler.handleError(error, request, {
          operation: propertyKey,
          ...context
        });
      }
    };

    return descriptor;
  };
}

/**
 * Class decorator για API route classes
 */
export function ApiErrorHandling(baseContext?: Partial<ApiErrorContext>) {
  return function <T extends { new(...args: any[]): {} }>(constructor: T) {
    return class extends constructor {
      constructor(...args: any[]) {
        super(...args);

        // Auto-wrap όλες τις methods
        Object.getOwnPropertyNames(constructor.prototype).forEach(methodName => {
          if (methodName !== 'constructor' && typeof this[methodName] === 'function') {
            const originalMethod = this[methodName];
            this[methodName] = async function(request: NextRequest, ...methodArgs: any[]) {
              try {
                return await originalMethod.apply(this, [request, ...methodArgs]);
              } catch (error) {
                return await apiErrorHandler.handleError(error, request, {
                  operation: methodName,
                  ...baseContext
                });
              }
            };
          }
        });
      }
    };
  };
}

// ============================================================================
// TYPE GUARDS & VALIDATION
// ============================================================================

export function isApiErrorResponse(response: any): response is ApiErrorResponse {
  return response && response.success === false && typeof response.error === 'string';
}

export function isApiSuccessResponse<T>(response: any): response is ApiSuccessResponse<T> {
  return response && response.success === true;
}

export default ApiErrorHandler;