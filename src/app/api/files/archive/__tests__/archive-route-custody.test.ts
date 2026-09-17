/**
 * @jest-environment node
 *
 * @fileoverview 🔒 **Η ΑΓΚΥΡΑ ΤΗΣ ΚΗΔΕΜΟΝΙΑΣ ΤΗΣ ΑΡΧΕΙΟΘΕΤΗΣΗΣ** (ADR-862 Φ0 Β10).
 * @related app/api/files/archive/route.ts · app/api/files/_shared/file-ownership.ts
 *
 * 🔴 **ΤΟ ΕΥΡΗΜΑ (2026-09-17)**: η `POST /api/files/archive` έγραφε σε `files/{id}` **χωρίς κανέναν
 * έλεγχο μισθωτή** — οποιοσδήποτε συνδεδεμένος αρχειοθετούσε ή επανέφερε **ξένο** αρχείο με γνωστό id.
 *
 * ⚠️ Ο PEP (`fileResource`) **ΔΕΝ** γίνεται mock: αν κάποιος τον αφαιρέσει από τη διαδρομή, η Α21.1
 * πρέπει να κοκκινίσει. Mock μόνο τα σύνορα (Firestore · ταυτότητα · όριο ρυθμού).
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

let fake: FakeFirestore;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore => fake as unknown as AdminFirestore,
}));

jest.mock('next/server', () => {
  class MockNextResponse {
    readonly status: number;
    private readonly body: unknown;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    async json(): Promise<unknown> { return this.body; }
    static json(body: unknown, init?: { status?: number }): MockNextResponse {
      return new MockNextResponse(body, init);
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

jest.mock('@/lib/middleware/with-rate-limit', () => ({ withStandardRateLimit: <T>(h: T) => h }));

const caller = { uid: 'u_alpha', companyId: 'c_alpha', globalRole: 'company_admin', isAuthenticated: true };
jest.mock('@/lib/auth', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown) => callback(request, caller, undefined),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../route') as typeof import('../route');

const FOREIGN = 'file_foreign';
const OWN_SUPERSEDED = 'file_own_superseded';

function request(fileIds: string[], action: 'archive' | 'unarchive'): unknown {
  return { json: async () => ({ fileIds, action }) };
}

async function call(fileIds: string[], action: 'archive' | 'unarchive') {
  const response = (await POST(request(fileIds, action) as never, undefined as never)) as unknown as {
    json: () => Promise<{ processedCount: number; errors: string[] }>;
  };
  return response.json();
}

function stored(id: string): Record<string, unknown> {
  return fake.all<Record<string, unknown>>(COLLECTIONS.FILES).find((doc) => doc.id === id) ?? {};
}

beforeEach(() => {
  fake = new FakeFirestore();
  fake.seed(COLLECTIONS.FILES, FOREIGN, { id: FOREIGN, companyId: 'c_beta', lifecycleState: 'active' });
  fake.seed(COLLECTIONS.FILES, OWN_SUPERSEDED, {
    id: OWN_SUPERSEDED,
    companyId: 'c_alpha',
    lifecycleState: 'archived',
    cdeState: 'SUPERSEDED',
    cdeSupersession: { by: 'u_alpha', at: '2026-09-17T10:00:00.000Z', revision: 0, supersededByFileId: 'file_next' },
    supersededByFileId: 'file_next',
  });
});

describe('Α21 — η αρχειοθέτηση σέβεται μισθωτή και διαδοχή', () => {
  it('🔒 Α21.1 — ΞΕΝΟ αρχείο ⇒ «not found» (ίδιο με ανύπαρκτο), καμία γραφή', async () => {
    const result = await call([FOREIGN, 'file_missing'], 'archive');

    expect(result.processedCount).toBe(0);
    expect(result.errors).toEqual([`${FOREIGN}: not found`, 'file_missing: not found']);
    expect(stored(FOREIGN).lifecycleState).toBe('active');
  });

  it('🔴 Α21.2 — ΑΝΤΙΚΑΤΕΣΤΗΜΕΝΗ έκδοση δεν «ξαναγίνεται ενεργή» με επαναφορά από αρχείο', async () => {
    const result = await call([OWN_SUPERSEDED], 'unarchive');

    expect(result.processedCount).toBe(0);
    expect(result.errors).toEqual([`${OWN_SUPERSEDED}: superseded-restore-via-new-version`]);
    expect(stored(OWN_SUPERSEDED).lifecycleState).toBe('archived');
  });
});
