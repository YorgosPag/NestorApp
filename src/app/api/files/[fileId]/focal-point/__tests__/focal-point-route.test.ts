/**
 * @jest-environment node
 *
 * @fileoverview 🎯 **Η ΠΡΟΤΑΣΗ ΣΗΜΕΙΟΥ ΕΣΤΙΑΣΗΣ ΠΕΡΝΑ ΑΠΟ ΤΗΝ ΙΔΙΑ ΑΛΥΣΙΔΑ ΜΕ ΤΗ ΛΗΨΗ** (ADR-880).
 *
 * Η αλυσίδα κατόχου/ορατότητας έχει τις δικές της άγκυρες (`owned-file-bytes.test`). Εδώ ρωτάμε μόνο:
 * *«σέβεται η διαδρομή την έκβασή της — και ΔΕΝ αγγίζει τον κινητήρα όταν αρνείται;»*.
 */

import sharp from 'sharp';

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

const CALLER = { custody: 'company', ctx: { uid: 'u1', companyId: 'c1' } };
jest.mock('../../../_shared/file-custody-route', () => ({
  withFileCustodyAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, segment: unknown) => callback(request, CALLER, segment),
}));

const mockLoad = jest.fn();
jest.mock('../../../_shared/owned-file-bytes', () => ({
  loadOwnedFileBytes: (...args: unknown[]) => mockLoad(...args),
}));

jest.mock('../../../_shared/container-route-responses', () => ({
  fileNotFoundResponse: () => ({ status: 404, json: async () => ({ error: 'not-found' }) }),
  authorityUnavailableResponse: () => ({ status: 503, json: async () => ({ error: 'authority-unavailable' }) }),
}));

const mockDetect = jest.fn();
jest.mock('@/services/listings/public-shelf-focal-point', () => ({
  detectFocalPointInBytes: (bytes: Buffer) => mockDetect(bytes),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET } = require('../route') as typeof import('../route');

interface Reply {
  readonly status: number;
  json(): Promise<unknown>;
}

const call = async (fileId: string): Promise<Reply> =>
  (await GET({} as never, { params: Promise.resolve({ fileId }) } as never)) as unknown as Reply;

beforeEach(() => {
  mockLoad.mockReset();
  mockDetect.mockReset();
});

describe('focal-point route', () => {
  it('ρωτά την αλυσίδα με ΤΗΝ ΙΔΙΑ ικανότητα με τη λήψη', async () => {
    mockLoad.mockResolvedValue({ outcome: 'refused' });
    await call('file_a');
    expect(mockLoad).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 'file_a', caller: CALLER, capability: 'dxf:files:view' }),
    );
  });

  it('🔴 άρνηση ⇒ 404 ΚΑΙ ο κινητήρας δεν αγγίζεται', async () => {
    mockLoad.mockResolvedValue({ outcome: 'refused' });
    expect((await call('file_a')).status).toBe(404);
    expect(mockDetect).not.toHaveBeenCalled();
  });

  it('η αυθεντία δεν απάντησε ⇒ 503, ποτέ «δεν επιτρέπεσαι»', async () => {
    mockLoad.mockResolvedValue({ outcome: 'unavailable' });
    expect((await call('file_a')).status).toBe(503);
  });

  it('bytes ⇒ το σημείο του ΙΔΙΟΥ κινητήρα με το ράφι', async () => {
    const buffer = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#888' } }).png().toBuffer();
    mockLoad.mockResolvedValue({ outcome: 'bytes', buffer, contentType: 'image/png', filename: 'a.png' });
    mockDetect.mockResolvedValue({ x: 0.3, y: 0.6 });

    const reply = await call('file_a');
    expect(reply.status).toBe(200);
    expect(await reply.json()).toEqual({ focalPoint: { x: 0.3, y: 0.6 } });
    expect(mockDetect).toHaveBeenCalledWith(buffer);
  });
});
