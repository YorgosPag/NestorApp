/**
 * @jest-environment node
 *
 * @fileoverview **stat + ανάγνωση ΚΑΡΦΩΜΕΝΗΣ γενιάς** (ADR-899 §4).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Γ1: η ανάγνωση ξεχνά τη γενιά (`bucket.file(path)`) ⇒ νέα bytes κάτω από παλιό ETag.
 * - Γ2: η γενιά γίνεται `Number` ⇒ 16ψήφια γενιά GCS χάνει ακρίβεια (> 2^53).
 * - Γ3: απουσία (404) πετά αντί να ονομαστεί.
 */

import type { Bucket } from '@google-cloud/storage';

jest.mock('server-only', () => ({}));

import { readStorageObjectGeneration, statStorageObject } from '../storage-object-stream';

const GENERATION = '1727712345678901234';
const notFound = Object.assign(new Error('No such object'), { code: 404 });

function fakeBucket(file: { getMetadata?: jest.Mock; download?: jest.Mock }) {
  const calls: Array<{ path: string; options: unknown }> = [];
  const bucket = {
    file: (path: string, options?: unknown) => {
      calls.push({ path, options });
      return file;
    },
  } as unknown as Bucket;
  return { bucket, calls };
}

describe('statStorageObject', () => {
  it('δίνει γενιά (ως string), τύπο, μέγεθος — χωρίς κατέβασμα', async () => {
    const download = jest.fn();
    const { bucket } = fakeBucket({
      getMetadata: jest.fn().mockResolvedValue([{ generation: GENERATION, contentType: 'image/jpeg', size: '2048' }]),
      download,
    });
    await expect(statStorageObject('a/b.jpg', { bucket })).resolves.toEqual({
      kind: 'found',
      generation: GENERATION,
      contentType: 'image/jpeg',
      size: 2048,
    });
    expect(download).not.toHaveBeenCalled();
  });

  it('🔴 Γ3 404 ⇒ ονομασμένη απουσία· άλλη βλάβη πετά', async () => {
    const absent = fakeBucket({ getMetadata: jest.fn().mockRejectedValue(notFound) });
    await expect(statStorageObject('x', { bucket: absent.bucket })).resolves.toEqual({ kind: 'absent' });
    const broken = fakeBucket({ getMetadata: jest.fn().mockRejectedValue(new Error('boom')) });
    await expect(statStorageObject('x', { bucket: broken.bucket })).rejects.toThrow('boom');
  });
});

describe('readStorageObjectGeneration', () => {
  it('🔴 Γ1+Γ2 ζητά ΑΚΡΙΒΩΣ τη γενιά, αυτολεξεί', async () => {
    const { bucket, calls } = fakeBucket({ download: jest.fn().mockResolvedValue([Buffer.from('JPEG')]) });
    await expect(readStorageObjectGeneration('a/b.jpg', GENERATION, { bucket })).resolves.toEqual(Buffer.from('JPEG'));
    expect(calls).toEqual([{ path: 'a/b.jpg', options: { generation: GENERATION } }]);
  });

  it('🔴 Γ3 η γενιά δεν υπάρχει πια (overwrite στο μεταξύ) ⇒ null, όχι ξένα bytes', async () => {
    const { bucket } = fakeBucket({ download: jest.fn().mockRejectedValue(notFound) });
    await expect(readStorageObjectGeneration('a/b.jpg', GENERATION, { bucket })).resolves.toBeNull();
  });
});
