import type { PriceLineBatch, PriceLineBatchResult, PriceLineInput } from '../../types/price-list-requests';
import type { PriceLineSubject } from '../../types/price-list';
import { chunkPriceLineChanges, sendPriceLineChunks } from '../price-line-batches';

const subject = (n: number): PriceLineSubject => ({ kind: 'variant', variantId: `prod_${n}` });
const line = (n: number): PriceLineInput => ({
  subject: subject(n),
  netPrice: 1000 + n,
  priceQuantity: 1,
  unitCode: 'pcs',
  discountGroupId: null,
  breakdown: null,
});
const lines = (count: number, from = 0) => Array.from({ length: count }, (_, i) => line(from + i));

/** Ένας «διακομιστής» που κάνει CAS όπως ο γραφέας: λάθος expected ⇒ άρνηση. */
function casServer(start: number, failAt: number | null = null) {
  let revision = start;
  const seen: number[] = [];
  const send = jest.fn(async (batch: PriceLineBatch): Promise<PriceLineBatchResult> => {
    seen.push(batch.expectedLinesRevision);
    if (batch.expectedLinesRevision !== revision || seen.length - 1 === failAt) throw new Error('409');
    revision += 1;
    return { versionId: 'v', linesRevision: revision, written: batch.upserts.length + batch.deletes.length };
  });
  return { send, seen };
}

describe('chunkPriceLineChanges — δέσμες ≤ όριο, εισαγωγές ΚΑΙ διαγραφές μαζί', () => {
  it('1.000 γραμμές σε δέσμες των 400 ⇒ 400 · 400 · 200', () => {
    expect(chunkPriceLineChanges(lines(1000), [], 400).map((c) => c.upserts.length)).toEqual([400, 400, 200]);
  });

  it('οι διαγραφές μετρούν στο ίδιο όριο και προηγούνται', () => {
    const chunks = chunkPriceLineChanges(lines(3), [subject(90), subject(91)], 4);
    expect(chunks).toEqual([
      { upserts: lines(2), deletes: [subject(90), subject(91)] },
      { upserts: [line(2)], deletes: [] },
    ]);
  });

  it('καμία αλλαγή ⇒ καμία δέσμη · άκυρο μέγεθος ⇒ σφάλμα, ποτέ ατέρμων βρόχος', () => {
    expect(chunkPriceLineChanges([], [])).toEqual([]);
    expect(() => chunkPriceLineChanges(lines(1), [], 0)).toThrow(RangeError);
  });
});

describe('sendPriceLineChunks — σειριακά, με αλυσίδα CAS, ειλικρινές μερικό', () => {
  it('κάθε δέσμη στέλνει το linesRevision που επέστρεψε η ΠΡΟΗΓΟΥΜΕΝΗ', async () => {
    const server = casServer(7);
    const outcome = await sendPriceLineChunks(server.send, 7, chunkPriceLineChanges(lines(900), [], 400));
    expect(server.seen).toEqual([7, 8, 9]);
    expect(outcome).toEqual({ kind: 'saved', linesRevision: 10, written: 900, total: 900 });
  });

  it('αποτυχία στη 2η δέσμη ⇒ «400 από 900», και η 3η ΔΕΝ στέλνεται', async () => {
    const server = casServer(0, 1);
    const outcome = await sendPriceLineChunks(server.send, 0, chunkPriceLineChanges(lines(900), [], 400));
    expect(server.send).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual(expect.objectContaining({ kind: 'partial', saved: 400, total: 900, failedChunk: 1, linesRevision: 1 }));
  });

  it('ξεκινά από ό,τι ΔΙΑΒΑΣΕ ο άνθρωπος: αλλαγή άλλου στο μεταξύ ⇒ 409 στην πρώτη, τίποτα δεν γράφεται', async () => {
    const server = casServer(5);
    const outcome = await sendPriceLineChunks(server.send, 4, chunkPriceLineChanges(lines(10), [], 400));
    expect(outcome).toEqual(expect.objectContaining({ kind: 'partial', saved: 0, total: 10, failedChunk: 0, linesRevision: 4 }));
  });
});
