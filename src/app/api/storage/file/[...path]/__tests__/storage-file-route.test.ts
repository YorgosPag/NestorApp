/**
 * @jest-environment node
 *
 * @fileoverview **Ο proxy ιδιωτικών αρχείων** — η πρώτη σουίτα της διαδρομής (ADR-899 §5).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Δ1: ο έλεγχος μισθωτή μετακινείται ΜΕΤΑ την προεπισκόπηση ⇒ η cache γίνεται πλάγια πόρτα σε ξένο χώρο.
 * - Δ2: δεκτό πλάτος εκτός κλίμακας ⇒ cache-busting / μία κωδικοποίηση ανά αίτημα.
 * - Δ3: ο κλάδος χωρίς `w` αλλάζει (δεν ανοίγει ροή πρωτοτύπου / χάνει την πολιτική cache του).
 * - Δ4: οι εκβάσεις της υπηρεσίας χάνουν τον κωδικό HTTP τους.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/lib/auth', () => ({
  withAuth: (handler: (req: unknown, ctx: unknown, cache: unknown) => unknown) => (req: unknown) =>
    handler(req, { companyId: 'c1', uid: 'u1' }, {}),
}));
jest.mock('@/lib/middleware/with-rate-limit', () => ({ withStandardRateLimit: (handler: unknown) => handler }));
jest.mock('@/server/files/file-record-bucket', () => ({
  fileStorageBucket: (placement: string) => ({ name: `bucket-${placement}` }),
}));
const openMock = jest.fn();
jest.mock('@/lib/storage/storage-object-stream', () => ({ openStorageObject: (...args: unknown[]) => openMock(...args) }));
const previewMock = jest.fn();
jest.mock('@/server/files/image-preview.service', () => ({ serveImagePreview: (...args: unknown[]) => previewMock(...args) }));

import { NextRequest } from 'next/server';

import { GET } from '../route';

const OWN = ['companies', 'c1', 'files', 'f1.jpg'];

function get(segments: string[], query = '', headers: Record<string, string> = {}) {
  const request = new NextRequest(`http://localhost/api/storage/file/${segments.join('/')}${query}`, { headers });
  return GET(request, { params: Promise.resolve({ path: segments }) });
}

beforeEach(() => {
  openMock.mockReset();
  previewMock.mockReset();
});

describe('proxy ιδιωτικών αρχείων', () => {
  it('🔴 Δ1 ξένος μισθωτής ⇒ 403 ΠΡΙΝ αγγιχτεί cache ή κάδος', async () => {
    const response = await get(['companies', 'c2', 'files', 'f1.jpg'], '?w=640');
    expect(response.status).toBe(403);
    expect(previewMock).not.toHaveBeenCalled();
    expect(openMock).not.toHaveBeenCalled();
  });

  it.each(['?w=641', '?w=0', '?w=abc', '?w=', '?w=640.0', '?w=99999'])('🔴 Δ2 %s ⇒ 400, καμία κωδικοποίηση', async (query) => {
    const response = await get(OWN, query);
    expect(response.status).toBe(400);
    expect(previewMock).not.toHaveBeenCalled();
  });

  it('🔴 Δ3 χωρίς w ⇒ η ροή του πρωτοτύπου, αμετάβλητη', async () => {
    openMock.mockResolvedValue({
      kind: 'found', stream: new ReadableStream(), contentType: 'image/jpeg', contentLength: 4, storedCacheControl: null,
    });
    const response = await get(OWN, '?placement=eu-originals');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, max-age=86400');
    expect(openMock).toHaveBeenCalledWith('companies/c1/files/f1.jpg', null, { bucket: { name: 'bucket-eu-originals' } });
    expect(previewMock).not.toHaveBeenCalled();
  });

  it('παράγωγο: 200 με ETag και private, no-cache — από τον κάδο της θέσης', async () => {
    previewMock.mockResolvedValue({ kind: 'image', etag: '"e1"', bytes: Buffer.from('WEBP'), contentType: 'image/webp' });
    const response = await get(OWN, '?placement=eu-originals&w=640', { 'if-none-match': '"old"' });
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"e1"');
    expect(response.headers.get('cache-control')).toBe('private, no-cache');
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(previewMock).toHaveBeenCalledWith(expect.objectContaining({
      bucketKey: 'bucket-eu-originals', storagePath: 'companies/c1/files/f1.jpg', width: 640, ifNoneMatch: '"old"',
    }));
  });

  it.each([
    ['not-modified', 304],
    ['absent', 404],
    ['not-previewable', 415],
    ['too-large', 413],
    ['undecodable', 422],
    ['busy', 503],
  ])('🔴 Δ4 έκβαση %s ⇒ %i', async (kind, status) => {
    previewMock.mockResolvedValue({ kind, etag: '"e1"' });
    const response = await get(OWN, '?w=320');
    expect(response.status).toBe(status);
  });
});
