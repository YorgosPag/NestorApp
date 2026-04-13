/**
 * =============================================================================
 * 🏢 ENTERPRISE API CLIENT — TYPE DEFINITIONS & ERROR CLASSES
 * =============================================================================
 *
 * Types, interfaces, and error classes for the enterprise API client.
 *
 * @module lib/api/api-client-types
 * @see enterprise-api-client.ts (main client)
 */

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestConfig {
  method?: HttpMethod;
  body?: Record<string, unknown> | unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  timeout?: number;
  retry?: boolean;
  maxRetries?: number;
  skipAuth?: boolean;
  responseType?: 'auto' | 'json' | 'text' | 'blob';
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  timestamp?: string;
  requestId?: string;
}

/** Request context for logging and debugging */
export interface RequestContext {
  method: HttpMethod;
  url: string;
  startTime: number;
  requestId: string;
}

// =============================================================================
// ERROR CLASSES
// =============================================================================

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly errorCode?: string;
  public readonly response?: Response;
  public readonly requestId?: string;

  constructor(
    message: string,
    statusCode: number,
    errorCode?: string,
    response?: Response,
    requestId?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.response = response;
    this.requestId = requestId;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiClientError);
    }
  }

  static isApiClientError(error: unknown): error is ApiClientError {
    return error instanceof ApiClientError;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      requestId: this.requestId,
      stack: this.stack,
    };
  }
}

/**
 * Contract Violation Error — thrown when API returns 200 OK but
 * response doesn't match expected canonical format.
 */
export class ContractViolationError extends ApiClientError {
  public readonly endpoint: string;
  public readonly receivedKeys: string[];
  public readonly expectedFormat: string;

  constructor(
    endpoint: string,
    status: number,
    requestId: string,
    receivedKeys: string[],
    expectedFormat: string = '{ success: boolean, data: T }'
  ) {
    const message = `API Contract Violation: ${endpoint} returned ${status} but response does not match canonical format. ` +
      `Expected: ${expectedFormat}. Received keys: [${receivedKeys.join(', ')}]`;

    super(message, status, 'CONTRACT_VIOLATION', undefined, requestId);
    this.name = 'ContractViolationError';
    this.endpoint = endpoint;
    this.receivedKeys = receivedKeys;
    this.expectedFormat = expectedFormat;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContractViolationError);
    }
  }

  static isContractViolationError(error: unknown): error is ContractViolationError {
    return error instanceof ContractViolationError;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function hasContentTypeHeader(headers: Record<string, string>): boolean {
  return Object.keys(headers).some((key) => key.toLowerCase() === 'content-type');
}

export function isBinaryRequestBody(body: unknown): body is BodyInit {
  return typeof body === 'string'
    || body instanceof FormData
    || body instanceof URLSearchParams
    || body instanceof Blob
    || body instanceof ArrayBuffer
    || ArrayBuffer.isView(body);
}

export function shouldSerializeBodyAsJson(body: unknown): boolean {
  if (body === undefined || body === null) return false;
  return !isBinaryRequestBody(body);
}
