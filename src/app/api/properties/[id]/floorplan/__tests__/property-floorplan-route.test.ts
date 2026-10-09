/**
 * @jest-environment node
 *
 * @fileoverview **Η ΠΟΡΤΑ ΤΗΣ ΠΑΡΑΓΟΜΕΝΗΣ ΚΑΤΟΨΗΣ** — ADR-909 Β1.
 * @related app/api/properties/[id]/floorplan/route.ts · ../_shared/publish-property-material
 *
 * 🔑 **Οι κριτές είναι ΠΡΑΓΜΑΤΙΚΟΙ** — συνταγή, κεφαλίδα PNG, δεσμός επιπέδου↔ακινήτου, κατασκευαστής
 * εγγραφής, ταυτότητα διαδοχής. Ψεύτικα είναι μόνο τα **σύνορα**: ταυτότητα, βάση, κάδος, ο ΕΝΑΣ
 * γραφέας της διαδοχής, η επαναπροβολή και η γραφή της δήλωσης *(που έχει δική της άγκυρα)*.
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

/** Το ακίνητο όπως το επιστρέφει ο φρουρός κηδεμονίας — μεταβλητό, ώστε κάθε δοκιμή να ορίζει τον δεσμό. */
let property: Record<string, unknown> = {};
jest.mock('@/lib/auth/tenant-isolation', () => ({
  requirePropertyInTenantScope: async () => property,
}));

const transitionContainer = jest.fn(async (request: { fileId: string }): Promise<unknown> => ({
  kind: 'transitioned', fileId: request.fileId, act: 'supersede', from: 'pre-cde', to: 'SUPERSEDED', revision: 0,
}));
jest.mock('@/services/iso19650/container-transitions', () => ({
  containerActorOf: (ctx: { uid: string; companyId: string }) => ({ uid: ctx.uid, custody: { companyId: ctx.companyId } }),
  transitionContainer: (request: { fileId: string }) => transitionContainer(request),
}));

const trace: string[] = [];
const setDoc = jest.fn(async (_data: Record<string, unknown>) => { trace.push('set'); });
const updateDoc = jest.fn(async () => { trace.push('update'); });

let siblings: readonly Record<string, unknown>[] = [];
let queriedCategory: unknown = null;
const queryGet = jest.fn(async () => {
  trace.push('query');
  return { docs: siblings.map((data) => ({ id: data.id as string, data: () => data })) };
});

let levels: Readonly<Record<string, Record<string, unknown>>> = {};
let sceneFiles: Readonly<Record<string, Record<string, unknown>>> = {};
const getAll = jest.fn(async (...refs: readonly { id: string }[]) => {
  trace.push('getAll');
  return refs.map((ref) => ({ id: ref.id, data: () => sceneFiles[ref.id] }));
});

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => {
    const chain = {
      where: (field: string, _op: string, value: unknown) => {
        if (field === 'category') queriedCategory = value;
        return chain;
      },
      get: queryGet,
    };
    return {
      collection: () => ({
        doc: (id: string) => ({
          id,
          set: setDoc,
          update: updateDoc,
          get: async () => { trace.push('level'); return { data: () => levels[id] }; },
        }),
        where: chain.where,
      }),
      getAll: (...refs: readonly { id: string }[]) => getAll(...refs),
    };
  },
  FieldValue: { serverTimestamp: () => 'ts' },
}));

const uploadPublicFile = jest.fn(async (_params: Record<string, unknown>) => {
  trace.push('upload');
  return { url: '/api/storage/file/x', storagePath: 'p', bucket: 'b', fileId: 'f' };
});
jest.mock('@/services/storage-admin/public-upload.service', () => ({
  uploadPublicFile: (params: Record<string, unknown>) => uploadPublicFile(params),
}));

const refreshListing = jest.fn(async (..._args: unknown[]): Promise<string> => {
  trace.push('refresh');
  return 'published';
});
jest.mock('@/services/listings/listing-media-refresh', () => ({
  refreshListingAfterMediaChange: (...args: unknown[]) => refreshListing(...args),
}));

/** Η **γραφή** της δήλωσης στο σύνορό της· οι δύο καθαροί κριτές της μένουν πραγματικοί. */
const declareFloorplan = jest.fn(async (..._args: unknown[]): Promise<string> => {
  trace.push('declare');
  return 'declared';
});
jest.mock('@/services/listings/floorplan-declaration.service', () => ({
  ...jest.requireActual('@/services/listings/floorplan-declaration.service'),
  declarePublishedFloorplan: (...args: unknown[]) => declareFloorplan(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../route') as typeof import('../route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PUBLISHED_MEDIA_LIMIT } = require('@/services/upload/utils/storage-path-public-shelf') as
  typeof import('@/services/upload/utils/storage-path-public-shelf');

// Η τρέχουσα έκδοση διαβάζεται από τη ρίζα: καρφωμένος αριθμός εδώ κοκκίνιζε 16 tests σε κάθε άνοδο προφίλ.
const { PUBLIC_FLOORPLAN_PROFILE } = require('@/lib/listings/floorplan-render-recipe') as
  typeof import('@/lib/listings/floorplan-render-recipe');
const PROFILE_VERSION = PUBLIC_FLOORPLAN_PROFILE.version;

const PROPERTY = 'prop_48a7caf6-ddeb-4f6b-a074-2d3ddb9daa3b';
const LEVEL = 'lvl_2a7ff5cc-4901-4dda-84f4-a2a243886dc2';
const SCENE = 'file_227cec18-a868-440f-8aa8-a32a7d7133c3';

function recipe(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    profileId: 'public-floorplan', profileVersion: PROFILE_VERSION,
    frame: { minX: 0, minY: 0, maxX: 12000, maxY: 9000 },
    widthPx: 2560, heightPx: 1920, plotStyle: 'colour', groups: [],
    ...over,
  });
}

/** PNG με έγκυρη κεφαλίδα και τις ζητούμενες διαστάσεις — ό,τι ακριβώς διαβάζει η πόρτα. */
function png(widthPx = 2560, heightPx = 1920, type = 'image/png'): File {
  const bytes = new Uint8Array(64);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 0);
  new DataView(bytes.buffer).setUint32(16, widthPx);
  new DataView(bytes.buffer).setUint32(20, heightPx);
  return new File([bytes], 'whatever-the-client-says.png', { type });
}

function request(fields: { file?: File | null; levelId?: string | null; recipe?: string | null } = {}): never {
  const body = new FormData();
  const file = fields.file === undefined ? png() : fields.file;
  const levelId = fields.levelId === undefined ? LEVEL : fields.levelId;
  const declared = fields.recipe === undefined ? recipe() : fields.recipe;
  if (file !== null) body.append('file', file);
  if (levelId !== null) body.append('levelId', levelId);
  if (declared !== null) body.append('recipe', declared);
  return {
    url: `https://x/api/properties/${PROPERTY}/floorplan`,
    nextUrl: { pathname: `/api/properties/${PROPERTY}/floorplan` },
    formData: async () => body,
  } as never;
}

async function post(fields?: Parameters<typeof request>[0]): Promise<{ data: Record<string, unknown> }> {
  const response = await POST(request(fields), undefined as never, undefined as never);
  return (await (response as unknown as Response).json()) as { data: Record<string, unknown> };
}

function refusal(fields?: Parameters<typeof request>[0]): Promise<unknown> {
  return POST(request(fields), undefined as never, undefined as never);
}

describe('ADR-909 Β1 — η πόρτα της παραγόμενης κάτοψης', () => {
  beforeEach(() => {
    trace.length = 0;
    siblings = [];
    queriedCategory = null;
    property = { companyId: 'comp_alfa', buildingId: 'bldg_1', floorId: 'flr_1' };
    levels = { [LEVEL]: { companyId: 'comp_alfa', buildingId: 'bldg_1', floorId: 'flr_1', sceneFileId: SCENE } };
    sceneFiles = { [SCENE]: { companyId: 'comp_alfa', revision: 5 } };
    authContext.permissions = ['listings:listings:publish'];
    jest.clearAllMocks();
  });

  it('🏆 Π1 — γεννιέται ΜΕΤΡΗΜΕΝΗ: ταυτότητα, διαβάθμιση, έκδοση σχεδίου και συνταγή τα γράφει Ο ΔΙΑΚΟΜΙΣΤΗΣ', async () => {
    await post();

    const born = setDoc.mock.calls[0][0];
    expect(born).toMatchObject({
      companyId: 'comp_alfa',
      entityType: 'property',
      entityId: PROPERTY,
      category: 'floorplans',
      classification: 'public',
      contentType: 'image/png',
      status: 'pending',
      publicationIdentity: `floorplan/measured/${LEVEL}`,
      // 🔴 Ο πελάτης έστειλε ΜΟΝΟ `levelId`: αρχείο σκηνής και `revision` διαβάστηκαν από τη βάση.
      sourceRevisions: [{ fileId: SCENE, revision: 5 }],
      renderRecipe: { profileId: 'public-floorplan', profileVersion: PROFILE_VERSION, widthPx: 2560, heightPx: 1920, groups: [] },
    });
    // ⛔ Ούτε το όνομα του αρχείου είναι του πελάτη.
    expect(born.originalFilename).toBe(`${LEVEL}.png`);
    expect(queriedCategory).toBe('floorplans');
  });

  it('Π2 — η σειρά ΕΙΝΑΙ ο μηχανισμός: κρίση → εγγραφή → bytes → έτοιμο → δήλωση → ΕΠΑΝΑΠΡΟΒΟΛΗ τελευταία', async () => {
    await post();

    expect(trace).toEqual(['level', 'getAll', 'query', 'set', 'upload', 'update', 'declare', 'refresh']);
  });

  it('Π3 — Α8: η δημοσίευση ΕΙΝΑΙ η ονομαστική δήλωση — για το ίδιο ακίνητο, από το auth context', async () => {
    const payload = await post();

    expect(declareFloorplan).toHaveBeenCalledTimes(1);
    expect(declareFloorplan.mock.calls[0][1]).toEqual({
      propertyId: PROPERTY, companyId: 'comp_alfa', fileId: payload.data.fileId, performedBy: 'user_1',
    });
    expect(payload.data.declared).toBe('declared');
    expect(payload.data.listing).toBe('published');
    expect(refreshListing.mock.calls[0].slice(1)).toEqual([PROPERTY, 'comp_alfa']);
  });

  it('🏆 Π4 — Α3: διαδέχεται ΜΟΝΟ την παραγόμενη του ΙΔΙΟΥ επιπέδου — ποτέ τη χειροκίνητη, ποτέ άλλου επιπέδου', async () => {
    siblings = [
      { id: 'file_prev', publicationIdentity: `floorplan/measured/${LEVEL}` },
      { id: 'file_other_level', publicationIdentity: 'floorplan/measured/lvl_other' },
      { id: 'file_manual' },
    ];

    const payload = await post();

    expect(payload.data.supersedes).toEqual(['file_prev']);
    expect(payload.data.archived).toEqual(['file_prev']);
    expect(transitionContainer).toHaveBeenCalledTimes(1);
    expect(transitionContainer).toHaveBeenCalledWith(expect.objectContaining({
      fileId: 'file_prev', act: 'supersede', supersededByFileId: payload.data.fileId,
    }));
  });

  it('🔒 Π5 — χωρίς δικαίωμα δημοσίευσης ⇒ άρνηση ΠΡΙΝ διαβαστεί το σώμα', async () => {
    authContext.permissions = [];

    await expect(refusal()).rejects.toMatchObject({ statusCode: 403, message: 'FLOORPLAN_PUBLICATION_NOT_CAPABLE' });
    expect(trace).toEqual([]);
  });

  it('⛔ Π6 — §5: αρχείο σκηνής ΧΩΡΙΣ αναγνώσιμη έκδοση ⇒ ΔΕΝ γεννιέται «μετρημένη» κάτοψη', async () => {
    sceneFiles = { [SCENE]: { companyId: 'comp_alfa' } };

    await expect(refusal()).rejects.toMatchObject({ statusCode: 422, message: 'FLOORPLAN_SOURCE_UNREADABLE' });
    expect(setDoc).not.toHaveBeenCalled();
    expect(uploadPublicFile).not.toHaveBeenCalled();
  });

  it('⛔ Π7 — αρχείο σκηνής ΞΕΝΟΥ μισθωτή ⇒ η έκδοσή του δεν διαβάζεται, άρα άρνηση', async () => {
    sceneFiles = { [SCENE]: { companyId: 'comp_ΑΛΛΗ', revision: 9 } };

    await expect(refusal()).rejects.toMatchObject({ message: 'FLOORPLAN_SOURCE_UNREADABLE' });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it.each([
    ['χωρίς συνταγή', { recipe: null }, 400, 'FLOORPLAN_RECIPE_INVALID'],
    ['ξένο προφίλ', { recipe: recipe({ profileId: 'engineer-view' }) }, 400, 'FLOORPLAN_PROFILE_UNKNOWN'],
    ['παλιά έκδοση προφίλ', { recipe: recipe({ profileVersion: PROFILE_VERSION + 1 }) }, 409, 'FLOORPLAN_PROFILE_STALE'],
    ['χωρίς επίπεδο', { levelId: null }, 400, 'FLOORPLAN_LEVEL_REQUIRED'],
    ['χωρίς αρχείο', { file: null }, 400, 'FLOORPLAN_FILE_REQUIRED'],
    ['όχι PNG', { file: png(2560, 1920, 'image/jpeg') }, 415, 'FLOORPLAN_TYPE_UNSUPPORTED'],
    ['bytes άλλων διαστάσεων από τη συνταγή', { file: png(640, 480) }, 400, 'FLOORPLAN_BYTES_MISMATCH'],
  ])('⛔ Π8 — %s ⇒ ονομασμένη άρνηση, χωρίς ΚΑΜΙΑ ανάγνωση ή εγγραφή στη βάση', async (_name, fields, status, code) => {
    await expect(refusal(fields)).rejects.toMatchObject({ statusCode: status, message: code });
    expect(trace).toEqual([]);
  });

  it('🔐 Π9 — επίπεδο ΞΕΝΟΥ μισθωτή είναι ανύπαρκτο (ίδιο 404 με το ανύπαρκτο)', async () => {
    levels = { [LEVEL]: { ...levels[LEVEL], companyId: 'comp_ΑΛΛΗ' } };
    await expect(refusal()).rejects.toMatchObject({ statusCode: 404, message: 'FLOORPLAN_LEVEL_NOT_FOUND' });

    levels = {};
    await expect(refusal()).rejects.toMatchObject({ statusCode: 404, message: 'FLOORPLAN_LEVEL_NOT_FOUND' });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('🏆 Π10 — ο ΔΟΜΙΚΟΣ δεσμός: επίπεδο άλλου κτιρίου ή άλλου ορόφου ΔΕΝ δημοσιεύεται σε αυτό το ακίνητο', async () => {
    property = { companyId: 'comp_alfa', buildingId: 'bldg_ΑΛΛΟ', floorId: 'flr_1' };
    await expect(refusal()).rejects.toMatchObject({ statusCode: 422, message: 'FLOORPLAN_LEVEL_NOT_OF_PROPERTY' });

    property = { companyId: 'comp_alfa', buildingId: 'bldg_1', floorId: 'flr_3' };
    await expect(refusal()).rejects.toMatchObject({ statusCode: 422, message: 'FLOORPLAN_LEVEL_NOT_OF_PROPERTY' });

    levels = { [LEVEL]: { companyId: 'comp_alfa', sceneFileId: SCENE } };
    await expect(refusal()).rejects.toMatchObject({ statusCode: 422, message: 'FLOORPLAN_LEVEL_UNPLACED' });

    expect(setDoc).not.toHaveBeenCalled();
    expect(getAll).not.toHaveBeenCalled();
  });

  it('⛔ Π11 — επίπεδο χωρίς σχέδιο ⇒ δεν υπάρχει από τι να «μετρηθεί»', async () => {
    levels = { [LEVEL]: { companyId: 'comp_alfa', buildingId: 'bldg_1', floorId: 'flr_1' } };

    await expect(refusal()).rejects.toMatchObject({ statusCode: 422, message: 'FLOORPLAN_LEVEL_WITHOUT_DRAWING' });
  });

  it('⛔ Π12 — γεμάτη δήλωση, χωρίς προκάτοχο ⇒ άρνηση ΠΡΙΝ γραφτεί ή ανέβει οτιδήποτε', async () => {
    property = {
      ...property,
      publishedFloorplans: Array.from({ length: PUBLISHED_MEDIA_LIMIT }, (_, index) => `file_${index}`),
    };

    await expect(refusal()).rejects.toMatchObject({ statusCode: 409, message: 'FLOORPLAN_SHELF_FULL' });
    expect(setDoc).not.toHaveBeenCalled();
    expect(uploadPublicFile).not.toHaveBeenCalled();
  });

  it('🔑 Π13 — γεμάτη δήλωση, αλλά ο ΔΗΛΩΜΕΝΟΣ προκάτοχος δίνει τη θέση του ⇒ δημοσιεύεται', async () => {
    const declared = Array.from({ length: PUBLISHED_MEDIA_LIMIT - 1 }, (_, index) => `file_${index}`);
    property = { ...property, publishedFloorplans: [...declared, 'file_prev'] };
    siblings = [{ id: 'file_prev', publicationIdentity: `floorplan/measured/${LEVEL}` }];

    const payload = await post();

    expect(payload.data.supersedes).toEqual(['file_prev']);
  });

  it('🔑 Π14 — δήλωση που ΔΕΝ γράφτηκε δεν ρίχνει τη δημοσίευση — ΟΝΟΜΑΖΕΤΑΙ στην απάντηση', async () => {
    declareFloorplan.mockImplementationOnce(async () => 'failed');

    const payload = await post();

    expect(payload.data.fileId).toEqual(expect.any(String));
    expect(payload.data.declared).toBe('failed');
    expect(refreshListing).toHaveBeenCalledTimes(1);
  });

  it('⛔ Π15 — ανέβασμα που ΑΠΕΤΥΧΕ: έγγραφο `failed`, καμία δήλωση, καμία επαναπροβολή', async () => {
    uploadPublicFile.mockImplementationOnce(async () => { throw new Error('bucket down'); });

    await expect(refusal()).rejects.toMatchObject({ statusCode: 500, message: 'FLOORPLAN_UPLOAD_FAILED' });
    expect(updateDoc).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    expect(declareFloorplan).not.toHaveBeenCalled();
    expect(refreshListing).not.toHaveBeenCalled();
  });

  it('Π16 — η κάτοψη ΔΕΝ κουβαλά custom metadata: η συνταγή ζει στην εγγραφή, όχι στο αντικείμενο', async () => {
    await post();

    expect(uploadPublicFile.mock.calls[0][0]).not.toHaveProperty('customMetadata');
    expect(uploadPublicFile.mock.calls[0][0]).toMatchObject({ contentType: 'image/png', createdBy: 'user_1' });
  });
});
