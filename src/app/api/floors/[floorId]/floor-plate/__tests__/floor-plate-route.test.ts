/**
 * @jest-environment node
 *
 * @fileoverview **Η ΠΟΡΤΑ ΤΗΣ ΔΗΛΩΣΗΣ ΟΡΟΦΟΥ, ΕΚΤΕΛΕΣΜΕΝΗ** — `GET` · `POST` · `DELETE` (ADR-907 §11.7 · §11.10 · §11.12).
 * @related app/api/floors/[floorId]/floor-plate/route.ts
 *
 * Ως εδώ η πόρτα είχε επαληθευτεί μόνο ζωντανά, και μόνο το `GET` (§11.10 «Τι ΔΕΝ έχει ιδωθεί»). Οι άγκυρες:
 *
 * ΠΔ-1 — η **ανάγνωση** δεν ζητά δικαίωμα δημοσίευσης, διαβάζει τη δήλωση από το έγγραφο που έφερε η κηδεμονία, και δεν
 *        γράφει ούτε ξαναπροβάλλει τίποτα;
 * ΠΔ-2 — 🔒 η **κηδεμονία** προηγείται όλων: ξένος / ανύπαρκτος όροφος ⇒ η απάντηση του `loadFloorInTenant` αυτούσια,
 *        και κανείς δεν ρωτήθηκε για δικαίωμα· χωρίς οργανισμό, ούτε ανάγνωση ορόφου;
 * ΠΔ-3 — 🔒 γραφή χωρίς δικαίωμα δημοσίευσης ⇒ `403 FLOOR_PLATE_NOT_CAPABLE`, **πριν διαβαστεί το σώμα**;
 * ΠΔ-4 — σώμα χωρίς αναγνώσιμο `fileId` ⇒ `400 FLOOR_PLATE_FILE_REQUIRED`, και ο γραφέας δεν καλείται;
 * ΠΔ-5 — 🔒 ο υπογράφων και ο μισθωτής έρχονται από την **απόδειξη**, ο όροφος από τη **διεύθυνση** — ποτέ από το σώμα;
 * ΠΔ-6 — 🔴 η επαναπροβολή είναι **τελευταία και awaited** (Ο-35), και τρέχει και στο `already` / `absent`;
 * ΠΔ-7 — 🔴 η άρνηση **επιστρέφεται** ως `409` που ο δίδυμος αναγνώστης (`readFloorPlateRefusal`) διαβάζει — και τότε
 *        καμία αγγελία δεν ξαναπροβάλλεται;
 * ΠΔ-8 — αποτυχία του γραφέα ⇒ `500 FLOOR_PLATE_FAILED`, που **δεν** διαβάζεται ως άρνηση;
 * ΠΔ-9 — κάθε ρήμα περνά από το σύνορο `withAuth` με το ίδιο δικαίωμα θέασης και από το όριο ρυθμού.
 *
 * ⚠️ **Τι είναι αληθινό εδώ**: ο κεντρικός χειριστής σφαλμάτων (`ApiErrorHandler`), το `apiSuccess`, ο γραφέας και ο
 * αναγνώστης του σώματος άρνησης, ο αναγνώστης της δήλωσης, η εξαγωγή του ορόφου από τη διεύθυνση. Ψεύτικα: το σύνορο
 * ταυτότητας, η κηδεμονία, ο κριτής δικαιώματος, ο γραφέας της δήλωσης και η επαναπροβολή — καθένα έχει δικές του άγκυρες.
 */

/**
 * ⚠️ **INSTANCE, όχι σκέτο αντικείμενο** (ίδια παγίδα με το `brokerage-declaration-route.test`): η πόρτα ξεχωρίζει την
 * άρνηση κηδεμονίας με `instanceof NextResponse`. Με `{ status, body }` κάθε 404 περνούσε ως «άνοιξε η πόρτα».
 */
jest.mock('next/server', () => {
  class MockNextResponse {
    readonly status: number;
    private readonly body: unknown;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    async json(): Promise<unknown> {
      return this.body;
    }
    static json(body: unknown, init?: { status?: number }): MockNextResponse {
      return new MockNextResponse(body, init);
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/services/ErrorTracker', () => ({ errorTracker: { captureError: jest.fn() } }));

/*
 * `var` ΧΩΡΙΣ αρχική τιμή: η πόρτα τυλίγεται στη **φόρτωση** του module, δηλαδή πριν τρέξει οποιαδήποτε ανάθεση αυτού
 * του αρχείου (τα `import` ανεβαίνουν). Ό,τι μετριέται εκεί γεννιέται μέσα στο εργοστάσιο· ανάθεση εδώ θα το μηδένιζε.
 */
var wrappedWith: { permissions?: string }[] | undefined;
var rateLimited: number | undefined;
var authCtx: { uid: string; companyId: string | undefined; globalRole: string; permissions: readonly string[] };

/**
 * Το σύνορο ταυτότητας, με **αληθινό** χειριστή σφαλμάτων πίσω του — όπως το `handler-execution` του `withAuth`. Αλλιώς
 * ένα `throw new ApiError(...)` θα ήταν εξαίρεση στο test και όχι το σώμα που φτάνει στον πελάτη.
 */
jest.mock('@/lib/auth', () => ({
  withAuth: (callback: (request: unknown, ctx: unknown, cache: unknown) => Promise<unknown>, options: { permissions?: string }) => {
    (wrappedWith ??= []).push(options);
    return async (request: unknown) => {
      try {
        return await callback(request, authCtx, {});
      } catch (error) {
        const { ApiErrorHandler } = jest.requireActual('@/lib/api/ApiErrorHandler');
        return ApiErrorHandler.getInstance().handleError(error, request);
      }
    };
  },
}));

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: <T>(handler: T): T => {
    rateLimited = (rateLimited ?? 0) + 1;
    return handler;
  },
}));

const ADMIN_DB = { marker: 'admin-db' };
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ADMIN_DB }));

const loadFloor = jest.fn();
jest.mock('@/app/api/floors/floors.shared', () => ({
  loadFloorInTenant: (...args: unknown[]) => loadFloor(...args),
}));

const mayPublish = jest.fn();
jest.mock('@/services/file-record/file-classification.service', () => ({
  mayChangePublication: (...args: unknown[]) => mayPublish(...args),
}));

const declare = jest.fn();
const withdraw = jest.fn();
jest.mock('@/services/listings/floor-plate-declaration.service', () => ({
  declareFloorPlate: (...args: unknown[]) => declare(...args),
  withdrawFloorPlate: (...args: unknown[]) => withdraw(...args),
}));

const refresh = jest.fn();
jest.mock('@/services/listings/listing-media-refresh', () => ({
  refreshListingsOfFloor: (...args: unknown[]) => refresh(...args),
}));

import { setImmediate } from 'node:timers';

import { NextResponse } from 'next/server';

import { readFloorPlateRefusal } from '@/lib/listings/floor-plate/floor-plate-refusal';

import { DELETE, GET, POST } from '../route';

const FLOOR_ID = 'flr_alfa';
const URL_OF_FLOOR = `http://localhost/api/floors/${FLOOR_ID}/floor-plate`;
const DECLARATION = { fileId: 'file_plate', declaredBy: 'user_1', declaredAt: '2026-10-10T08:00:00.000Z' };
const LISTINGS = [{ propertyId: 'prop_1', state: 'refreshed' }];

type Verb = typeof GET;
interface Answer {
  readonly status: number;
  readonly body: Record<string, unknown>;
}

/** Το αίτημα όπως το βλέπει η πόρτα: διεύθυνση, μέθοδος, και σώμα που **μετρά** αν διαβάστηκε. */
function requestOf(body?: unknown, url = URL_OF_FLOOR) {
  const json = jest.fn(async () => {
    if (body === 'ΑΚΥΡΟ JSON') throw new SyntaxError('Unexpected token');
    return body;
  });
  return { url, method: 'TEST', headers: new Headers(), nextUrl: new URL(url), json };
}

async function call(verb: Verb, request = requestOf()): Promise<Answer> {
  const handler = verb as unknown as (r: unknown) => Promise<{ status: number; json: () => Promise<Record<string, unknown>> }>;
  const response = await handler(request);
  return { status: response.status, body: await response.json() };
}

const dataOf = (answer: Answer) => answer.body.data as Record<string, unknown>;
const WRITES: readonly (readonly [string, Verb, jest.Mock])[] = [['POST', POST, declare], ['DELETE', DELETE, withdraw]];
const VERBS: readonly (readonly [string, Verb])[] = [['GET', GET], ['POST', POST], ['DELETE', DELETE]];

beforeEach(() => {
  jest.clearAllMocks();
  authCtx = { uid: 'user_1', companyId: 'comp_alfa', globalRole: 'company_admin', permissions: ['listings:listings:publish'] };
  loadFloor.mockResolvedValue({ ref: {}, data: { name: 'Ισόγειο', publishedFloorPlate: DECLARATION } });
  mayPublish.mockReturnValue(true);
  declare.mockResolvedValue({ state: 'declared', declaration: DECLARATION });
  withdraw.mockResolvedValue({ state: 'withdrawn' });
  refresh.mockResolvedValue(LISTINGS);
});

describe('ΠΔ-1 — η ΑΝΑΓΝΩΣΗ: ποιος υπέγραψε, και αν εσύ μπορείς', () => {
  it('🔑 δήλωση + `mayDeclare`, από το έγγραφο που έφερε η κηδεμονία', async () => {
    const answer = await call(GET);

    expect(answer.status).toBe(200);
    expect(dataOf(answer)).toEqual({ floorId: FLOOR_ID, declaration: DECLARATION, mayDeclare: true });
    expect(loadFloor).toHaveBeenCalledTimes(1);
    expect(loadFloor).toHaveBeenCalledWith(ADMIN_DB, FLOOR_ID, authCtx);
  });

  it('🔴 χωρίς δικαίωμα δημοσίευσης η ανάγνωση ΔΕΝ αρνείται — λέει `mayDeclare: false`', async () => {
    mayPublish.mockReturnValue(false);

    const answer = await call(GET);

    expect(answer.status).toBe(200);
    expect(dataOf(answer)).toEqual({ floorId: FLOOR_ID, declaration: DECLARATION, mayDeclare: false });
  });

  it.each([
    ['κανένα πεδίο', {}],
    ['δήλωση χωρίς υπογράφοντα', { publishedFloorPlate: { fileId: 'file_plate', declaredAt: DECLARATION.declaredAt } }],
  ])('όροφος με %s ⇒ `declaration: null`, ποτέ μισή δήλωση', async (_label, floor) => {
    loadFloor.mockResolvedValue({ ref: {}, data: floor });

    expect(dataOf(await call(GET)).declaration).toBeNull();
  });

  it('🔴 η ανάγνωση ΔΕΝ γράφει και ΔΕΝ ξαναπροβάλλει', async () => {
    await call(GET);

    expect(declare).not.toHaveBeenCalled();
    expect(withdraw).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('🔒 το δικαίωμα ρωτιέται για ΑΥΤΟΝ που ζήτησε: ρόλος, δικαιώματα και οργανισμός της απόδειξης', async () => {
    await call(GET);

    expect(mayPublish).toHaveBeenCalledWith({
      globalRole: 'company_admin',
      permissions: ['listings:listings:publish'],
      companyId: 'comp_alfa',
    });
  });
});

describe('ΠΔ-2 — 🔒 η ΚΗΔΕΜΟΝΙΑ προηγείται όλων', () => {
  it.each(VERBS)('%s σε ξένο όροφο ⇒ η απάντηση της κηδεμονίας ΑΥΤΟΥΣΙΑ, και τίποτα άλλο δεν ρωτήθηκε', async (_name, verb) => {
    const refusal = NextResponse.json({ error: 'Floor not found' }, { status: 404 });
    loadFloor.mockResolvedValue(refusal);
    const request = requestOf({ fileId: 'file_plate' });

    const answer = await call(verb, request);

    expect(answer.status).toBe(404);
    expect(answer.body).toEqual({ error: 'Floor not found' });
    expect(mayPublish).not.toHaveBeenCalled();
    expect(request.json).not.toHaveBeenCalled();
    expect(declare).not.toHaveBeenCalled();
    expect(withdraw).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each(VERBS)('%s χωρίς οργανισμό στην απόδειξη ⇒ 403, και ΚΑΝΕΝΑΣ όροφος δεν διαβάστηκε', async (_name, verb) => {
    authCtx.companyId = undefined;

    const answer = await call(verb, requestOf({ fileId: 'file_plate' }));

    expect(answer.status).toBe(403);
    expect(loadFloor).not.toHaveBeenCalled();
    expect(declare).not.toHaveBeenCalled();
    expect(withdraw).not.toHaveBeenCalled();
  });

  it('ο όροφος είναι το τμήμα ΜΕΤΑ το `floors` της διεύθυνσης — όχι το τελευταίο, όχι παράμετρος', async () => {
    const url = 'http://localhost/api/floors/flr_apo_ti_diefthynsi/floor-plate?floorId=flr_apo_parametro';

    const answer = await call(GET, requestOf(undefined, url));

    expect(dataOf(answer).floorId).toBe('flr_apo_ti_diefthynsi');
    expect(loadFloor).toHaveBeenCalledWith(ADMIN_DB, 'flr_apo_ti_diefthynsi', authCtx);
  });

  it('διεύθυνση χωρίς όροφο ⇒ 400, και κανένας όροφος δεν διαβάστηκε', async () => {
    const answer = await call(GET, requestOf(undefined, 'http://localhost/api/floors/'));

    expect(answer.status).toBe(400);
    expect(loadFloor).not.toHaveBeenCalled();
  });
});

describe('ΠΔ-3 — 🔒 γραφή χωρίς δικαίωμα δημοσίευσης', () => {
  it.each(WRITES)('%s ⇒ 403 FLOOR_PLATE_NOT_CAPABLE, ΠΡΙΝ διαβαστεί το σώμα', async (_name, verb, writer) => {
    mayPublish.mockReturnValue(false);
    const request = requestOf({ fileId: 'file_plate' });

    const answer = await call(verb, request);

    expect(answer.status).toBe(403);
    expect(answer.body.errorCode).toBe('FLOOR_PLATE_NOT_CAPABLE');
    expect(request.json).not.toHaveBeenCalled();
    expect(writer).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('ΠΔ-4 — η υπογραφή ΟΝΟΜΑΖΕΙ εικόνα', () => {
  it.each([
    ['κανένα σώμα', undefined],
    ['άκυρο JSON', 'ΑΚΥΡΟ JSON'],
    ['σώμα που δεν είναι αντικείμενο', 'file_plate'],
    ['χωρίς `fileId`', {}],
    ['κενό `fileId`', { fileId: '' }],
    ['`fileId` μόνο με κενά', { fileId: '   ' }],
    ['`fileId` που δεν είναι κείμενο', { fileId: 42 }],
    ['`fileId` ως πίνακας', { fileId: ['file_plate'] }],
  ])('%s ⇒ 400 FLOOR_PLATE_FILE_REQUIRED, και ο γραφέας ΔΕΝ καλείται', async (_label, body) => {
    const answer = await call(POST, requestOf(body));

    expect(answer.status).toBe(400);
    expect(answer.body.errorCode).toBe('FLOOR_PLATE_FILE_REQUIRED');
    expect(declare).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('η άρση ΔΕΝ ζητά σώμα — δεν το διαβάζει καν', async () => {
    const request = requestOf('ΑΚΥΡΟ JSON');

    const answer = await call(DELETE, request);

    expect(answer.status).toBe(200);
    expect(request.json).not.toHaveBeenCalled();
  });
});

describe('ΠΔ-5 — 🔒 ποιος υπογράφει, για ποιον μισθωτή, σε ποιον όροφο', () => {
  const FORGED = { fileId: 'file_plate', companyId: 'comp_xeno', floorId: 'flr_xenos', performedBy: 'user_xenos' };

  it('🔴 POST: ταυτότητα από την απόδειξη, όροφος από τη διεύθυνση — το σώμα δίνει ΜΟΝΟ την εικόνα', async () => {
    await call(POST, requestOf(FORGED));

    expect(declare).toHaveBeenCalledTimes(1);
    expect(declare).toHaveBeenCalledWith(ADMIN_DB, {
      floorId: FLOOR_ID,
      companyId: 'comp_alfa',
      performedBy: 'user_1',
      fileId: 'file_plate',
    });
    expect(withdraw).not.toHaveBeenCalled();
  });

  it('🔴 DELETE: ο ίδιος πράττων, ΧΩΡΙΣ εικόνα — και ποτέ ο γραφέας της υπογραφής', async () => {
    await call(DELETE, requestOf(FORGED));

    expect(withdraw).toHaveBeenCalledTimes(1);
    expect(withdraw).toHaveBeenCalledWith(ADMIN_DB, { floorId: FLOOR_ID, companyId: 'comp_alfa', performedBy: 'user_1' });
    expect(declare).not.toHaveBeenCalled();
  });
});

describe('ΠΔ-6 — 🔴 η επαναπροβολή είναι ΤΕΛΕΥΤΑΙΑ και awaited (Ο-35)', () => {
  it('υπογραφή ⇒ 200 με την έκβαση, τη δήλωση και ό,τι έγινε σε κάθε αγγελία του ορόφου', async () => {
    const answer = await call(POST, requestOf({ fileId: 'file_plate' }));

    expect(answer.status).toBe(200);
    expect(dataOf(answer)).toEqual({ floorId: FLOOR_ID, state: 'declared', declaration: DECLARATION, listings: LISTINGS });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith(ADMIN_DB, FLOOR_ID, 'comp_alfa');
  });

  it('η επαναπροβολή αρχίζει ΑΦΟΥ γράψει ο γραφέας — ποτέ πριν, ποτέ παράλληλα', async () => {
    const order: string[] = [];
    declare.mockImplementation(async () => {
      await Promise.resolve();
      order.push('γραφή');
      return { state: 'declared', declaration: DECLARATION };
    });
    refresh.mockImplementation(async () => {
      order.push('επαναπροβολή');
      return LISTINGS;
    });

    await call(POST, requestOf({ fileId: 'file_plate' }));

    expect(order).toEqual(['γραφή', 'επαναπροβολή']);
  });

  it('η απάντηση ΔΕΝ φεύγει όσο η επαναπροβολή τρέχει', async () => {
    let finish: (reports: unknown) => void = () => undefined;
    refresh.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    let answered = false;

    const pending = call(POST, requestOf({ fileId: 'file_plate' })).then((answer) => {
      answered = true;
      return answer;
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(answered).toBe(false);

    finish(LISTINGS);
    expect(dataOf(await pending).listings).toEqual(LISTINGS);
  });

  it('`already` ⇒ η δήλωση που ΙΣΧΥΕΙ (ο αρχικός υπογράφων), και η επαναπροβολή τρέχει ξανά', async () => {
    const standing = { fileId: 'file_plate', declaredBy: 'user_protos', declaredAt: '2026-10-01T08:00:00.000Z' };
    declare.mockResolvedValue({ state: 'already', declaration: standing });

    const answer = await call(POST, requestOf({ fileId: 'file_plate' }));

    expect(dataOf(answer)).toEqual({ floorId: FLOOR_ID, state: 'already', declaration: standing, listings: LISTINGS });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it.each(['withdrawn', 'absent'] as const)('άρση `%s` ⇒ `declaration: null`, και η επαναπροβολή τρέχει', async (state) => {
    withdraw.mockResolvedValue({ state });

    const answer = await call(DELETE);

    expect(answer.status).toBe(200);
    expect(dataOf(answer)).toEqual({ floorId: FLOOR_ID, state, declaration: null, listings: LISTINGS });
    expect(refresh).toHaveBeenCalledWith(ADMIN_DB, FLOOR_ID, 'comp_alfa');
  });
});

describe('ΠΔ-7 — 🔴 η άρνηση ΕΠΙΣΤΡΕΦΕΤΑΙ, και ο δίδυμος αναγνώστης τη διαβάζει', () => {
  it.each([
    ['image-not-public', null],
    ['unlinked-outline', 'ovl_7'],
    ['not-declared', null],
  ] as const)('`%s` ⇒ 409 με `why` και `overlayId` στη ΡΙΖΑ του σώματος', async (why, overlayId) => {
    declare.mockResolvedValue({ state: 'refused', why, overlayId });

    const answer = await call(POST, requestOf({ fileId: 'file_plate' }));

    expect(answer.status).toBe(409);
    expect(answer.body.success).toBe(false);
    expect(answer.body.errorCode).toBe('FLOOR_PLATE_REFUSED');
    expect(readFloorPlateRefusal(answer.body)).toEqual({ why, overlayId });
    expect(answer.body).not.toHaveProperty('details');
    expect(answer.body).not.toHaveProperty('data');
  });

  it('άρνηση = τίποτα δεν γράφτηκε ⇒ ΚΑΜΙΑ αγγελία δεν ξαναπροβάλλεται', async () => {
    declare.mockResolvedValue({ state: 'refused', why: 'image-not-public', overlayId: null });

    await call(POST, requestOf({ fileId: 'file_plate' }));

    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('ΠΔ-8 — αποτυχία του γραφέα', () => {
  it.each(WRITES)('%s `failed` ⇒ 500 FLOOR_PLATE_FAILED, που ΔΕΝ διαβάζεται ως άρνηση', async (_name, verb, writer) => {
    writer.mockResolvedValue({ state: 'failed' });

    const answer = await call(verb, requestOf({ fileId: 'file_plate' }));

    expect(answer.status).toBe(500);
    expect(answer.body.errorCode).toBe('FLOOR_PLATE_FAILED');
    expect(readFloorPlateRefusal(answer.body)).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('ΠΔ-9 — το σύνορο', () => {
  it('🔒 τρία ρήματα, τρεις φορές `withAuth` με το ίδιο δικαίωμα θέασης ορόφων, τρεις φορές όριο ρυθμού', () => {
    // Μετρώνται στη φόρτωση του module — πριν από κάθε `clearAllMocks`, γι' αυτό σε δικές τους μεταβλητές.
    expect(wrappedWith).toEqual([
      { permissions: 'projects:floors:view' },
      { permissions: 'projects:floors:view' },
      { permissions: 'projects:floors:view' },
    ]);
    expect(rateLimited).toBe(3);
  });
});
