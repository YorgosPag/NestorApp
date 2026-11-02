import type { DocumentSnapshot } from 'firebase-admin/firestore';

import { signedUrlOfFileRecord } from '../file-record-signed-url';

const signedDownloadUrl = jest.fn();
jest.mock('@/lib/storage/signed-download-url', () => ({
  signedDownloadUrl: (input: unknown) => signedDownloadUrl(input),
}));
jest.mock('@/server/files/file-record-bucket', () => ({ fileRecordBucket: () => 'bucket-a' }));

const snapOf = (exists: boolean, fields: Record<string, unknown>): DocumentSnapshot =>
  ({ exists, get: (field: string) => fields[field] }) as unknown as DocumentSnapshot;

beforeEach(() => signedDownloadUrl.mockReset());

describe('signedUrlOfFileRecord', () => {
  it('υπογράφει τη διαδρομή του αρχείου', async () => {
    signedDownloadUrl.mockResolvedValue({ outcome: 'signed', url: 'https://signed' });
    await expect(signedUrlOfFileRecord(snapOf(true, { storagePath: 'x/y.pdf' }))).resolves.toEqual({ url: 'https://signed' });
    expect(signedDownloadUrl).toHaveBeenCalledWith({ bucket: 'bucket-a', storagePath: 'x/y.pdf' });
  });

  it.each([
    ['ανύπαρκτο αρχείο', snapOf(false, { storagePath: 'x/y.pdf' })],
    ['χωρίς διαδρομή', snapOf(true, {})],
  ])('%s ⇒ NOT_FOUND, χωρίς υπογραφή', async (_name, snap) => {
    await expect(signedUrlOfFileRecord(snap)).resolves.toEqual({ error: 'NOT_FOUND' });
    expect(signedDownloadUrl).not.toHaveBeenCalled();
  });

  it('αποτυχία υπογραφής ⇒ UNAVAILABLE', async () => {
    signedDownloadUrl.mockResolvedValue({ outcome: 'failed' });
    await expect(signedUrlOfFileRecord(snapOf(true, { storagePath: 'x/y.pdf' }))).resolves.toEqual({ error: 'UNAVAILABLE' });
  });
});
