/**
 * ⚓ ADR-915 §20 — η συμπλήρωση: μόνο όπου λείπει ανάγνωση του εγγράφου · το dry-run διαβάζει αλλά ΔΕΝ γράφει.
 */

import type { Firestore } from 'firebase-admin/firestore';

jest.mock('server-only', () => ({}));

import { TAX_PDFJS } from '@/lib/document-validity/__tests__/clearance-text.fixture';
import { needsDocumentText, runDocumentTextBackfill } from '../document-text-backfill';
import type { DocumentTextDeps } from '../document-text-reading';

const TAX: Record<string, unknown> = {
  entityType: 'contact', purpose: 'tax-clearance', status: 'ready', contentType: 'application/pdf', storagePath: 'p/file.pdf',
};
const READ_FACTS = {
  kind: 'tax-clearance', issuedOn: '2026-07-22', printedValidUntil: null,
  source: { kind: 'document-text', reader: 'aade-tax-clearance-text' }, recordedBy: 'system:document-text', recordedAt: '2026-10-16T00:00:00Z',
};

/** Ένα `files` δύο σελίδων για το `processAdminBatch` (limit · startAfter · get). */
function dbOf(docs: Record<string, Record<string, unknown>>): Firestore {
  const all = Object.entries(docs).map(([id, data]) => ({ id, data: () => data }));
  const page = (from: number, size: number) => ({
    limit: (n: number) => page(from, n),
    startAfter: (last: { id: string }) => page(all.findIndex((d) => d.id === last.id) + 1, size),
    get: async () => {
      const slice = all.slice(from, from + size);
      return { empty: slice.length === 0, docs: slice, size: slice.length };
    },
  });
  return { collection: () => ({ orderBy: () => page(0, Infinity) }) } as unknown as Firestore;
}

describe('needsDocumentText (ADR-915 §20)', () => {
  it('παρακολουθείται χωρίς γεγονότα · με δήλωση ανθρώπου ⇒ ναι (η ανάγνωση ξεπερνά τη δήλωση)', () => {
    expect(needsDocumentText(TAX)).toBe(true);
    expect(needsDocumentText({ ...TAX, documentFacts: { ...READ_FACTS, source: { kind: 'attested', via: 'conveyance-review' } } })).toBe(true);
  });

  it('ήδη διαβασμένο από το έγγραφο · μη παρακολουθούμενο ⇒ όχι (κανένα κατέβασμα)', () => {
    expect(needsDocumentText({ ...TAX, documentFacts: READ_FACTS })).toBe(false);
    expect(needsDocumentText({ ...TAX, purpose: 'document' })).toBe(false);
  });
});

describe('runDocumentTextBackfill', () => {
  const docs = { a: TAX, b: { ...TAX, documentFacts: READ_FACTS }, c: { ...TAX, purpose: 'document' } };

  function deps(): { value: DocumentTextDeps; writes: string[] } {
    const writes: string[] = [];
    return {
      writes,
      value: {
        readBytes: async () => ({ size: 10, read: async () => Buffer.from('%PDF') }),
        readPdfText: async () => [TAX_PDFJS],
        recordFacts: async (_db, input) => { writes.push(input.fileId); return 'write'; },
      },
    };
  }

  it('🔴 dry-run ⇒ διαβάζει και αναφέρει «θα γραφόταν», ο γραφέας ΔΕΝ καλείται', async () => {
    const { value, writes } = deps();
    const tally = await runDocumentTextBackfill(dbOf(docs), true, value);
    expect(tally).toMatchObject({ scanned: 3, candidates: 1, outcomes: { 'recorded:write': 1 }, failed: 0 });
    expect(writes).toEqual([]);
  });

  it('εκτέλεση ⇒ γράφει μόνο το υποψήφιο · βλάβη ανά αρχείο μετριέται και η σάρωση συνεχίζει', async () => {
    const { value, writes } = deps();
    await expect(runDocumentTextBackfill(dbOf(docs), false, value)).resolves.toMatchObject({ candidates: 1, outcomes: { 'recorded:write': 1 } });
    expect(writes).toEqual(['a']);
    const broken = { ...value, readBytes: async () => { throw new Error('503'); } };
    await expect(runDocumentTextBackfill(dbOf(docs), false, broken)).resolves.toMatchObject({ failed: 1, errors: ['a: 503'] });
  });
});
