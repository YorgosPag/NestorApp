/**
 * @jest-environment node
 *
 * @fileoverview **Η ΠΟΡΤΑ ΤΟΥ ΤΟΠΟΓΡΑΦΙΚΟΥ ΤΟΥ ΙΔΙΟΚΤΗΤΗ** — ADR-920 Β4.3.
 * @related app/api/owner-properties/[ownerPropertyId]/terrain/route.ts ·
 *   server/listing-material/publish-owner-property-material.ts
 *
 * 🔴 Τι φυλάει που καμία άλλη σουίτα δεν φυλάει:
 *   - η πηγή γεννιέται στον **ΦΑΚΕΛΟ** (`files_personal`, `property_dossier`) — ποτέ με `companyId`·
 *   - ξένη αγγελία ⇒ 404 **πριν** διαβαστεί το σώμα· χώρος γραφείου / χωρίς φάκελο / φάκελος άλλου ⇒ `TERRAIN_NO_DOSSIER`·
 *   - οι προκάτοχοι ζητούνται στον **ίδιο** φάκελο, και μόνο του ίδιου κάδου·
 *   - η επαναπροβολή είναι **της αγγελίας ιδιοκτήτη**, με τον κάτοχο του φακέλου, **τελευταία**·
 *   - το ιστορικό γράφεται στο βιβλίο του **χώρου του ανθρώπου**.
 *
 * 🔑 Πραγματικά: ο κοινός κώδικας εδάφους, ο κινητήρας, η κηδεμονία (`custodyOf`/`mayAdminister`), ο κατασκευαστής της
 * εγγραφής. Ψεύτικα: η ταυτότητα, η βάση, ο κάδος, η επαναπροβολή και το ιστορικό.
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | η πόρτα γεννά με το εταιρικό σπίτι | Ι1 |
 * | ο κινητήρας γράφει στο `files` αντί για `files_personal` | Ι1 |
 * | φάκελος άλλου ανθρώπου γίνεται δεκτός | Ι4 |
 * | το φίλτρο κάδου στους προκατόχους λείπει | Ι5 |
 * | η επαναπροβολή χάνει τον κάτοχο | Ι6 |
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

const OWNER = 'user_9';
let callerUid = OWNER;
jest.mock('@/lib/auth/personal-scope-middleware', () => ({
  withPersonalOrOrgAuth:
    (handler: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, context: unknown) => handler(request, { ctx: { uid: callerUid }, scope: 'personal' }, context),
  listingActorOf: (actor: { ctx: { uid: string } }) => ({ uid: actor.ctx.uid, companyId: null }),
}));

/** Τα έγγραφα όπως τα επιστρέφει η βάση — κάθε δοκιμή ορίζει αγγελία και φάκελο. */
let ownerProperty: Record<string, unknown> | undefined;
let dossier: Record<string, unknown> | undefined;
jest.mock('@/lib/owner-property/owner-property-from-document', () => ({
  ownerPropertyFromDocument: (raw: unknown, id: string) => (raw === undefined ? null : { ...(raw as object), id }),
}));
jest.mock('@/lib/property-dossier/property-dossier-from-document', () => ({
  propertyDossierFromDocument: (raw: unknown, id: string) => (raw === undefined ? null : { ...(raw as object), id }),
}));

jest.mock('@/services/iso19650/container-transitions', () => ({
  personalContainerActorOf: (uid: string) => ({ uid, custody: { userId: uid } }),
  transitionContainer: async (request: { fileId: string }) => ({
    kind: 'transitioned', fileId: request.fileId, act: 'supersede', from: 'pre-cde', to: 'SUPERSEDED', revision: 0,
  }),
}));

const trace: string[] = [];
const collections: string[] = [];
const setDoc = jest.fn(async (_data: Record<string, unknown>) => { trace.push('set'); });
const updateDoc = jest.fn(async () => { trace.push('update'); });
let siblings: readonly Record<string, unknown>[] = [];
const filters: unknown[][] = [];

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: (name: string) => {
      collections.push(name);
      const chain = {
        where: (...args: unknown[]) => { filters.push(args); return chain; },
        get: async () => {
          trace.push('query');
          return { docs: siblings.map((data) => ({ id: data.id as string, data: () => data })) };
        },
      };
      return {
        doc: (id: string) => ({
          id,
          set: setDoc,
          update: updateDoc,
          get: async () => ({ data: () => (name === 'owner_properties' ? ownerProperty : name === 'property_dossiers' ? dossier : undefined) }),
        }),
        where: chain.where,
      };
    },
    getAll: async () => [],
  }),
  FieldValue: { serverTimestamp: () => 'ts' },
}));

jest.mock('@/services/storage-admin/public-upload.service', () => ({
  uploadPublicFile: async () => {
    trace.push('upload');
    return { url: '/api/storage/file/x', storagePath: 'p', bucket: 'b', fileId: 'f' };
  },
}));

const refreshOwner = jest.fn(async (..._args: unknown[]): Promise<string> => {
  trace.push('refresh');
  return 'published';
});
jest.mock('@/services/listings/listing-media-refresh', () => ({
  refreshOwnerListingAfterMediaChange: (...args: unknown[]) => refreshOwner(...args),
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

const LISTING = 'oprop_a0000009-7777-4aaa-8aaa-000000000031';
const DOSSIER = 'pdos_a0000009-7777-4aaa-8aaa-000000000032';
const E0 = 400_000_000;
const N0 = 4_200_000_000;

function surveyPoints(): number[][] {
  const points: number[][] = [];
  for (let x = 0; x <= 20_000; x += 5_000) {
    for (let y = 0; y <= 20_000; y += 5_000) points.push([E0 + x, N0 + y, 120_000 + 0.1 * x]);
  }
  return points;
}

const SOURCE = { version: 1, points: surveyPoints(), breaklines: [], boundary: null, envelope: null };
const DECLARATION = JSON.stringify({ surveyorName: 'Α. Τοπογράφος', surveyedOn: '2026-03-14', rightsAffirmed: true });

const formData = jest.fn(async () => {
  const body = new FormData();
  body.append('source', new File([JSON.stringify(SOURCE)], 'survey.json', { type: 'application/json' }));
  body.append('declaration', DECLARATION);
  return body;
});

const post = () => POST(
  { url: `https://x/api/owner-properties/${LISTING}/terrain`, nextUrl: { pathname: '/x' }, formData } as never,
  { params: Promise.resolve({ ownerPropertyId: LISTING }) } as never,
);

describe('ADR-920 Β4.3 — η πόρτα του τοπογραφικού του ιδιοκτήτη', () => {
  beforeEach(() => {
    trace.length = 0;
    collections.length = 0;
    filters.length = 0;
    siblings = [];
    callerUid = OWNER;
    ownerProperty = { authorUserId: OWNER, authorCompanyId: null, dossierId: DOSSIER, type: 'plot', title: 'Οικόπεδο Σούνιο ' };
    dossier = { userId: OWNER, label: 'Οικόπεδο', type: 'plot' };
    jest.clearAllMocks();
  });

  it('Ι1 — 🏆 η πηγή γεννιέται στον ΦΑΚΕΛΟ, ως αρχείο του ανθρώπου — ποτέ του μισθωτή', async () => {
    await post();

    expect(setDoc).toHaveBeenCalledWith(expect.objectContaining({
      userId: OWNER,
      entityType: 'property_dossier',
      entityId: DOSSIER,
      createdBy: OWNER,
      publicationIdentity: 'terrain/measured',
      category: 'drawings',
    }));
    expect(setDoc.mock.calls[0][0]).not.toHaveProperty('companyId');
    expect(collections).toContain('files_personal');
    expect(collections).not.toContain('files');
    expect(trace).toEqual(['query', 'set', 'upload', 'update', 'audit', 'refresh']);
  });

  it('Ι2 — 🔒 ξένη αγγελία ⇒ 404, και το σώμα ΔΕΝ διαβάζεται', async () => {
    callerUid = 'user_stranger';
    await expect(post()).rejects.toMatchObject({ statusCode: 404 });
    expect(formData).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });

  const NO_DOSSIER = { statusCode: 409, message: 'TERRAIN_NO_DOSSIER' };
  it.each([
    // Στον χώρο γραφείου ο άνθρωπος δεν διαχειρίζεται την αγγελία ⇒ 404, ποτέ «υπάρχει».
    ['σε χώρο γραφείου', () => { ownerProperty = { ...ownerProperty, authorCompanyId: 'comp_a' }; }, { statusCode: 404 }],
    ['χωρίς φάκελο', () => { ownerProperty = { ...ownerProperty, dossierId: undefined }; }, NO_DOSSIER],
    ['με φάκελο που δεν υπάρχει', () => { dossier = undefined; }, NO_DOSSIER],
  ])('Ι3 — αγγελία %s ⇒ άρνηση, χωρίς καμία εγγραφή', async (_label, arrange, expected) => {
    arrange();
    await expect(post()).rejects.toMatchObject(expected);
    expect(formData).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('Ι4 — 🔒 φάκελος ΑΛΛΟΥ ανθρώπου ⇒ TERRAIN_NO_DOSSIER: κανένα υλικό σε ξένο δοχείο', async () => {
    dossier = { ...dossier, userId: 'user_other' };
    await expect(post()).rejects.toMatchObject({ statusCode: 409, message: 'TERRAIN_NO_DOSSIER' });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('Ι5 — οι προκάτοχοι ζητούνται στον ΙΔΙΟ φάκελο, και μόνο του ίδιου κάδου', async () => {
    siblings = [
      { id: 'file_old_terrain', publicationIdentity: 'terrain/measured', category: 'drawings' },
      { id: 'file_same_identity_other_bucket', publicationIdentity: 'terrain/measured', category: 'photos' },
    ];
    const response = await post();
    const payload = await (response as unknown as Response).json() as { data: { fileId: string; supersedes: string[] } };

    expect(payload.data.supersedes).toEqual(['file_old_terrain']);
    expect(filters).toEqual(expect.arrayContaining([
      ['userId', '==', OWNER], ['entityType', '==', 'property_dossier'], ['entityId', '==', DOSSIER], ['status', '==', 'ready'],
    ]));
    expect(recordChange).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'owner_property',
      entityId: LISTING,
      entityName: 'Οικόπεδο Σούνιο',
      changes: [{ field: 'terrain', oldValue: 'file_old_terrain', newValue: payload.data.fileId }],
      performedBy: OWNER,
      userId: OWNER,
    }));
    expect(recordChange.mock.calls[0][0]).not.toHaveProperty('companyId');
  });

  it('Ι6 — η επαναπροβολή είναι της ΙΔΙΑΣ αγγελίας ιδιοκτήτη, με τον κάτοχο του φακέλου', async () => {
    await post();
    expect(refreshOwner.mock.calls[0].slice(1)).toEqual([LISTING, OWNER]);
  });

  it('Ι7 — ο κοινός κώδικας εδάφους ισχύει κι εδώ: ό,τι δεν είναι γη ⇒ 422', async () => {
    ownerProperty = { ...ownerProperty, type: 'apartment' };
    await expect(post()).rejects.toMatchObject({ statusCode: 422, message: 'TERRAIN_NOT_LAND' });
    expect(setDoc).not.toHaveBeenCalled();
  });
});
