/**
 * @jest-environment node
 *
 * ⚓ ΑΓΚΥΡΑ Α-18 (ADR-845 §7.15, Ο-18) — **η εμβέλεια στον ΔΙΑΚΟΜΙΣΤΗ**.
 *
 * Node environment *(όχι jsdom)*: ο handler εισάγει `next/server`, που απαιτεί τα
 * web globals `Request`/`Response`.
 *
 * ## Οι τρεις ερωτήσεις
 *
 * **Σ1** *«Μπορεί ένα PATCH να αφήσει το επίπεδο να δηλώνει κτήριο που **δεν
 * περιέχει** τον όροφό του;»* — ο client έχει πλέον τύπο που το κάνει αδύνατο,
 * **αλλά ο client δεν είναι έμπιστος**: αρκεί ένας νέος καλών, ένα regression ή
 * ένα απευθείας PATCH. Ίδιο δόγμα με το ADR-714.
 *
 * **Σ2** *«Μπορούν δύο κτήρια να έχουν το καθένα «Ισόγειο»;»* — ο έλεγχος διπλού
 * ονόματος ήταν **ανά tenant**, δηλαδή το δεύτερο κτήριο **δεν μπορούσε** να
 * αποκτήσει ισόγειο. Το όνομα ορόφου είναι μοναδικό **μέσα στο κτήριό του**, όχι
 * μέσα στην εταιρεία *(IFC: `IfcBuildingStorey.Name` ζει κάτω από το `IfcBuilding`)*.
 *
 * **Σ3** *«Ρωτά το ερώτημα λίστας ΠΟΙΟΥ ΚΤΗΡΙΟΥ;»* — φιλτράριζε **μόνο**
 * `companyId`: **6 επίπεδα, 4 κτήρια, 3 έργα, μία λίστα** *(μετρημένο)*.
 *
 * ⚠️ Το τεστ **μετρά τι ρώτησε ο διακομιστής** *(τα `where` καταγράφονται)*, όχι
 * τι επέστρεψε ένα ψεύτικο — αλλιώς θα ήταν πράσινο πάνω σε νεκρό δρόμο.
 */

interface WhereClause {
  readonly collection: string;
  readonly field: string;
  readonly op: string;
  readonly value: unknown;
}

interface UpdateCall {
  readonly docId: string;
  readonly updates: Record<string, unknown>;
}

const updateCalls: UpdateCall[] = [];
const createCalls: Array<Record<string, unknown>> = [];
const whereClauses: WhereClause[] = [];
const levelDocs = new Map<string, Record<string, unknown>>();
const floorDocs = new Map<string, Record<string, unknown>>();
const fileDocs = new Map<string, Record<string, unknown>>();
/** Τι θα «βρει» ο έλεγχος διπλού ονόματος στην επόμενη κλήση. */
let duplicateQueryEmpty = true;

jest.mock('server-only', () => ({}));

jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: {
    FILES: 'files',
    DXF_VIEWER_LEVELS: 'dxf_viewer_levels',
    FLOORS: 'floors',
  },
}));

/** Ψεύτικο Firestore που **καταγράφει τα ερωτήματα** αντί να τα κρύβει. */
function makeQuery(collection: string) {
  const q = {
    where(field: string, op: string, value: unknown) {
      whereClauses.push({ collection, field, op, value });
      return q;
    },
    orderBy() {
      return q;
    },
    select() {
      return q;
    },
    limit() {
      return q;
    },
    get: () =>
      Promise.resolve(
        collection === 'dxf_viewer_levels' && !duplicateQueryEmpty
          ? { empty: false, docs: [] }
          : { empty: true, docs: [] },
      ),
  };
  return q;
}

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: (name: string) => {
      const q = makeQuery(name);
      return Object.assign(q, {
        doc: (id: string) => ({
          get: () => {
            const store =
              name === 'files' ? fileDocs : name === 'floors' ? floorDocs : levelDocs;
            const data = store.get(id);
            return Promise.resolve({ exists: data !== undefined, data: () => data });
          },
        }),
      });
    },
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
  createEntity: jest.fn((_type: string, options: Record<string, unknown>) => {
    createCalls.push(options);
    return Promise.resolve({ id: 'lvl_NEW' });
  }),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  handleUpdateDxfLevel,
  handleCreateDxfLevel,
  handleListDxfLevels,
} = require('../dxf-levels.handlers');

// ─── Ο κόσμος: δύο κτήρια, ένας όροφος στο καθένα ────────────────────────────
const BLDG_A = 'bldg_aaaaaaaa';
const BLDG_B = 'bldg_bbbbbbbb';
const FLOOR_A1 = 'flr_aaaa0001';
const FLOOR_B1 = 'flr_bbbb0001';
const LEVEL_A = 'lvl_aaaa0001';

const ctx = { uid: 'uid_1', companyId: 'comp_1', globalRole: 'admin' };

const patch = (body: Record<string, unknown>) =>
  ({ json: () => Promise.resolve(body) }) as unknown as Parameters<typeof handleUpdateDxfLevel>[0];

const listRequest = (query: string) =>
  ({ url: `https://x/api/dxf-levels${query}` }) as unknown as Parameters<typeof handleListDxfLevels>[0];

beforeEach(() => {
  updateCalls.length = 0;
  createCalls.length = 0;
  whereClauses.length = 0;
  levelDocs.clear();
  floorDocs.clear();
  fileDocs.clear();
  duplicateQueryEmpty = true;

  levelDocs.set(LEVEL_A, { companyId: 'comp_1', floorId: FLOOR_A1, buildingId: BLDG_A, _v: 1 });
  floorDocs.set(FLOOR_A1, { companyId: 'comp_1', buildingId: BLDG_A });
  floorDocs.set(FLOOR_B1, { companyId: 'comp_1', buildingId: BLDG_B });
});

describe('Σ1 — 🔴 ΓΡΑΦΗ: το επίπεδο δεν επιτρέπεται να δηλώσει ξένο κτήριο', () => {
  it('ΑΠΟΡΡΙΠΤΕΙ (409) PATCH που βάζει κτήριο ξένο προς τον αποθηκευμένο όροφο', async () => {
    await expect(
      handleUpdateDxfLevel(patch({ levelId: LEVEL_A, buildingId: BLDG_B, _v: 1 }), ctx),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(updateCalls).toHaveLength(0);
  });

  it('ΑΠΟΡΡΙΠΤΕΙ (409) PATCH που βάζει όροφο ξένου κτηρίου δίπλα στο αποθηκευμένο κτήριο', async () => {
    await expect(
      handleUpdateDxfLevel(patch({ levelId: LEVEL_A, floorId: FLOOR_B1, _v: 1 }), ctx),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(updateCalls).toHaveLength(0);
  });

  it('ΕΠΙΤΡΕΠΕΙ τη ΜΕΤΑΚΙΝΗΣΗ όταν το ζευγάρι έρχεται ΟΛΟΚΛΗΡΟ — κρίνει το ΜΕΤΑ, όχι το πριν', async () => {
    await handleUpdateDxfLevel(
      patch({ levelId: LEVEL_A, floorId: FLOOR_B1, buildingId: BLDG_B, _v: 1 }),
      ctx,
    );

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].updates.floorId).toBe(FLOOR_B1);
    expect(updateCalls[0].updates.buildingId).toBe(BLDG_B);
  });

  it('ΕΠΙΤΡΕΠΕΙ ΠΑΝΤΑ το ξε-δέσιμο (null) — είναι η θεραπεία, όχι η ασθένεια', async () => {
    await handleUpdateDxfLevel(
      patch({ levelId: LEVEL_A, floorId: null, buildingId: null, _v: 1 }),
      ctx,
    );

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].updates.floorId).toBeNull();
  });

  it('ΔΕΝ κατηγορεί όταν ο όροφος δεν βρίσκεται — άγνοια δεν είναι ενοχή', async () => {
    await handleUpdateDxfLevel(
      patch({ levelId: LEVEL_A, floorId: 'flr_GHOST', buildingId: BLDG_B, _v: 1 }),
      ctx,
    );

    expect(updateCalls).toHaveLength(1);
  });

  it('ΔΕΝ τρέχει καθόλου όταν το αίτημα δεν αγγίζει την εμβέλεια', async () => {
    await handleUpdateDxfLevel(patch({ levelId: LEVEL_A, name: 'Νέο όνομα', _v: 1 }), ctx);

    expect(updateCalls).toHaveLength(1);
    // Κανένα διάβασμα ορόφου: «δεν σε κατηγορώ για ό,τι βρήκα, σε σταματώ όταν το γράφεις».
    expect(whereClauses.filter((w) => w.collection === 'floors')).toHaveLength(0);
  });

  it('ο ίδιος φρουρός τρέχει και στη ΔΗΜΙΟΥΡΓΙΑ', async () => {
    await expect(
      handleCreateDxfLevel(
        patch({ name: 'Ισόγειο', order: 0, floorId: FLOOR_A1, buildingId: BLDG_B }),
        ctx,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(createCalls).toHaveLength(0);
  });
});

describe('Σ2 — το όνομα ορόφου είναι μοναδικό ΜΕΣΑ ΣΤΟ ΚΤΗΡΙΟ, όχι μέσα στην εταιρεία', () => {
  it('ρωτά ΚΑΙ το κτήριο στον έλεγχο διπλού ονόματος', async () => {
    await handleCreateDxfLevel(
      patch({ name: 'Ισόγειο', order: 0, floorId: FLOOR_B1, buildingId: BLDG_B }),
      ctx,
    );

    const dupWhere = whereClauses.filter((w) => w.collection === 'dxf_viewer_levels');
    expect(dupWhere).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'buildingId', value: BLDG_B })]),
    );
  });

  it('το κτήριο ΦΤΑΝΕΙ στο έγγραφο που γράφεται — δεν χάνεται στη δημιουργία', async () => {
    await handleCreateDxfLevel(
      patch({ name: 'Ισόγειο', order: 0, floorId: FLOOR_B1, buildingId: BLDG_B }),
      ctx,
    );

    expect(createCalls).toHaveLength(1);
    const fields = createCalls[0].entitySpecificFields as Record<string, unknown>;
    expect(fields.buildingId).toBe(BLDG_B);
  });
});

describe('Σ3 — η λίστα ρωτά ΠΟΙΟΥ ΚΤΗΡΙΟΥ', () => {
  it('εφαρμόζει το `buildingId` του αιτήματος στο ερώτημα', async () => {
    await handleListDxfLevels(listRequest(`?buildingId=${BLDG_B}`), ctx);

    expect(whereClauses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ collection: 'dxf_viewer_levels', field: 'buildingId', value: BLDG_B }),
      ]),
    );
  });

  it('χωρίς `buildingId` δεν φιλτράρει κτήριο — η συμβατότητα δεν σπάει σιωπηλά', async () => {
    await handleListDxfLevels(listRequest(''), ctx);

    expect(whereClauses.filter((w) => w.field === 'buildingId')).toHaveLength(0);
    expect(whereClauses).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'companyId', value: 'comp_1' })]),
    );
  });
});
