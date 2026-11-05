/**
 * @jest-environment node
 *
 * ADR-929 Δ15 #1 — ο αναγνώστης και ο γραφέας της επεξεργασίας AI ανά εταιρεία, πάνω στο επαληθευμένο ψεύτικο
 * Firestore και στο **πραγματικό** μητρώο εκδόσεων της πολιτικής απορρήτου.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  privacyPolicyClausesInForce,
  readAiPurposeStatus,
  resolveAiPurposeStatus,
  setCompanyAiPurpose,
} from '../company-ai-processing.server';

const fake = new FakeFirestore();
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: (): Firestore => fake as unknown as Firestore }));

const recordChange = jest.fn(async () => 'audit_1');
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: (...a: unknown[]) => recordChange(...(a as [])) } }));

const COMPANY = 'comp_a';
const ADMIN = { uid: 'u_admin', displayName: null };
const DISCLOSED = () => ['aiPlanReading'];
const NOW = new Date('2026-11-04T10:00:00.000Z');

const stored = () => (fake.all<Record<string, unknown>>(COLLECTIONS.COMPANIES)[0].settings as { aiProcessing?: Record<string, unknown> }).aiProcessing;

beforeEach(() => {
  fake.seedCollection(COLLECTIONS.COMPANIES, {});
  fake.seed(COLLECTIONS.COMPANIES, COMPANY, { name: 'A', settings: { defaultLocale: 'el' } });
  recordChange.mockClear();
});

describe('resolveAiPurposeStatus', () => {
  it('never decided ⇒ the platform default (on), said as such', () => {
    expect(resolveAiPurposeStatus({}, 'plan-reading', ['aiPlanReading'])).toEqual({
      purpose: 'plan-reading', state: 'enabled', source: 'platform-default', decision: null, legal: 'disclosed', effective: true,
    });
  });

  it('on, but the clause is not in the policy in force ⇒ pending and not effective', () => {
    expect(resolveAiPurposeStatus({}, 'plan-reading', ['dataSharing'])).toMatchObject({ state: 'enabled', legal: 'pending', effective: false });
  });

  it('the company closed it ⇒ not effective even with the clause in force', () => {
    const settings = { 'plan-reading': { state: 'disabled' as const, decidedBy: 'u', decidedAt: NOW.toISOString() } };
    expect(resolveAiPurposeStatus(settings, 'plan-reading', ['aiPlanReading'])).toMatchObject({ state: 'disabled', source: 'company', effective: false });
  });
});

describe('privacyPolicyClausesInForce (real legal registry)', () => {
  it('privacy policy v1, in force on 2026-11-04, does not disclose plan reading', () => {
    expect(privacyPolicyClausesInForce('2026-11-04')).not.toContain('aiPlanReading');
  });

  it('before any version is in force there are no clauses at all', () => {
    expect(privacyPolicyClausesInForce('2000-01-01')).toEqual([]);
  });
});

describe('readAiPurposeStatus', () => {
  it('a missing company document reads as never decided', async () => {
    expect(await readAiPurposeStatus('comp_none', 'plan-reading', DISCLOSED, NOW)).toMatchObject({ source: 'platform-default', effective: true });
  });

  it('a malformed stored decision is ignored, not trusted', async () => {
    fake.seed(COLLECTIONS.COMPANIES, COMPANY, { settings: { aiProcessing: { 'plan-reading': { state: 'maybe' } } } });
    expect(await readAiPurposeStatus(COMPANY, 'plan-reading', DISCLOSED, NOW)).toMatchObject({ source: 'platform-default' });
  });
});

describe('setCompanyAiPurpose', () => {
  it('writes the decision with who and when, and audits the real before/after', async () => {
    expect(await setCompanyAiPurpose(COMPANY, 'plan-reading', 'disabled', ADMIN, NOW)).toEqual({ changed: true });
    expect(stored()).toEqual({ 'plan-reading': { state: 'disabled', decidedBy: 'u_admin', decidedAt: NOW.toISOString() } });
    expect(recordChange).toHaveBeenCalledTimes(1);
    expect(recordChange).toHaveBeenCalledWith(expect.objectContaining({
      entityId: COMPANY, companyId: COMPANY, performedBy: 'u_admin',
      changes: [expect.objectContaining({ field: 'settings.aiProcessing.plan-reading', oldValue: null, newValue: 'disabled' })],
    }));
    expect(await readAiPurposeStatus(COMPANY, 'plan-reading', DISCLOSED, NOW)).toMatchObject({ state: 'disabled', source: 'company', effective: false });
  });

  it('a later change audits the previous decision, not the default', async () => {
    await setCompanyAiPurpose(COMPANY, 'plan-reading', 'disabled', ADMIN, NOW);
    recordChange.mockClear();
    await setCompanyAiPurpose(COMPANY, 'plan-reading', 'enabled', ADMIN, NOW);
    expect(recordChange).toHaveBeenCalledWith(expect.objectContaining({
      changes: [expect.objectContaining({ oldValue: 'disabled', newValue: 'enabled' })],
    }));
  });

  it('is idempotent: the same state again writes nothing and audits nothing', async () => {
    await setCompanyAiPurpose(COMPANY, 'plan-reading', 'disabled', ADMIN, NOW);
    recordChange.mockClear();
    expect(await setCompanyAiPurpose(COMPANY, 'plan-reading', 'disabled', ADMIN, new Date('2026-11-05T00:00:00Z'))).toEqual({ changed: false });
    expect(recordChange).not.toHaveBeenCalled();
    expect(stored()).toMatchObject({ 'plan-reading': { decidedAt: NOW.toISOString() } });
  });

  it('confirming the platform default is still a decision (it records who chose it)', async () => {
    expect(await setCompanyAiPurpose(COMPANY, 'plan-reading', 'enabled', ADMIN, NOW)).toEqual({ changed: true });
    expect(recordChange).toHaveBeenCalledWith(expect.objectContaining({
      changes: [expect.objectContaining({ oldValue: null, newValue: 'enabled' })],
    }));
  });

  it('refuses a company that does not exist, and writes nothing', async () => {
    await expect(setCompanyAiPurpose('comp_none', 'plan-reading', 'disabled', ADMIN, NOW)).rejects.toThrow('company not found');
    expect(recordChange).not.toHaveBeenCalled();
  });
});
