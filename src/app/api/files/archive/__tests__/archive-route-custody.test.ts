/**
 * @jest-environment node
 *
 * @fileoverview 🔒 **Η ΑΓΚΥΡΑ ΤΗΣ ΑΡΧΕΙΟΘΕΤΗΣΗΣ** — κηδεμονία (ADR-862 Φ0 Β10) + κλάση Ο-35 (ADR-845 §7.17 Α3).
 * @related app/api/files/archive/route.ts · services/file-record/file-archive.service.ts ·
 *   app/api/files/_shared/file-batch-act.ts
 *
 * 🔴 **ΤΑ ΕΥΡΗΜΑΤΑ ΠΟΥ ΦΥΛΑΕΙ**:
 * - *(2026-09-17)* η διαδρομή έγραφε σε `files/{id}` **χωρίς έλεγχο μισθωτή**·
 * - *(2026-10-08)* φωτογραφία που αρχειοθετήθηκε **έμενε** στη δημόσια αγγελία, το ίχνος γραφόταν
 *   **χωρίς `companyId`** *(αόρατο)*, και το δικαίωμα δημοσίευσης παρακαμπτόταν.
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

// 🔒 Α21.9 — η βαθμίδα είναι μέρος του συμβολαίου: μόνο η `Sensitive` υπάρχει στο mock, άρα
//    επιστροφή στη `Standard` ρίχνει το module στη φόρτωση.
jest.mock('@/lib/middleware/with-rate-limit', () => ({ withSensitiveRateLimit: <T>(h: T) => h }));

const PUBLISHER = 'listings:listings:publish';
const caller: { uid: string; companyId: string; globalRole: string; permissions: string[]; isAuthenticated: boolean } =
  { uid: 'u_alpha', companyId: 'c_alpha', globalRole: 'external_user', permissions: [], isAuthenticated: true };

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
const FOREIGN = 'file_foreign';
const OWN_SUPERSEDED = 'file_own_superseded';
const DOC = 'file_doc';
const PUBLIC_PHOTO = 'file_public_photo';
const PUBLIC_PHOTO_B = 'file_public_photo_b';

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
  fake.seed(COLLECTIONS.FILES, id, {
    id, companyId: 'c_alpha', status: 'ready', lifecycleState: 'active', classification: 'internal', ...extra,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  caller.permissions = [];
  fake = new FakeFirestore();
  fake.seed(COLLECTIONS.PROPERTIES, PROPERTY, { companyId: 'c_alpha', status: 'active' });
  fake.seed(COLLECTIONS.FILES, FOREIGN, { id: FOREIGN, companyId: 'c_beta', lifecycleState: 'active' });
  seedFile(OWN_SUPERSEDED, {
    lifecycleState: 'archived',
    cdeState: 'SUPERSEDED',
    cdeSupersession: { by: 'u_alpha', at: '2026-09-17T10:00:00.000Z', revision: 0, supersededByFileId: 'file_next' },
    supersededByFileId: 'file_next',
  });
  seedFile(DOC, { entityType: 'contact', entityId: 'cont_1' });
  seedFile(PUBLIC_PHOTO, { entityType: 'property', entityId: PROPERTY, category: 'photos', classification: 'public' });
  seedFile(PUBLIC_PHOTO_B, { entityType: 'property', entityId: PROPERTY, category: 'photos', classification: 'public' });
});

describe('Α21 — η αρχειοθέτηση σέβεται μισθωτή και διαδοχή', () => {
  it('🔒 Α21.1 — ΞΕΝΟ αρχείο ⇒ «not found» (ίδιο με ανύπαρκτο), καμία γραφή', async () => {
    const { body } = await call({ fileIds: [FOREIGN, 'file_missing'], action: 'archive' });

    expect(body.processedCount).toBe(0);
    expect(body.errors).toEqual([`${FOREIGN}: not found`, 'file_missing: not found']);
    expect(stored(FOREIGN).lifecycleState).toBe('active');
  });

  it('🔴 Α21.2 — ΑΝΤΙΚΑΤΕΣΤΗΜΕΝΗ έκδοση δεν «ξαναγίνεται ενεργή» με επαναφορά από αρχείο', async () => {
    const { body } = await call({ fileIds: [OWN_SUPERSEDED], action: 'unarchive' });

    expect(body.processedCount).toBe(0);
    expect(body.errors).toEqual([`${OWN_SUPERSEDED}: superseded-restore-via-new-version`]);
    expect(stored(OWN_SUPERSEDED).lifecycleState).toBe('archived');
  });
});

describe('ADR-845 §7.17 Α3 — η αρχειοθέτηση γράφεται, καταγράφεται ΚΑΙ ξαναπροβάλλει στο ίδιο αίτημα', () => {
  it('🏆 Α21.3 — αρχειοθέτηση και επαναφορά: τα πεδία της γραφής, και `archive` ως προεπιλογή', async () => {
    const archived = await call({ fileIds: [DOC] });

    expect(archived.body).toMatchObject({ success: true, processedCount: 1, errors: [], listings: [] });
    expect(stored(DOC)).toMatchObject({ lifecycleState: 'archived', archivedBy: 'u_alpha' });
    expect(typeof stored(DOC).archivedAt).toBe('string');

    const restored = await call({ fileIds: [DOC], action: 'unarchive' });

    expect(restored.body.processedCount).toBe(1);
    expect(stored(DOC)).toMatchObject({ lifecycleState: 'active', archivedAt: null, archivedBy: null });
  });

  it('🧾 Α21.4 — ΙΧΝΟΣ με τον κάτοχο του βιβλίου (`companyId`) — χωρίς αυτό η γραμμή δεν διαβάζεται', async () => {
    await call({ fileIds: [DOC], action: 'archive' });

    expect(auditRows()).toHaveLength(1);
    expect(auditRows()[0]).toMatchObject({
      fileId: DOC, action: 'archive', performedBy: 'u_alpha', companyId: 'c_alpha',
      metadata: { archiveAction: 'archive' },
    });
  });

  it('🌍 Α21.5 — δημόσιες φωτογραφίες του ΙΔΙΟΥ ακινήτου ⇒ ΜΙΑ επαναπροβολή, ΜΕΤΑ τη γραφή', async () => {
    caller.permissions = [PUBLISHER];
    let seenAtRepublish: unknown = 'δεν κλήθηκε';
    republishListing.mockImplementationOnce(async () => {
      seenAtRepublish = stored(PUBLIC_PHOTO).lifecycleState;
      return 'published';
    });

    const { body } = await call({ fileIds: [PUBLIC_PHOTO, PUBLIC_PHOTO_B], action: 'archive' });

    expect(body.processedCount).toBe(2);
    expect(body.listings).toEqual([{ propertyId: PROPERTY, outcome: 'published' }]);
    expect(republishListing).toHaveBeenCalledTimes(1);
    expect(seenAtRepublish).toBe('archived');
  });

  it('🔴 Α21.6 — ΔΗΜΟΣΙΟ αρχείο χωρίς δικαίωμα δημοσίευσης: ΟΥΤΕ αρχειοθέτηση ΟΥΤΕ επαναφορά', async () => {
    seedFile('file_public_archived', {
      entityType: 'property', entityId: PROPERTY, classification: 'public', lifecycleState: 'archived',
    });

    const archive = await call({ fileIds: [PUBLIC_PHOTO], action: 'archive' });
    const unarchive = await call({ fileIds: ['file_public_archived'], action: 'unarchive' });

    expect(archive.body.errors).toEqual([`${PUBLIC_PHOTO}: not-capable`]);
    expect(unarchive.body.errors).toEqual(['file_public_archived: not-capable']);
    expect(stored(PUBLIC_PHOTO).lifecycleState).toBe('active');
    expect(stored('file_public_archived').lifecycleState).toBe('archived');
    expect(auditRows()).toEqual([]);
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('Α21.7 — ΙΔΕΜΠΟΤΗΤΑ: ήδη στη ζητούμενη κατάσταση ⇒ καμία γραφή, κανένα ίχνος, καμία επαναπροβολή', async () => {
    caller.permissions = [PUBLISHER];
    seedFile('file_archived', { entityType: 'property', entityId: PROPERTY, lifecycleState: 'archived', archivedBy: 'u_first' });

    const again = await call({ fileIds: ['file_archived'], action: 'archive' });
    const notArchived = await call({ fileIds: [PUBLIC_PHOTO], action: 'unarchive' });

    expect(again.body).toMatchObject({ success: true, processedCount: 0, errors: [] });
    expect(notArchived.body).toMatchObject({ success: true, processedCount: 0, errors: [] });
    expect(stored('file_archived').archivedBy).toBe('u_first');
    expect(auditRows()).toEqual([]);
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('🗑️ Α21.8 — αρχείο του ΚΑΔΟΥ δεν αρχειοθετείται: ο κάδος έχει τη δική του «Επαναφορά»', async () => {
    seedFile('file_trashed', { lifecycleState: 'trashed', isDeleted: true, purgeAt: '2026-01-01T00:00:00.000Z' });

    const { body } = await call({ fileIds: ['file_trashed'], action: 'archive' });

    expect(body.errors).toEqual(['file_trashed: in-trash']);
    expect(stored('file_trashed')).toMatchObject({ lifecycleState: 'trashed', isDeleted: true });
  });

  it('Α21.9 — άκυρο σώμα ⇒ 400 με όνομα, καμία γραφή', async () => {
    const bad = await call({ fileIds: [DOC], action: 'purge' });
    const empty = await call({ fileIds: [], action: 'archive' });

    expect(bad.status).toBe(400);
    expect(bad.body.errors).toEqual(['action is invalid']);
    expect(empty.status).toBe(400);
    expect(stored(DOC).lifecycleState).toBe('active');
  });
});
