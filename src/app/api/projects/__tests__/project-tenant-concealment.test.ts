/**
 * Η μεταμφίεση σε **κάθε σχήμα σύρματος** του πεδίου ορισμού — ADR-742 §7sexies
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ Η ΣΟΥΙΤΑ ΤΟΥ ΦΥΛΑΚΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο φύλακας μπορεί να είναι τέλειος και η διαδρομή **να μην τον καλεί**. Ή να
 * τον καλεί και μετά να γράφει **το δικό της** «δεν βρέθηκε» με άλλο σχήμα.
 * Εδώ ελέγχονται οι **πραγματικοί χειριστές**, μία φορά ανά σχήμα σύρματος:
 *
 * | Διαδρομή | Σχήμα |
 * |---|---|
 * | `GET /api/projects/[projectId]` | `ApiError` → `{success,error,errorCode}` |
 * | `GET /api/projects/structure/[projectId]` | `NextResponse` → `{success,error,projectId}` |
 *
 * Η δεύτερη **δεν** μπορεί να μοιραστεί το εργοστάσιο της πρώτης: το σώμα της
 * φέρει `projectId`. Μεταμφίεση με ξένο σχήμα θα πρόδιδε τη διαφορά **με το
 * ίδιο το σχήμα** (ADR-742 §7.1) — γι' αυτό μοιράζεται μόνο το **κείμενο**.
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => body, body };
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

var currentRole = 'company_admin';
var currentCompanyId = 'co_alpha';

jest.mock('@/lib/auth', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown) =>
      callback(
        request,
        { uid: 'u_1', email: 'a@alpha.gr', companyId: currentCompanyId, globalRole: currentRole },
        { cache: true },
      ),
}));

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: (handler: unknown) => handler,
}));

/** Το έργο που «υπάρχει» στη βάση· `null` ⇒ δεν υπάρχει. */
var storedProject: { companyId?: string | null; name?: string } | null = null;

jest.mock('@/lib/firebaseAdmin', () => {
  /** Αλυσίδα ερωτήματος που δέχεται όσα `where` της ζητηθούν και δίνει άδειο σύνολο. */
  const emptyQuery = () => {
    const q: Record<string, unknown> = {};
    q.where = () => q;
    q.get = async () => ({ docs: [] });
    return q;
  };
  return {
    getAdminFirestore: () => ({
      collection: () => ({
        doc: () => ({
          get: async () => ({
            exists: storedProject !== null,
            id: 'prj_42',
            data: () => storedProject ?? undefined,
          }),
        }),
        where: () => emptyQuery(),
      }),
    }),
  };
});

/** Το `route.ts` εισάγει τις μεταβολές· δεν συμμετέχουν στο `GET`. */
jest.mock('../[projectId]/project-mutations.service', () => ({
  handleUpdateProject: jest.fn(),
  handleDeleteProject: jest.fn(),
  ConflictError: class ConflictError extends Error {},
}));

import type { NextRequest } from 'next/server';
import { ApiError } from '@/lib/api/api-error-types';
import { GET as getProject } from '../[projectId]/route';
import { GET as getStructure } from '../structure/[projectId]/route';
import { PROJECT_NOT_FOUND_MESSAGE } from '../_shared/project-ownership';

const req = {} as NextRequest;
const seg = { params: Promise.resolve({ projectId: 'prj_42' }) };

interface Envelope {
  status: number;
  json: () => Promise<Record<string, unknown>>;
}

beforeEach(() => {
  currentRole = 'company_admin';
  currentCompanyId = 'co_alpha';
  storedProject = { companyId: 'co_alpha', name: 'Έργο Α' };
});

// ============================================================================
describe('GET /api/projects/[projectId] — σχήμα `ApiError`', () => {
  /** Τρέχει τον χειριστή και επιστρέφει ό,τι έριξε, ή `null`. */
  const refusal = async (): Promise<ApiError | null> => {
    try {
      await getProject(req, seg);
      return null;
    } catch (e) {
      return e as ApiError;
    }
  };

  const wire = (e: ApiError) => ({
    status: e.statusCode,
    message: e.message,
    errorCode: e.errorCode,
  });

  it('ίδιος tenant → επιτυχία', async () => {
    expect(await refusal()).toBeNull();
  });

  it('🔴 ξένο έργο → 404, ΙΣΟ με το γνήσιο «δεν βρέθηκε»', async () => {
    storedProject = null;
    const genuine = await refusal();

    storedProject = { companyId: 'co_beta' };
    const disguised = await refusal();

    expect(genuine).toBeInstanceOf(ApiError);
    expect(disguised).toBeInstanceOf(ApiError);
    expect(wire(disguised!)).toEqual(wire(genuine!));
    expect(disguised!.statusCode).toBe(404);
  });

  it('🔴 το παλιό σχήμα (403 + «Access denied - …») δεν επιστρέφεται πια', async () => {
    storedProject = { companyId: 'co_beta' };
    const e = (await refusal())!;
    expect(e.statusCode).not.toBe(403);
    expect(e.message).toBe(PROJECT_NOT_FOUND_MESSAGE);
  });

  it('🔴 bypass ρόλος σε ξένο έργο → ΠΑΙΡΝΕΙ το έργο (§7ter.2)', async () => {
    storedProject = { companyId: 'co_beta' };
    currentRole = 'super_admin';
    expect(await refusal()).toBeNull();
  });

  it('🔴 έργο χωρίς companyId → «δεν βρέθηκε», όχι σιωπηλή πρόσβαση (§4)', async () => {
    storedProject = { companyId: '' };
    currentCompanyId = '';
    const e = (await refusal())!;
    expect(e).toBeInstanceOf(ApiError);
    expect(e.statusCode).toBe(404);
  });
});

// ============================================================================
describe('GET /api/projects/structure/[projectId] — σχήμα `NextResponse`', () => {
  const call = async (): Promise<Envelope> =>
    (await getStructure(req, seg)) as unknown as Envelope;

  it('ίδιος tenant → 200', async () => {
    const res = await call();
    expect(res.status).toBe(200);
  });

  it('🔴 ξένο έργο → 404 με ΠΑΝΟΜΟΙΟΤΥΠΟ σώμα με το γνήσιο «δεν βρέθηκε»', async () => {
    storedProject = null;
    const genuine = await call();

    storedProject = { companyId: 'co_beta' };
    const disguised = await call();

    expect(disguised.status).toBe(genuine.status);
    expect(await disguised.json()).toEqual(await genuine.json());
    expect(disguised.status).toBe(404);
  });

  it('🔴 το σώμα κρατά το σχήμα ΤΗΣ ΔΙΑΔΡΟΜΗΣ (με `projectId`), όχι του `ApiError`', async () => {
    storedProject = { companyId: 'co_beta' };
    const res = await call();
    expect(await res.json()).toEqual({
      success: false,
      error: PROJECT_NOT_FOUND_MESSAGE,
      projectId: 'prj_42',
    });
  });

  it('🔴 το παλιό 403 «Access denied - …» δεν επιστρέφεται πια', async () => {
    storedProject = { companyId: 'co_beta' };
    const res = await call();
    expect(res.status).not.toBe(403);
    expect((await res.json()).error).not.toMatch(/access denied/i);
  });

  it('🔴 bypass ρόλος σε ξένο έργο → 200 (§7ter.2)', async () => {
    storedProject = { companyId: 'co_beta' };
    currentRole = 'super_admin';
    expect((await call()).status).toBe(200);
  });
});

// ============================================================================
describe('🔴 ΤΟ ΚΕΙΝΟ ΕΙΝΑΙ ΚΟΙΝΟ ΑΝΑΜΕΣΑ ΣΤΑ ΔΥΟ ΣΧΗΜΑΤΑ', () => {
  it('και οι δύο διαδρομές λένε την ίδια λέξη — αλλιώς η σύγκριση των δύο σχημάτων γίνεται μαντείο', async () => {
    storedProject = { companyId: 'co_beta' };

    const viaApiError = await getProject(req, seg).catch((e: ApiError) => e.message);
    const viaResponse = await ((await getStructure(req, seg)) as unknown as Envelope)
      .json()
      .then((b) => b.error);

    expect(viaApiError).toBe(PROJECT_NOT_FOUND_MESSAGE);
    expect(viaResponse).toBe(PROJECT_NOT_FOUND_MESSAGE);
  });
});
