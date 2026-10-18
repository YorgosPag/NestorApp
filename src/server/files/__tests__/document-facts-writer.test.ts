/**
 * ⚓ ADR-915 Φ3 — ο ΕΝΑΣ γραφέας των γεγονότων εγγράφου.
 *
 * 🔴 Η άγκυρα που μετρά: γράφει **ΜΟΝΟ** το `documentFacts` — ποτέ `updatedAt`/`revision`. Το αποτύπωμα του ελέγχου
 * μεταβίβασης είναι `fileId:revision:updatedAt`· αν άλλαζε, κάθε εγκεκριμένη γραμμή θα γινόταν σιωπηλά «μη τρέχουσα».
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { DocumentFacts } from '@/lib/document-validity/document-facts';

jest.mock('server-only', () => ({}));
const mockRecordFileAudit = jest.fn(async () => 'audit_1');
jest.mock('@/services/file-audit-admin.service', () => ({
  recordFileAudit: (...args: unknown[]) => mockRecordFileAudit(...(args as [])),
}));

import { recordDocumentFacts, type DocumentFactsClaim } from '../document-facts-writer';

const NOW = '2026-10-14T10:00:00.000Z';
const claim: DocumentFactsClaim = {
  kind: 'energy-certificate',
  issuedOn: '2026-07-16',
  printedValidUntil: '2036-07-16',
  classification: null,
  source: { kind: 'document-text', reader: 'pea-text' },
  recordedBy: 'u1',
};

function dbWith(data: Record<string, unknown> | null) {
  const updates: Array<Record<string, unknown>> = [];
  const ref = { id: 'file_1' };
  const fake = {
    collection: () => ({ doc: () => ref }),
    runTransaction: async <T>(body: (tx: unknown) => Promise<T>) =>
      body({
        get: async () => ({ exists: data !== null, data: () => data ?? undefined }),
        update: (_ref: unknown, patch: Record<string, unknown>) => void updates.push(patch),
      }),
  };
  return { db: fake as unknown as AdminFirestore, updates };
}

const input = { fileCollection: 'files', fileId: 'file_1', claim };

beforeEach(() => mockRecordFileAudit.mockClear());

describe('Γ1 — η εγγραφή', () => {
  it('κενό αρχείο ⇒ γράφει ΜΟΝΟ `documentFacts` (κανένα updatedAt/revision) + μία γραμμή ημερολογίου', async () => {
    const { db, updates } = dbWith({ companyId: 'c1', updatedAt: 'x', revision: 3 });
    await expect(recordDocumentFacts(db, input, () => NOW)).resolves.toBe('write');
    expect(updates).toEqual([{ documentFacts: { ...claim, recordedAt: NOW } }]);
    expect(Object.keys(updates[0])).toEqual(['documentFacts']);
    expect(mockRecordFileAudit).toHaveBeenCalledWith({
      fileId: 'file_1',
      action: 'document_facts_record',
      performedBy: 'u1',
      metadata: { kind: 'energy-certificate', issuedOn: '2026-07-16', printedValidUntil: '2036-07-16', classification: null, source: 'document-text:pea-text' },
      companyId: 'c1',
    });
  });

  it('προσωπικό αρχείο ⇒ το ημερολόγιο πάει στο βιβλίο του ΚΑΤΟΧΟΥ', async () => {
    const { db } = dbWith({ userId: 'u7' });
    await recordDocumentFacts(db, input, () => NOW);
    expect(mockRecordFileAudit).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u7' }));
    expect(mockRecordFileAudit).toHaveBeenCalledWith(expect.not.objectContaining({ companyId: expect.anything() }));
  });

  it('ίδια γεγονότα ⇒ already-recorded, ΚΑΜΙΑ γραφή, ΚΑΜΙΑ γραμμή (ιδεμπότητα)', async () => {
    const stored: DocumentFacts = { ...claim, recordedBy: 'u0', recordedAt: '2026-01-01T00:00:00.000Z' };
    const { db, updates } = dbWith({ companyId: 'c1', documentFacts: stored });
    await expect(recordDocumentFacts(db, input, () => NOW)).resolves.toBe('already-recorded');
    expect(updates).toEqual([]);
    expect(mockRecordFileAudit).not.toHaveBeenCalled();
  });

  it('⛔ δήλωση ανθρώπου πάνω σε ανάγνωση του εγγράφου ⇒ outranked, ΚΑΜΙΑ γραφή', async () => {
    const stored: DocumentFacts = { ...claim, recordedAt: NOW };
    const { db, updates } = dbWith({ companyId: 'c1', documentFacts: stored });
    const human = { ...input, claim: { ...claim, issuedOn: '2026-01-01', source: { kind: 'attested', via: 'conveyance-review' } as const } };
    await expect(recordDocumentFacts(db, human, () => NOW)).resolves.toBe('outranked');
    expect(updates).toEqual([]);
  });

  it('αλλοιωμένο αποθηκευμένο πεδίο ⇒ διαβάζεται «δεν ξέρουμε» και αντικαθίσταται', async () => {
    const { db, updates } = dbWith({ companyId: 'c1', documentFacts: { kind: 'garbage' } });
    await expect(recordDocumentFacts(db, input, () => NOW)).resolves.toBe('write');
    expect(updates).toHaveLength(1);
  });

  it('ανύπαρκτο αρχείο ⇒ no-file, τίποτα δεν γράφεται', async () => {
    const { db, updates } = dbWith(null);
    await expect(recordDocumentFacts(db, input, () => NOW)).resolves.toBe('no-file');
    expect(updates).toEqual([]);
    expect(mockRecordFileAudit).not.toHaveBeenCalled();
  });

  // ADR-915 §20 — φραγμός bytes: η ανάγνωση περιγράφει το αντικείμενο που κατέβηκε, όχι ό,τι δείχνει η εγγραφή τώρα.
  it('η εγγραφή δείχνει πλέον άλλο αντικείμενο ⇒ not-this-object, τίποτα δεν γράφεται', async () => {
    const { db, updates } = dbWith({ companyId: 'c1', storagePath: 'companies/c1/files/f1-v2.pdf' });
    const guarded = { ...input, expectedStoragePath: 'companies/c1/files/f1.pdf' };
    await expect(recordDocumentFacts(db, guarded, () => NOW)).resolves.toBe('not-this-object');
    expect(updates).toEqual([]);
    expect(mockRecordFileAudit).not.toHaveBeenCalled();
  });

  it('ίδιο αντικείμενο ⇒ ο φραγμός περνά', async () => {
    const { db, updates } = dbWith({ companyId: 'c1', storagePath: 'companies/c1/files/f1.pdf' });
    const guarded = { ...input, expectedStoragePath: 'companies/c1/files/f1.pdf' };
    await expect(recordDocumentFacts(db, guarded, () => NOW)).resolves.toBe('write');
    expect(updates).toHaveLength(1);
  });
});
