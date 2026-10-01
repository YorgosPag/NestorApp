/**
 * @jest-environment node
 *
 * @fileoverview 📷 **ΤΑ ΣΤΟΙΧΕΙΑ ΛΗΨΗΣ ΠΕΡΝΟΥΝ ΑΠΟ ΤΗΝ ΙΔΙΑ ΑΛΥΣΙΔΑ ΜΕ ΤΗ ΛΗΨΗ** (ADR-897 Φ5).
 *
 * Η αλυσίδα κατόχου/ορατότητας έχει τις δικές της άγκυρες (`owned-file-bytes.test`)· ο σκελετός του χειριστή είναι
 * κοινός με το `focal-point` (`owned-file-insight-route`). Εδώ ρωτάμε: *«ζητά την ίδια ικανότητα, αρνείται με το ίδιο
 * 404 χωρίς να αγγίξει τα bytes, και δίνει `{ facts }`;»*.
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

jest.mock('@/lib/middleware/with-rate-limit', () => ({ withHeavyRateLimit: <T>(handler: T) => handler }));

const CALLER = { custody: 'personal', ctx: { uid: 'u1' } };
jest.mock('../../../_shared/file-custody-route', () => ({
  withFileCustodyAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, segment: unknown) => callback(request, CALLER, segment),
}));

const mockLoad = jest.fn();
jest.mock('../../../_shared/owned-file-bytes', () => ({ loadOwnedFileBytes: (...args: unknown[]) => mockLoad(...args) }));

jest.mock('../../../_shared/container-route-responses', () => ({
  fileNotFoundResponse: () => ({ status: 404, json: async () => ({ error: 'not-found' }) }),
  authorityUnavailableResponse: () => ({ status: 503, json: async () => ({ error: 'authority-unavailable' }) }),
}));

const mockRead = jest.fn();
jest.mock('@/services/listings/photo-capture-facts', () => ({ readPhotoCaptureFacts: (bytes: Buffer) => mockRead(bytes) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET } = require('../route') as typeof import('../route');

const call = async (fileId: string) =>
  (await GET({} as never, { params: Promise.resolve({ fileId }) } as never)) as unknown as { status: number; json(): Promise<unknown> };

beforeEach(() => {
  mockLoad.mockReset();
  mockRead.mockReset();
});

describe('capture-facts route', () => {
  it('ίδια ικανότητα με τη λήψη, και η απάντηση είναι `{ facts }`', async () => {
    const bytes = Buffer.from('jpeg');
    const facts = { fovRad: 1.2, compass: null };
    mockLoad.mockResolvedValue({ outcome: 'bytes', buffer: bytes });
    mockRead.mockResolvedValue(facts);
    const reply = await call('file_a');
    expect(mockLoad).toHaveBeenCalledWith(expect.objectContaining({
      fileId: 'file_a', caller: CALLER, action: 'capture-facts', capability: 'dxf:files:view',
    }));
    expect(mockRead).toHaveBeenCalledWith(bytes);
    expect(reply.status).toBe(200);
    await expect(reply.json()).resolves.toEqual({ facts });
  });

  it('🔴 άρνηση ⇒ 404 ΚΑΙ τα bytes δεν διαβάζονται', async () => {
    mockLoad.mockResolvedValue({ outcome: 'refused' });
    expect((await call('file_a')).status).toBe(404);
    expect(mockRead).not.toHaveBeenCalled();
  });

  it('αρχή εξουσιοδότησης μη διαθέσιμη ⇒ 503, όχι 404', async () => {
    mockLoad.mockResolvedValue({ outcome: 'unavailable' });
    expect((await call('file_a')).status).toBe(503);
  });
});
