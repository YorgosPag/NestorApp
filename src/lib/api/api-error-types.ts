/**
 * API Error Handler — Types & ApiError Class
 *
 * Extracted from ApiErrorHandler.ts for SRP compliance (ADR-065 Phase 4).
 */

import type { ErrorSeverity, ErrorCategory } from '@/services/ErrorTracker';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ApiErrorContext {
  method?: string;
  url?: string;
  path?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  userId?: string;
  userAgent?: string;
  endpoint?: string;
  operation?: string;
  requestId?: string;
  timestamp?: number;
  duration?: number;
  memoryUsage?: number;
  entityId?: string;
  entityType?: string;
  metadata?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  errorCode?: string;
  errorId?: string;
  timestamp: string;
  requestId?: string;
  details?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data?: T;
  message?: string;
  timestamp: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export type ApiResponse<T = unknown> = ApiErrorResponse | ApiSuccessResponse<T>;

// ============================================================================
// CUSTOM API ERROR CLASS
// ============================================================================

/**
 * Custom Error class for API operations.
 * Use this to throw typed HTTP errors in API routes.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errorCode?: string;

  constructor(statusCode: number, message: string, errorCode?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  static isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
  }
}

// ============================================================================
// ERROR MAPPING RULE TYPE
// ============================================================================

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
