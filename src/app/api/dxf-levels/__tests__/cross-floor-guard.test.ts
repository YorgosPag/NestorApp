/**
 * @jest-environment node
 *
 * ADR-714 — SERVER-SIDE cross-floor guard για το `sceneFileId`.
 *
 * Node environment (όχι jsdom): ο handler εισάγει `next/server`, που απαιτεί τα web
 * globals `Request`/`Response` — το jsdom environment δεν τα εκθέτει.
 *
 * Ο client έχει ήδη δύο φρουρούς (load + write path), αλλά ο client δεν είναι έμπιστος:
 * αρκεί ένας νέος καλών, ένα regression ή ένα απευθείας PATCH για να ξαναγραφτεί ο
 * λάθος σύνδεσμος και δύο όροφοι να μοιραστούν ένα `.scene.json` (περιστατικό
 * 2026-07-26). Αυτά τα tests κλειδώνουν τη μοναδική μη-παρακάμψιμη γραμμή.
 */

interface UpdateCall {
  readonly docId: string;
  readonly updates: Record<string, unknown>;
}

const updateCalls: UpdateCall[] = [];
const fileDocs = new Map<string, Record<string, unknown>>();
const levelDocs = new Map<string, Record<string, unknown>>();

jest.mock('server-only', () => ({}));

jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: { FILES: 'files', DXF_VIEWER_LEVELS: 'dxf_viewer_levels' },
}));

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: () => {
          const store = name === 'files' ? fileDocs : levelDocs;
          const data = store.get(id);
          return Promise.resolve({ exists: data !== undefined, data: () => data });
        },
      }),
    }),
  }),
}));

jest.mock('@/lib/firestore/version-check', () => ({
  withVersionCheck: (options: { docId: string; updates: Record<string, unknown> }) => {
    updateCalls.push({ docId: options.docId, updates: options.updates });
    return Promise.resolve({ success: true, newVersion: 2 });
  },
  ConflictError: class ConflictError extends Error {},
}));

jest.mock('@/lib/firestore/entity-creation.service', () => ({
  createEntity: jest.fn(() => Promise.resolve({ id: 'lvl_NEW' })),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { handleUpdateDxfLevel } = require('../dxf-levels.handlers');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ApiError } = require('@/lib/api/ApiErrorHandler');

const FLOOR_A = 'flr_4275c4c9'; // 1ος Όροφος
const FLOOR_B = 'flr_7a0a8be2'; // Ισόγειο
const FILE_B = 'file_751f0286'; // ανήκει στο Ισόγειο
const LEVEL_A = 'lvl_2a7ff5cc'; // 1ος Όροφος

const ctx = { uid: 'uid_1', companyId: 'comp_1', globalRole: 'admin' };

const request = (body: Record<string, unknown>) =>
  ({ json: () => Promise.resolve(body) }) as unknown as Parameters<typeof handleUpdateDxfLevel>[0];

beforeEach(() => {
  updateCalls.length = 0;
  fileDocs.clear();
  levelDocs.clear();

  levelDocs.set(LEVEL_A, { companyId: 'comp_1', floorId: FLOOR_A, _v: 1 });
  fileDocs.set(FILE_B, { entityType: 'floor', entityId: FLOOR_B, companyId: 'comp_1' });
});

describe('handleUpdateDxfLevel — ADR-714 cross-floor guard', () => {
  it('ΑΠΟΡΡΙΠΤΕΙ (409) σύνδεση επιπέδου σε αρχείο άλλου ορόφου', async () => {
    await expect(
      handleUpdateDxfLevel(request({ levelId: LEVEL_A, sceneFileId: FILE_B, _v: 1 }), ctx),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(updateCalls).toHaveLength(0);
  });

  it('ΕΠΙΤΡΕΠΕΙ σύνδεση σε αρχείο του ΙΔΙΟΥ ορόφου', async () => {
    fileDocs.set('file_90ee1df2', { entityType: 'floor', entityId: FLOOR_A, companyId: 'comp_1' });

    await handleUpdateDxfLevel(
      request({ levelId: LEVEL_A, sceneFileId: 'file_90ee1df2', _v: 1 }),
      ctx,
    );

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].updates.sceneFileId).toBe('file_90ee1df2');
  });

  it('ΕΠΙΤΡΕΠΕΙ ΠΑΝΤΑ το ξε-linkάρισμα (null) — είναι η θεραπεία, όχι η ασθένεια', async () => {
    await handleUpdateDxfLevel(
      request({ levelId: LEVEL_A, sceneFileId: null, sceneFileName: null, _v: 1 }),
      ctx,
    );

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].updates.sceneFileId).toBeNull();
  });

  it('ΕΠΙΤΡΕΠΕΙ project/building-scoped σκηνές (δεν είναι floor-scoped)', async () => {
    fileDocs.set('file_PROJ', { entityType: 'project', entityId: 'proj_1', companyId: 'comp_1' });

    await handleUpdateDxfLevel(request({ levelId: LEVEL_A, sceneFileId: 'file_PROJ', _v: 1 }), ctx);

    expect(updateCalls).toHaveLength(1);
  });

  it('κρίνει με τον όροφο ΟΠΩΣ ΘΑ ΕΙΝΑΙ μετά το PATCH, όχι με τον παλιό', async () => {
    // Το ίδιο αίτημα μετακινεί το επίπεδο στον όροφο Β ΚΑΙ το συνδέει με το αρχείο του Β.
    // Αν ο έλεγχος διάβαζε τον αποθηκευμένο (παλιό) όροφο, θα απέρριπτε λάθος.
    await handleUpdateDxfLevel(
      request({ levelId: LEVEL_A, floorId: FLOOR_B, sceneFileId: FILE_B, _v: 1 }),
      ctx,
    );

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].updates.sceneFileId).toBe(FILE_B);
  });

  it('ΑΠΟΡΡΙΠΤΕΙ (404) όταν το αρχείο δεν υπάρχει καν', async () => {
    await expect(
      handleUpdateDxfLevel(request({ levelId: LEVEL_A, sceneFileId: 'file_GHOST', _v: 1 }), ctx),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(updateCalls).toHaveLength(0);
  });

  it('ο guard δεν χαλαρώνει για legacy επίπεδο χωρίς όροφο — απλώς δεν έχει τι να ελέγξει', async () => {
    levelDocs.set('lvl_LEGACY', { companyId: 'comp_1', floorId: null, _v: 1 });

    await handleUpdateDxfLevel(request({ levelId: 'lvl_LEGACY', sceneFileId: FILE_B, _v: 1 }), ctx);

    expect(updateCalls).toHaveLength(1);
  });

  it('ApiError είναι όντως το export που περιμένουμε (sanity)', () => {
    expect(typeof ApiError).toBe('function');
  });
});
