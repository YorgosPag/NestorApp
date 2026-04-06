/**
 * API Error Handler — Error Mapping Rules (Config Data)
 *
 * Enterprise pattern matching rules that map error messages to HTTP responses.
 * Extracted from ApiErrorHandler.ts for SRP compliance (ADR-065 Phase 4).
 *
 * EXEMPT from 500-line limit: config/data file.
 */

import type { ErrorMappingRule } from './api-error-types';

// ============================================================================
// ERROR MAPPING RULES - ENTERPRISE PATTERNS
// ============================================================================

export const ERROR_MAPPING_RULES: ErrorMappingRule[] = [
  // **Authentication & Authorization Errors**
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

  // **Database & Storage Errors**
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

  // **Network & External API Errors**
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

  // **Validation Errors**
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

  // **Business Logic Errors**
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

  // **File & Upload Errors**
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

  // **Performance Errors**
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

  // **Default Fallback**
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
