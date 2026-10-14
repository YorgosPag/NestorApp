/**
 * ⚓ ADR-777 §8.96 — η εισαγωγή ΠΕΑ στον server: κριτής αρχείου → bytes με όριο → κείμενο → πρόταση. Δεν γράφει τίποτα.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { UNDECLARED_ENERGY_CERTIFICATE } from '@/lib/energy-certificate/energy-certificate';
import { peaPagesJoined } from '@/lib/energy-certificate/__tests__/pea-text.fixture';
import type { FileBytesReader } from '@/server/files/download-file-record-bytes';

import {
  PEA_MAX_BYTES,
  proposeEnergyCertificateImport,
  type EnergyCertificateImportTarget,
} from '../energy-certificate-import.service';

const FILE = {
  userId: 'u1',
  entityType: 'property_dossier',
  entityId: 'pdos_1',
  status: 'ready',
  contentType: 'application/pdf',
  storagePath: 'people/u1/x.pdf',
};

function dbWith(data: Record<string, unknown> | null) {
  const writes: string[] = [];
  const fake = {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => ({ exists: data !== null, data: () => data ?? undefined }),
        set: async () => void writes.push(`${name}/${id}`),
        update: async () => void writes.push(`${name}/${id}`),
      }),
    }),
  };
  return { db: fake as unknown as AdminFirestore, writes };
}

const TARGET: EnergyCertificateImportTarget = {
  fileCollection: 'files_personal',
  container: { owner: { kind: 'personal', userId: 'u1' }, entityType: 'property_dossier', entityId: 'pdos_1' },
  current: UNDECLARED_ENERGY_CERTIFICATE,
  propertyArea: 80,
  today: '2026-10-14',
};

const bytesOf = (size: number): FileBytesReader => async () => ({ size, read: async () => Buffer.alloc(Math.min(size, 16)) });

describe('Σ1 — η ροή', () => {
  it('δικό σου PDF στο σωστό δοχείο ⇒ πρόταση, και ΚΑΜΙΑ εγγραφή στη βάση', async () => {
    const { db, writes } = dbWith(FILE);
    const readPdfText = jest.fn(async () => peaPagesJoined());
    const outcome = await proposeEnergyCertificateImport(db, 'file_1', TARGET, { readPdfText, readBytes: bytesOf(1000) });
    expect(outcome.kind).toBe('proposal');
    expect(outcome.kind === 'proposal' && outcome.proposal.fileId).toBe('file_1');
    expect(readPdfText).toHaveBeenCalledWith(expect.any(Buffer), { maxPages: 4 });
    expect(writes).toEqual([]);
  });

  it('🔒 ξένο αρχείο ⇒ άρνηση ΠΡΙΝ κατέβει byte', async () => {
    const { db } = dbWith({ ...FILE, userId: 'u2' });
    const readBytes = jest.fn(bytesOf(1000));
    const outcome = await proposeEnergyCertificateImport(db, 'file_1', TARGET, { readPdfText: jest.fn(), readBytes });
    expect(outcome).toEqual({ kind: 'refused', reason: 'file-not-yours' });
    expect(readBytes).not.toHaveBeenCalled();
  });

  it('PDF-βόμβα ⇒ file-too-large, ο αναλυτής δεν τρέχει', async () => {
    const { db } = dbWith(FILE);
    const readPdfText = jest.fn();
    const outcome = await proposeEnergyCertificateImport(db, 'file_1', TARGET, { readPdfText, readBytes: bytesOf(PEA_MAX_BYTES + 1) });
    expect(outcome).toEqual({ kind: 'refused', reason: 'file-too-large' });
    expect(readPdfText).not.toHaveBeenCalled();
  });

  it('PDF που δεν είναι ΠΕΑ ⇒ not-a-certificate', async () => {
    const { db } = dbWith(FILE);
    const outcome = await proposeEnergyCertificateImport(db, 'file_1', TARGET, {
      readPdfText: async () => ['Συμβόλαιο αγοραπωλησίας'],
      readBytes: bytesOf(1000),
    });
    expect(outcome).toEqual({ kind: 'refused', reason: 'not-a-certificate' });
  });

  it('βλάβη του αναλυτή ΠΕΤΑ (η διαδρομή τη γυρίζει σε 503 — «ξαναδοκίμασε»)', async () => {
    const { db } = dbWith(FILE);
    const failing = async (): Promise<string[]> => {
      throw new Error('pdf.js');
    };
    await expect(
      proposeEnergyCertificateImport(db, 'file_1', TARGET, { readPdfText: failing, readBytes: bytesOf(1000) }),
    ).rejects.toThrow('pdf.js');
  });
});
