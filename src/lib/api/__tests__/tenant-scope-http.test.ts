/**
 * Tenant scope at the HTTP boundary (ADR-702).
 *
 * The doctrine itself is tested in `lib/auth/__tests__/tenant-scope.test.ts`.
 * These cases cover the translation layer: that a missing company is a 400 and
 * a forbidden one is a 403 — two different failures that a single "bad request"
 * would blur, and that the refusal envelope does not leak whether the other
 * company exists.
 */

// `next/server` needs Web `Request`/`Response` globals that jsdom does not
// provide. Same double as define-route.test.ts — the helpers only ever use
// `NextResponse.json`.
jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => body };
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

import {
  requireTenantScopeFromQuery,
  requireTenantScopeFromBody,
  tenantIsolationResponse,
} from '../tenant-scope-http';
import { ApiError } from '../api-error-types';
import { TenantIsolationError } from '@/lib/auth/tenant-isolation-error';
import type { AuthContext, GlobalRole } from '@/lib/auth/types';
import type { NextRequest } from 'next/server';

const OWN_COMPANY = 'comp_own_001';
const OTHER_COMPANY = 'comp_other_999';

function makeCtx(globalRole: string, companyId = OWN_COMPANY): AuthContext {
  return {
    uid: 'user_1',
    email: 'user@example.com',
    companyId,
    globalRole: globalRole as GlobalRole,
    mfaEnrolled: false,
    isAuthenticated: true,
  };
}

/** Minimal stand-in: the helper only ever touches `nextUrl.searchParams`. */
function makeRequest(query: string): NextRequest {
  return { nextUrl: new URL(`https://app.example/api/admin/x${query}`) } as unknown as NextRequest;
}

describe('requireTenantScopeFromQuery', () => {
  it('returns the scope when a bypass role names another company', () => {
    const scope = requireTenantScopeFromQuery(makeRequest(`?companyId=${OTHER_COMPANY}`), makeCtx('super_admin'));

    expect(scope.companyId).toBe(OTHER_COMPANY);
    expect(scope.isCrossTenant).toBe(true);
  });

  it('is a 400 — not a 403 — when no company is named at all', () => {
    try {
      requireTenantScopeFromQuery(makeRequest(''), makeCtx('super_admin'));
      throw new Error('expected a refusal');
    } catch (error) {
      expect(ApiError.isApiError(error)).toBe(true);
      expect((error as ApiError).statusCode).toBe(400);
    }
  });

  it('treats an empty value as absent', () => {
    expect(() => requireTenantScopeFromQuery(makeRequest('?companyId='), makeCtx('super_admin')))
      .toThrow(ApiError);
  });

  it('refuses a non-bypass caller naming someone else with 403', () => {
    try {
      requireTenantScopeFromQuery(makeRequest(`?companyId=${OTHER_COMPANY}`), makeCtx('company_admin'));
      throw new Error('expected a refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(TenantIsolationError);
      expect((error as TenantIsolationError).status).toBe(403);
    }
  });

  it('lets a non-bypass caller name its own company', () => {
    const scope = requireTenantScopeFromQuery(makeRequest(`?companyId=${OWN_COMPANY}`), makeCtx('company_admin'));

    expect(scope.companyId).toBe(OWN_COMPANY);
  });
});

describe('requireTenantScopeFromBody', () => {
  it('applies the identical rule to a body-sourced company', () => {
    expect(() => requireTenantScopeFromBody({ companyId: OTHER_COMPANY }, makeCtx('company_admin')))
      .toThrow(TenantIsolationError);

    expect(requireTenantScopeFromBody({ companyId: OTHER_COMPANY }, makeCtx('super_admin')).companyId)
      .toBe(OTHER_COMPANY);
  });

  it('is a 400 when the body names nothing', () => {
    expect(() => requireTenantScopeFromBody({}, makeCtx('super_admin'))).toThrow(ApiError);
  });
});

describe('tenantIsolationResponse', () => {
  it('answers 404 with the caller-supplied noun', async () => {
    const response = tenantIsolationResponse(
      new TenantIsolationError('building bld_1 not found', 404, 'NOT_FOUND'),
      'Building not found',
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Building not found',
      details: 'building bld_1 not found',
    });
  });

  it('answers 403 with "Access denied", never the not-found noun', async () => {
    const response = tenantIsolationResponse(
      new TenantIsolationError('building belongs to another company', 403, 'FORBIDDEN'),
      'Building not found',
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: 'Access denied' });
  });
});

describe('asApiError — shared classification (ApiErrorHandler ↔ defineRoute)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { asApiError } = require('../api-error-types') as typeof import('../api-error-types');

  it('passes an ApiError through untouched', () => {
    const original = new ApiError(409, 'conflict');

    expect(asApiError(original)).toBe(original);
  });

  it('maps a tenant refusal onto its decided status, not a 500', () => {
    const mapped = asApiError(new TenantIsolationError('nope', 403, 'FORBIDDEN'));

    expect(mapped?.statusCode).toBe(403);
    expect(mapped?.errorCode).toBe('FORBIDDEN');
  });

  it('preserves 404 for a missing parent', () => {
    expect(asApiError(new TenantIsolationError('gone', 404, 'NOT_FOUND'))?.statusCode).toBe(404);
  });

  it('leaves genuinely unknown failures unclassified, so they still log as 500s', () => {
    expect(asApiError(new Error('database on fire'))).toBeNull();
    expect(asApiError('a string')).toBeNull();
  });
});
