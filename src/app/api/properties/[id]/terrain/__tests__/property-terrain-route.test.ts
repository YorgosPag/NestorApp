/**
 * @jest-environment node
 *
 * @fileoverview **Η ΠΟΡΤΑ ΤΟΥ ΤΟΠΟΓΡΑΦΙΚΟΥ** — ADR-920 Β3.
 * @related app/api/properties/[id]/terrain/route.ts
 *
 * 🔴 Τι φυλάει που καμία άλλη σουίτα δεν φυλάει:
 *   - ο διακομιστής **ξαναχτίζει** το στιγμιότυπο και αρνείται με όνομα ό,τι δεν δημοσιεύεται ποτέ·
 *   - αποθηκεύεται η **κανονική** πηγή, ποτέ η ωμή του πελάτη·
 *   - η δήλωση Δ2 φεύγει στο **ίδιο** `save()` με τα bytes·
 *   - μόνο **γη** (Δ1).
 *
 * 🔑 Πραγματικά: ο builder του στιγμιοτύπου, ο αναγνώστης πηγής και δήλωσης, ο κοινός κορμός. Ψεύτικα
 * είναι μόνο η ταυτότητα, η βάση, ο κάδος, η επαναπροβολή και το ιστορικό.
 */

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

jest.mock('@/lib/middleware/with-rate-limit', () => ({ withHeavyRateLimit: <T>(h: T) => h }));

const authContext: { uid: string; companyId: string; isAuthenticated: true; globalRole: string; permissions: string[] } =
  { uid: 'user_1', companyId: 'comp_alfa', isAuthenticated: true, globalRole: 'external_user', permissions: ['listings:listings:publish'] };
jest.mock('@/lib/auth/middleware', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown) => callback(request, authContext),
}));

/** Το ακίνητο όπως το επιστρέφει ο φρουρός κηδεμονίας — κάθε δοκιμή ορίζει το είδος του. */
let property: Record<string, unknown> = {};
jest.mock('@/lib/auth/tenant-isolation', () => ({
  requirePropertyInTenantScope: async () => property,
}));

jest.mock('@/services/iso19650/container-transitions', () => ({
  containerActorOf: (ctx: { uid: string; companyId: string }) => ({ uid: ctx.uid, custody: { companyId: ctx.companyId } }),
  transitionContainer: async (request: { fileId: string }) => ({
    kind: 'transitioned', fileId: request.fileId, act: 'supersede', from: 'pre-cde', to: 'SUPERSEDED', revision: 0,
  }),
}));

const trace: string[] = [];
const setDoc = jest.fn(async (_data: Record<string, unknown>) => { trace.push('set'); });
const updateDoc = jest.fn(async () => { trace.push('update'); });
let siblings: readonly Record<string, unknown>[] = [];
const queryGet = jest.fn(async () => {
  trace.push('query');
  return { docs: siblings.map((data) => ({ id: data.id as string, data: () => data })) };
});

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => {
    const chain = { where: () => chain, get: queryGet };
    return {
      collection: () => ({
        doc: (id: string) => ({ id, set: setDoc, update: updateDoc }),
        where: chain.where,
      }),
      getAll: async () => [],
    };
  },
  FieldValue: { serverTimestamp: () => 'ts' },
}));

interface UploadParams { readonly buffer: Buffer; readonly contentType: string; readonly customMetadata?: Record<string, string> }
const uploadPublicFile = jest.fn(async (_params: UploadParams) => {
  trace.push('upload');
  return { url: '/api/storage/file/x', storagePath: 'p', bucket: 'b', fileId: 'f' };
});
jest.mock('@/services/storage-admin/public-upload.service', () => ({
  uploadPublicFile: (params: UploadParams) => uploadPublicFile(params),
}));

const refreshListing = jest.fn(async (..._args: unknown[]): Promise<string> => {
  trace.push('refresh');
  return 'published';
});
jest.mock('@/services/listings/listing-media-refresh', () => ({
  refreshListingAfterMediaChange: (...args: unknown[]) => refreshListing(...args),
}));

const recordChange = jest.fn(async (_entry: Record<string, unknown>) => {
  trace.push('audit');
  return 'eaud_1';
});
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: (entry: Record<string, unknown>) => recordChange(entry) },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../route') as typeof import('../route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TERRAIN_DECLARATION_METADATA_KEY, decodeTerrainSurveyDeclaration } =
  require('@/lib/terrain/publication/terrain-survey-declaration') as
    typeof import('@/lib/terrain/publication/terrain-survey-declaration');

const PROPERTY = 'prop_a0000009-7777-4aaa-8aaa-000000000020';
const E0 = 400_000_000;
const N0 = 4_200_000_000;

/** Οικόπεδο 20 × 20 m, κλίση 10 % προς ανατολή, σε μεγέθη ΕΓΣΑ'87 (mm). */
function surveyPoints(): number[][] {
  const points: number[][] = [];
  for (let x = 0; x <= 20_000; x += 5_000) {
    for (let y = 0; y <= 20_000; y += 5_000) points.push([E0 + x + 0.4, N0 + y, 120_000 + 0.1 * x]);
  }
  return points;
}

function source(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { version: 1, points: surveyPoints(), breaklines: [], boundary: null, envelope: null, ...over };
}

const DECLARATION = JSON.stringify({ surveyorName: 'Α. Τοπογράφος', surveyedOn: '2026-03-14', rightsAffirmed: true });

function jsonFile(value: unknown, type = 'application/json'): File {
  return new File([JSON.stringify(value)], 'survey.json', { type });
}

function request(file: File | null, declared: string | null = DECLARATION): unknown {
  const body = new FormData();
  if (file) body.append('source', file);
  if (declared !== null) body.append('declaration', declared);
  return {
    url: `https://x/api/properties/${PROPERTY}/terrain`,
    nextUrl: { pathname: `/api/properties/${PROPERTY}/terrain` },
    formData: async () => body,
  };
}

const post = (req: unknown) => POST(req as never, undefined as never, undefined as never);

describe('ADR-920 Β3 — η πόρτα του τοπογραφικού', () => {
  beforeEach(() => {
    trace.length = 0;
    siblings = [];
    property = { companyId: 'comp_alfa', type: 'plot', name: 'Οικόπεδο Κηφισιάς' };
    authContext.permissions = ['listings:listings:publish'];
    jest.clearAllMocks();
  });

  it('Τ1 — 🏆 η ΚΑΝΟΝΙΚΗ πηγή και η δήλωση φεύγουν σε ΜΙΑ εγγραφή', async () => {
    await post(request(jsonFile({ ...source(), smuggled: 'x' })));

    expect(uploadPublicFile).toHaveBeenCalledTimes(1);
    const params = uploadPublicFile.mock.calls[0][0];
    const stored = params.buffer.toString('utf8');
    expect(params.contentType).toBe('application/json');
    expect(stored).not.toContain('smuggled');
    expect(JSON.parse(stored).points[0]).toStrictEqual([E0, N0, 120_000]); // ακέραια mm
    expect(decodeTerrainSurveyDeclaration(params.customMetadata?.[TERRAIN_DECLARATION_METADATA_KEY]))
      .toStrictEqual({ surveyorName: 'Α. Τοπογράφος', surveyedOn: '2026-03-14', rightsAffirmed: true });
  });

  it('Τ2 — το έγγραφο: DRAWINGS, ιδιωτική πηγή με ταυτότητα terrain/measured, ΠΡΙΝ τα bytes', async () => {
    await post(request(jsonFile(source())));

    expect(setDoc).toHaveBeenCalledWith(expect.objectContaining({
      category: 'drawings',
      contentType: 'application/json',
      publicationIdentity: 'terrain/measured',
      entityId: PROPERTY,
      // ADR-920 Β4.3 — το εταιρικό σπίτι: αρχείο του μισθωτή στο ακίνητο, ποτέ στον φάκελο ενός ανθρώπου.
      entityType: 'property',
      companyId: authContext.companyId,
    }));
    expect(setDoc.mock.calls[0][0]).not.toHaveProperty('userId');
    expect(trace).toEqual(['query', 'set', 'upload', 'update', 'audit', 'refresh']);
  });

  it('Τ3 — ο διακομιστής απαντά με τη ΔΙΚΗ του μέτρηση του εδάφους', async () => {
    const response = await post(request(jsonFile(source())));
    const payload = await (response as unknown as Response).json() as { data: { terrain: { stats: { reliefM: number; meanSlopePct: number } } } };

    expect(payload.data.terrain.stats.reliefM).toBe(2);
    expect(payload.data.terrain.stats.meanSlopePct).toBeCloseTo(10, 1);
  });

  it.each([
    ['επιφάνεια χωρίς υψόμετρα', source({ points: [[E0, N0], [E0 + 1_000, N0], [E0, N0 + 1_000]] }), 'TERRAIN_INSUFFICIENT_SURFACE'],
    ['όριο έξω από την επιφάνεια', source({ boundary: [[0, 0], [1_000, 0], [1_000, 1_000]] }), 'TERRAIN_EMPTY_AFTER_CLIP'],
  ])('Τ4 — %s ⇒ 422 με όνομα, και ΤΙΠΟΤΑ δεν γράφεται', async (_label, body, code) => {
    await expect(post(request(jsonFile(body)))).rejects.toMatchObject({ statusCode: 422, message: code });
    expect(setDoc).not.toHaveBeenCalled();
    expect(uploadPublicFile).not.toHaveBeenCalled();
  });

  it.each([
    ['χωρίς αρχείο', request(null), 400, 'TERRAIN_SOURCE_REQUIRED'],
    ['όχι JSON τύπος', request(jsonFile(source(), 'text/csv')), 415, 'TERRAIN_TYPE_UNSUPPORTED'],
    ['άκυρο JSON', request(new File(['{nope'], 's.json', { type: 'application/json' })), 400, 'TERRAIN_SOURCE_MALFORMED'],
    ['άγνωστη έκδοση πηγής', request(jsonFile(source({ version: 9 }))), 400, 'TERRAIN_SOURCE_MALFORMED'],
    ['χωρίς δήλωση', request(jsonFile(source()), null), 400, 'TERRAIN_DECLARATION_INVALID'],
    ['δήλωση χωρίς κατάφαση', request(jsonFile(source()), JSON.stringify({ surveyorName: 'Α', surveyedOn: '2026-03-14' })), 400, 'TERRAIN_DECLARATION_INVALID'],
    ['αποτύπωση στο μέλλον', request(jsonFile(source()), JSON.stringify({ surveyorName: 'Α', surveyedOn: '2999-01-01', rightsAffirmed: true })), 422, 'TERRAIN_SURVEY_DATE_IN_FUTURE'],
  ])('Τ5 — %s ⇒ άρνηση με όνομα', async (_label, req, statusCode, code) => {
    await expect(post(req)).rejects.toMatchObject({ statusCode, message: code });
    expect(uploadPublicFile).not.toHaveBeenCalled();
  });

  it('Τ6 — Δ1: ακίνητο που ΔΕΝ είναι γη ⇒ 422, πριν διαβαστεί η πηγή', async () => {
    property = { companyId: 'comp_alfa', type: 'apartment' };
    await expect(post(request(jsonFile(source())))).rejects.toMatchObject({ statusCode: 422, message: 'TERRAIN_NOT_LAND' });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('Τ7 — 🔒 χωρίς δικαίωμα δημοσίευσης ⇒ άρνηση ΠΡΙΝ από οτιδήποτε', async () => {
    authContext.permissions = [];
    await expect(post(request(jsonFile(source())))).rejects.toMatchObject({ message: 'TERRAIN_PUBLICATION_NOT_CAPABLE' });
    expect(uploadPublicFile).not.toHaveBeenCalled();
  });

  it('Τ8 — νέα δημοσίευση ΔΙΑΔΕΧΕΤΑΙ την προηγούμενη και το ιστορικό το λέει', async () => {
    siblings = [{ id: 'file_old_terrain', publicationIdentity: 'terrain/measured' }];
    const response = await post(request(jsonFile(source())));
    const payload = await (response as unknown as Response).json() as { data: { fileId: string; supersedes: string[] } };

    expect(payload.data.supersedes).toEqual(['file_old_terrain']);
    expect(recordChange).toHaveBeenCalledWith(expect.objectContaining({
      entityId: PROPERTY,
      entityName: 'Οικόπεδο Κηφισιάς',
      changes: [{ field: 'terrain', oldValue: 'file_old_terrain', newValue: payload.data.fileId }],
      performedBy: 'user_1',
      companyId: 'comp_alfa',
    }));
  });

  it('Τ9 — η επαναπροβολή είναι για ΤΟ ΙΔΙΟ ακίνητο, του μισθωτή του auth', async () => {
    await post(request(jsonFile(source())));
    expect(refreshListing.mock.calls[0].slice(1)).toEqual([PROPERTY, 'comp_alfa']);
  });
});
