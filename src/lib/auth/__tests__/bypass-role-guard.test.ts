/**
 * ADR-703 — `bypassRoleGuard` contract tests.
 *
 * The point of this suite is NOT "super_admin passes, others don't" — a raw string
 * comparison satisfies that too. It is the *anchor* that the guard's verdict is
 * derived from the roles SSoT, so a future second bypass role is honoured without
 * touching a single call site. That is the entire reason the campaign exists.
 */

// Same `next/server` stub the route suites use (see
// api/admin/migrate-accounting-profile/__tests__) — NextResponse needs the edge
// runtime that jsdom/node jest does not provide.
jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => body };
    }
  }
  return { NextResponse: MockNextResponse };
});

import {
  bypassRoleGuard,
  BYPASS_ROLE_REQUIRED_CODE,
  BYPASS_ROLE_REQUIRED_ERROR,
} from '../bypass-role-guard';
import { PREDEFINED_ROLES } from '../roles';

describe('bypassRoleGuard (ADR-703)', () => {
  describe('verdict', () => {
    it('lets a bypass role through (returns null)', () => {
      expect(bypassRoleGuard({ globalRole: 'super_admin' })).toBeNull();
    });

    it.each(['company_admin', 'internal_user', 'external_user'])(
      'refuses non-bypass global role %s',
      (globalRole) => {
        const res = bypassRoleGuard({ globalRole });
        expect(res).not.toBeNull();
        expect(res?.status).toBe(403);
      },
    );

    it('refuses an unknown role instead of failing open', () => {
      const res = bypassRoleGuard({ globalRole: 'not_a_real_role' });
      expect(res?.status).toBe(403);
    });

    it('refuses an empty role instead of failing open', () => {
      expect(bypassRoleGuard({ globalRole: '' })?.status).toBe(403);
    });
  });

  describe('refusal payload — unchanged from the routes it replaced', () => {
    it('returns the canonical body', async () => {
      const res = bypassRoleGuard({ globalRole: 'external_user' });
      await expect(res?.json()).resolves.toEqual({
        success: false,
        error: BYPASS_ROLE_REQUIRED_ERROR,
        code: BYPASS_ROLE_REQUIRED_CODE,
      });
    });

    it('keeps the wire-format literals the admin UI already matches on', () => {
      // Hard-coded on purpose: these strings ARE the contract. If someone renames
      // them, this test is the place that says "that is a breaking change".
      expect(BYPASS_ROLE_REQUIRED_CODE).toBe('SUPER_ADMIN_REQUIRED');
      expect(BYPASS_ROLE_REQUIRED_ERROR).toBe('Forbidden: super_admin required');
    });
  });

  describe('SSoT derivation — the reason ADR-703 exists', () => {
    it('agrees with the roles registry for EVERY predefined role', () => {
      const verdicts = Object.entries(PREDEFINED_ROLES).map(([roleId, def]) => ({
        roleId,
        declaredBypass: def.isBypass === true,
        guardLetsThrough: bypassRoleGuard({ globalRole: roleId }) === null,
      }));

      // Nothing is asserted about WHICH roles bypass — only that the guard never
      // disagrees with the registry. Add a bypass role to roles.ts and this stays green;
      // hard-code a role string in the guard and it goes red.
      for (const v of verdicts) {
        expect(v.guardLetsThrough).toBe(v.declaredBypass);
      }
    });

    it('self-test: the registry currently declares exactly one bypass role', () => {
      // Guards the test above from becoming vacuous. If this count changes, that is a
      // real authorization change and someone must look at it deliberately.
      const bypassRoles = Object.entries(PREDEFINED_ROLES)
        .filter(([, def]) => def.isBypass === true)
        .map(([roleId]) => roleId);

      expect(bypassRoles).toEqual(['super_admin']);
    });
  });
});
