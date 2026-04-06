/**
 * API ERROR HANDLER - ENTERPRISE CENTRALIZED SYSTEM
 *
 * Enterprise-grade API error handling with standardized NextResponse format.
 *
 * Split into 3 files for SRP compliance (ADR-065 Phase 4):
 * - api-error-types.ts  — Types + ApiError class
 * - api-error-rules.ts  — ERROR_MAPPING_RULES config data
 * - ApiErrorHandler.ts  — Main handler class (this file)
 */

import { NextRequest, NextResponse } from 'next/server';
import { errorTracker, type ErrorContext } from '@/services/ErrorTracker';
import { getErrorConfig } from '@/config/error-reporting';
import { generateRequestId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

// Re-export everything from types for backward compatibility (86 importers)
export type { ApiErrorContext, ApiErrorResponse, ApiSuccessResponse, ApiResponse, ErrorMappingRule } from './api-error-types';
export { ApiError } from './api-error-types';

import type { ApiErrorContext, ApiErrorResponse, ApiSuccessResponse, ErrorMappingRule } from './api-error-types';
import { ApiError } from './api-error-types';
import { ERROR_MAPPING_RULES } from './api-error-rules';

const logger = createModuleLogger('ApiErrorHandler');

// ============================================================================
// API ERROR HANDLER CLASS
// ============================================================================

export class ApiErrorHandler {
  private static instance: ApiErrorHandler;
  private config = getErrorConfig();

  static getInstance(): ApiErrorHandler {
    if (!ApiErrorHandler.instance) {
      ApiErrorHandler.instance = new ApiErrorHandler();
    }
    return ApiErrorHandler.instance;
  }

  /** Main error handler — handle any error and return NextResponse */
  async handleError(
    error: Error | string | unknown,
    request: NextRequest,
    additionalContext: Partial<ApiErrorContext> = {}
  ): Promise<NextResponse<ApiErrorResponse>> {
    const startTime = Date.now();

    try {
      if (ApiError.isApiError(error)) {
        const requestId = this.generateRequestId();
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: error.message,
          errorCode: error.errorCode || `HTTP_${error.statusCode}`,
          timestamp: new Date().toISOString(),
          requestId,
        };

        logger.info(`[API] ${error.statusCode}: ${error.message}`);

        return NextResponse.json(errorResponse, {
          status: error.statusCode,
          headers: {
            'X-Request-ID': requestId,
            'X-Error-Code': errorResponse.errorCode || '',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
      }

      const errorMessage = this.extractErrorMessage(error);
      const errorMapping = this.mapErrorToRule(errorMessage);
      const requestId = this.generateRequestId();

      const context = await this.buildErrorContext(request, additionalContext, {
        errorCode: errorMapping.errorCode,
        httpStatus: errorMapping.httpStatus,
        requestId,
        duration: Date.now() - startTime
      });

      let errorId = '';
      if (errorMapping.shouldReport && this.shouldReportError(errorMessage)) {
        try {
          if (errorTracker && typeof errorTracker.captureError === 'function') {
            errorId = errorTracker.captureError(
              error instanceof Error ? error : new Error(errorMessage),
              errorMapping.severity,
              errorMapping.category,
              {
                component: 'ApiErrorHandler',
                action: `${request.method} ${context.path}`,
                ...context
              } as unknown as Partial<ErrorContext>
            );
          }
        } catch (trackerError) {
          logger.warn('[ApiErrorHandler] ErrorTracker unavailable', { error: getErrorMessage(trackerError) });
        }
      }

      if (errorMapping.shouldLog) {
        this.logError(errorMessage, errorMapping, context, errorId);
      }

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
      logger.error('ApiErrorHandler failed', { error: handlerError });

      return NextResponse.json({
        success: false,
        error: 'Internal server error',
        errorCode: 'HANDLER_FAILURE',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  }

  /** Standardized success response */
  static success<T>(
    data?: T,
    message?: string,
    metadata?: Record<string, unknown>,
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

  /** Wrap async functions with automatic error handling */
  static withErrorHandling<T extends unknown[], R>(
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

  private extractErrorMessage(error: unknown): string {
    return getErrorMessage(error, 'Unknown error occurred');
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
      method: request.method,
      url: request.url,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers: this.sanitizeHeaders(request.headers),
      userAgent: request.headers.get('user-agent') || undefined,
      endpoint: url.pathname.split('/').slice(-2).join('/'),
      requestId: errorInfo.requestId,
      timestamp: Date.now(),
      duration: errorInfo.duration,
      memoryUsage: this.getMemoryUsage(),
      ...additionalContext,
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
    return !this.config.ignoredErrors.some(ignored =>
      errorMessage.toLowerCase().includes(ignored.toLowerCase())
    );
  }

  private shouldIncludeDetails(mapping: ErrorMappingRule): boolean {
    return process.env.NODE_ENV === 'development' || mapping.category !== 'security';
  }

  private shouldIncludeContext(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  private sanitizeErrorDetails(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      };
    }

    if (error !== null && typeof error === 'object') {
      return error as Record<string, unknown>;
    }

    return { value: error };
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
      logger.error(`API Error: ${message}`, logData);
    } else {
      logger.warn(`API Warning: ${message}`, logData);
    }
  }

  private generateRequestId(): string {
    return generateRequestId();
  }

  private getMemoryUsage(): number {
    try {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        return process.memoryUsage().heapUsed;
      }
    } catch {
      // Fallback for browser environment
    }
    return 0;
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export const apiErrorHandler = ApiErrorHandler.getInstance();

export const handleApiError = (error: unknown, request: NextRequest, context?: Partial<ApiErrorContext>) =>
  apiErrorHandler.handleError(error, request, context);

export const apiSuccess = ApiErrorHandler.success;
export const withErrorHandling = ApiErrorHandler.withErrorHandling;

// ============================================================================
// DECORATOR PATTERNS
// ============================================================================

/** Method decorator for automatic error handling */
export function HandleApiErrors(context?: Partial<ApiErrorContext>) {
  return function <T>(
    _target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> | void {
    const originalMethod = descriptor.value as ((...args: unknown[]) => Promise<NextResponse<unknown>>) | undefined;
    if (!originalMethod) return;

    descriptor.value = async function (this: unknown, request: NextRequest, ...args: unknown[]) {
      try {
        return await originalMethod.apply(this, [request, ...args]);
      } catch (error) {
        return await apiErrorHandler.handleError(error, request, {
          operation: String(propertyKey),
          ...context
        });
      }
    } as T;

    return descriptor;
  };
}

/** Class decorator for API route classes */
type Constructor<T = object> = new (...args: unknown[]) => T;

export function ApiErrorHandling(baseContext?: Partial<ApiErrorContext>) {
  return function <T extends Constructor>(constructor: T): T {
    const prototype = constructor.prototype as Record<string, unknown>;
    Object.getOwnPropertyNames(constructor.prototype).forEach(methodName => {
      if (methodName !== 'constructor' && typeof prototype[methodName] === 'function') {
        const originalMethod = prototype[methodName] as (...args: unknown[]) => Promise<unknown>;
        prototype[methodName] = async function(request: NextRequest, ...methodArgs: unknown[]) {
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

    return constructor;
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isApiErrorResponse(response: unknown): response is ApiErrorResponse {
  return (
    response !== null &&
    typeof response === 'object' &&
    'success' in response &&
    response.success === false &&
    'error' in response &&
    typeof (response as ApiErrorResponse).error === 'string'
  );
}

export function isApiSuccessResponse<T>(response: unknown): response is ApiSuccessResponse<T> {
  return (
    response !== null &&
    typeof response === 'object' &&
    'success' in response &&
    response.success === true
  );
}

export default ApiErrorHandler;
