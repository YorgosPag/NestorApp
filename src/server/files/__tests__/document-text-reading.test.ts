/**
 * ⚓ ADR-915 §20 — ο ΕΝΑΣ δρόμος «κείμενο εγγράφου → γεγονότα στο ίδιο το αρχείο», για κάθε αφορμή.
 *
 * Δύο είδη αποτυχίας, δύο συμπεριφορές: βλάβη υποδομής **πετά** (ο καλών ξαναδοκιμάζει)· αρχείο που δεν διαβάζεται
 * είναι **έκβαση με όνομα**. Συνθετικά έντυπα — καμία τιμή από αρχείο πελάτη.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

jest.mock('server-only', () => ({}));

import type { RecordDocumentFactsInput } from '@/server/files/document-facts-writer';
import type { FileBytesReader } from '@/server/files/download-file-record-bytes';
import { TAX_PDFJS } from '@/lib/document-validity/__tests__/clearance-text.fixture';
import { RasterizeUnavailableError } from '@/services/pdf/pdf-rasterize.service';
import { DOCUMENT_TEXT_AUTOMATION_ACTOR, readDocumentTextFacts, type DocumentTextDeps } from '../document-text-reading';

const db = {} as AdminFirestore;
const PATH = 'companies/c1/contacts/cont_s/files/file_1.pdf';

const TAX_FILE: Readonly<Record<string, unknown>> = {
  entityType: 'contact', purpose: 'tax-clearance', status: 'ready', contentType: 'application/pdf', storagePath: PATH,
};

function harness(overrides: Partial<{ pages: string[]; size: number; readError: Error; parseError: Error }> = {}) {
  const written: RecordDocumentFactsInput[] = [];
  const readBytes: FileBytesReader = async () => {
    if (overrides.readError) throw overrides.readError;
    return { size: overrides.size ?? 2048, read: async () => Buffer.from('%PDF-synthetic') };
  };
  const deps: DocumentTextDeps = {
    readBytes,
    readPdfText: async () => {
      if (overrides.parseError) throw overrides.parseError;
      return overrides.pages ?? [TAX_PDFJS];
    },
    recordFacts: async (_db, input) => { written.push(input); return 'write'; },
  };
  return { deps, written };
}

const run = (data: Readonly<Record<string, unknown>>, deps: DocumentTextDeps) =>
  readDocumentTextFacts(db, { fileCollection: 'files', fileId: 'file_1', data, recordedBy: DOCUMENT_TEXT_AUTOMATION_ACTOR }, deps);

describe('readDocumentTextFacts — ο ΕΝΑΣ δρόμος (ADR-915 §20)', () => {
  it('φορολογική ⇒ γράφει μέσω του ΕΝΟΣ γραφέα, με τον φραγμό bytes και τον αυτοματισμό ως `recordedBy`', async () => {
    const { deps, written } = harness();
    await expect(run(TAX_FILE, deps)).resolves.toMatchObject({ kind: 'recorded', verdict: 'write', facts: { issuedOn: '2026-07-22' } });
    expect(written).toEqual([{
      fileCollection: 'files',
      fileId: 'file_1',
      expectedStoragePath: PATH,
      claim: {
        kind: 'tax-clearance', issuedOn: '2026-07-22', printedValidUntil: '2026-08-22',
        source: { kind: 'document-text', reader: 'aade-tax-clearance-text' }, recordedBy: 'system:document-text',
      },
    }]);
  });

  it('αρχείο που ο κατάλογος δεν παρακολουθεί ⇒ not-tracked, ΚΑΝΕΝΑ κατέβασμα', async () => {
    const { deps, written } = harness({ readError: new Error('must not download') });
    await expect(run({ ...TAX_FILE, purpose: 'document' }, deps)).resolves.toEqual({ kind: 'not-tracked' });
    expect(written).toEqual([]);
  });

  it.each([
    ['not-live', { status: 'pending' }],
    ['not-live', { isDeleted: true }],
    ['not-pdf', { contentType: 'image/jpeg' }],
    ['no-object', { storagePath: '' }],
  ])('%s ⇒ ονομασμένη έκβαση, κανένα κατέβασμα', async (reason, patch) => {
    const { deps, written } = harness({ readError: new Error('must not download') });
    await expect(run({ ...TAX_FILE, ...patch }, deps)).resolves.toEqual({ kind: 'unreadable', reason });
    expect(written).toEqual([]);
  });

  it('πάνω από το όριο ⇒ too-large ΠΡΙΝ κατέβει (PDF-βόμβα δεν φτάνει στον αναλυτή)', async () => {
    const { deps } = harness({ size: 50 * 1024 * 1024 });
    await expect(run(TAX_FILE, deps)).resolves.toEqual({ kind: 'unreadable', reason: 'too-large' });
  });

  it('χαλασμένο PDF ⇒ unparsable (έκβαση του αρχείου — η επανάληψη δεν θα βοηθήσει)', async () => {
    const { deps } = harness({ parseError: new Error('Invalid PDF structure') });
    await expect(run(TAX_FILE, deps)).resolves.toEqual({ kind: 'unreadable', reason: 'unparsable' });
  });

  it('🔴 ο αναλυτής ΔΕΝ ΦΟΡΤΩΝΕΙ ⇒ ΠΕΤΑ — βλάβη υποδομής, όχι «το αρχείο δεν διαβάζεται» (μετρημένο: έτσι έπεφτε το jest)', async () => {
    const { deps } = harness({ parseError: new RasterizeUnavailableError(new SyntaxError("Unexpected token 'export'")) });
    await expect(run(TAX_FILE, deps)).rejects.toBeInstanceOf(RasterizeUnavailableError);
  });

  it('🔴 βλάβη Storage ⇒ ΠΕΤΑ (ο καλών ξαναδοκιμάζει — δεν γίνεται σιωπηλό «δεν διαβάστηκε»)', async () => {
    const { deps } = harness({ readError: new Error('503 storage') });
    await expect(run(TAX_FILE, deps)).rejects.toThrow('503 storage');
  });

  it('άλλο έντυπο · άγνωστο έντυπο ⇒ ονομασμένη έκβαση, ΚΑΜΙΑ εγγραφή', async () => {
    const mismatch = harness();
    await expect(run({ ...TAX_FILE, purpose: 'owner-enfia' }, mismatch.deps)).resolves.toEqual({ kind: 'kind-mismatch', found: 'tax-clearance' });
    expect(mismatch.written).toEqual([]);
    const unknown = harness({ pages: ['Σαρωμένη σελίδα χωρίς κείμενο'] });
    await expect(run(TAX_FILE, unknown.deps)).resolves.toEqual({ kind: 'not-recognized' });
    expect(unknown.written).toEqual([]);
  });
});
