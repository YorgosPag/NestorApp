/**
 * @jest-environment node
 *
 * @fileoverview 🌍 **Η ΔΙΑΓΡΑΦΗ ΓΚΠΔ ΞΑΝΑΠΡΟΒΑΛΛΕΙ ΤΗΝ ΑΓΓΕΛΙΑ** — ADR-845 §7.17 Α3 (κλάση Ο-35).
 * @related app/api/files/gdpr-delete/route.ts · services/listings/listing-media-refresh.ts
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: η διαγραφή σβήνει τα bytes και γράφει `lifecycleState: 'purged'`· αν το αρχείο
 * ήταν δημοσιευμένη φωτογραφία ακινήτου, η αγγελία έδειχνε σε υλικό που δεν υπάρχει πια.
 *
 * ⚠️ Ο σαρωτής υποκειμένου και ο βοηθός επαναπροβολής **ΔΕΝ** γίνονται mock. Mock μόνο τα σύνορα
 * (ταυτότητα · Storage · όριο ρυθμού) και ο ΕΝΑΣ γραφέας της αγγελίας.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

jest.mock('server-only', () => ({}));

let fake: FakeFirestore;

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

jest.mock('@/app/api/files/_shared/gdpr-subject-route', () => ({
  gdprSubjectRoute:
    (handler: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown) => handler(request, { userId: 'u_alpha', db: fake as unknown as AdminFirestore }),
}));

const deleteStorageObjectForPurge = jest.fn(async (..._args: unknown[]): Promise<string> => 'deleted');
jest.mock('@/services/file-record/file-purge-helpers', () => ({
  deleteStorageObjectForPurge: (...args: unknown[]) => deleteStorageObjectForPurge(...args),
  isFileHeld: (data: { hold?: string }): boolean => data.hold === 'legal',
}));

jest.mock('@/services/enterprise-id.service', () => ({ generateAuditId: (): string => 'audit_gdpr_1' }));

const republishListing = jest.fn(async (..._args: unknown[]): Promise<string> => 'published');
jest.mock('@/services/listings/publish-public-listing', () => ({
  republishListing: (...args: unknown[]) => republishListing(...args),
  reportProjectionFailure: (): string => 'failed',
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../route') as typeof import('../route');

const PROPERTY = 'prop_95';
const PHOTO = 'file_photo';
const PHOTO_B = 'file_photo_b';
const HELD = 'file_held';

interface Wire {
  success?: boolean;
  results?: { filesDeleted: number; filesSkippedHold: number };
  listings?: { propertyId: string; outcome: string }[];
}

async function erase(body: unknown): Promise<{ status: number; body: Wire }> {
  const response = (await (POST as unknown as (request: unknown) => Promise<unknown>)({
    json: async () => body,
  })) as { status: number; json: () => Promise<Wire> };
  return { status: response.status, body: await response.json() };
}

function stored(id: string): Record<string, unknown> {
  return fake.all<Record<string, unknown>>(COLLECTIONS.FILES).find((doc) => doc.id === id) ?? {};
}

function seedPhoto(id: string, extra: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.FILES, id, {
    id, companyId: 'c_alpha', createdBy: 'u_alpha', entityType: 'property', entityId: PROPERTY,
    classification: 'public', lifecycleState: 'active', storagePath: `companies/c_alpha/${id}.jpg`, ...extra,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  fake = new FakeFirestore();
  fake.seed(COLLECTIONS.PROPERTIES, PROPERTY, { companyId: 'c_alpha', status: 'active' });
  seedPhoto(PHOTO);
  seedPhoto(PHOTO_B);
});

describe('ADR-845 §7.17 Α3 — η πόρτα της διαγραφής ΓΚΠΔ ξαναπροβάλλει', () => {
  it('🌍 Γ1 — δημοσιευμένες φωτογραφίες του ΙΔΙΟΥ ακινήτου ⇒ ΜΙΑ επαναπροβολή, ΜΕΤΑ τη γραφή', async () => {
    let seenAtRepublish: unknown = 'δεν κλήθηκε';
    republishListing.mockImplementationOnce(async () => {
      seenAtRepublish = stored(PHOTO).lifecycleState;
      return 'published';
    });

    const { status, body } = await erase({ confirmPhrase: 'DELETE_ALL_MY_DATA' });

    expect(status).toBe(200);
    expect(body.results?.filesDeleted).toBe(2);
    expect(body.listings).toEqual([{ propertyId: PROPERTY, outcome: 'published' }]);
    expect(republishListing).toHaveBeenCalledTimes(1);
    expect(seenAtRepublish).toBe('purged');
  });

  it('🔴 Γ2 — αρχείο σε ΔΕΣΜΕΥΣΗ δεν σβήνεται ⇒ δεν ξαναπροβάλλει κιόλας', async () => {
    fake = new FakeFirestore();
    fake.seed(COLLECTIONS.PROPERTIES, PROPERTY, { companyId: 'c_alpha', status: 'active' });
    seedPhoto(HELD, { hold: 'legal' });

    const { body } = await erase({ confirmPhrase: 'DELETE_ALL_MY_DATA' });

    expect(body.results).toMatchObject({ filesDeleted: 0, filesSkippedHold: 1 });
    expect(body.listings).toEqual([]);
    expect(stored(HELD).lifecycleState).toBe('active');
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('Γ3 — χωρίς τη φράση επιβεβαίωσης ⇒ 400, καμία γραφή, καμία επαναπροβολή', async () => {
    const { status } = await erase({});

    expect(status).toBe(400);
    expect(stored(PHOTO).lifecycleState).toBe('active');
    expect(republishListing).not.toHaveBeenCalled();
  });
});
