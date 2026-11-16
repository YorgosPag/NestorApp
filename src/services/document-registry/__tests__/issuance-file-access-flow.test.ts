/**
 * @jest-environment node
 *
 * ADR-942 Φ2 — «δόθηκε ⇒ ο μηχανικός το ανοίγει» **από άκρη σε άκρη** πάνω στο fake Firestore: δόσιμο (ιδεμποτικό) →
 * άνοιγμα με ίχνος → ανάκληση ⇒ 404. Κάθε `it` ονομάζει τη μετάλλαξη που πρέπει να πιάσει.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { IssuanceStage } from '@/lib/document-validity/issuance-stage';
import { giveDocument, revokeProvision } from '@/server/document-requests/document-provision-store.server';
import { EntityAuditService } from '@/services/entity-audit.service';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { IssuanceEngagement } from '@/types/engagement';
import { openIssuanceFile } from '../issuance-file-access.service';
import { issuanceRequestPurposeOf } from '../issuance-request-files.server';

jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn(async () => 'eaud_1') } }));
const signedDownloadUrl = jest.fn(async (_req: { storagePath: string; downloadFileName?: string }) => ({ outcome: 'signed', url: 'https://signed.example/x', expiresAt: 1 }));
jest.mock('@/lib/storage/signed-download-url', () => ({ signedDownloadUrl: (req: { storagePath: string; downloadFileName?: string }) => signedDownloadUrl(req) }));
jest.mock('@/server/files/file-record-bucket', () => ({ fileRecordBucket: () => ({ name: 'bucket-under-test' }) }));

let mockEngaged = true;
let mockStage: IssuanceStage = 'accepted';
let mockLatestIssuedOn: string | null | 'unknown' = null;
const ASSIGNMENT = {
  id: 'dias_1', companyId: 'comp_a', propertyId: 'prop_1', scope: 'property', documentKind: 'energy-certificate',
  proposedAt: '2026-11-01T10:00:00.000Z',
};
jest.mock('../issuance-engagement-host-adapter', () => ({
  readHostedIssuanceAssignment: async () => ASSIGNMENT,
  judgeIssuanceEngagement: () => ({ verdict: mockEngaged ? 'engaged' : 'not-engaged' }),
  issuancePropertyNameOf: async () => 'Δ3',
}));
jest.mock('@/lib/auth/engagement-judge', () => ({ isEngaged: (verdict: string) => verdict === 'engaged' }));
jest.mock('@/lib/document-validity/issuance-stage', () => ({
  ...jest.requireActual('@/lib/document-validity/issuance-stage'),
  issuanceStageOf: () => mockStage,
}));
jest.mock('../issuance-latest-issued.server', () => ({ issuanceLatestIssuedOn: async () => mockLatestIssuedOn }));

const NOW = Date.parse('2026-11-17T10:00:00.000Z');
const engagement = { id: 'eng_1', hostCompanyId: 'comp_a', subject: { kind: 'document_issuance', assignmentId: 'dias_1' } } as unknown as IssuanceEngagement;
const subject = { kind: 'document_issuance', id: 'dias_1' } as const;
let fake: FakeFirestore;
const db = () => fake as unknown as Firestore;

function seedFile(fileId: string, overrides: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.FILES, fileId, {
    companyId: 'comp_a', entityType: 'property', entityId: 'prop_1', purpose: issuanceRequestPurposeOf('unit-permit'),
    status: 'ready', storagePath: `companies/comp_a/${fileId}.pdf`, displayName: 'Άδεια', ext: 'pdf', contentType: 'application/pdf',
    ...overrides,
  });
}

function give(fileId: string) {
  return giveDocument(db(), { companyId: 'comp_a', subject, itemId: 'unit-permit', fileId, via: 'existing', byUid: 'u_host', nowIso: new Date(NOW).toISOString() });
}

function open(fileId: string, mode: 'view' | 'download' = 'download') {
  return openIssuanceFile(db(), engagement, { uid: 'u_eng', email: null, engagementId: 'eng_1', fileId, mode, nowMs: NOW });
}

describe('ADR-942 Φ2 — δόσιμο → άνοιγμα → ανάκληση', () => {
  beforeEach(() => {
    fake = new FakeFirestore();
    mockEngaged = true;
    mockStage = 'accepted';
    mockLatestIssuedOn = null;
    jest.clearAllMocks();
    seedFile('file_permit');
  });

  it('αρχείο που ΔΕΝ δόθηκε ⇒ 404, κανένας σύνδεσμος, κανένα ίχνος (μετάλλαξη: «κάθε αρχείο του είδους» ανοίγει)', async () => {
    expect(await open('file_permit')).toEqual({ ok: false, rejection: 'not-found' });
    expect(signedDownloadUrl).not.toHaveBeenCalled();
    expect(EntityAuditService.recordChange).not.toHaveBeenCalled();
  });

  it('δοσμένο ⇒ λήψη με όνομα + ίχνος «λήψη» στο ακίνητο (μετάλλαξη: άνοιγμα χωρίς ίχνος)', async () => {
    await give('file_permit');
    expect(await open('file_permit')).toMatchObject({ ok: true, fileName: 'Άδεια.pdf' });
    expect(signedDownloadUrl).toHaveBeenCalledWith(expect.objectContaining({ downloadFileName: 'Άδεια.pdf' }));
    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'property', entityId: 'prop_1', action: 'document_accessed',
      changes: [expect.objectContaining({ field: 'energyCertificateIssuanceDocumentAccess', newValue: 'download' })],
    }));
  });

  it('δεύτερο δόσιμο του ίδιου αρχείου ⇒ `already-given`, ίδιο έγγραφο (μετάλλαξη: τυχαίο id ⇒ διπλά δοσίματα)', async () => {
    const first = await give('file_permit');
    const second = await give('file_permit');
    expect(first.outcome).toBe('given');
    expect(second).toEqual({ outcome: 'already-given', provision: first.provision });
  });

  it('ανάκληση ⇒ το ίδιο αρχείο δεν ανοίγει πια (μετάλλαξη: ανάκληση που δεν ελέγχεται στο άνοιγμα)', async () => {
    const { provision } = await give('file_permit');
    expect(await revokeProvision(db(), { companyId: 'comp_a', subject, provisionId: provision.id, byUid: 'u_host', nowIso: new Date(NOW).toISOString() }))
      .toMatchObject({ outcome: 'revoked' });
    expect(await open('file_permit')).toEqual({ ok: false, rejection: 'not-found' });
  });

  it('ανάκληση από ΞΕΝΟ μισθωτή ⇒ `not-found` (μετάλλαξη: ανάκληση χωρίς έλεγχο θεματοφυλακής)', async () => {
    const { provision } = await give('file_permit');
    expect(await revokeProvision(db(), { companyId: 'comp_b', subject, provisionId: provision.id, byUid: 'u_x', nowIso: new Date(NOW).toISOString() }))
      .toEqual({ outcome: 'not-found' });
  });

  it('δοσμένο αρχείο που ΔΕΝ ζει πια στο δοχείο του κατόχου ⇒ 404 (μετάλλαξη: η διαδρομή από το δόσιμο, όχι από το έγγραφο)', async () => {
    seedFile('file_elsewhere', { entityId: 'prop_other' });
    await give('file_elsewhere');
    expect(await open('file_elsewhere')).toEqual({ ok: false, rejection: 'not-found' });
  });

  it('ακυρωμένη ανάθεση ⇒ 404 ακόμη και για δοσμένο (μετάλλαξη: καμία κρίση παραθύρου)', async () => {
    await give('file_permit');
    mockStage = 'cancelled';
    expect(await open('file_permit')).toEqual({ ok: false, rejection: 'not-found' });
  });

  it('μητρώο που δεν διαβάστηκε ⇒ `unknown`, όχι άνοιγμα (μετάλλαξη: «δεν ξέρω» = «ανοιχτό»)', async () => {
    await give('file_permit');
    mockLatestIssuedOn = 'unknown';
    expect(await open('file_permit')).toEqual({ ok: false, rejection: 'unknown' });
  });

  it('μη ενεργή συμμετοχή ⇒ 403 με ετυμηγορία (μετάλλαξη: κρίση συμμετοχής μετά το άνοιγμα)', async () => {
    await give('file_permit');
    mockEngaged = false;
    expect(await open('file_permit')).toEqual({ ok: false, rejection: 'denied', verdict: 'not-engaged' });
    expect(signedDownloadUrl).not.toHaveBeenCalled();
  });
});
