/**
 * Domain Error to i18n Key Mapping System
 * Maps application domain errors to localized error messages
 */

export interface DomainError {
  code: string;
  domain?: string;
  context?: Record<string, any>;
}

export interface ErrorMapping {
  key: string;
  namespace?: string;
  fallback?: string;
  context?: Record<string, any>;
}

/**
 * Error mapping registry
 * Format: "DOMAIN.ERROR_CODE" -> i18n configuration
 */
const ERROR_MAPPINGS: Record<string, ErrorMapping> = {
  // Authentication errors
  'AUTH.INVALID_CREDENTIALS': {
    key: 'http.401',
    namespace: 'errors',
    fallback: 'Μη έγκυρα διαπιστευτήρια'
  },
  'AUTH.TOKEN_EXPIRED': {
    key: 'auth.tokenExpired',
    namespace: 'errors',
    fallback: 'Η συνεδρία έχει λήξει'
  },
  'AUTH.ACCESS_DENIED': {
    key: 'http.403',
    namespace: 'errors',
    fallback: 'Απαγορευμένη πρόσβαση'
  },

  // DXF Viewer errors
  'DXF.FILE_PARSE_ERROR': {
    key: 'file.parseError',
    namespace: 'dxf-viewer',
    fallback: 'Σφάλμα ανάλυσης αρχείου DXF'
  },
  'DXF.LAYER_NOT_FOUND': {
    key: 'layers.notFound',
    namespace: 'dxf-viewer',
    fallback: 'Το layer δεν βρέθηκε'
  },
  'DXF.STORAGE_QUOTA_EXCEEDED': {
    key: 'storage.quotaExceeded',
    namespace: 'errors',
    fallback: 'Ο χώρος αποθήκευσης έχει εξαντληθεί'
  },
  'DXF.STORAGE_ERROR': {
    key: 'storage.error',
    namespace: 'dxf-viewer',
    fallback: 'Storage Γεμάτο'
  },
  'DXF.GENERIC_ERROR': {
    key: 'generic.error',
    namespace: 'dxf-viewer',
    fallback: 'Σφάλμα DXF Viewer'
  },

  // Property management errors
  'PROPERTY.NOT_FOUND': {
    key: 'http.404',
    namespace: 'errors',
    fallback: 'Το ακίνητο δεν βρέθηκε'
  },
  'PROPERTY.VALIDATION_FAILED': {
    key: 'validation.failed',
    namespace: 'forms',
    fallback: 'Σφάλμα επικύρωσης δεδομένων'
  },

  // Network errors
  'NETWORK.CONNECTION_FAILED': {
    key: 'network.connectionFailed',
    namespace: 'errors',
    fallback: 'Αποτυχία σύνδεσης'
  },
  'NETWORK.TIMEOUT': {
    key: 'network.timeout',
    namespace: 'errors',
    fallback: 'Λήξη χρονικού ορίου'
  },

  // Storage errors
  'STORAGE.FILE_TOO_LARGE': {
    key: 'file.tooLarge',
    namespace: 'errors',
    fallback: 'Το αρχείο είναι πολύ μεγάλο'
  },
  'STORAGE.INSUFFICIENT_SPACE': {
    key: 'storage.insufficientSpace',
    namespace: 'errors',
    fallback: 'Ανεπαρκής χώρος αποθήκευσης'
  },

  // Form validation errors
  'VALIDATION.REQUIRED_FIELD': {
    key: 'validation.required',
    namespace: 'forms',
    fallback: 'Αυτό το πεδίο είναι υποχρεωτικό'
  },
  'VALIDATION.INVALID_EMAIL': {
    key: 'validation.invalidEmail',
    namespace: 'forms',
    fallback: 'Μη έγκυρη διεύθυνση email'
  },
  'VALIDATION.PASSWORD_TOO_WEAK': {
    key: 'validation.passwordWeak',
    namespace: 'forms',
    fallback: 'Ο κωδικός πρόσβασης είναι πολύ αδύναμος'
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
    fallback: 'Παρουσιάστηκε απροσδόκητο σφάλμα',
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
export function mapHttpStatusToError(status: number, response?: any): DomainError {
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