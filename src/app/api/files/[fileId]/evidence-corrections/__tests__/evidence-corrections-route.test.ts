/**
 * @jest-environment node
 *
 * @fileoverview ⚓ ADR-950 §10.6 — `POST /api/files/{fileId}/evidence-corrections`.
 *
 * Ο γραφέας έχει τις δικές του άγκυρες (`evidence-corrections-writer.test`). Εδώ ρωτάμε μόνο το **σύνορο**:
 * *«φτάνει στον γραφέα μόνο εντολή που στέκει, με την ταυτότητα του αιτήματος — και βγαίνει κάθε έκβαση με τον
 * σωστό κωδικό;»*. Άρνηση του PEP ή άκυρη εντολή ⇒ ο γραφέας **δεν** αγγίζεται.
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

jest.mock('@/lib/middleware/with-rate-limit', () => ({ withStandardRateLimit: <T>(handler: T) => handler }));

const CTX = { uid: 'u1', companyId: 'c1' };
const mockWithAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  withAuth: (handler: (...args: unknown[]) => Promise<unknown>, options: unknown) => {
    mockWithAuth(options);
    return async (request: unknown, segment: unknown) => handler(request, CTX, {}, segment);
  },
}));

const DB = { marker: 'admin-firestore' };
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => DB }));

const mockApply = jest.fn();
jest.mock('@/server/files/evidence-corrections-writer', () => ({
  applyEvidenceCorrection: (...args: unknown[]) => mockApply(...args),
}));

const mockResolve = jest.fn();
jest.mock('../../../_shared/container-route-responses', () => ({
  fileNotFoundResponse: () => ({ status: 404, json: async () => ({ error: 'not-found' }) }),
  resolveContainerFile: (...args: unknown[]) => mockResolve(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../route') as typeof import('../route');

interface Reply {
  readonly status: number;
  json(): Promise<unknown>;
}

const post = async (body: unknown): Promise<Reply> => {
  const request = { json: async () => body };
  return (await POST(request as never, { params: Promise.resolve({ fileId: 'file_a' }) } as never)) as unknown as Reply;
};

const CORRECT = { act: 'correct', row: 'vatNumber', values: { vatNumber: '040817944' } };

beforeEach(() => {
  mockApply.mockReset();
  mockResolve.mockReset();
  mockResolve.mockResolvedValue({ refusal: null, fileId: 'file_a' });
});

describe('evidence-corrections route — το σύνορο', () => {
  it('ζητά το δικαίωμα των στοιχείων επαφής', () => {
    expect(mockWithAuth).toHaveBeenCalledWith({ permissions: 'crm:contacts:update' });
  });

  it('περνά από τον PEP με φύλαξη εταιρείας — άρνηση ⇒ ο γραφέας ΔΕΝ αγγίζεται', async () => {
    const refusal = { status: 404, json: async () => ({ error: 'not-found' }) };
    mockResolve.mockResolvedValue({ refusal });
    const reply = await post(CORRECT);
    expect(reply).toBe(refusal);
    expect(mockResolve).toHaveBeenCalledWith(expect.anything(), { custody: 'company', ctx: CTX }, 'evidence-correction');
    expect(mockApply).not.toHaveBeenCalled();
  });

  it.each([
    ['σώμα που δεν είναι JSON αντικείμενο', null],
    ['άγνωστη γραμμή', { act: 'correct', row: 'not-a-row', values: { vatNumber: '040817944' } }],
    ['μέρος διεύθυνσης ως γραμμή', { act: 'correct', row: 'addressStreet', values: { addressStreet: 'Σαμοθράκης' } }],
    ['άγνωστη πράξη', { act: 'overwrite', row: 'vatNumber', values: {} }],
    ['διόρθωση χωρίς τιμές', { act: 'correct', row: 'vatNumber' }],
    ['τιμές που δεν είναι αντικείμενο', { act: 'correct', row: 'vatNumber', values: '040817944' }],
  ])('άκυρη εντολή (%s) ⇒ 400, ο γραφέας ΔΕΝ αγγίζεται', async (_label, body) => {
    const reply = await post(body);
    expect(reply.status).toBe(400);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it('η ταυτότητα έρχεται από το αίτημα, το αρχείο από τον PEP — ποτέ από το σώμα', async () => {
    mockApply.mockResolvedValue({ kind: 'cleared' });
    await post({ act: 'clear', row: 'phone', uid: 'intruder', companyId: 'c2', fileId: 'file_other', values: { phone: 'x' } });
    expect(mockApply).toHaveBeenCalledWith(DB, { fileId: 'file_a', companyId: 'c1', uid: 'u1', command: { act: 'clear', row: 'phone' } });
  });

  it('η διόρθωση φτάνει στον γραφέα με τις τιμές της', async () => {
    mockApply.mockResolvedValue({ kind: 'cleared' });
    await post(CORRECT);
    expect(mockApply).toHaveBeenCalledWith(DB, expect.objectContaining({ command: CORRECT }));
  });
});

describe('evidence-corrections route — κάθε έκβαση με τον κωδικό της', () => {
  const correction = { row: 'vatNumber', values: { vatNumber: '040817944' }, machineReadingAtCorrection: '', correctedBy: 'u1', correctedAt: 'now' };

  it.each([
    [{ kind: 'corrected', correction }, 200, true],
    [{ kind: 'cleared' }, 200, true],
    [{ kind: 'not-a-contact-file' }, 409, false],
    [{ kind: 'no-such-row' }, 409, false],
    [{ kind: 'invalid-value', fields: ['vatNumber'] }, 422, false],
  ])('%j ⇒ %i', async (outcome, status, success) => {
    mockApply.mockResolvedValue(outcome);
    const reply = await post(CORRECT);
    expect(reply.status).toBe(status);
    expect(await reply.json()).toEqual({ success, ...outcome });
  });

  it('`not-found` ⇒ το ΕΝΑ 404 του αρχείου (ίδιο με ξένο μισθωτή)', async () => {
    mockApply.mockResolvedValue({ kind: 'not-found' });
    const reply = await post(CORRECT);
    expect(reply.status).toBe(404);
    expect(await reply.json()).toEqual({ error: 'not-found' });
  });
});
