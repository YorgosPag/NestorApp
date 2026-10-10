/**
 * ΑΓΚΥΡΑ — **το `PATCH /api/buildings` γράφει ιστορικό για ό,τι άλλαξε άνθρωπος, και μόνο γι' αυτό**
 * (ADR-195 · ADR-332 D29).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: η διαδρομή έγραφε κάθε ανθρώπινη αλλαγή μέσω `withVersionCheck` και **καμία**
 * στο ιστορικό της οντότητας — και το CHECK 3.17 δεν το έβλεπε. Δεν υπήρχε ούτε ένα test της.
 *
 * Τρία πράγματα κρίνονται, όλα με την **πραγματική** μηχανή διαφορών και τον πραγματικό γραφέα θέσης:
 * - η προθεσμία: ο πάροχος που αργεί δεν κρατά την «Αποθήκευση», και η εκκρεμότητα προγραμματίζεται·
 * - το ιστορικό: κείμενο **και** θέση (σύρσιμο πινέζας), απέναντι στο αποθηκευμένο έγγραφο·
 * - η αυτόματη αποθήκευση: ξαναστέλνει **όλα** τα πεδία — αμετάβλητα πεδία ⇒ καμία γραμμή.
 */

/* global describe, it, expect, beforeEach, afterEach, jest */

import type { NextRequest } from 'next/server';
import { COLLECTIONS } from '@/config/firestore-collections';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { geocodeWithVerdict } from '@/app/api/geocoding/geocoding-engine';
import { scheduleAddressPositionCompletion } from '@/services/listings/address-position-completion-schedule';
import { EntityAuditService } from '@/services/entity-audit.service';
import { PATCH } from '../building-update.handler';

jest.mock('server-only', () => ({}));
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, json: async () => body }),
  },
}));

// `var`: τα `jest.mock` ανυψώνονται πάνω από τα `const`.
var storedBuilding: Record<string, unknown> = {};
var written: Record<string, unknown> | null = null;

jest.mock('@/lib/api/admin-db', () => ({ requireAdminFirestore: () => ({}) }));
jest.mock('../_shared/building-owned-doc', () => ({
  loadOwnedBuilding: async () => ({ data: storedBuilding }),
}));
jest.mock('@/lib/auth', () => ({
  withAuth: (callback: (request: unknown, ctx: unknown, cache: unknown) => unknown) => (request: unknown) =>
    callback(request, { uid: 'u_1', email: 'a@alpha.gr', companyId: 'co_caller', globalRole: 'company_admin' }, {}),
  logAuditEvent: async () => undefined,
}));
jest.mock('@/lib/middleware/with-rate-limit', () => ({ withStandardRateLimit: (handler: unknown) => handler }));
jest.mock('@/lib/firestore/version-check', () => ({
  withVersionCheck: async ({ updates }: { updates: Record<string, unknown> }) => {
    written = updates;
    return { newVersion: 2, docId: 'bld_1' };
  },
  ConflictError: class ConflictError extends Error {},
}));
jest.mock('@/lib/firestore/entity-linking.service', () => ({ linkEntity: async () => undefined }));
jest.mock('@/services/places/public-place-read.service', () => ({ verifyPlaceRef: async () => 'exists' }));
jest.mock('@/services/listings/listing-scope-republish', () => ({ republishListingsForProject: jest.fn() }));
jest.mock('@/app/api/geocoding/geocoding-engine', () => ({ geocodeWithVerdict: jest.fn() }));
jest.mock('@/services/listings/address-position-completion-schedule', () => ({
  scheduleAddressPositionCompletion: jest.fn(),
}));
// Η διαφορά είναι η ΠΡΑΓΜΑΤΙΚΗ μηχανή· μόνο η γραφή στο βιβλίο αντικαθίσταται.
jest.mock('@/services/entity-audit.service', () => {
  const { diffTrackedFields } = jest.requireActual('@/lib/audit/audit-diff');
  return {
    EntityAuditService: {
      diffFieldsWithResolution: async (before: unknown, after: unknown, defs: unknown) =>
        diffTrackedFields(before, after, defs),
      recordChange: jest.fn().mockResolvedValue('eaud_1'),
    },
  };
});

const engine = geocodeWithVerdict as jest.MockedFunction<typeof geocodeWithVerdict>;
const schedule = scheduleAddressPositionCompletion as jest.MockedFunction<typeof scheduleAddressPositionCompletion>;
const recordChange = EntityAuditService.recordChange as jest.MockedFunction<typeof EntityAuditService.recordChange>;
type Verdict = Awaited<ReturnType<typeof geocodeWithVerdict>>;

const { RESOLVER_TIMEOUT_MS } = GEOGRAPHIC_CONFIG.GEOCODING;

const PLACED = {
  id: 'addr_1',
  type: 'site',
  isPrimary: true,
  street: 'Τσιμισκή',
  number: '43',
  city: 'Θεσσαλονίκη',
  country: 'GR',
  coordinates: { lat: 40.6403, lng: 22.9444 },
  source: 'dragged',
};

const BUILDING = {
  name: 'Κτίριο Α',
  description: 'Πρώτη φάση',
  startDate: '2026-01-10',
  completionDate: '2027-06-30',
  constructionYear: 2026,
  category: 'residential',
  companyId: 'co_owner',
  projectId: 'proj_1',
  addresses: [PLACED],
};

const patch = async (payload: Record<string, unknown>) => {
  const request = { json: async () => ({ buildingId: 'bld_1', _v: 1, ...payload }) } as unknown as NextRequest;
  const response = await (PATCH as unknown as (request: NextRequest) => Promise<{ json: () => Promise<{ data: Record<string, unknown> }> }>)(request);
  return (await response.json()).data;
};

beforeEach(() => {
  storedBuilding = { ...BUILDING };
  written = null;
  engine.mockReset();
  schedule.mockClear();
  recordChange.mockClear();
});

describe('ιστορικό — ό,τι άλλαξε άνθρωπος', () => {
  it('Ι1 — αλλαγή κειμένου ⇒ ΜΙΑ γραμμή, με παλιά και νέα τιμή, στο βιβλίο του ΚΑΤΟΧΟΥ του κτιρίου', async () => {
    await patch({ name: 'Κτίριο Β' });

    expect(recordChange).toHaveBeenCalledTimes(1);
    expect(recordChange.mock.calls[0][0]).toEqual({
      entityType: 'building',
      entityId: 'bld_1',
      entityName: 'Κτίριο Β',
      action: 'updated',
      changes: [{ field: 'name', oldValue: 'Κτίριο Α', newValue: 'Κτίριο Β', label: 'name' }],
      performedBy: 'u_1',
      performedByName: 'a@alpha.gr',
      // Του εγγράφου, όχι του καλούντος: ο super admin γράφει στο ιστορικό της εταιρείας του κτιρίου.
      companyId: 'co_owner',
    });
  });

  it('Ι2 — αυτόματη αποθήκευση που ξαναστέλνει ΑΜΕΤΑΒΛΗΤΑ όλα τα πεδία ⇒ καμία γραμμή', async () => {
    const { addresses: _addresses, companyId: _companyId, projectId: _projectId, ...form } = BUILDING;

    await patch(form);

    expect(written).toMatchObject({ name: 'Κτίριο Α' });
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('Ι3 — το έτος κατασκευής είναι παρακολουθούμενο πεδίο', async () => {
    await patch({ constructionYear: 2027 });

    expect(recordChange.mock.calls[0][0].changes).toEqual([
      { field: 'constructionYear', oldValue: 2026, newValue: 2027, label: 'constructionYear' },
    ]);
  });

  it('Ι4 — σύρσιμο πινέζας ⇒ γραμμή `coordinates`, στην ΙΔΙΑ διατύπωση με τη μηχανή', async () => {
    await patch({ addresses: [{ ...PLACED, coordinates: { lat: 40.65, lng: 22.95 } }] });

    expect(recordChange).toHaveBeenCalledTimes(1);
    expect(recordChange.mock.calls[0][0].changes).toEqual([
      {
        field: 'addresses',
        oldValue: null,
        newValue: null,
        label: 'addresses',
        kind: 'collection',
        op: 'modified',
        itemKey: 'k:addr_1',
        itemLabel: 'site — Τσιμισκή — 43',
        subChanges: [{ subField: 'coordinates', oldValue: '40.64030, 22.94440', newValue: '40.65000, 22.95000' }],
      },
    ]);
    // Η πινέζα του ανθρώπου δεν ρωτά τη μηχανή.
    expect(engine).not.toHaveBeenCalled();
  });

  it('Ι5 — αποθήκευση των ίδιων διευθύνσεων (καμία αλλαγή) ⇒ καμία γραμμή', async () => {
    await patch({ addresses: [PLACED] });

    expect(recordChange).not.toHaveBeenCalled();
  });
});

describe('προθεσμία θέσης', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const NEW_ADDRESS = { id: 'addr_2', type: 'entrance', street: 'Εγνατία', number: '1', city: 'Θεσσαλονίκη', country: 'GR' };

  it('Π1 — ο πάροχος αργεί ⇒ η απάντηση φεύγει ΣΤΗΝ προθεσμία με τη διεύθυνση εκκρεμή, και η ολοκλήρωση προγραμματίζεται', async () => {
    engine.mockReturnValue(new Promise<Verdict>(() => undefined));

    const saving = patch({ addresses: [PLACED, NEW_ADDRESS] });
    await jest.advanceTimersByTimeAsync(RESOLVER_TIMEOUT_MS);
    const data = await saving;

    expect(data.positionsPending).toEqual(['addr_2']);
    expect(data.updated).toBe(true);
    expect(schedule).toHaveBeenCalledTimes(1);
    const [job] = schedule.mock.calls[0];
    expect(job).toMatchObject({
      collection: COLLECTIONS.BUILDINGS,
      docId: 'bld_1',
      entityType: 'building',
      pendingIds: ['addr_2'],
      relocateIds: [],
    });
    // Τα παράγωγα του κτιρίου γράφονται από την ολοκλήρωση, στην ίδια συναλλαγή με τη θέση.
    expect(job.derive?.([{ ...PLACED, coordinates: { lat: 1, lng: 2 } }])).toEqual({ latitude: 1, longitude: 2 });
  });

  it('Π2 — η εκκρεμής διεύθυνση γράφεται στο ιστορικό ως προσθήκη ΧΩΡΙΣ θέση (η θέση είναι της μηχανής, αργότερα)', async () => {
    engine.mockReturnValue(new Promise<Verdict>(() => undefined));

    const saving = patch({ addresses: [PLACED, NEW_ADDRESS] });
    await jest.advanceTimersByTimeAsync(RESOLVER_TIMEOUT_MS);
    await saving;

    const [added] = recordChange.mock.calls[0][0].changes;
    expect(added).toMatchObject({ op: 'added', itemKey: 'k:addr_2' });
    expect(added.subChanges?.map((sub) => sub.subField)).not.toContain('coordinates');
  });

  it('Π3 — καμία εκκρεμότητα ⇒ ο προγραμματιστής καλείται με κενή λίστα (δεν ανοίγει εργασία)', async () => {
    await patch({ name: 'Κτίριο Β' });

    expect(schedule.mock.calls[0][0].pendingIds).toEqual([]);
  });
});
