/**
 * ΑΓΚΥΡΑ — **κανένας δρόμος δεν γράφει κτίριο σε ξένο έργο** (ADR-829 §7.1).
 *
 * 🔴 Οι τρεις δρόμοι (`POST` · `PATCH` · `link-project`) έτρεχαν ως τώρα μόνο για τον `super_admin`, που δεν έχει όριο
 * χώρου, οπότε κανείς δεν είχε ρωτήσει τι κάνουν με `projectId` από το σώμα ενός ρόλου εταιρείας. Εκτελούνται εδώ οι
 * πραγματικοί handlers με καλούντα `company_admin` του χώρου Α και έργο του χώρου Β· αντικαθίστανται μόνο τα άκρα.
 */

/* global describe, it, expect, beforeEach, jest */

import type { NextRequest } from 'next/server';
import { POST } from '../route';
import { PATCH } from '../building-update.handler';
import { POST as LINK_PROJECT } from '../[buildingId]/link-project/route';
import { createEntity } from '@/lib/firestore/entity-creation.service';
import { withVersionCheck } from '@/lib/firestore/version-check';

jest.mock('server-only', () => ({}));
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, json: async () => body }),
  },
}));

const CALLER = { uid: 'u_a', email: 'a@a.gr', companyId: 'co_a', globalRole: 'company_admin' };

// `var`: τα `jest.mock` ανυψώνονται πάνω από τα `const`.
var docs: Record<string, Record<string, Record<string, unknown>>> = {};
var written: unknown[] = [];

/** Ελάχιστη Firestore: μόνο ό,τι ρωτούν οι τρεις δρόμοι. */
function fakeDb() {
  const snap = (collection: string, id: string) => ({
    exists: Boolean(docs[collection]?.[id]),
    data: () => docs[collection]?.[id],
  });
  const db = {
    collection: (collection: string) => ({
      doc: (id: string) => ({ __path: [collection, id], get: async () => snap(collection, id) }),
      where: () => ({ where: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) }) }),
    }),
    runTransaction: async (run: (tx: unknown) => Promise<void>) => run({
      get: async (ref: { __path: [string, string] }) => snap(...ref.__path),
      update: (_ref: unknown, value: unknown) => { written.push(value); },
    }),
  };
  return db;
}

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => fakeDb() }));
jest.mock('@/lib/api/admin-db', () => ({ requireAdminFirestore: () => fakeDb() }));
jest.mock('@/lib/middleware/with-rate-limit', () => ({ withStandardRateLimit: (handler: unknown) => handler }));
jest.mock('@/lib/auth', () => {
  const actual = jest.requireActual('@/lib/auth/tenant-isolation');
  return {
    requireProjectInTenant: actual.requireProjectInTenant,
    withAuth: (callback: (request: unknown, ctx: unknown, cache: unknown) => unknown) => (request: unknown) =>
      callback(request, CALLER, {}),
    logAuditEvent: async () => undefined,
  };
});
jest.mock('@/lib/auth/audit', () => ({ logAuditEvent: async () => undefined }));
jest.mock('@/lib/firestore/entity-creation.service', () => ({ createEntity: jest.fn(async () => ({ id: 'bld_new' })) }));
jest.mock('@/lib/firestore/entity-linking.service', () => ({ linkEntity: async () => undefined }));
jest.mock('@/lib/firestore/version-check', () => ({
  withVersionCheck: jest.fn(async () => ({ newVersion: 2, docId: 'bld_a' })),
  ConflictError: class ConflictError extends Error {},
}));
jest.mock('../_shared/building-owned-doc', () => ({
  loadOwnedBuilding: async () => ({ data: docs.buildings.bld_a }),
}));
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(), diffFieldsWithResolution: async () => [] },
}));
jest.mock('@/services/places/public-place-read.service', () => ({ verifyPlaceRef: async () => 'exists' }));
jest.mock('@/services/listings/listing-scope-republish', () => ({ republishListingsForProject: jest.fn() }));
jest.mock('@/app/api/geocoding/geocoding-engine', () => ({ geocodeWithVerdict: jest.fn() }));
jest.mock('@/services/listings/address-position-completion-schedule', () => ({ scheduleAddressPositionCompletion: jest.fn() }));

type Handler = (request: NextRequest, segment?: unknown) => Promise<{ status: number; json: () => Promise<unknown> }>;
const request = (body: unknown) => ({ url: 'http://x/api/buildings', json: async () => body }) as unknown as NextRequest;

beforeEach(() => {
  written = [];
  docs = {
    projects: {
      prj_a: { companyId: 'co_a', linkedCompanyId: 'cont_a', name: 'Δικό μου' },
      prj_b: { companyId: 'co_b', linkedCompanyId: 'cont_b', name: 'Ξένο' },
    },
    buildings: { bld_a: { companyId: 'co_a', name: 'Κτίριο', projectId: null } },
  };
  (createEntity as jest.Mock).mockClear();
  (withVersionCheck as jest.Mock).mockClear();
});

describe('POST /api/buildings', () => {
  const create = (projectId: string) => (POST as unknown as Handler)(request({ name: 'Νέο', code: 'Κτ-1', projectId }));

  it('Γ1 — δικό μου έργο ⇒ γέννηση (ο δείκτης ότι ο δρόμος εκτελείται)', async () => {
    await create('prj_a');
    expect(createEntity).toHaveBeenCalledTimes(1);
  });

  it('Γ2 — 🔴 ξένο έργο ⇒ 404 ίδιο με το ανύπαρκτο, ΧΩΡΙΣ γέννηση', async () => {
    await expect(create('prj_b')).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' });
    await expect(create('prj_missing')).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' });
    expect(createEntity).not.toHaveBeenCalled();
  });

  it('Γ3 — άγνωστο πεδίο ⇒ 400 ΧΩΡΙΣ γέννηση', async () => {
    await expect((POST as unknown as Handler)(request({ name: 'Ν', code: 'Κ', projectId: 'prj_a', createdBy: 'x' })))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(createEntity).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/buildings', () => {
  const patch = (fields: Record<string, unknown>) => (PATCH as unknown as Handler)(request({ buildingId: 'bld_a', ...fields }));

  it('Π1 — δικό μου έργο ⇒ γράφεται', async () => {
    await patch({ projectId: 'prj_a' });
    expect(withVersionCheck).toHaveBeenCalledTimes(1);
  });

  it('Π2 — το `null` λύνει τον δεσμό, χωρίς στόχο να κριθεί', async () => {
    await patch({ projectId: null });
    expect(withVersionCheck).toHaveBeenCalledTimes(1);
  });

  it('Π3 — 🔴 ξένο έργο ⇒ άρνηση ΧΩΡΙΣ εγγραφή', async () => {
    await expect(patch({ projectId: 'prj_b' })).rejects.toMatchObject({ statusCode: 400 });
    expect(withVersionCheck).not.toHaveBeenCalled();
  });

  it('Π4 — πεδίο συστήματος ⇒ 400 ΧΩΡΙΣ εγγραφή', async () => {
    await expect(patch({ createdBy: 'x' })).rejects.toMatchObject({ statusCode: 400 });
    expect(withVersionCheck).not.toHaveBeenCalled();
  });
});

describe('POST /api/buildings/[buildingId]/link-project', () => {
  const link = (projectId: string) =>
    (LINK_PROJECT as unknown as Handler)(request({ projectId }), { params: Promise.resolve({ buildingId: 'bld_a' }) });

  it('Σ1 — δικό μου έργο ⇒ γράφεται', async () => {
    await link('prj_a');
    expect(written).toHaveLength(1);
  });

  it('Σ2 — 🔴 ξένο έργο ⇒ άρνηση ΠΡΙΝ από την εγγραφή', async () => {
    await expect(link('prj_b')).rejects.toMatchObject({ statusCode: 400 });
    expect(written).toEqual([]);
  });
});
