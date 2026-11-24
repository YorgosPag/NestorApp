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

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withHeavyRateLimit: <T>(h: T) => h,
  withStandardRateLimit: <T>(h: T) => h,
}));

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

/** Τα bytes κάθε ανεβάσματος — για να διαβαστεί η πηγή που ΠΡΑΓΜΑΤΙ φυλάχτηκε (ADR-920 §14.11 Ζ3). */
const uploadedBuffers: Buffer[] = [];
jest.mock('@/services/storage-admin/public-upload.service', () => ({
  uploadPublicFile: async (params: { buffer: Buffer }) => {
    uploadedBuffers.push(params.buffer);
    trace.push('upload');
    return { url: '/api/storage/file/x', storagePath: 'p', bucket: 'b', fileId: 'f' };
  },
}));

/** Η πηγή που είναι ΗΔΗ δημοσιευμένη στον φάκελο (Ζ3c) — ο κάδος της εγγραφής τη δίνει μαζί με τη δήλωση Δ2. */
let storedSourceBytes = '';
let storedDeclaration = '';
const downloads = jest.fn();
jest.mock('@/server/files/file-record-bucket', () => ({
  fileRecordBucket: () => ({
    file: () => ({
      getMetadata: async () => [{ metadata: { nestorTerrainDeclaration: storedDeclaration } }],
      download: async () => {
        downloads();
        return [Buffer.from(storedSourceBytes, 'utf8')];
      },
    }),
  }),
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

import { encodeTerrainSurveyDeclaration } from '@/lib/terrain/publication/terrain-survey-declaration';

import { greekGridToGeoPoint } from '@/lib/geo/greek-grid';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET, POST, PATCH } = require('../route') as typeof import('../route');

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

/** Ό,τι στέλνει ο browser ως πηγή — κάθε δοκιμή μπορεί να βάλει μέσα και δικό της «περίγραμμα». */
let sentSource: Record<string, unknown> = SOURCE;

/** Ένα τετράγωνο 10 × 10 m μέσα στο ανάγλυφο, WORLD mm. */
const INSIDE_RING = [
  { x: E0 + 5_000, y: N0 + 5_000 }, { x: E0 + 15_000, y: N0 + 5_000 },
  { x: E0 + 15_000, y: N0 + 15_000 }, { x: E0 + 5_000, y: N0 + 15_000 },
];

/** Το σχέδιο του φακέλου με επιβεβαιωμένο περίγραμμα, όπως το γράφει η πόρτα (Ζ3). */
const confirmedDrawing = (plotOutline: unknown): Record<string, unknown> => ({
  id: 'file_drawing',
  publicationIdentity: 'terrain/plot-drawing',
  entityType: 'property_dossier',
  status: 'ready',
  storagePath: 'people/x/drawing.dxf',
  contentType: 'image/vnd.dxf',
  createdAt: '2026-11-20T10:00:00.000Z',
  plotOutline,
});

const CONFIRMED = {
  version: 1, ring: INSIDE_RING, showInListing: true, areaM2: 100, candidateId: 'dxf:P',
  origin: { source: 'dxf', handle: 'P', layer: 'ΟΡΙΟ', closure: 'flag' }, drawingUnit: 'm', drawingSha256: 'a'.repeat(64),
};

/** Η πηγή που είναι ήδη δημοσιευμένη στον φάκελο, με το περίγραμμα που κουβαλά (`null` = κανένα). */
const publishedRelief = (createdAt: string, plotOutline: unknown): Record<string, unknown> => {
  storedSourceBytes = JSON.stringify({ ...SOURCE, version: 2, plotOutline });
  storedDeclaration = encodeTerrainSurveyDeclaration({ surveyorName: 'Α. Τοπογράφος', surveyedOn: '2026-03-14', rightsAffirmed: true });
  return {
    id: 'file_terrain_old',
    publicationIdentity: 'terrain/measured',
    contentType: 'application/json',
    classification: 'public',
    entityType: 'property_dossier',
    status: 'ready',
    storagePath: 'people/x/terrain.json',
    category: 'drawings',
    createdAt,
  };
};

const RING_MM = INSIDE_RING.map(({ x, y }) => [x, y]);
/** Το σχέδιο γράφτηκε 2026-11-20· «παλιότερη» / «νεότερη» πηγή = πριν / μετά από αυτό. */
const BEFORE_DRAWING = '2026-11-10T10:00:00.000Z';
const AFTER_DRAWING = '2026-11-21T10:00:00.000Z';

/** Η πηγή που ΦΥΛΑΧΤΗΚΕ — το τελευταίο ανέβασμα. */
const storedSource = (): { plotOutline: unknown } => JSON.parse(uploadedBuffers[uploadedBuffers.length - 1].toString('utf8'));

const formData = jest.fn(async () => {
  const body = new FormData();
  body.append('source', new File([JSON.stringify(sentSource)], 'survey.json', { type: 'application/json' }));
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
    uploadedBuffers.length = 0;
    downloads.mockClear();
    storedSourceBytes = '';
    storedDeclaration = '';
    sentSource = SOURCE;
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
    // Πρώτο ερώτημα: ό,τι κληρονομεί το νέο ανάγλυφο από τον φάκελο — περίγραμμα (Ζ3) ΚΑΙ γεωαναφορά (§14.12 φάση Α),
    // μαζί (Ι17)· δεύτερο: οι προκάτοχοι. Ως τις 2026-11-24 ήταν τρία: περίγραμμα και γεωαναφορά ρωτούσαν χωριστά.
    expect(trace).toEqual(['query', 'query', 'set', 'upload', 'update', 'audit', 'refresh']);
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

  it('Ι8 — 🔴 περίγραμμα που στέλνει ο BROWSER δεν είναι επιβεβαίωση: χωρίς σχέδιο στον φάκελο ⇒ αφαιρείται', async () => {
    sentSource = {
      ...SOURCE,
      version: 2,
      plotOutline: { ring: INSIDE_RING.map(({ x, y }) => [x, y]), showInListing: true },
    };
    await post();
    expect(storedSource().plotOutline).toBeNull();
  });

  it('Ι9 — 🏆 το ΕΠΙΒΕΒΑΙΩΜΕΝΟ περίγραμμα του φακέλου μπαίνει ΠΑΝΤΑ — και αντικαθιστά ό,τι έστειλε ο browser', async () => {
    siblings = [confirmedDrawing(CONFIRMED)];
    sentSource = { ...SOURCE, version: 2, plotOutline: { ring: [[E0, N0], [E0 + 1, N0], [E0, N0 + 1]], showInListing: false } };
    await post();
    expect(storedSource().plotOutline).toEqual({ ring: INSIDE_RING.map(({ x, y }) => [x, y]), showInListing: true });
  });

  it('Ι10 — 🔒 σχέδιο με ΑΝΑΓΝΩΣΙΜΗ κηδεμονία αλλά χαλασμένη επιβεβαίωση ⇒ 503, τίποτα δεν δημοσιεύεται', async () => {
    siblings = [confirmedDrawing({ version: 1, ring: [] })];
    await expect(post()).rejects.toMatchObject({ statusCode: 503, message: 'TERRAIN_PLOT_OUTLINE_UNREADABLE' });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('Ι11 — σχέδιο στον ΚΑΔΟ χωρίς ανάγλυφο: δεν υπάρχει περίγραμμα να μεταφερθεί', async () => {
    siblings = [{ ...confirmedDrawing(CONFIRMED), isDeleted: true }];
    await post();
    expect(storedSource().plotOutline).toBeNull();
  });

  it('Ι12 — 🏆 Ζ3c copy semantics: σχέδιο στον ΚΑΔΟ, ανάγλυφο με περίγραμμα ⇒ το νέο ανάγλυφο το ΜΕΤΑΦΕΡΕΙ', async () => {
    siblings = [{ ...confirmedDrawing(CONFIRMED), isDeleted: true }, publishedRelief(BEFORE_DRAWING, { ring: RING_MM, showInListing: false })];
    await post();
    expect(storedSource().plotOutline).toEqual({ ring: RING_MM, showInListing: false });
  });

  it('Ι13 — 🔴 «ΣΧΕΔΙΟ ΠΡΩΤΑ»: σχέδιο ΝΕΟΤΕΡΟ από την πηγή (έπεσε η επαναδημοσίευση) ⇒ νικά το σχέδιο, η πηγή δεν κατεβαίνει', async () => {
    siblings = [confirmedDrawing(CONFIRMED), publishedRelief(BEFORE_DRAWING, null)];
    await post();
    expect(storedSource().plotOutline).toEqual({ ring: RING_MM, showInListing: true });
    // Για το ΠΕΡΙΓΡΑΜΜΑ η πηγή δεν κατεβαίνει (νικά το σχέδιο)· κατεβαίνει ΜΙΑ φορά για τη γεωαναφορά που μεταφέρεται
    // στο νέο ανάγλυφο (§14.12 φάση Α) — η δήλωση συστήματος ζει μόνο μέσα στην πηγή.
    expect(downloads).toHaveBeenCalledTimes(1);
  });

  it('Ι14 — 🔴 ρητή αφαίρεση (πηγή ΝΕΟΤΕΡΗ από το σχέδιο, χωρίς περίγραμμα) ⇒ το ενεργό σχέδιο ΔΕΝ το ξαναφέρνει', async () => {
    siblings = [confirmedDrawing(CONFIRMED), publishedRelief(AFTER_DRAWING, null)];
    await post();
    expect(storedSource().plotOutline).toBeNull();
  });

  it('Ι15 — πηγή νεότερη από το σχέδιο: ισχύει η Π9 της ΠΗΓΗΣ (αλλαγή χωρίς σχέδιο), όχι της επιβεβαίωσης', async () => {
    siblings = [confirmedDrawing(CONFIRMED), publishedRelief(AFTER_DRAWING, { ring: RING_MM, showInListing: false })];
    await post();
    expect(storedSource().plotOutline).toEqual({ ring: RING_MM, showInListing: false });
  });

  it('Ι16 — 🔒 πηγή που νικά αλλά δεν διαβάζεται ⇒ 503, τίποτα δεν δημοσιεύεται (ποτέ σιωπηλό «χωρίς περίγραμμα»)', async () => {
    siblings = [publishedRelief(AFTER_DRAWING, null)];
    storedSourceBytes = '{';
    await expect(post()).rejects.toMatchObject({ statusCode: 503, message: 'TERRAIN_CURRENT_SOURCE_UNREADABLE' });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('Ι17 — 🏆 ό,τι κληρονομεί το νέο ανάγλυφο διαβάζεται ΜΙΑ φορά: ένα ερώτημα φακέλου και ένα κατέβασμα', async () => {
    // Η πηγή νικά για το περίγραμμα ΚΑΙ κρατά τη γεωαναφορά: ως τις 2026-11-24 αυτό ήταν 2 ερωτήματα φακέλου + 2 κατεβάσματα.
    siblings = [{ ...confirmedDrawing(CONFIRMED), isDeleted: true }, publishedRelief(BEFORE_DRAWING, { ring: RING_MM, showInListing: false })];
    await post();
    const beforeUpload = trace.slice(0, trace.indexOf('upload'));
    expect(trace).toContain('upload');
    // Δύο ερωτήματα πριν από το ανέβασμα: ΕΝΑ της κληρονομιάς + το ερώτημα προκατόχων του κινητήρα (όπως στο Ι1).
    expect(beforeUpload.filter((step) => step === 'query')).toHaveLength(2);
    expect(downloads).toHaveBeenCalledTimes(1);
    expect(storedSource().plotOutline).toEqual({ ring: RING_MM, showInListing: false });
  });

  it('Ι18 — σχέδιο χωρίς ανάγλυφο (πρώτη δημοσίευση): το περίγραμμα έρχεται από το σχέδιο, καμία πηγή δεν κατεβαίνει', async () => {
    siblings = [confirmedDrawing(CONFIRMED)];
    await post();
    expect(downloads).not.toHaveBeenCalled();
    expect(storedSource().plotOutline).toEqual({ ring: INSIDE_RING.map(({ x, y }) => [x, y]), showInListing: true });
    expect(storedSource()).toMatchObject({ coordinateSystem: null, showLocationInListing: false });
  });
});

/**
 * ADR-920 §14.12 φάση Α — το σκέλος γεωαναφοράς της ΙΔΙΑΣ πόρτας.
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | η δήλωση ΕΓΣΑ'87 γράφεται χωρίς διασταύρωση με τη θέση της αγγελίας | Γ2 · Γ3 |
 * | η συγκατάθεση γράφεται χωρίς δηλωμένο σύστημα | Γ4 |
 * | «τοπικές» αφήνει όρθια τη συγκατάθεση | Γ6 |
 * | το νέο ανάγλυφο κρατά ό,τι έστειλε ο browser | Γ8 |
 * | το νέο ανάγλυφο μεταφέρει δήλωση που δεν στέκει για τα νέα σημεία | Γ9 |
 * | η κατάσταση επιστρέφει συντεταγμένη | Γ10 |
 */
describe('ADR-920 §14.12 Α — γεωαναφορά: δήλωση συστήματος και συγκατάθεση θέσης', () => {
  /** Το κέντρο της αποτύπωσης του fixture (E0 + 10 m, N0 + 10 m), σε WGS84 — από την ΙΔΙΑ σύνθεση με τον χάρτη. */
  const CENTRE = greekGridToGeoPoint(E0 / 1000 + 10, N0 / 1000 + 10);
  const placeAt = (metresNorth: number) => ({
    kind: 'declared', label: 'Οδός 1', accuracy: null, link: null,
    point: { lat: CENTRE.lat + metresNorth / 111_195, lng: CENTRE.lng },
  });

  /** Το δημοσιευμένο ανάγλυφο του φακέλου, με ό,τι λέει η πηγή του για τη θέση. */
  const reliefSaying = (coordinateSystem: string | null, showLocationInListing: boolean): Record<string, unknown> => {
    const record = publishedRelief(BEFORE_DRAWING, null);
    storedSourceBytes = JSON.stringify({ ...SOURCE, version: 3, plotOutline: null, coordinateSystem, showLocationInListing });
    return record;
  };

  type Stored = { coordinateSystem: unknown; showLocationInListing: unknown };
  const stored = (): Stored => storedSource() as unknown as Stored;
  const request = (extra: Record<string, unknown>, query = '') => ({
    url: `https://x/api/owner-properties/${LISTING}/terrain${query}`, nextUrl: { pathname: '/x' }, ...extra,
  }) as never;
  const params = { params: Promise.resolve({ ownerPropertyId: LISTING }) } as never;
  const patch = async (body: unknown) => {
    const response = await PATCH(request({ json: async () => body }), params);
    return (await (response as unknown as Response).json() as { data: { changed: boolean; georeference: Stored; terrain: { fileId: string } | null } }).data;
  };
  const view = async () => {
    const response = await GET(request({}, '?view=georeference'), params);
    return (await (response as unknown as Response).json() as { data: { georeference: Record<string, unknown> | null } }).data;
  };

  beforeEach(() => {
    trace.length = 0;
    siblings = [];
    uploadedBuffers.length = 0;
    downloads.mockClear();
    sentSource = SOURCE;
    callerUid = OWNER;
    dossier = { userId: OWNER, label: 'Οικόπεδο', type: 'plot' };
    ownerProperty = { authorUserId: OWNER, authorCompanyId: null, dossierId: DOSSIER, type: 'plot', title: 'Οικόπεδο', place: placeAt(100) };
    jest.clearAllMocks();
  });

  it('Γ1 — 🏆 δήλωση ΕΓΣΑ\'87 κοντά στη θέση της αγγελίας ⇒ νέα πηγή με τη δήλωση, επαναπροβολή, ίχνος στο ιστορικό', async () => {
    siblings = [reliefSaying(null, false)];
    const data = await patch({ kind: 'coordinate-system', system: 'EPSG:2100' });

    expect(data).toMatchObject({ changed: true, georeference: { coordinateSystem: 'EPSG:2100', showLocationInListing: false } });
    expect(stored()).toMatchObject({ coordinateSystem: 'EPSG:2100', showLocationInListing: false });
    expect(refreshOwner).toHaveBeenCalledTimes(1);
    expect(recordChange).toHaveBeenCalledWith(expect.objectContaining({
      changes: [{ field: 'terrainGeoreference', oldValue: 'file_terrain_old', newValue: data.terrain?.fileId }],
    }));
  });

  it('Γ2 — 🔴 η αποτύπωση πέφτει ΜΑΚΡΙΑ από τη θέση της αγγελίας ⇒ 422 με όνομα, τίποτα δεν γράφεται', async () => {
    siblings = [reliefSaying(null, false)];
    ownerProperty = { ...ownerProperty, place: placeAt(5_000) };
    await expect(patch({ kind: 'coordinate-system', system: 'EPSG:2100' }))
      .rejects.toMatchObject({ statusCode: 422, message: 'TERRAIN_GEOREFERENCE_FAR_FROM_LISTING' });
    expect(setDoc).not.toHaveBeenCalled();
    expect(refreshOwner).not.toHaveBeenCalled();
  });

  it('Γ3 — 🔴 αγγελία που ΑΡΝΗΘΗΚΕ θέση ⇒ 422: δεν υπάρχει τίποτα ανεξάρτητο να διασταυρωθεί', async () => {
    siblings = [reliefSaying(null, false)];
    ownerProperty = { ...ownerProperty, place: { kind: 'declined' } };
    await expect(patch({ kind: 'coordinate-system', system: 'EPSG:2100' }))
      .rejects.toMatchObject({ statusCode: 422, message: 'TERRAIN_GEOREFERENCE_LISTING_POSITION_UNKNOWN' });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('Γ4 — 🔒 συγκατάθεση ΧΩΡΙΣ δηλωμένο ΕΓΣΑ\'87 ⇒ 409: δεν υπάρχει θέση να φανεί', async () => {
    siblings = [reliefSaying(null, false)];
    await expect(patch({ kind: 'location-visibility', showInListing: true }))
      .rejects.toMatchObject({ statusCode: 409, message: 'TERRAIN_GEOREFERENCE_NOT_DECLARED' });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('Γ5 — συγκατάθεση με δηλωμένο σύστημα ⇒ γράφεται· η ίδια ξανά ⇒ `changed: false`, καμία εγγραφή', async () => {
    siblings = [reliefSaying('EPSG:2100', false)];
    expect(await patch({ kind: 'location-visibility', showInListing: true })).toMatchObject({ changed: true });
    expect(stored()).toMatchObject({ coordinateSystem: 'EPSG:2100', showLocationInListing: true });

    siblings = [reliefSaying('EPSG:2100', true)];
    setDoc.mockClear();
    expect(await patch({ kind: 'location-visibility', showInListing: true })).toMatchObject({ changed: false, terrain: null });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('Γ6 — 🔒 «τοπικές συντεταγμένες» ΑΙΡΕΙ τη συγκατάθεση: καμία θέση, κανένα «ναι» που να κρέμεται από αυτήν', async () => {
    siblings = [reliefSaying('EPSG:2100', true)];
    await patch({ kind: 'coordinate-system', system: 'local' });
    expect(stored()).toMatchObject({ coordinateSystem: 'local', showLocationInListing: false });
  });

  it('Γ7 — χωρίς ανάγλυφο ⇒ 409· σώμα που δεν είναι ΚΑΝΕΝΑ από τα δύο λεξιλόγια ⇒ 400', async () => {
    await expect(patch({ kind: 'coordinate-system', system: 'local' }))
      .rejects.toMatchObject({ statusCode: 409, message: 'TERRAIN_GEOREFERENCE_NO_RELIEF' });
    await expect(patch({ kind: 'coordinate-system', system: 'EPSG:4326' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(patch({ kind: 'location-visibility', showInListing: true, centre: CENTRE })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('Γ8 — 🔴 ΝΕΟ ανάγλυφο: ό,τι έστειλε ο browser στα δύο πεδία ΑΝΤΙΚΑΘΙΣΤΑΤΑΙ — πρώτο ανάγλυφο = αδήλωτο, χωρίς συγκατάθεση', async () => {
    sentSource = { ...SOURCE, version: 3, plotOutline: null, coordinateSystem: 'EPSG:2100', showLocationInListing: true };
    await post();
    expect(stored()).toMatchObject({ coordinateSystem: null, showLocationInListing: false });
  });

  it('Γ9 — 🏆 ΝΕΟ ανάγλυφο ΜΕΤΑΦΕΡΕΙ δήλωση + συγκατάθεση όταν στέκουν· σημεία αλλού ⇒ αδήλωτο ΚΑΙ χωρίς συγκατάθεση', async () => {
    siblings = [reliefSaying('EPSG:2100', true)];
    await post();
    expect(stored()).toMatchObject({ coordinateSystem: 'EPSG:2100', showLocationInListing: true });

    siblings = [reliefSaying('EPSG:2100', true)];
    const elsewhere = surveyPoints().map(([x, y, z]) => [x + 9_000_000, y, z]);
    sentSource = { ...SOURCE, points: elsewhere };
    await post();
    expect(stored()).toMatchObject({ coordinateSystem: null, showLocationInListing: false });
  });

  it('Γ10 — η κατάσταση (GET ?view=georeference): δήλωση · πρόταση · ανάγνωση — και ΚΑΜΙΑ συντεταγμένη', async () => {
    expect(await view()).toEqual({ georeference: null });

    siblings = [reliefSaying(null, false)];
    const data = await view();
    expect(data.georeference).toMatchObject({
      coordinateSystem: null, showLocationInListing: false, suggestion: 'EPSG:2100', greekGrid: { kind: 'agrees' },
    });
    expect(JSON.stringify(data)).not.toMatch(/"lat"|"lng"/);
    expect(setDoc).not.toHaveBeenCalled();
  });
});
