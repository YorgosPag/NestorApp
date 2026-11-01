/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΑ — **το έργο του ορόφου βγαίνει από το κτίριο** (ADR-829 §7.1).
 *
 * Ο handler πλέον αγνοεί το `projectId` του σώματος, άρα όλη η ευθύνη περνά στην κληρονομιά του `createEntity`. Τρέχει
 * ο πραγματικός `createEntity` πάνω στον διπλό δύο χώρων: αν κοπεί η κληρονομιά, οι όροφοι χάνουν το έργο τους σιωπηλά.
 */

/* global describe, it, expect, beforeEach, jest */

import type { AuthContext } from '@/lib/auth';
import { createEntity } from '@/lib/firestore/entity-creation.service';
import { seedTenantDocuments } from '@/app/api/buildings/__tests__/tenant-fake-firestore.fixture';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/lib/firebaseAdmin', () => {
  const { tenantFakeDb } = jest.requireActual('@/app/api/buildings/__tests__/tenant-fake-firestore.fixture');
  return { getAdminFirestore: () => tenantFakeDb(), FieldValue: { serverTimestamp: () => 'TS' } };
});
jest.mock('@/lib/auth/audit', () => ({ logAuditEvent: async () => undefined }));
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(), diffFields: () => [], diffFieldsWithResolution: async () => [] },
  resolveUserDisplayName: async () => 'Χρήστης',
}));

const AUTH = { uid: 'u_a', email: 'a@a.gr', companyId: 'co_a', globalRole: 'company_admin' } as unknown as AuthContext;

async function bornFloor(buildingId: string): Promise<Record<string, unknown>> {
  let written: Record<string, unknown> = {};
  await createEntity('floor', {
    auth: AUTH,
    parentId: buildingId,
    entitySpecificFields: { name: 'Ο1', buildingId },
    apiPath: '/api/floors (POST)',
    commit: async ({ doc }) => { written = doc; },
  });
  return written;
}

beforeEach(() => {
  seedTenantDocuments({
    buildings: {
      bld_with: { companyId: 'co_a', name: 'Με έργο', projectId: 'prj_a' },
      bld_without: { companyId: 'co_a', name: 'Χωρίς έργο', projectId: null },
    },
  });
});

describe('ADR-829 §7.1 — η κληρονομιά του έργου', () => {
  it('όροφος κτιρίου με έργο ⇒ το έργο του κτιρίου', async () => {
    expect((await bornFloor('bld_with')).projectId).toBe('prj_a');
  });

  it('όροφος κτιρίου χωρίς έργο ⇒ χωρίς έργο', async () => {
    expect((await bornFloor('bld_without')).projectId ?? null).toBeNull();
  });
});
