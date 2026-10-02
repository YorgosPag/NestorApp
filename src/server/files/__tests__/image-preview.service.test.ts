/**
 * @jest-environment node
 *
 * @fileoverview **Παράγωγα κατ' απαίτηση** (ADR-899 §3.4) — κάθε στρώση με εγχεόμενες εξαρτήσεις.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Υ1: το ETag χάνει τη γενιά ⇒ αντικατεστημένο πρωτότυπο σερβίρεται από την cache (παλιά εικόνα).
 * - Υ2: `If-None-Match` ελέγχεται ΜΕΤΑ το κατέβασμα ⇒ το 304 κοστίζει όσο ένα 200.
 * - Υ3: χωρίς συγχώνευση ⇒ Ν ταυτόχρονα αιτήματα = Ν κωδικοποιήσεις.
 * - Υ4: η αποτυχία μένει «κρατημένη» ⇒ το κλειδί νεκρώνει για όλη τη ζωή της διεργασίας.
 * - Υ5: απουσία/τύπος/μέγεθος δεν ονομάζονται ⇒ 500 αντί για 404/415/413.
 * - Υ6: ουρά χωρίς όριο ⇒ καμία οπισθοπίεση (busy).
 * - Υ7 (ADR-899 §3.7, Π2): βαθμίδες πάνω από το πρωτότυπο ⇒ ΔΥΟ κλειδιά/κωδικοποιήσεις για ίδια bytes.
 * - Υ8: χωρίς metadata, η μέτρηση του πρωτοτύπου που κατέβηκε δεν κανονικοποιεί ούτε απομνημονεύεται.
 * - Υ9: η μνήμη διαστάσεων χάνει τη γενιά ⇒ νέα bytes με παλιές διαστάσεις.
 */

jest.mock('server-only', () => ({}));

import type { Bucket } from '@google-cloud/storage';

import { createBoundedLru } from '@/lib/cache/bounded-lru';
import { createPriorityTaskQueue } from '@/lib/async/priority-task-queue';
import type { StorageObjectStat } from '@/lib/storage/storage-object-stream';
import type { ImageDimensions } from '@/lib/images/image-dimensions';

import {
  createImagePreviewService,
  etagMatches,
  imagePreviewEtag,
  type ImagePreviewDeps,
  type ImagePreviewRequest,
} from '../image-preview.service';

const BUCKET = {} as Bucket;
const PATH = 'companies/c1/files/f1.jpg';
const found = (generation: string, overrides: Partial<StorageObjectStat & { kind: 'found' }> = {}): StorageObjectStat => ({
  kind: 'found',
  generation,
  contentType: 'image/jpeg',
  size: 1000,
  dimensions: null,
  ...overrides,
});

function harness(overrides: Partial<ImagePreviewDeps> = {}) {
  const deps: ImagePreviewDeps = {
    stat: jest.fn().mockResolvedValue(found('7')),
    read: jest.fn().mockResolvedValue(Buffer.from('ORIGINAL')),
    encode: jest.fn().mockImplementation(async (_bytes: Buffer, width: number) => Buffer.from(`webp-${width}`)),
    measure: jest.fn().mockResolvedValue(null),
    cache: createBoundedLru<Buffer>({ maxWeight: 1024, weigh: (bytes) => bytes.length }),
    dimensions: createBoundedLru<ImageDimensions>({ maxWeight: 16, weigh: () => 1 }),
    queue: createPriorityTaskQueue(2),
    maxQueued: 8,
    maxOriginalBytes: 5000,
    ...overrides,
  };
  return { deps, serve: createImagePreviewService(deps) };
}

const request = (overrides: Partial<ImagePreviewRequest> = {}): ImagePreviewRequest => ({
  bucket: BUCKET,
  bucketKey: 'files-eu',
  storagePath: PATH,
  width: 640,
  ifNoneMatch: null,
  ...overrides,
});

describe('createImagePreviewService', () => {
  it('παράγει, και το δεύτερο αίτημα έρχεται από τη μνήμη', async () => {
    const { deps, serve } = harness();
    const first = await serve(request());
    expect(first).toMatchObject({ kind: 'image', contentType: 'image/webp', bytes: Buffer.from('webp-640') });
    await serve(request());
    expect(deps.encode).toHaveBeenCalledTimes(1);
    expect(deps.read).toHaveBeenCalledTimes(1);
  });

  it('🔴 Υ1 νέα γενιά ⇒ νέο ETag ⇒ νέα κωδικοποίηση', async () => {
    const stat = jest.fn().mockResolvedValueOnce(found('7')).mockResolvedValueOnce(found('8'));
    const { deps, serve } = harness({ stat });
    const before = await serve(request());
    const after = await serve(request());
    expect(before.kind === 'image' && after.kind === 'image' && before.etag !== after.etag).toBe(true);
    expect(deps.encode).toHaveBeenCalledTimes(2);
    expect(deps.read).toHaveBeenLastCalledWith(BUCKET, PATH, '8');
  });

  it('🔴 Υ2 If-None-Match ⇒ 304 χωρίς κατέβασμα και χωρίς κωδικοποίηση', async () => {
    const { deps, serve } = harness();
    const etag = imagePreviewEtag('files-eu', PATH, '7', 640);
    await expect(serve(request({ ifNoneMatch: `W/${etag}` }))).resolves.toEqual({ kind: 'not-modified', etag });
    expect(deps.read).not.toHaveBeenCalled();
    expect(deps.encode).not.toHaveBeenCalled();
  });

  it('🔴 Υ3 ταυτόχρονα ίδια αιτήματα ⇒ ΜΙΑ κωδικοποίηση', async () => {
    const { deps, serve } = harness();
    const results = await Promise.all([serve(request()), serve(request()), serve(request())]);
    expect(results.every((r) => r.kind === 'image')).toBe(true);
    expect(deps.encode).toHaveBeenCalledTimes(1);
  });

  it('🔴 Υ4 η αποτυχία δεν μένει κρατημένη — το επόμενο αίτημα ξαναπροσπαθεί', async () => {
    const encode = jest.fn().mockRejectedValueOnce(new Error('corrupt')).mockResolvedValueOnce(Buffer.from('ok'));
    const { serve } = harness({ encode });
    await expect(serve(request())).resolves.toEqual({ kind: 'undecodable' });
    await expect(serve(request())).resolves.toMatchObject({ kind: 'image' });
  });

  it('🔴 Υ5 ονομασμένες εκβάσεις: απουσία · τύπος · μέγεθος · χαμένη γενιά', async () => {
    await expect(harness({ stat: jest.fn().mockResolvedValue({ kind: 'absent' }) }).serve(request()))
      .resolves.toEqual({ kind: 'absent' });
    await expect(harness({ stat: jest.fn().mockResolvedValue(found('7', { contentType: 'image/svg+xml' })) }).serve(request()))
      .resolves.toEqual({ kind: 'not-previewable' });
    await expect(harness({ stat: jest.fn().mockResolvedValue(found('7', { size: 9999 })) }).serve(request()))
      .resolves.toEqual({ kind: 'too-large' });
    await expect(harness({ read: jest.fn().mockResolvedValue(null) }).serve(request()))
      .resolves.toEqual({ kind: 'absent' });
    await expect(harness({ stat: jest.fn().mockResolvedValue(found('7', { size: null })), read: jest.fn().mockResolvedValue(Buffer.alloc(9999)) }).serve(request()))
      .resolves.toEqual({ kind: 'too-large' });
  });

  it('🔴 Υ6 γεμάτη ουρά ⇒ busy, όχι ουρά χωρίς όριο', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const encode = jest.fn().mockImplementation(async () => { await gate; return Buffer.from('x'); });
    const { serve } = harness({ encode, queue: createPriorityTaskQueue(1), maxQueued: 1 });
    const running = serve(request({ width: 320 }));
    const queued = serve(request({ width: 640 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(serve(request({ width: 1280 }))).resolves.toEqual({ kind: 'busy' });
    release();
    await expect(Promise.all([running, queued])).resolves.toHaveLength(2);
  });

  it('🔴 Υ7 metadata 1183 px: w=2560 και w=1280 ⇒ ΕΝΑ κλειδί, ΜΙΑ κωδικοποίηση στο 1280 · w=640 ανέγγιχτο', async () => {
    const stat = jest.fn().mockResolvedValue(found('7', { dimensions: { width: 1183, height: 1600 } }));
    const { deps, serve } = harness({ stat });
    const big = await serve(request({ width: 2560 }));
    const exact = await serve(request({ width: 1280 }));
    expect(big.kind === 'image' && exact.kind === 'image' && big.etag === exact.etag).toBe(true);
    expect(deps.encode).toHaveBeenCalledTimes(1);
    expect(deps.encode).toHaveBeenCalledWith(expect.anything(), 1280);
    await serve(request({ width: 640 }));
    expect(deps.encode).toHaveBeenLastCalledWith(expect.anything(), 640);
    expect(deps.measure).not.toHaveBeenCalled();
  });

  it('🔴 Υ8 χωρίς metadata: μέτρηση των bytes που κατέβηκαν ⇒ κανονικό κλειδί, και από εκεί και πέρα 304/μνήμη', async () => {
    const { deps, serve } = harness({ measure: jest.fn().mockResolvedValue({ width: 1183, height: 1600 }) });
    const first = await serve(request({ width: 2560 }));
    expect(deps.encode).toHaveBeenCalledWith(expect.anything(), 1280);
    if (first.kind !== 'image') throw new Error(first.kind);
    expect(first.etag).toBe(imagePreviewEtag('files-eu', PATH, '7', 1280));
    expect(await serve(request({ width: 2560, ifNoneMatch: first.etag }))).toEqual({ kind: 'not-modified', etag: first.etag });
    expect(await serve(request({ width: 1280 }))).toMatchObject({ kind: 'image', etag: first.etag });
    expect(deps.read).toHaveBeenCalledTimes(1);
    expect(deps.measure).toHaveBeenCalledTimes(1);
  });

  it('🔴 Υ9 η μνήμη διαστάσεων είναι ανά ΓΕΝΙΑ — νέα bytes ⇒ νέα μέτρηση', async () => {
    const stat = jest.fn().mockResolvedValueOnce(found('7')).mockResolvedValueOnce(found('8'));
    const measure = jest.fn().mockResolvedValueOnce({ width: 600, height: 400 }).mockResolvedValueOnce({ width: 3000, height: 2000 });
    const { deps, serve } = harness({ stat, measure });
    await serve(request({ width: 2560 }));
    await serve(request({ width: 2560 }));
    expect(deps.encode).toHaveBeenNthCalledWith(1, expect.anything(), 640);
    expect(deps.encode).toHaveBeenNthCalledWith(2, expect.anything(), 2560);
  });

  it('το κλειδί περιέχει κάδο και πλάτος — ίδιο μονοπάτι αλλού ≠ ίδιο αρχείο', () => {
    const base = imagePreviewEtag('files-eu', PATH, '7', 640);
    expect(imagePreviewEtag('legacy', PATH, '7', 640)).not.toBe(base);
    expect(imagePreviewEtag('files-eu', PATH, '7', 320)).not.toBe(base);
  });
});

describe('etagMatches (RFC 9110 ασθενής σύγκριση)', () => {
  it('λίστα, W/ πρόθεμα, αστερίσκος', () => {
    expect(etagMatches('"a", W/"b"', '"b"')).toBe(true);
    expect(etagMatches('*', '"x"')).toBe(true);
    expect(etagMatches('"a"', '"b"')).toBe(false);
    expect(etagMatches(null, '"b"')).toBe(false);
  });
});
