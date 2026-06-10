/**
 * Unit tests — accountingDocId SSoT convention (ADR-439 Phase 2c).
 *
 * @enterprise ADR-439 — Tenant Identity SSoT & Provisioning — Phase 2c
 */

import { accountingDocId, type AccountingSingletonType } from '../accounting-doc-ids';

const COMPANY_ID = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';

describe('accountingDocId — per-tenant composite doc-id convention', () => {
  it('joins companyId and type with the `__` separator', () => {
    expect(accountingDocId(COMPANY_ID, 'partners')).toBe(`${COMPANY_ID}__partners`);
    expect(accountingDocId(COMPANY_ID, 'matching_config')).toBe(`${COMPANY_ID}__matching_config`);
  });

  it('produces a distinct id per singleton type (no collisions)', () => {
    const types: AccountingSingletonType[] = [
      'partners',
      'members',
      'shareholders',
      'service_presets',
      'matching_config',
    ];
    const ids = types.map((t) => accountingDocId(COMPANY_ID, t));
    expect(new Set(ids).size).toBe(types.length);
  });

  it('never collides with the bare profile doc id ({companyId})', () => {
    expect(accountingDocId(COMPANY_ID, 'partners')).not.toBe(COMPANY_ID);
  });
});
