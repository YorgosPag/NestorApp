/**
 * @jest-environment node
 *
 * @fileoverview 🔒 **Η ΔΙΑΒΑΘΜΙΣΗ ΩΣ ΠΡΑΞΗ ΔΙΑΚΟΜΙΣΤΗ** — ADR-845 §7.17 (κλάση Ο-35).
 * @related app/api/files/classification/route.ts · services/file-record/file-classification.service.ts
 *
 * 🔴 **ΤΟ ΓΕΓΟΝΟΣ (μετρημένο ζωντανά 2026-10-08)**: φωτογραφία που έγινε `internal` έμεινε στο
 * `public_listings.gallery`, γιατί η διαβάθμιση γραφόταν από τον browser και **κανείς** δεν
 * ξαναπρόβαλλε την αγγελία. Χωρίς ρόλο, χωρίς ίχνος.
 *
 * ⚠️ Ο PEP (`fileResource`), ο γραφέας και ο κριτής ικανότητας **ΔΕΝ** γίνονται mock: αν κάποιος
 * αφαιρέσει έναν από τους τρεις, αυτές οι άγκυρες πρέπει να κοκκινίσουν. Mock μόνο τα σύνορα
 * (Firestore · ταυτότητα · όριο ρυθμού) και ο **ΕΝΑΣ** γραφέας της αγγελίας, που έχει δικές του άγκυρες.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

jest.mock('server-only', () => ({}));

let fake: FakeFirestore;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore => fake as unknown as AdminFirestore,
  FieldValue: { serverTimestamp: (): string => 'SERVER_TIME' },
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

jest.mock('@/lib/middleware/with-rate-limit', () => ({ withSensitiveRateLimit: <T>(h: T) => h }));

const PUBLISHER = ['listings:listings:publish'];
const caller: { uid: string; companyId: string; globalRole: string; permissions: string[]; isAuthenticated: boolean } =
  { uid: 'u_alpha', companyId: 'c_alpha', globalRole: 'external_user', permissions: PUBLISHER, isAuthenticated: true };

jest.mock('@/lib/auth', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown) => callback(request, caller, undefined),
}));

const republishListing = jest.fn(async (..._args: unknown[]): Promise<string> => 'published');
jest.mock('@/services/listings/publish-public-listing', () => ({
  republishListing: (...args: unknown[]) => republishListing(...args),
  reportProjectionFailure: (): string => 'failed',
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../route') as typeof import('../route');

const PROPERTY = 'prop_95';
const PHOTO_A = 'file_photo_a';
const PHOTO_B = 'file_photo_b';
const CONTRACT = 'file_contract';
const FOREIGN = 'file_foreign';

interface Wire {
  success: boolean;
  processedCount: number;
  errors: string[];
  listings: { propertyId: string; outcome: string }[];
}

async function call(body: unknown): Promise<{ status: number; body: Wire }> {
  const response = (await POST({ json: async () => body } as never, undefined as never)) as unknown as {
    status: number;
    json: () => Promise<Wire>;
  };
  return { status: response.status, body: await response.json() };
}

function stored(id: string): Record<string, unknown> {
  return fake.all<Record<string, unknown>>(COLLECTIONS.FILES).find((doc) => doc.id === id) ?? {};
}

function auditRows(): Record<string, unknown>[] {
  return fake.all<Record<string, unknown>>(COLLECTIONS.FILE_AUDIT_LOG);
}

function seedFile(id: string, extra: Record<string, unknown>): void {
  fake.seed(COLLECTIONS.FILES, id, { id, companyId: 'c_alpha', status: 'ready', ...extra });
}

beforeEach(() => {
  jest.clearAllMocks();
  caller.permissions = PUBLISHER;
  fake = new FakeFirestore();
  fake.seed(COLLECTIONS.PROPERTIES, PROPERTY, { companyId: 'c_alpha', commercialStatus: 'for-sale' });
  seedFile(PHOTO_A, { entityType: 'property', entityId: PROPERTY, category: 'photos', classification: 'public' });
  seedFile(PHOTO_B, { entityType: 'property', entityId: PROPERTY, category: 'photos', classification: 'public' });
  seedFile(CONTRACT, { entityType: 'contact', entityId: 'cont_1', category: 'documents', classification: 'internal' });
  fake.seed(COLLECTIONS.FILES, FOREIGN, {
    id: FOREIGN, companyId: 'c_beta', entityType: 'property', entityId: 'prop_beta', classification: 'public',
  });
});

describe('ADR-845 §7.17 — η διαβάθμιση γράφεται ΚΑΙ ξαναπροβάλλει στο ίδιο αίτημα', () => {
  it('🏆 Τ1 — ΑΠΟΣΥΡΣΗ: `public → internal` γράφεται και η αγγελία ξαναπροβάλλεται', async () => {
    const { body } = await call({ fileIds: [PHOTO_A], classification: 'internal' });

    expect(body).toEqual({
      success: true, processedCount: 1, errors: [], listings: [{ propertyId: PROPERTY, outcome: 'published' }],
    });
    expect(stored(PHOTO_A).classification).toBe('internal');
    expect(republishListing).toHaveBeenCalledTimes(1);
  });

  it('🔑 Τ2 — δέσμη του ΙΔΙΟΥ ακινήτου ⇒ ΜΙΑ επαναπροβολή, όχι μία ανά αρχείο', async () => {
    const { body } = await call({ fileIds: [PHOTO_A, PHOTO_B], classification: 'internal' });

    expect(body.processedCount).toBe(2);
    expect(republishListing).toHaveBeenCalledTimes(1);
  });

  it('🔑 Τ3 — η επαναπροβολή τρέχει ΜΕΤΑ τη γραφή (βλέπει τον κόσμο όπως έμεινε)', async () => {
    let seenAtRepublish: unknown = 'δεν κλήθηκε';
    republishListing.mockImplementationOnce(async () => {
      seenAtRepublish = stored(PHOTO_A).classification;
      return 'published';
    });

    await call({ fileIds: [PHOTO_A], classification: 'internal' });

    expect(seenAtRepublish).toBe('internal');
  });

  it('Τ4 — αρχείο που ΔΕΝ είναι ακινήτου γράφεται, αλλά καμία αγγελία δεν αφορά', async () => {
    const { body } = await call({ fileIds: [CONTRACT], classification: 'confidential' });

    expect(body.processedCount).toBe(1);
    expect(body.listings).toEqual([]);
    expect(stored(CONTRACT).classification).toBe('confidential');
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('Τ5 — ΙΔΕΜΠΟΤΗΤΑ: ίδια τιμή ⇒ καμία γραφή, κανένα ίχνος, καμία επαναπροβολή', async () => {
    const { body } = await call({ fileIds: [PHOTO_A], classification: 'public' });

    expect(body).toEqual({ success: true, processedCount: 0, errors: [], listings: [] });
    expect(auditRows()).toEqual([]);
    expect(republishListing).not.toHaveBeenCalled();
  });
});

describe('ADR-845 §7.17 — ποιος επιτρέπεται, και τι μένει πίσω', () => {
  it('🔒 Τ6 — ΞΕΝΟ αρχείο ⇒ «not found» (ίδιο με ανύπαρκτο), καμία γραφή', async () => {
    const { body } = await call({ fileIds: [FOREIGN, 'file_missing'], classification: 'internal' });

    expect(body.processedCount).toBe(0);
    expect(body.errors).toEqual([`${FOREIGN}: not found`, 'file_missing: not found']);
    expect(stored(FOREIGN).classification).toBe('public');
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('🔴 Τ7 — χωρίς δικαίωμα δημοσίευσης: ΟΥΤΕ δημοσίευση ΟΥΤΕ απόσυρση', async () => {
    caller.permissions = [];
    seedFile('file_draft', { entityType: 'property', entityId: PROPERTY, category: 'photos', classification: 'internal' });

    const { body } = await call({ fileIds: ['file_draft', PHOTO_A], classification: 'public' });
    const withdraw = await call({ fileIds: [PHOTO_A], classification: 'internal' });

    expect(body.errors).toEqual(['file_draft: not-capable']);
    expect(stored('file_draft').classification).toBe('internal');
    expect(withdraw.body.errors).toEqual([`${PHOTO_A}: not-capable`]);
    expect(stored(PHOTO_A).classification).toBe('public');
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('Τ8 — χωρίς το δικαίωμα, `internal ⇄ confidential` μένει ανοιχτό (δεν αγγίζει το κοινό)', async () => {
    caller.permissions = [];

    const { body } = await call({ fileIds: [CONTRACT], classification: 'confidential' });

    expect(body.errors).toEqual([]);
    expect(stored(CONTRACT).classification).toBe('confidential');
  });

  it('🧾 Τ9 — ΙΧΝΟΣ: ποιος, τι, από πού προς πού — με τον κάτοχο του βιβλίου', async () => {
    await call({ fileIds: [PHOTO_A], classification: 'internal' });

    expect(auditRows()).toHaveLength(1);
    expect(auditRows()[0]).toMatchObject({
      fileId: PHOTO_A,
      action: 'classify',
      performedBy: 'u_alpha',
      companyId: 'c_alpha',
      metadata: { from: 'public', to: 'internal' },
    });
  });

  it('Τ10 — άκυρο σώμα ⇒ 400 με όνομα, καμία γραφή', async () => {
    const bad = await call({ fileIds: [PHOTO_A], classification: 'secret' });
    const empty = await call({ fileIds: [], classification: 'internal' });

    expect(bad.status).toBe(400);
    expect(bad.body.errors).toEqual(['classification is invalid']);
    expect(empty.status).toBe(400);
    expect(stored(PHOTO_A).classification).toBe('public');
  });
});
