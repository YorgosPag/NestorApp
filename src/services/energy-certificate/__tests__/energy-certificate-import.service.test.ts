/**
 * ⚓ ADR-777 §8.96 — η εισαγωγή ΠΕΑ στον server: κριτής αρχείου → bytes με όριο → κείμενο → πρόταση. Δεν γράφει το ακίνητο.
 * ⚓ ADR-915 Φ3 — γράφει ό,τι λέει το έγγραφο ΣΤΟ έγγραφο, μόνο μέσω του ΕΝΟΣ γραφέα (`recordFacts`).
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { UNDECLARED_ENERGY_CERTIFICATE } from '@/lib/energy-certificate/energy-certificate';
import { peaPagesJoined } from '@/lib/energy-certificate/__tests__/pea-text.fixture';
import type { FileBytesReader } from '@/server/files/download-file-record-bytes';

import {
  PEA_MAX_BYTES,
  peaDocumentFacts,
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
  container: {
    owner: { kind: 'personal', userId: 'u1' },
    entityType: 'property_dossier',
    entityId: 'pdos_1',
    contentType: 'application/pdf',
  },
  current: UNDECLARED_ENERGY_CERTIFICATE,
  propertyArea: 80,
  today: '2026-10-14',
  actorUid: 'u1',
};

/** Ο ΕΝΑΣ γραφέας, ως κατάσκοπος — ο πραγματικός δοκιμάζεται στο `document-facts-writer.test.ts`. */
const factsSpy = () => jest.fn(async () => 'write' as const);

const bytesOf = (size: number): FileBytesReader => async () => ({ size, read: async () => Buffer.alloc(Math.min(size, 16)) });

describe('Σ1 — η ροή', () => {
  it('δικό σου PDF στο σωστό δοχείο ⇒ πρόταση, και ΚΑΜΙΑ άμεση εγγραφή στη βάση', async () => {
    const { db, writes } = dbWith(FILE);
    const readPdfText = jest.fn(async () => peaPagesJoined());
    const recordFacts = factsSpy();
    const outcome = await proposeEnergyCertificateImport(db, 'file_1', TARGET, { readPdfText, readBytes: bytesOf(1000), recordFacts });
    expect(outcome.kind).toBe('proposal');
    expect(outcome.kind === 'proposal' && outcome.proposal.fileId).toBe('file_1');
    expect(readPdfText).toHaveBeenCalledWith(expect.any(Buffer), { maxPages: 4 });
    expect(writes).toEqual([]);
  });

  it('📅 ADR-915 Φ3 — έκδοση + τυπωμένη λήξη πάνε στο ΙΔΙΟ το αρχείο, μέσω του ΕΝΟΣ γραφέα', async () => {
    const { db } = dbWith(FILE);
    const recordFacts = factsSpy();
    await proposeEnergyCertificateImport(db, 'file_1', TARGET, { readPdfText: async () => peaPagesJoined(), readBytes: bytesOf(1000), recordFacts });
    expect(recordFacts).toHaveBeenCalledTimes(1);
    expect(recordFacts).toHaveBeenCalledWith(db, {
      fileCollection: 'files_personal',
      fileId: 'file_1',
      claim: {
        kind: 'energy-certificate',
        issuedOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        printedValidUntil: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        source: { kind: 'document-text', reader: 'pea-text' },
        recordedBy: 'u1',
      },
    });
  });

  it('🔒 ξένο αρχείο ⇒ άρνηση ΠΡΙΝ κατέβει byte', async () => {
    const { db } = dbWith({ ...FILE, userId: 'u2' });
    const readBytes = jest.fn(bytesOf(1000));
    const recordFacts = factsSpy();
    const outcome = await proposeEnergyCertificateImport(db, 'file_1', TARGET, { readPdfText: jest.fn(), readBytes, recordFacts });
    expect(outcome).toEqual({ kind: 'refused', reason: 'file-not-yours' });
    expect(readBytes).not.toHaveBeenCalled();
    expect(recordFacts).not.toHaveBeenCalled();
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
    const recordFacts = factsSpy();
    const outcome = await proposeEnergyCertificateImport(db, 'file_1', TARGET, {
      readPdfText: async () => ['Συμβόλαιο αγοραπωλησίας'],
      readBytes: bytesOf(1000),
      recordFacts,
    });
    expect(outcome).toEqual({ kind: 'refused', reason: 'not-a-certificate' });
    expect(recordFacts).not.toHaveBeenCalled();
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

describe('Σ2 — ADR-915 Φ3: ανάγνωση ΠΕΑ → γεγονότα εγγράφου', () => {
  const reading = (issuedOn: string | null, validUntil: string | null) => ({
    template: 'buildingcert-pd4ml', protocol: null, securityNumber: null, issuedOn, validUntil, unitTitle: null,
    buildingUse: null, totalArea: null, usefulArea: null, referenceEnergy: null, primaryEnergy: null,
    co2Emissions: null, finalEnergy: null, unread: [],
  } as const);

  it('έκδοση + τυπωμένη λήξη ⇒ γεγονότα `document-text`', () => {
    expect(peaDocumentFacts(reading('2026-07-16', '2036-07-16'), 'u1')).toEqual({
      kind: 'energy-certificate', issuedOn: '2026-07-16', printedValidUntil: '2036-07-16',
      source: { kind: 'document-text', reader: 'pea-text' }, recordedBy: 'u1',
    });
  });

  it('⛔ χωρίς αναγνωσμένη έκδοση ⇒ ΚΑΝΕΝΑ γεγονός (κενή ανάγνωση δεν υπερισχύει της δήλωσης ελεγκτή)', () => {
    expect(peaDocumentFacts(reading(null, '2036-07-16'), 'u1')).toBeNull();
  });

  it('έκδοση χωρίς τυπωμένη λήξη ⇒ γεγονότα με `printedValidUntil: null`', () => {
    expect(peaDocumentFacts(reading('2026-07-16', null), 'u1')?.printedValidUntil).toBeNull();
  });
});
