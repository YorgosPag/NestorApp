/**
 * API Error Handler — Types & ApiError Class
 *
 * Extracted from ApiErrorHandler.ts for SRP compliance (ADR-065 Phase 4).
 */

import type { ErrorSeverity, ErrorCategory } from '@/services/ErrorTracker';
// Leaf module — carries the error class only, so this stays free of the Admin SDK.
import { TenantIsolationError } from '@/lib/auth/tenant-isolation-error';

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
  /** Extra fields spread into the response envelope (e.g. { existingCertificateId }). */
  public readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    message: string,
    errorCode?: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  static isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
  }
}

/**
 * Normalise a thrown value into an `ApiError`, or `null` if it is not one of
 * the typed HTTP refusals.
 *
 * Both error renderers — `ApiErrorHandler.handleError` (the `withAuth` path) and
 * `defineRoute`'s `toErrorResponse` — ask this question, and they must answer it
 * the same way: a route's status code should not depend on which wrapper it
 * happens to be built with.
 *
 * `TenantIsolationError` is included because a tenant refusal is a *decided*
 * 403/404. Left unmapped it fell through to message matching and surfaced as a
 * 500, i.e. "we broke" instead of "you may not".
 *
 * @enterprise ADR-701 — Tenant Query Scope SSoT
 */
export function asApiError(error: unknown): ApiError | null {
  if (ApiError.isApiError(error)) {
    return error;
  }

  if (error instanceof TenantIsolationError) {
    return new ApiError(error.status, error.message, error.code);
  }

  return null;
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
