/**
 * @jest-environment node
 *
 * @fileoverview **Η ΠΟΡΤΑ ΤΩΝ ΑΔΕΙΩΝ** — ADR-915 §21.
 * @related app/api/agency-profile/licences/route.ts · lib/agency/showcase-licence.ts
 *
 * 🔑 Ο **σχηματισμός είναι ΠΡΑΓΜΑΤΙΚΟΣ** (`formShowcaseLicences` δεν είναι mock): η αρχή που παράγεται και οι
 * ονομασμένες αρνήσεις δοκιμάζονται αληθινά. Ψεύτικος είναι μόνο ο **γραφέας** (Firestore).
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

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: <T,>(handler: T): T => handler,
}));

const authContext = { uid: 'user_1', companyId: 'comp_alfa', isAuthenticated: true as const };
jest.mock('@/lib/auth/middleware', () => ({
  withAuth:
    (callback: (request: unknown, ctx: unknown) => unknown) =>
    (request: unknown) =>
      callback(request, authContext),
}));

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));

const saveMock = jest.fn();
jest.mock('@/services/mandate/showcase-licence-custody', () => ({
  saveShowcaseLicences: (...args: unknown[]) => saveMock(...args),
}));

import { PUT } from '../route';

interface Answer {
  readonly status: number;
  readonly body: Record<string, unknown>;
}

async function put(body: unknown): Promise<Answer> {
  const response = (await (PUT as unknown as (r: unknown) => Promise<unknown>)({ json: async () => body })) as {
    status: number;
    json: () => Promise<Record<string, unknown>>;
  };
  return { status: response.status, body: await response.json() };
}

const DECLARED = {
  licence: 'energy-inspector',
  attestation: { state: 'declared', registration: { authorityKind: 'national', authority: 'ypen', number: '4321' } },
};

beforeEach(() => {
  jest.clearAllMocks();
  saveMock.mockImplementation(async (_db: unknown, _companyId: string, licences: unknown) => ({ kind: 'saved', licences }));
});

describe('ADR-915 §21 — οι άδειες: η αρχή ΠΑΡΑΓΕΤΑΙ, ο αριθμός είναι υποχρεωτικός', () => {
  it('🔑 Λ1 — άδεια με αριθμό ⇒ στον γραφέα `declared` με την αρχή της άδειας (ΥΠΕΝ), για το companyId ΤΗΣ ΑΠΟΔΕΙΞΗΣ', async () => {
    const answer = await put({ licences: [{ licence: 'energy-inspector', registrationNumber: ' 4321 ' }] });

    expect(answer.status).toBe(200);
    expect(saveMock).toHaveBeenCalledWith(expect.anything(), 'comp_alfa', [DECLARED]);
    expect(answer.body.licences).toEqual([DECLARED]);
  });

  it('🔴 Λ2 — άδεια ΧΩΡΙΣ αριθμό ⇒ 422 ονομαστικό, και ΚΑΜΙΑ γραφή', async () => {
    const answer = await put({ licences: [{ licence: 'energy-inspector', registrationNumber: '' }] });

    expect(answer.status).toBe(422);
    expect(answer.body.reason).toBe('licence-number-missing');
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('🔴 Λ3 — άγνωστη άδεια ⇒ 400 (κλειστό λεξιλόγιο), καμία γραφή · κενή λίστα ⇒ «δεν έχω καμία»', async () => {
    expect((await put({ licences: [{ licence: 'wizard', registrationNumber: '1' }] })).status).toBe(400);
    expect(saveMock).not.toHaveBeenCalled();
    expect((await put({ licences: [] })).status).toBe(200);
    expect(saveMock).toHaveBeenCalledWith(expect.anything(), 'comp_alfa', []);
  });

  it('🔴 Λ4 — χωρίς βιτρίνα ⇒ 422 με τον λόγο του γραφέα · βλάβη ⇒ 500', async () => {
    saveMock.mockResolvedValueOnce({ kind: 'rejected', reason: 'licences-without-showcase' });
    const rejected = await put({ licences: [] });
    expect(rejected.status).toBe(422);
    expect(rejected.body.reason).toBe('licences-without-showcase');

    saveMock.mockResolvedValueOnce({ kind: 'failed' });
    expect((await put({ licences: [] })).status).toBe(500);
  });
});

describe('ADR-915 §34 — άδεια ηλεκτρολόγου: ο εκδότης (Περιφερειακή Ενότητα) περνά το σύνορο', () => {
  it('🔑 Π1 — με ΠΕ ⇒ στον γραφέα εγγραφή `chapter` στη Διεύθυνση Ανάπτυξης, με τον εκδότη κομμένο', async () => {
    const answer = await put({
      licences: [{ licence: 'electrical-installer', registrationNumber: '4521', registrationChapter: ' ΠΕ Λάρισας ' }],
    });

    expect(answer.status).toBe(200);
    expect(saveMock).toHaveBeenCalledWith(expect.anything(), 'comp_alfa', [
      {
        licence: 'electrical-installer',
        attestation: {
          state: 'declared',
          registration: { authorityKind: 'chapter', authority: 'regional-authority', chapter: 'ΠΕ Λάρισας', number: '4521' },
        },
      },
    ]);
  });

  it('🔴 Π2 — χωρίς ΠΕ ⇒ 422 `licence-chapter-missing`, ΚΑΜΙΑ γραφή', async () => {
    const answer = await put({ licences: [{ licence: 'electrical-installer', registrationNumber: '4521' }] });

    expect(answer.status).toBe(422);
    expect(answer.body.reason).toBe('licence-chapter-missing');
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('🔴 Π3 — η άρνηση «την έχετε ήδη από την ειδικότητα» του γραφέα φτάνει ονομαστικά (422)', async () => {
    saveMock.mockResolvedValueOnce({ kind: 'rejected', reason: 'licence-held-through-occupation' });
    const answer = await put({
      licences: [{ licence: 'electrical-installer', registrationNumber: '4521', registrationChapter: 'ΠΕ Λάρισας' }],
    });

    expect(answer.status).toBe(422);
    expect(answer.body.reason).toBe('licence-held-through-occupation');
  });
});
