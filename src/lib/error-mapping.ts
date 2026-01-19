/**
 * Domain Error to i18n Key Mapping System
 * Maps application domain errors to localized error messages
 */

export interface DomainError {
  code: string;
  domain?: string;
  context?: Record<string, unknown>;
}

export interface ErrorMapping {
  key: string;
  namespace?: string;
  fallback?: string;
  context?: Record<string, unknown>;
}

/**
 * Error mapping registry
 * Format: "DOMAIN.ERROR_CODE" -> i18n configuration
 */
// 🌐 i18n: All fallbacks converted to i18n keys - 2026-01-18
// Fallbacks reference the same i18n keys for consistency
const ERROR_MAPPINGS: Record<string, ErrorMapping> = {
  // Authentication errors
  'AUTH.INVALID_CREDENTIALS': {
    key: 'http.401',
    namespace: 'errors',
    fallback: 'errors.http.401'
  },
  'AUTH.TOKEN_EXPIRED': {
    key: 'auth.tokenExpired',
    namespace: 'errors',
    fallback: 'errors.auth.tokenExpired'
  },
  'AUTH.ACCESS_DENIED': {
    key: 'http.403',
    namespace: 'errors',
    fallback: 'errors.http.403'
  },

  // DXF Viewer errors
  'DXF.FILE_PARSE_ERROR': {
    key: 'file.parseError',
    namespace: 'dxf-viewer',
    fallback: 'dxf-viewer.file.parseError'
  },
  'DXF.LAYER_NOT_FOUND': {
    key: 'layers.notFound',
    namespace: 'dxf-viewer',
    fallback: 'dxf-viewer.layers.notFound'
  },
  'DXF.STORAGE_QUOTA_EXCEEDED': {
    key: 'storage.quotaExceeded',
    namespace: 'errors',
    fallback: 'errors.storage.quotaExceeded'
  },
  'DXF.STORAGE_ERROR': {
    key: 'storage.error',
    namespace: 'dxf-viewer',
    fallback: 'dxf-viewer.storage.error'
  },
  'DXF.GENERIC_ERROR': {
    key: 'generic.error',
    namespace: 'dxf-viewer',
    fallback: 'dxf-viewer.generic.error'
  },

  // Property management errors
  'PROPERTY.NOT_FOUND': {
    key: 'http.404',
    namespace: 'errors',
    fallback: 'errors.http.404'
  },
  'PROPERTY.VALIDATION_FAILED': {
    key: 'validation.failed',
    namespace: 'forms',
    fallback: 'forms.validation.failed'
  },

  // Network errors
  'NETWORK.CONNECTION_FAILED': {
    key: 'network.connectionFailed',
    namespace: 'errors',
    fallback: 'errors.network.connectionFailed'
  },
  'NETWORK.TIMEOUT': {
    key: 'network.timeout',
    namespace: 'errors',
    fallback: 'errors.network.timeout'
  },

  // Storage errors
  'STORAGE.FILE_TOO_LARGE': {
    key: 'file.tooLarge',
    namespace: 'errors',
    fallback: 'errors.file.tooLarge'
  },
  'STORAGE.INSUFFICIENT_SPACE': {
    key: 'storage.insufficientSpace',
    namespace: 'errors',
    fallback: 'errors.storage.insufficientSpace'
  },

  // Form validation errors
  'VALIDATION.REQUIRED_FIELD': {
    key: 'validation.required',
    namespace: 'forms',
    fallback: 'forms.validation.required'
  },
  'VALIDATION.INVALID_EMAIL': {
    key: 'validation.invalidEmail',
    namespace: 'forms',
    fallback: 'forms.validation.invalidEmail'
  },
  'VALIDATION.PASSWORD_TOO_WEAK': {
    key: 'validation.passwordWeak',
    namespace: 'forms',
    fallback: 'forms.validation.passwordWeak'
  },
};

/**
 * Map domain error to i18n key configuration
 */
export function mapErrorToI18n(error: DomainError): ErrorMapping {
  const errorKey = error.domain 
    ? `${error.domain}.${error.code}`
    : error.code;

  const mapping = ERROR_MAPPINGS[errorKey];
  
  if (mapping) {
    return {
      ...mapping,
      context: { ...mapping.context, ...error.context },
    };
  }

  // Fallback for unmapped errors
  return {
    key: 'general.unknown',
    namespace: 'errors',
    fallback: 'errors.general.unknown',
    context: error.context,
  };
}

/**
 * Get all available error mappings (for debugging/admin)
 */
export function getAllErrorMappings(): Record<string, ErrorMapping> {
  return { ...ERROR_MAPPINGS };
}

/**
 * Register new error mapping dynamically
 */
export function registerErrorMapping(errorCode: string, mapping: ErrorMapping): void {
  ERROR_MAPPINGS[errorCode] = mapping;
}

/**
 * HTTP status code to domain error mapping
 */
export function mapHttpStatusToError(status: number, response?: Record<string, unknown>): DomainError {
  const statusMappings: Record<number, DomainError> = {
    400: { code: 'BAD_REQUEST', domain: 'HTTP' },
    401: { code: 'INVALID_CREDENTIALS', domain: 'AUTH' },
    403: { code: 'ACCESS_DENIED', domain: 'AUTH' },
    404: { code: 'NOT_FOUND', domain: 'HTTP' },
    409: { code: 'CONFLICT', domain: 'HTTP' },
    422: { code: 'VALIDATION_FAILED', domain: 'VALIDATION' },
    500: { code: 'INTERNAL_SERVER_ERROR', domain: 'HTTP' },
    502: { code: 'BAD_GATEWAY', domain: 'NETWORK' },
    503: { code: 'SERVICE_UNAVAILABLE', domain: 'NETWORK' },
    504: { code: 'TIMEOUT', domain: 'NETWORK' },
  };

  return statusMappings[status] || {
    code: 'UNKNOWN_ERROR',
    domain: 'HTTP',
    context: { status, response },
  };
}