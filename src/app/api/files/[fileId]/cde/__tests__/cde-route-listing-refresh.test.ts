/**
 * @jest-environment node
 *
 * @fileoverview 🌍 **Η ΠΡΑΞΗ ΔΟΧΕΙΟΥ ΞΑΝΑΠΡΟΒΑΛΛΕΙ ΤΗΝ ΑΓΓΕΛΙΑ** — ADR-845 §7.17 Α3 (κλάση Ο-35).
 * @related app/api/files/[fileId]/cde/route.ts · services/listings/listing-media-refresh.ts
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: η αντικατάσταση αρχειοθετεί δημοσιευμένη φωτογραφία, και η αγγελία δεν το
 * μάθαινε — η πόρτα δεν καλούσε επαναπροβολή.
 *
 * ⚠️ Ο PEP (`fileResource`) και ο βοηθός επαναπροβολής **ΔΕΝ** γίνονται mock. Mock μόνο ο ΕΝΑΣ
 * γραφέας του δοχείου *(έχει δικές του άγκυρες — εδώ κρίνεται τι κάνει η πόρτα με την **έκβασή** του)*,
 * η ορατότητα, η ταυτότητα και ο ΕΝΑΣ γραφέας της αγγελίας.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

jest.mock('server-only', () => ({}));

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

jest.mock('@/lib/middleware/with-rate-limit', () => ({ withSensitiveRateLimit: <T>(h: T) => h }));
jest.mock('@/lib/auth/container-visibility-guard', () => ({ containerVisibilityRefusal: async () => null }));

const caller = { uid: 'u_alpha', companyId: 'c_alpha', globalRole: 'company_admin', isAuthenticated: true };
jest.mock('@/app/api/files/_shared/file-custody-route', () => ({
  withFileCustodyAuth:
    (handler: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, segment: unknown) => handler(request, { custody: 'company', ctx: caller }, segment),
}));

const transitionContainer = jest.fn();
jest.mock('@/services/iso19650/container-transitions', () => ({
  transitionContainer: (...args: unknown[]) => transitionContainer(...args),
  containerActorOf: () => ({ uid: 'u_alpha' }),
  personalContainerActorOf: () => ({ uid: 'u_alpha' }),
}));

const republishListing = jest.fn(async (..._args: unknown[]): Promise<string> => 'published');
jest.mock('@/services/listings/publish-public-listing', () => ({
  republishListing: (...args: unknown[]) => republishListing(...args),
  reportProjectionFailure: (): string => 'failed',
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../route') as typeof import('../route');

const PROPERTY = 'prop_95';
const PHOTO = 'file_photo';
const CONTACT_DOC = 'file_contact_doc';

interface Wire {
  success: boolean;
  refused?: string;
  listings?: { propertyId: string; outcome: string }[];
}

async function act(fileId: string, body: unknown): Promise<{ status: number; body: Wire }> {
  const response = (await (POST as unknown as (request: unknown, segment: unknown) => Promise<unknown>)(
    { json: async () => body },
    { params: Promise.resolve({ fileId }) },
  )) as { status: number; json: () => Promise<Wire> };
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  jest.clearAllMocks();
  fake = new FakeFirestore();
  fake.seed(COLLECTIONS.PROPERTIES, PROPERTY, { companyId: 'c_alpha', status: 'active' });
  fake.seed(COLLECTIONS.FILES, PHOTO, {
    id: PHOTO, companyId: 'c_alpha', entityType: 'property', entityId: PROPERTY, classification: 'public',
  });
  fake.seed(COLLECTIONS.FILES, CONTACT_DOC, {
    id: CONTACT_DOC, companyId: 'c_alpha', entityType: 'contact', entityId: 'cont_1',
  });
});

describe('ADR-845 §7.17 Α3 — η πόρτα των πράξεων δοχείου ξαναπροβάλλει', () => {
  it('🌍 Δ1 — αντικατάσταση που ΕΓΙΝΕ ⇒ ΜΙΑ επαναπροβολή του ακινήτου, ΜΕΤΑ τον γραφέα', async () => {
    const order: string[] = [];
    transitionContainer.mockImplementation(async () => {
      order.push('write');
      return { kind: 'succeeded', fileId: PHOTO, act: 'supersede', supersededByFileId: 'file_next' };
    });
    republishListing.mockImplementationOnce(async () => {
      order.push('republish');
      return 'published';
    });

    const { status, body } = await act(PHOTO, { act: 'supersede', supersededByFileId: 'file_next' });

    expect(status).toBe(200);
    expect(order).toEqual(['write', 'republish']);
    expect(body.listings).toEqual([{ propertyId: PROPERTY, outcome: 'published' }]);
    expect(republishListing.mock.calls[0][1]).toBe(PROPERTY);
  });

  it('Δ2 — ΚΑΘΕ πράξη που έγινε, όχι μόνο η αντικατάσταση (η πόρτα δεν κρίνει τι «μετράει»)', async () => {
    transitionContainer.mockResolvedValue({ kind: 'transitioned', fileId: PHOTO, act: 'share' });

    const { body } = await act(PHOTO, { act: 'share' });

    expect(body.success).toBe(true);
    expect(republishListing).toHaveBeenCalledTimes(1);
  });

  it('🔴 Δ3 — άρνηση ή «τίποτα να αλλάξει» ⇒ ΚΑΜΙΑ επαναπροβολή', async () => {
    transitionContainer.mockResolvedValueOnce({ kind: 'refused', fileId: PHOTO, act: 'release', why: 'not-capable' });
    const refused = await act(PHOTO, { act: 'release' });

    transitionContainer.mockResolvedValueOnce({ kind: 'noop', fileId: PHOTO, act: 'share', why: 'already' });
    const noop = await act(PHOTO, { act: 'share' });

    expect(refused.status).toBe(403);
    expect(noop.body.listings).toEqual([]);
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('Δ4 — αρχείο που ΔΕΝ είναι ακινήτου ⇒ καμία αγγελία δεν αφορούσε', async () => {
    transitionContainer.mockResolvedValue({ kind: 'transitioned', fileId: CONTACT_DOC, act: 'share' });

    const { body } = await act(CONTACT_DOC, { act: 'share' });

    expect(body.listings).toEqual([]);
    expect(republishListing).not.toHaveBeenCalled();
  });
});
