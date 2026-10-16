/**
 * ⚓ ADR-915 §20 — η ανάγνωση στο ανέβασμα, ως δεύτερος καταναλωτής του CDC των αρχείων (ADR-905 §6).
 *
 * 🔴 Η άγκυρα που μετρά: η εγγραφή των ίδιων των γεγονότων είναι **κι αυτή** εγγραφή αρχείου ⇒ ξαναφτάνει εδώ. Αν άλλαζε
 * το κλειδί ανάγνωσης, κάθε ανάγνωση θα γεννούσε την επόμενη — βρόχος ανάμεσα σε Functions και εφαρμογή.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

jest.mock('server-only', () => ({}));

import type { DependencyChangeEvent, WireDocument } from '@/lib/conveyance/dependency-change-event';
import type { RecordDocumentFactsInput } from '@/server/files/document-facts-writer';
import { TAX_PDFJS } from '@/lib/document-validity/__tests__/clearance-text.fixture';
import { documentTextReadingDue, readDocumentTextOnFileChange } from '../document-text-on-file-change';
import type { DocumentTextDeps } from '../document-text-reading';

const READY: WireDocument = {
  companyId: 'c1', entityType: 'contact', entityId: 'cont_s', purpose: 'tax-clearance', status: 'ready',
  contentType: 'application/pdf', storagePath: 'companies/c1/files/file_1.pdf', sizeBytes: 2048, hash: 'sha256:a',
};

const event = (before: WireDocument | null, after: WireDocument | null, source: DependencyChangeEvent['source'] = 'file'): DependencyChangeEvent =>
  ({ eventId: 'evt_1', source, docId: 'file_1', before, after });

describe('documentTextReadingDue — πότε διαβάζεται (ADR-915 §20)', () => {
  it('γίνεται έτοιμο ⇒ ναι', () => {
    expect(documentTextReadingDue(event({ ...READY, status: 'pending' }, READY))).toBe(true);
    expect(documentTextReadingDue(event(null, READY))).toBe(true);
  });

  it('🔴 γράφτηκαν ΤΑ ΓΕΓΟΝΟΤΑ (ή μικρογραφία, ή updatedAt) ⇒ ΟΧΙ — κανένας βρόχος', () => {
    const facts = { kind: 'tax-clearance', issuedOn: '2026-07-22', printedValidUntil: '2026-08-22', source: { kind: 'document-text', reader: 'aade-tax-clearance-text' } };
    expect(documentTextReadingDue(event(READY, { ...READY, documentFacts: facts, updatedAt: '2026-10-16T10:00:00Z', thumbnailUrl: 'x' }))).toBe(false);
  });

  it('νέα bytes · άλλος σκοπός ⇒ ναι (η απάντηση «τι λέει;» άλλαξε)', () => {
    expect(documentTextReadingDue(event(READY, { ...READY, hash: 'sha256:b', sizeBytes: 4096 }))).toBe(true);
    expect(documentTextReadingDue(event({ ...READY, purpose: 'document' }, READY))).toBe(true);
  });

  it('μη παρακολουθούμενο · στον κάδο · όχι PDF · άλλη πηγή ⇒ όχι', () => {
    expect(documentTextReadingDue(event(null, { ...READY, purpose: 'document' }))).toBe(false);
    expect(documentTextReadingDue(event(READY, { ...READY, isDeleted: true }))).toBe(false);
    expect(documentTextReadingDue(event(null, { ...READY, contentType: 'image/png' }))).toBe(false);
    expect(documentTextReadingDue(event(null, READY, 'property'))).toBe(false);
    expect(documentTextReadingDue(event(READY, null))).toBe(false);
  });
});

describe('readDocumentTextOnFileChange — ο καταναλωτής', () => {
  function deps() {
    const written: RecordDocumentFactsInput[] = [];
    const value: DocumentTextDeps = {
      readBytes: async () => ({ size: 2048, read: async () => Buffer.from('%PDF') }),
      readPdfText: async () => [TAX_PDFJS],
      recordFacts: async (_db, input) => { written.push(input); return 'write'; },
    };
    return { value, written };
  }

  it('έτοιμο ⇒ γράφει στη συλλογή `files`, ως ονομασμένος αυτοματισμός', async () => {
    const { value, written } = deps();
    await expect(readDocumentTextOnFileChange({} as AdminFirestore, event(null, READY), value)).resolves.toMatchObject({ kind: 'recorded' });
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ fileCollection: 'files', fileId: 'file_1', claim: { recordedBy: 'system:document-text' } });
  });

  it('δεν χρειάζεται ⇒ `null`, κανένα κατέβασμα', async () => {
    const { value, written } = deps();
    await expect(readDocumentTextOnFileChange({} as AdminFirestore, event(READY, READY), value)).resolves.toBeNull();
    expect(written).toEqual([]);
  });
});
