/**
 * @jest-environment node
 *
 * @fileoverview **ΕΥΡΟΣ BYTES (RFC 9110 §14)** — ο αναλυτής του `storage-object-stream` (ADR-884 Κ3β) — και ο
 * **δρόμος του ενός αιτήματος** (Φ2ε · §4.11): μετρημένο ~820 ms/πλακίδιο με δύο ταξίδια ως τον κάδο.
 */

import { PassThrough } from 'node:stream';

jest.mock('server-only', () => ({}));
const file = { getMetadata: jest.fn(), createReadStream: jest.fn() };
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminBucket: () => ({ file: () => file }) }));

import { openStorageObject, parseByteRange } from '../storage-object-stream';

/** Ψεύτικη ροή του GCS: εκπέμπει `response` (ασύγχρονα, όπως το δίκτυο) και μετά τα bytes. */
function mediaStream(statusCode: number, headers: Record<string, string>, body = 'JPEG'): PassThrough {
  const node = new PassThrough();
  setTimeout(() => {
    node.emit('response', { statusCode, headers });
    if (statusCode < 400) node.end(body);
  }, 0);
  return node;
}

describe('openStorageObject — ένα αίτημα (singleRequest)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('χωρίς Range: ΚΑΝΕΝΑ getMetadata· τύπος, μέγεθος και ETag από την ίδια την απάντηση', async () => {
    file.createReadStream.mockReturnValue(mediaStream(200, { 'content-type': 'image/jpeg', 'content-length': '4', 'x-goog-generation': '17' }));
    const opened = await openStorageObject('tour-tiles/x.jpg', null, { singleRequest: true });
    expect(file.getMetadata).not.toHaveBeenCalled();
    expect(opened).toMatchObject({ kind: 'found', contentType: 'image/jpeg', contentLength: 4, etag: '"17"', storedCacheControl: null, range: null });
  });

  it('404 στην απάντηση (το `response` εκπέμπεται ΚΑΙ τότε) ⇒ absent, όχι found', async () => {
    file.createReadStream.mockReturnValue(mediaStream(404, {}));
    await expect(openStorageObject('tour-tiles/none.jpg', null, { singleRequest: true })).resolves.toEqual({ kind: 'absent' });
  });

  it('με Range ⇒ ο κανονικός δρόμος (χρειάζεται το συνολικό μέγεθος για το 206/416)', async () => {
    file.getMetadata.mockResolvedValue([{ size: '100', contentType: 'video/mp4', generation: 3 }]);
    file.createReadStream.mockReturnValue(new PassThrough());
    const opened = await openStorageObject('m.mp4', 'bytes=0-9', { singleRequest: true });
    expect(file.getMetadata).toHaveBeenCalledTimes(1);
    expect(opened).toMatchObject({ kind: 'found', range: { start: 0, end: 9 }, contentLength: 10 });
  });

  it('χωρίς την επιλογή ⇒ ο κανονικός δρόμος (το αποθηκευμένο Cache-Control δεν χάνεται σιωπηλά)', async () => {
    file.getMetadata.mockResolvedValue([{ size: '4', contentType: 'image/png', cacheControl: 'public, max-age=60' }]);
    file.createReadStream.mockReturnValue(new PassThrough());
    const opened = await openStorageObject('f.png');
    expect(opened).toMatchObject({ kind: 'found', storedCacheControl: 'public, max-age=60' });
  });
});

describe('parseByteRange', () => {
  const SIZE = 1000;

  it('χωρίς κεφαλίδα ή με άγνωστη μορφή ⇒ ολόκληρο (null)', () => {
    expect(parseByteRange(null, SIZE)).toBeNull();
    expect(parseByteRange('items=0-1', SIZE)).toBeNull();
    expect(parseByteRange('bytes=0-1,5-9', SIZE)).toBeNull();
    expect(parseByteRange('bytes=-', SIZE)).toBeNull();
  });

  it('bytes=a-b · bytes=a- · bytes=-n', () => {
    expect(parseByteRange('bytes=0-99', SIZE)).toEqual({ start: 0, end: 99 });
    expect(parseByteRange('bytes=900-', SIZE)).toEqual({ start: 900, end: 999 });
    expect(parseByteRange('bytes=-100', SIZE)).toEqual({ start: 900, end: 999 });
  });

  it('το τέλος κόβεται στο μέγεθος· επίθημα μεγαλύτερο από το αρχείο ⇒ ολόκληρο', () => {
    expect(parseByteRange('bytes=500-5000', SIZE)).toEqual({ start: 500, end: 999 });
    expect(parseByteRange('bytes=-5000', SIZE)).toEqual({ start: 0, end: 999 });
  });

  it('ανικανοποίητο ⇒ 416', () => {
    expect(parseByteRange('bytes=1000-', SIZE)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=10-5', SIZE)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=-0', SIZE)).toBe('unsatisfiable');
  });
});
