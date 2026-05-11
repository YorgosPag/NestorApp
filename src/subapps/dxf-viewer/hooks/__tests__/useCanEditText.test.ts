/**
 * ADR-344 Phase 5.B — role → capability matrix tests.
 * Tests the pure function — React context not required.
 */

import { describe, it, expect } from '@jest/globals';
import { capabilitiesForRole } from '../text-edit-capabilities';

describe('capabilitiesForRole — ADR-344 Q8 role matrix', () => {
  it.each(['super_admin', 'admin', 'company_admin'])(
    '%s gets full caps including layer.unlock',
    (role) => {
      const caps = capabilitiesForRole(role);
      expect(caps.canCreate).toBe(true);
      expect(caps.canEdit).toBe(true);
      expect(caps.canDelete).toBe(true);
      expect(caps.canUnlockLayer).toBe(true);
      expect(caps.denyReason).toBeNull();
    },
  );

  it.each(['architect', 'engineer', 'project_manager'])(
    '%s gets create+edit+delete but NOT layer.unlock',
    (role) => {
      const caps = capabilitiesForRole(role);
      expect(caps.canCreate).toBe(true);
      expect(caps.canEdit).toBe(true);
      expect(caps.canDelete).toBe(true);
      expect(caps.canUnlockLayer).toBe(false);
      expect(caps.denyReason).toBeNull();
    },
  );

  it.each(['site_manager', 'foreman'])(
    '%s gets create+edit only — delete is server-enforced own-only',
    (role) => {
      const caps = capabilitiesForRole(role);
      expect(caps.canCreate).toBe(true);
      expect(caps.canEdit).toBe(true);
      expect(caps.canDelete).toBe(false);
      expect(caps.canUnlockLayer).toBe(false);
    },
  );

  it.each([
    'accountant',
    'sales_agent',
    'data_entry',
    'vendor',
    'viewer',
    'client',
  ])('%s gets no caps', (role) => {
    const caps = capabilitiesForRole(role);
    expect(caps.canCreate).toBe(false);
    expect(caps.canEdit).toBe(false);
    expect(caps.canDelete).toBe(false);
    expect(caps.canUnlockLayer).toBe(false);
    expect(caps.denyReason).toBe('textToolbar:denyReason.insufficientRole');
  });

  it.each([null, undefined, ''])('unauthenticated (%s) returns notAuthenticated reason', (role) => {
    const caps = capabilitiesForRole(role);
    expect(caps.canCreate).toBe(false);
    expect(caps.denyReason).toBe('textToolbar:denyReason.notAuthenticated');
  });

  it('unknown role defaults to NONE', () => {
    const caps = capabilitiesForRole('mystery_role');
    expect(caps.canCreate).toBe(false);
    expect(caps.denyReason).toBe('textToolbar:denyReason.insufficientRole');
  });
});
