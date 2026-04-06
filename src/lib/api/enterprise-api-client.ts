/**
 * =============================================================================
 * 🏢 ENTERPRISE AUTHENTICATED API CLIENT - SINGLE SOURCE OF TRUTH
 * =============================================================================
 *
 * Centralized API client for all authenticated requests.
 * Fortune-500 pattern (SAP, Salesforce, Microsoft, Google).
 *
 * Split into SRP modules (ADR-065):
 * - api-client-types.ts — types, error classes, helper functions
 *
 * @module lib/api/enterprise-api-client
 * @see ADR-212 Phase 9 — sleep() centralized
 */

import { auth } from '@/lib/firebase';
import type { User as FirebaseUser } from 'firebase/auth';
import { generateRequestId as _generateRequestId } from '@/services/enterprise-id.service';
import { sleep } from '@/lib/async-utils';
import { createModuleLogger } from '@/lib/telemetry';

// Re-export all types for consumers
export type {
  HttpMethod,
  ApiRequestConfig,
  ApiResponse,
  RequestContext,
} from './api-client-types';

export {
  ApiClientError,
  ContractViolationError,
  hasContentTypeHeader,
  isBinaryRequestBody,
  shouldSerializeBodyAsJson,
} from './api-client-types';

import type {
  HttpMethod,
  ApiRequestConfig,
  ApiResponse,
  RequestContext,
} from './api-client-types';

import {
  ApiClientError,
  ContractViolationError,
  shouldSerializeBodyAsJson,
  hasContentTypeHeader,
} from './api-client-types';

const logger = createModuleLogger('enterprise-api-client');

// =============================================================================
// ENTERPRISE API CLIENT CLASS
// =============================================================================

export class EnterpriseApiClient {
  private static instance: EnterpriseApiClient;
  private currentUser: FirebaseUser | null = null;
  private tokenCache: { token: string; expiresAt: number } | null = null;

  static getInstance(): EnterpriseApiClient {
    if (!EnterpriseApiClient.instance) {
      EnterpriseApiClient.instance = new EnterpriseApiClient();
    }
    return EnterpriseApiClient.instance;
  }

  private constructor() {
    if (typeof window !== 'undefined' && auth) {
      auth.onAuthStateChanged((user) => {
        this.currentUser = user;
        if (!user) this.tokenCache = null;
      });
    }
  }

  // ===========================================================================
  // CORE HTTP METHODS
  // ===========================================================================

  async get<T = unknown>(url: string, config?: Omit<ApiRequestConfig, 'method' | 'body'>): Promise<T> {
    return this.request<T>(url, { ...config, method: 'GET' });
  }

  async post<T = unknown>(url: string, body?: Record<string, unknown> | unknown, config?: Omit<ApiRequestConfig, 'method' | 'body'>): Promise<T> {
    return this.request<T>(url, { ...config, method: 'POST', body });
  }

  async put<T = unknown>(url: string, body?: Record<string, unknown> | unknown, config?: Omit<ApiRequestConfig, 'method' | 'body'>): Promise<T> {
    return this.request<T>(url, { ...config, method: 'PUT', body });
  }

  async patch<T = unknown>(url: string, body?: Record<string, unknown> | unknown, config?: Omit<ApiRequestConfig, 'method' | 'body'>): Promise<T> {
    return this.request<T>(url, { ...config, method: 'PATCH', body });
  }

  async delete<T = unknown>(url: string, config?: Omit<ApiRequestConfig, 'method' | 'body'>): Promise<T> {
    return this.request<T>(url, { ...config, method: 'DELETE' });
  }

  // ===========================================================================
  // MAIN REQUEST METHOD
  // ===========================================================================

  async request<T = unknown>(url: string, config: ApiRequestConfig = {}): Promise<T> {
    const {
      method = 'GET',
      body,
      headers = {},
      params,
      timeout = 60000,
      retry = true,
      maxRetries = 3,
      skipAuth = false,
      responseType = 'auto',
    } = config;

    const fullUrl = this.buildUrl(url, params);
    const requestId = _generateRequestId();

    const context: RequestContext = {
      method, url: fullUrl, startTime: Date.now(), requestId,
    };

    let lastError: Error | null = null;
    let attempts = 0;

    while (attempts < (retry ? maxRetries : 1)) {
      attempts++;

      try {
        const requestHeaders = await this.buildHeaders(headers, skipAuth, body);
        const fetchOptions: RequestInit = { method, headers: requestHeaders };

        if (body !== undefined && body !== null) {
          fetchOptions.body = shouldSerializeBodyAsJson(body)
            ? JSON.stringify(body) : body as BodyInit;
        }

        this.logRequest(context, attempts, maxRetries);
        const response = await this.fetchWithTimeout(fullUrl, fetchOptions, timeout);
        const result = await this.handleResponse<T>(response, context, responseType);
        this.logSuccess(context, response.status);
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const shouldRetryNow = this.shouldRetry(error, attempts, maxRetries, retry);

        if (shouldRetryNow) {
          const delay = this.calculateBackoff(attempts);
          logger.warn(`[API] Retrying request (${attempts}/${maxRetries}) after ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        this.logError(context, lastError);
        throw lastError;
      }
    }

    throw lastError || new Error('Request failed after all retries');
  }

  // ===========================================================================
  // AUTHENTICATION
  // ===========================================================================

  private async getIdToken(forceRefresh: boolean = false): Promise<string> {
    if (typeof window === 'undefined') {
      throw new Error('API client cannot run on server - Firebase auth requires browser environment');
    }

    const user = auth.currentUser || this.currentUser;
    if (!user) {
      throw new ApiClientError('User not authenticated', 401, 'AUTHENTICATION_REQUIRED');
    }

    if (!forceRefresh && this.tokenCache) {
      if (this.tokenCache.expiresAt - Date.now() > 2 * 60 * 1000) {
        return this.tokenCache.token;
      }
    }

    try {
      const token = await user.getIdToken(forceRefresh);
      this.tokenCache = { token, expiresAt: Date.now() + 55 * 60 * 1000 };
      return token;
    } catch (error) {
      logger.error('[API] Failed to get ID token', { error });
      throw new ApiClientError('Failed to get authentication token', 401, 'TOKEN_RETRIEVAL_FAILED');
    }
  }

  private async buildHeaders(
    customHeaders: Record<string, string>,
    skipAuth: boolean,
    body?: unknown,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = { ...customHeaders };

    if (shouldSerializeBodyAsJson(body) && !hasContentTypeHeader(headers)) {
      headers['Content-Type'] = 'application/json';
    }

    if (!skipAuth) {
      const token = await this.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  // ===========================================================================
  // RESPONSE HANDLING
  // ===========================================================================

  private async handleResponse<T>(
    response: Response,
    context: RequestContext,
    responseType: ApiRequestConfig['responseType'] = 'auto'
  ): Promise<T> {
    const { status, statusText } = response;

    if (status >= 200 && status < 300) {
      return this.parseResponseBody<T>(response, context, responseType);
    }

    let errorMessage = statusText || 'Request failed';
    let errorCode = `HTTP_${status}`;

    try {
      const errorBody = await response.json();
      if (errorBody && typeof errorBody === 'object') {
        errorMessage = (errorBody as Record<string, unknown>).error as string || errorMessage;
        errorCode = (errorBody as Record<string, unknown>).errorCode as string || errorCode;
      }
    } catch { /* use default message */ }

    if (status === 401) this.tokenCache = null;

    const ERROR_MAP: Record<number, { msg: string; code: string }> = {
      401: { msg: 'Authentication required', code: 'AUTHENTICATION_REQUIRED' },
      403: { msg: 'Access denied', code: 'ACCESS_DENIED' },
      404: { msg: 'Resource not found', code: 'NOT_FOUND' },
      409: { msg: 'Version conflict', code: 'VERSION_CONFLICT' },
      422: { msg: 'Validation failed', code: 'VALIDATION_ERROR' },
      429: { msg: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' },
    };

    const mapped = ERROR_MAP[status];
    throw new ApiClientError(
      errorMessage || mapped?.msg || 'Server error',
      status,
      errorCode || mapped?.code || 'SERVER_ERROR',
      response,
      context.requestId
    );
  }

  private async parseResponseBody<T>(
    response: Response,
    context: RequestContext,
    responseType: ApiRequestConfig['responseType'] = 'auto'
  ): Promise<T> {
    const contentType = response.headers.get('content-type');

    if (responseType === 'blob') return response.blob() as Promise<T>;
    if (responseType === 'text') return (await response.text()) as T;
    if (responseType === 'json') return await response.json() as T;
    if (response.status === 204) return undefined as T;

    if (contentType?.includes('application/json')) {
      const json = await response.json();

      if (json && typeof json === 'object') {
        const keys = Object.keys(json);

        if ('success' in json && 'data' in json) {
          const apiResponse = json as ApiResponse<T>;
          if (apiResponse.success !== true) {
            throw new ContractViolationError(
              context.url, response.status, context.requestId, keys,
              '{ success: true, data: T } (success should be true for 2xx status)'
            );
          }
          return apiResponse.data as T;
        }

        logger.warn(`[API Contract] ${context.url} returned 200 but not canonical format. Keys: [${keys.join(', ')}]`);
        return json as T;
      }

      return json as T;
    }

    if (contentType?.includes('text/')) return (await response.text()) as T;

    try { return await response.json(); }
    catch { return (await response.text()) as T; }
  }

  // ===========================================================================
  // RETRY & UTILITIES
  // ===========================================================================

  private shouldRetry(error: unknown, attempt: number, maxRetries: number, retryEnabled: boolean): boolean {
    if (!retryEnabled || attempt >= maxRetries) return false;
    if (error instanceof TypeError && error.message.includes('fetch')) return true;
    if (ApiClientError.isApiClientError(error)) return error.statusCode >= 500 && error.statusCode < 600;
    return false;
  }

  private calculateBackoff(attempt: number): number {
    const baseDelay = 1000;
    const maxDelay = 10000;
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitter = delay * 0.2 * (Math.random() - 0.5);
    return Math.round(delay + jitter);
  }

  private buildUrl(url: string, params?: Record<string, string | number | boolean>): string {
    if (!params) return url;
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => searchParams.set(key, String(value)));
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${searchParams.toString()}`;
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        throw new ApiClientError(`Request timeout after ${timeout}ms`, 408, 'REQUEST_TIMEOUT');
      }
      throw error;
    }
  }

  // ===========================================================================
  // LOGGING
  // ===========================================================================

  private logRequest(context: RequestContext, attempt: number, maxRetries: number): void {
    if (process.env.NODE_ENV === 'development') {
      const retryInfo = maxRetries > 1 ? ` (attempt ${attempt}/${maxRetries})` : '';
      logger.info(`[API] ${context.method} ${context.url}${retryInfo}`);
    }
  }

  private logSuccess(context: RequestContext, status: number): void {
    if (process.env.NODE_ENV === 'development') {
      const duration = Date.now() - context.startTime;
      logger.info(`[API] ${context.method} ${context.url} - ${status} (${duration}ms)`);
    }
  }

  private logError(context: RequestContext, error: Error): void {
    const duration = Date.now() - context.startTime;
    const isClientError = error instanceof ApiClientError && error.statusCode >= 400 && error.statusCode < 500;
    const logMethod = isClientError ? 'warn' : 'error';
    logger[logMethod](
      `[API] ${context.method} ${context.url} - ${isClientError ? error.statusCode : 'Failed'} (${duration}ms)`,
      { error: error.message }
    );
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

export const apiClient = EnterpriseApiClient.getInstance();
export default apiClient;
