/**
 * @jest-environment node
 *
 * @fileoverview **stat + ανάγνωση ΚΑΡΦΩΜΕΝΗΣ γενιάς** (ADR-899 §3.3).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Γ1: η ανάγνωση ξεχνά τη γενιά (`bucket.file(path)`) ⇒ νέα bytes κάτω από παλιό ETag.
 * - Γ2: η γενιά γίνεται `Number` ⇒ 16ψήφια γενιά GCS χάνει ακρίβεια (> 2^53).
 * - Γ3: απουσία (404) πετά αντί να ονομαστεί.
 * - Γ4 (ADR-899 §3.7): το εύρος κεφαλίδας χάνεται (κατεβαίνει όλο το αρχείο) · το metadata γράφεται χωρίς
 *   `ifGenerationMatch` ή η αλλαγμένη γενιά πετά αντί να ονομαστεί.
 */

import type { Bucket } from '@google-cloud/storage';

jest.mock('server-only', () => ({}));

import { readStorageObjectGeneration, statStorageObject, writeStorageObjectMetadataIfGeneration } from '../storage-object-stream';

const GENERATION = '1727712345678901234';
const notFound = Object.assign(new Error('No such object'), { code: 404 });

function fakeBucket(file: { getMetadata?: jest.Mock; download?: jest.Mock; setMetadata?: jest.Mock }) {
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
      dimensions: null,
    });
    expect(download).not.toHaveBeenCalled();
  });

  it('🔴 ADR-899 §3.7 διαστάσεις ΤΗΣ ΓΕΝΙΑΣ από το custom metadata — με την ίδια κλήση', async () => {
    const download = jest.fn();
    const { bucket } = fakeBucket({
      getMetadata: jest.fn().mockResolvedValue([
        { generation: GENERATION, contentType: 'image/jpeg', size: '2048', metadata: { imageWidth: '1013', imageHeight: '1800' } },
      ]),
      download,
    });
    await expect(statStorageObject('a/b.jpg', { bucket })).resolves.toMatchObject({ dimensions: { width: 1013, height: 1800 } });
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

describe('Γ4 κεφαλίδα + metadata δεμένα στη γενιά (ADR-899 §3.7)', () => {
  it('🔴 το εύρος φτάνει στο download', async () => {
    const download = jest.fn().mockResolvedValue([Buffer.from('HEAD')]);
    const { bucket, calls } = fakeBucket({ download });
    await readStorageObjectGeneration('a/b.jpg', GENERATION, { bucket, range: { start: 0, end: 131071 } });
    expect(download).toHaveBeenCalledWith({ start: 0, end: 131071 });
    expect(calls).toEqual([{ path: 'a/b.jpg', options: { generation: GENERATION } }]);
  });

  it('🔴 metadata ΜΟΝΟ με ifGenerationMatch · 412/404 ⇒ generation-changed · άλλη βλάβη πετά', async () => {
    const setMetadata = jest.fn().mockResolvedValue([{}]);
    const { bucket } = fakeBucket({ setMetadata });
    await expect(writeStorageObjectMetadataIfGeneration('a/b.jpg', GENERATION, { imageWidth: '1' }, { bucket })).resolves.toBe('written');
    expect(setMetadata).toHaveBeenCalledWith({ metadata: { imageWidth: '1' } }, { ifGenerationMatch: GENERATION });
    for (const code of [412, 404]) {
      setMetadata.mockRejectedValueOnce(Object.assign(new Error('x'), { code }));
      await expect(writeStorageObjectMetadataIfGeneration('a/b.jpg', GENERATION, {}, { bucket })).resolves.toBe('generation-changed');
    }
    setMetadata.mockRejectedValueOnce(new Error('boom'));
    await expect(writeStorageObjectMetadataIfGeneration('a/b.jpg', GENERATION, {}, { bucket })).rejects.toThrow('boom');
  });
});
