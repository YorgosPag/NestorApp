/**
 * @jest-environment node
 *
 * @fileoverview 🗑️ **Ο ΚΑΔΟΣ ΤΩΝ ΕΤΑΙΡΙΚΩΝ ΑΡΧΕΙΩΝ ΩΣ ΠΡΑΞΗ ΔΙΑΚΟΜΙΣΤΗ** — ADR-845 §7.17 Α2 (κλάση Ο-35).
 * @related app/api/files/trash/route.ts · services/file-record/file-trash.service.ts
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: ο κάδος γραφόταν από τον browser — η δημόσια αγγελία δεν το μάθαινε, και την
 * κρίση *«ποιος επιτρέπεται»* την έκαναν οι κανόνες της βάσης, που ο Admin SDK **παρακάμπτει**.
 * Κάθε σκέλος εκείνου του κανόνα έχει εδώ τη δική του άγκυρα.
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

const PUBLISHER = 'listings:listings:publish';
const TRASH_OTHERS = 'dxf:files:delete';
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
const RETIRED_PROPERTY = 'prop_archived';
const MINE = 'file_mine';
const OTHERS = 'file_others';
const PUBLIC_PHOTO = 'file_public_photo';
const PUBLIC_PHOTO_B = 'file_public_photo_b';
const FOREIGN = 'file_foreign';

interface Wire {
  success: boolean;
  processedCount: number;
  errors: string[];
  listings: { propertyId: string; outcome: string }[];
  files: { fileId: string; purgeAt: string | null; displayName?: string; entityId?: string; entityType?: string }[];
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
    id, companyId: 'c_alpha', status: 'ready', createdBy: 'u_alpha', category: 'documents',
    classification: 'internal', displayName: `${id}.pdf`, ...extra,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  caller.permissions = [];
  fake = new FakeFirestore();
  fake.seed(COLLECTIONS.PROPERTIES, PROPERTY, { companyId: 'c_alpha', status: 'active' });
  fake.seed(COLLECTIONS.PROPERTIES, RETIRED_PROPERTY, { companyId: 'c_alpha', status: 'archived' });
  seedFile(MINE, { entityType: 'contact', entityId: 'cont_1' });
  seedFile(OTHERS, { entityType: 'contact', entityId: 'cont_1', createdBy: 'u_someone_else' });
  seedFile(PUBLIC_PHOTO, { entityType: 'property', entityId: PROPERTY, category: 'photos', classification: 'public' });
  seedFile(PUBLIC_PHOTO_B, { entityType: 'property', entityId: PROPERTY, category: 'photos', classification: 'public' });
  fake.seed(COLLECTIONS.FILES, FOREIGN, {
    id: FOREIGN, companyId: 'c_beta', status: 'ready', createdBy: 'u_alpha', entityType: 'property', entityId: 'prop_beta',
  });
});

describe('ADR-845 §7.17 Α2 — ο κάδος γράφεται, καταγράφεται ΚΑΙ ξαναπροβάλλει στο ίδιο αίτημα', () => {
  it('🏆 Κ1 — ΔΙΚΟ ΜΟΥ αρχείο: πετιέται με τα πεδία του κάδου και τον αιτούντα ως `trashedBy`', async () => {
    const { body } = await call({ fileIds: [MINE], action: 'trash' });

    expect(body.processedCount).toBe(1);
    expect(body.errors).toEqual([]);
    expect(stored(MINE)).toMatchObject({
      lifecycleState: 'trashed', isDeleted: true, trashedBy: 'u_alpha', deletedBy: 'u_alpha',
      trashedAt: 'SERVER_TIME', updatedAt: 'SERVER_TIME',
    });
    expect(typeof stored(MINE).purgeAt).toBe('string');
  });

  it('🔑 Κ2 — η απάντηση φέρει ό,τι χρειάζεται το γεγονός του πελάτη, από ό,τι ΓΡΑΦΤΗΚΕ', async () => {
    const { body } = await call({ fileIds: [MINE], action: 'trash' });

    expect(body.files).toEqual([{
      fileId: MINE, purgeAt: stored(MINE).purgeAt, displayName: `${MINE}.pdf`, entityId: 'cont_1', entityType: 'contact',
    }]);
  });

  it('🌍 Κ3 — δημόσια φωτογραφία ακινήτου: δέσμη του ΙΔΙΟΥ ακινήτου ⇒ ΜΙΑ επαναπροβολή, ΜΕΤΑ τη γραφή', async () => {
    caller.permissions = [PUBLISHER];
    let seenAtRepublish: unknown = 'δεν κλήθηκε';
    republishListing.mockImplementationOnce(async () => {
      seenAtRepublish = stored(PUBLIC_PHOTO).isDeleted;
      return 'published';
    });

    const { body } = await call({ fileIds: [PUBLIC_PHOTO, PUBLIC_PHOTO_B], action: 'trash' });

    expect(body.processedCount).toBe(2);
    expect(body.listings).toEqual([{ propertyId: PROPERTY, outcome: 'published' }]);
    expect(republishListing).toHaveBeenCalledTimes(1);
    expect(seenAtRepublish).toBe(true);
  });

  it('🔴 Κ4 — ΙΔΕΜΠΟΤΗΤΑ: δεύτερος κάδος ΔΕΝ μεταθέτει το ρολόι εκκαθάρισης, ούτε γράφει ίχνος', async () => {
    seedFile('file_trashed', { lifecycleState: 'trashed', isDeleted: true, purgeAt: '2026-01-01T00:00:00.000Z' });

    const { body } = await call({ fileIds: ['file_trashed'], action: 'trash' });

    expect(body).toMatchObject({ success: true, processedCount: 0, errors: [], files: [] });
    expect(stored('file_trashed').purgeAt).toBe('2026-01-01T00:00:00.000Z');
    expect(auditRows()).toEqual([]);
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('🧾 Κ5 — ΙΧΝΟΣ: `delete` στον κάδο, `restore` στην επαναφορά — με τον κάτοχο του βιβλίου', async () => {
    await call({ fileIds: [MINE], action: 'trash' });
    await call({ fileIds: [MINE], action: 'restore' });

    expect(auditRows().map((row) => row.action)).toEqual(['delete', 'restore']);
    expect(auditRows()[0]).toMatchObject({ fileId: MINE, performedBy: 'u_alpha', companyId: 'c_alpha' });
  });

  it('♻️ Κ6 — ΕΠΑΝΑΦΟΡΑ: καθαρίζει ΟΛΑ τα πεδία του κάδου και γράφει ποιος επανέφερε', async () => {
    await call({ fileIds: [MINE], action: 'trash' });
    const { body } = await call({ fileIds: [MINE], action: 'restore' });

    expect(body.files).toEqual([expect.objectContaining({ fileId: MINE, purgeAt: null })]);
    expect(stored(MINE)).toMatchObject({
      lifecycleState: 'active', isDeleted: false, purgeAt: null, trashedAt: null, trashedBy: null,
      deletedAt: null, deletedBy: null, restoredBy: 'u_alpha', restoredAt: 'SERVER_TIME',
    });
  });
});

describe('ADR-845 §7.17 Α2 — ποιος επιτρέπεται (ό,τι έκριναν οι κανόνες, το κρίνει πλέον ο διακομιστής)', () => {
  it('🔒 Κ7 — ΞΕΝΟΥ μισθωτή ή ανύπαρκτο ⇒ «not found», καμία γραφή — ακόμη κι αν το «ανέβασα εγώ»', async () => {
    const { body } = await call({ fileIds: [FOREIGN, 'file_missing'], action: 'trash' });

    expect(body.errors).toEqual([`${FOREIGN}: not found`, 'file_missing: not found']);
    expect(stored(FOREIGN).isDeleted).toBeUndefined();
  });

  it('🔴 Κ8 — αρχείο ΑΛΛΟΥ μέλους χωρίς `dxf:files:delete` ⇒ `not-owner`, καμία γραφή', async () => {
    const { body } = await call({ fileIds: [OTHERS], action: 'trash' });

    expect(body.errors).toEqual([`${OTHERS}: not-owner`]);
    expect(stored(OTHERS).isDeleted).toBeUndefined();
    expect(auditRows()).toEqual([]);
  });

  it('Κ9 — αρχείο ΑΛΛΟΥ μέλους ΜΕ `dxf:files:delete` (ο διαχειριστής) ⇒ πετιέται', async () => {
    caller.permissions = [TRASH_OTHERS];

    const { body } = await call({ fileIds: [OTHERS], action: 'trash' });

    expect(body.errors).toEqual([]);
    expect(stored(OTHERS).isDeleted).toBe(true);
  });

  it('🔑 Κ10 — ο ρόλος `company_admin` ΕΧΕΙ το δικαίωμα από τον κατάλογο (όχι από claim)', async () => {
    caller.globalRole = 'company_admin';
    try {
      const { body } = await call({ fileIds: [OTHERS], action: 'trash' });
      expect(body.errors).toEqual([]);
    } finally {
      caller.globalRole = 'external_user';
    }
  });

  it('🔴 Κ11 — ΔΗΜΟΣΙΟ αρχείο χωρίς δικαίωμα δημοσίευσης: ΟΥΤΕ κάδος ΟΥΤΕ επαναφορά — ακόμη κι αν είναι δικό μου', async () => {
    seedFile('file_public_trashed', {
      entityType: 'property', entityId: PROPERTY, classification: 'public', lifecycleState: 'trashed', isDeleted: true,
    });

    const trash = await call({ fileIds: [PUBLIC_PHOTO], action: 'trash' });
    const restore = await call({ fileIds: ['file_public_trashed'], action: 'restore' });

    expect(trash.body.errors).toEqual([`${PUBLIC_PHOTO}: not-capable`]);
    expect(restore.body.errors).toEqual(['file_public_trashed: not-capable']);
    expect(stored(PUBLIC_PHOTO).isDeleted).toBeUndefined();
    expect(stored('file_public_trashed').isDeleted).toBe(true);
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('Κ12 — το δικαίωμα δημοσίευσης ΔΕΝ αντικαθιστά την ιδιοκτησία: ξένο δημόσιο ⇒ `not-owner`', async () => {
    caller.permissions = [PUBLISHER];
    seedFile('file_public_others', { classification: 'public', createdBy: 'u_someone_else' });

    const { body } = await call({ fileIds: ['file_public_others'], action: 'trash' });

    expect(body.errors).toEqual(['file_public_others: not-owner']);
  });

  it('Κ13 — αρχείο που ΔΕΝ ολοκλήρωσε το ανέβασμα ⇒ `not-ready`', async () => {
    seedFile('file_pending', { status: 'pending' });

    const { body } = await call({ fileIds: ['file_pending'], action: 'trash' });

    expect(body.errors).toEqual(['file_pending: not-ready']);
    expect(stored('file_pending').isDeleted).toBeUndefined();
  });

  it('Κ14 — επαναφορά αρχείου που ΔΕΝ είναι στον κάδο ⇒ `not-in-trash`', async () => {
    const { body } = await call({ fileIds: [MINE], action: 'restore' });

    expect(body.errors).toEqual([`${MINE}: not-in-trash`]);
    expect(auditRows()).toEqual([]);
  });

  it('🗄️ Κ15 — αρχείο ΑΠΟΣΥΡΜΕΝΟΥ ακινήτου είναι κλειδωμένο (ADR-281)· ορφανό αρχείο ΟΧΙ', async () => {
    seedFile('file_retired', { entityType: 'property', entityId: RETIRED_PROPERTY });
    seedFile('file_orphan', { entityType: 'property', entityId: 'prop_gone' });

    const { body } = await call({ fileIds: ['file_retired', 'file_orphan'], action: 'trash' });

    expect(body.errors).toEqual(['file_retired: retired-property']);
    expect(stored('file_retired').isDeleted).toBeUndefined();
    expect(stored('file_orphan').isDeleted).toBe(true);
  });

  it('Κ16 — άκυρο σώμα ⇒ 400 με όνομα, καμία γραφή', async () => {
    const bad = await call({ fileIds: [MINE], action: 'purge' });
    const empty = await call({ fileIds: [], action: 'trash' });

    expect(bad.status).toBe(400);
    expect(bad.body.errors).toEqual(['action is invalid']);
    expect(bad.body.files).toEqual([]);
    expect(empty.status).toBe(400);
    expect(stored(MINE).isDeleted).toBeUndefined();
  });
});
