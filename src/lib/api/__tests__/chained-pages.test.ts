/**
 * @jest-environment node
 *
 * @fileoverview **ΣΕΛΙΔΟΠΟΙΗΣΗ ΣΕ ΑΛΥΣΙΔΑ ΠΗΓΩΝ** (ADR-904 Κ7 · Google AIP-158).
 *
 * - **Σ1** όλες οι σελίδες μαζί = όλα τα στοιχεία, **μία** φορά το καθένα, για κάθε μέγεθος σελίδας·
 * - **Σ2** το τέλος λέγεται **μόνο** με κενό token· μικρότερη σελίδα (πηγή που απέρριψε) **δεν** είναι τέλος·
 * - **Σ3** το πολύ **μία** ανάγνωση ανά πηγή ανά αίτημα (φραγμένη καθυστέρηση)·
 * - **Σ4** χαλασμένο token / άγνωστη πηγή ⇒ `null` (ο καλών απαντά 400, ποτέ «πρώτη σελίδα»).
 */

import {
  decodeChainPosition,
  encodeChainPosition,
  readChainedPage,
  type ChainPosition,
  type PageSource,
} from '../chained-pages';
import { decodePageToken, encodePageToken } from '../page-token';

/** Πηγή πάνω σε πίνακα — `rejects` = στοιχεία που η πηγή διαβάζει αλλά ο κριτής της αφήνει έξω. */
function arraySource(id: string, values: readonly string[], rejects: readonly string[] = [], reads: string[] = []): PageSource<string> {
  return {
    id,
    async read(after, limit) {
      reads.push(id);
      const start = after === null ? 0 : values.indexOf(after) + 1;
      const window = values.slice(start, start + limit);
      const last = window[window.length - 1];
      return {
        items: window.filter((value) => !rejects.includes(value)),
        after: start + limit < values.length && last !== undefined ? last : null,
      };
    },
  };
}

const SOURCES = (): PageSource<string>[] => [
  arraySource('g', ['g1', 'g2']),
  arraySource('e', []),
  arraySource('o', ['o1', 'o2', 'o3', 'o4', 'o5'], ['o3']),
  arraySource('c', ['c1']),
];
const IDS = ['g', 'e', 'o', 'c'];
const EXPECTED = ['g1', 'g2', 'o1', 'o2', 'o4', 'o5', 'c1'];

async function readAll(size: number): Promise<{ readonly items: string[]; readonly pages: number }> {
  const items: string[] = [];
  let from: ChainPosition | null = null;
  for (let pages = 1; pages < 50; pages += 1) {
    const page = await readChainedPage(SOURCES(), from, size);
    items.push(...page.items);
    if (page.nextPageToken === '') return { items, pages };
    from = decodeChainPosition(page.nextPageToken, IDS);
    if (from === null) throw new Error('undecodable token');
  }
  throw new Error('no end');
}

describe('Σ1 — πληρότητα χωρίς διπλά', () => {
  it.each([1, 2, 3, 4, 7, 50])('pageSize %i ⇒ όλα, μία φορά, με τη σειρά των πηγών', async (size) => {
    expect((await readAll(size)).items).toEqual(EXPECTED);
  });
});

describe('Σ2 — το τέλος', () => {
  it('μία σελίδα που χωρά τα πάντα ⇒ κενό token', async () => {
    const page = await readChainedPage(SOURCES(), null, 100);
    expect([page.items, page.nextPageToken]).toEqual([EXPECTED, '']);
  });

  it('πηγή που απέρριψε στοιχείο ⇒ ΜΙΚΡΟΤΕΡΗ σελίδα, ΟΧΙ τέλος', async () => {
    const page = await readChainedPage([arraySource('o', ['o1', 'o2', 'o3', 'o4'], ['o2'])], null, 2);
    expect(page.items).toEqual(['o1']);
    expect(page.nextPageToken).not.toBe('');
  });

  it('η πηγή εξαντλήθηκε ακριβώς στο όριο ⇒ το token δείχνει την ΑΡΧΗ της επόμενης', async () => {
    const page = await readChainedPage(SOURCES(), null, 2);
    expect(page.items).toEqual(['g1', 'g2']);
    expect(decodeChainPosition(page.nextPageToken, IDS)).toEqual({ source: 'e', after: null });
  });
});

describe('Σ3 — φραγμένο κόστος', () => {
  it('το πολύ μία ανάγνωση ανά πηγή — η μη εξαντλημένη πηγή κλείνει τη σελίδα', async () => {
    const reads: string[] = [];
    const sources = [arraySource('a', ['a1'], [], reads), arraySource('b', ['b1', 'b2', 'b3'], ['b1', 'b2'], reads), arraySource('z', ['z1'], [], reads)];
    const page = await readChainedPage(sources, null, 3);
    expect(reads).toEqual(['a', 'b']);
    expect(page.items).toEqual(['a1']);
  });
});

describe('Σ4 — το token', () => {
  it('στρογγυλή διαδρομή με και χωρίς δρομέα', () => {
    for (const position of [{ source: 'o', after: 'o2' }, { source: 'c', after: null }]) {
      expect(decodeChainPosition(encodeChainPosition(position), IDS)).toEqual(position);
    }
  });

  it.each([
    ['σκουπίδια', 'not-a-token!!'],
    ['άγνωστη πηγή', encodeChainPosition({ source: 'gone', after: null })],
    ['κενός δρομέας', encodePageToken({ s: 'o', a: '' })],
    ['πίνακας αντί για αντικείμενο', Buffer.from('["o"]').toString('base64url')],
  ])('%s ⇒ null', (_label, raw) => {
    expect(decodeChainPosition(raw, IDS)).toBeNull();
  });

  it('επιπλέον κλειδί από παλαιότερη έκδοση ⇒ αγνοείται', () => {
    expect(decodePageToken(encodePageToken({ s: 'o', x: 'old' }), ['s'])).toEqual({ s: 'o' });
  });

  it('άγνωστη πηγή μέσα στο readChainedPage ⇒ ΠΕΤΑ (ποτέ σιωπηλή πρώτη σελίδα)', async () => {
    await expect(readChainedPage(SOURCES(), { source: 'gone', after: null }, 2)).rejects.toThrow('unknown page source');
  });
});
