/**
 * ⚓ ADR-915 §20 — «Ανάγνωση από το έγγραφο»: διαβάζεται ΤΟ αρχείο που βλέπει ο άνθρωπος (CAS), μόνο αν είναι του χώρου.
 */

import type { Firestore } from 'firebase-admin/firestore';

jest.mock('server-only', () => ({}));

const mockEvidence = jest.fn();
jest.mock('../conveyance-case-evidence.server', () => ({
  HOST_EVIDENCE_VIEWER: { role: 'host', audience: 'host', uid: null },
  collectCaseEvidence: (...args: unknown[]) => mockEvidence(...args),
}));
const mockRead = jest.fn();
jest.mock('@/server/files/document-text-reading', () => ({
  readDocumentTextFacts: (...args: unknown[]) => mockRead(...args),
}));

import type { ConveyanceCase, EvidenceFile } from '@/types/conveyance-case';
import { sellerParty } from '@/lib/conveyance/case-parties';
import { readCaseRowDocumentText } from '../conveyance-document-text.server';

// ADR-915 §22 — δύο πωλητές: η γραμμή του καθενός βλέπει ΜΟΝΟ τα αρχεία της δικής του επαφής.
const RECORD: ConveyanceCase = {
  id: 'cvc_1', companyId: 'c1', profile: 'new_build_company',
  subject: { kind: 'property', propertyId: 'prop_1', buildingId: null, projectId: null, appurtenances: [] },
  parties: { sellers: [sellerParty('cont_s', 'legal_entity'), sellerParty('cont_other', 'person')], buyers: [] },
  facts: {}, partyFacts: {}, overrides: {}, storedState: 'open', targetSigningDate: null, catalogVersion: '0.5.0',
  version: 1, createdBy: 'u1', createdAt: 't0', updatedAt: 't0', cancellation: null,
};
const TAX_ROW = 'seller_tax_clearance@cont_s';
const FILE_DATA = { purpose: 'tax-clearance', storagePath: 'p/f.pdf' };

function evidence(fileId: string, createdAt: string, source: EvidenceFile['source'] = { kind: 'owned' }): EvidenceFile {
  return {
    source, fileId, displayName: `${fileId}.pdf`, entityType: 'contact', entityId: 'cont_s', purpose: 'tax-clearance',
    level: 'seller_contact', fingerprint: `${fileId}:0:x`, createdAt, documentFacts: null,
  };
}

const db = {
  collection: () => ({ doc: () => ({ get: async () => ({ data: () => FILE_DATA }) }) }),
} as unknown as Firestore;

const run = (itemId: string, fileId: string) =>
  readCaseRowDocumentText(db, { record: RECORD, itemId, fileId, actorUid: 'u1' }, { readPdfText: async () => [] });

beforeEach(() => {
  mockEvidence.mockReset();
  mockRead.mockReset();
  mockRead.mockResolvedValue({ kind: 'not-recognized' });
});

describe('readCaseRowDocumentText (ADR-915 §20)', () => {
  it('το νεότερο αρχείο της γραμμής ⇒ ο κοινός πυρήνας, με `recordedBy` τον άνθρωπο', async () => {
    mockEvidence.mockResolvedValue({ files: [evidence('old', '2026-07-01'), evidence('new', '2026-07-22')], sealed: [] });
    await expect(run(TAX_ROW, 'new')).resolves.toEqual({ kind: 'not-recognized' });
    expect(mockRead).toHaveBeenCalledWith(db, { fileCollection: 'files', fileId: 'new', data: FILE_DATA, recordedBy: 'u1' }, expect.anything());
  });

  it('🔴 ο άνθρωπος βλέπει ΠΑΛΙΟΤΕΡΟ αρχείο ⇒ stale — ποτέ ανάγνωση εγγράφου άλλου από αυτό που εγκρίνει', async () => {
    mockEvidence.mockResolvedValue({ files: [evidence('old', '2026-07-01'), evidence('new', '2026-07-22')], sealed: [] });
    await expect(run(TAX_ROW, 'old')).resolves.toEqual({ kind: 'refused', reason: 'stale' });
    expect(mockRead).not.toHaveBeenCalled();
  });

  it('αρχείο επαγγελματία · γραμμή χωρίς αρχείο · γραμμή χωρίς αναγνώστη ⇒ ονομασμένη άρνηση', async () => {
    const sent: EvidenceFile['source'] = { kind: 'transmittal', contributionId: 'ctb', authorRole: 'seller_lawyer', onBehalf: false, own: false };
    mockEvidence.mockResolvedValue({ files: [evidence('sent', '2026-07-22', sent)], sealed: [] });
    await expect(run(TAX_ROW, 'sent')).resolves.toEqual({ kind: 'refused', reason: 'contributed-file' });
    mockEvidence.mockResolvedValue({ files: [], sealed: [] });
    await expect(run(TAX_ROW, 'x')).resolves.toEqual({ kind: 'refused', reason: 'no-file' });
    await expect(run('building_identity', 'x')).resolves.toEqual({ kind: 'refused', reason: 'not-text-readable' });
    await expect(run('no_such_item', 'x')).resolves.toEqual({ kind: 'refused', reason: 'not-text-readable' });
    expect(mockRead).not.toHaveBeenCalled();
  });

  it('⚓ ADR-915 §22 — η γραμμή του ΑΛΛΟΥ πωλητή δεν βλέπει αυτό το αρχείο ⇒ no-file · σκέτο κλειδί ⇒ not-text-readable', async () => {
    mockEvidence.mockResolvedValue({ files: [evidence('new', '2026-07-22')], sealed: [] });
    await expect(run('seller_tax_clearance@cont_other', 'new')).resolves.toEqual({ kind: 'refused', reason: 'no-file' });
    await expect(run('seller_tax_clearance', 'new')).resolves.toEqual({ kind: 'refused', reason: 'not-text-readable' });
    expect(mockRead).not.toHaveBeenCalled();
  });
});
