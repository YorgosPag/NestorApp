/**
 * @jest-environment node
 *
 * `readKeysetPage` — η σελίδα με δρομέα (ADR-ACC-010 §2.1.1 Φάση 3β · Google AIP-158).
 *
 * Ο ψεύτικος Firestore εδώ ΕΚΤΕΛΕΙ τη σημασιολογία `orderBy(πεδίο, __name__) → startAfter(τιμή, id) → limit`, ώστε
 * το «διάβασε όλες τις σελίδες» να αποδεικνύει ότι καμία εγγραφή δεν χάνεται ή διπλασιάζεται — ΚΑΙ σε ισοπαλία
 * ημερομηνίας στο όριο σελίδας (το σύνηθες σε ημερολόγιο).
 */

import type { DocumentData, Query } from 'firebase-admin/firestore';

import {
  InvalidPageTokenError,
  decodeKeysetCursor,
  encodeKeysetCursor,
  readKeysetPage,
  type KeysetOrder,
  type KeysetPosition,
  type KeysetScope,
} from '../admin-keyset-page';

jest.mock('firebase-admin/firestore', () => ({
  FieldPath: { documentId: () => '__name__' },
  Timestamp: class {
    seconds: number;
    nanoseconds: number;
    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
  },
}));

/** Ψεύτικο `Timestamp` όπως το επιστρέφει ο Firestore σε `data()`. */
const ts = (seconds: number, nanoseconds = 0) => ({ seconds, nanoseconds });

interface Row {
  readonly id: string;
  readonly data: DocumentData;
}

interface Recorded {
  orderBy: [string, string][];
  startAfter: unknown[] | null;
  limit: number | null;
}

/** Ψεύτικο ερώτημα: ταξινόμηση (πεδίο, id) στη δηλωμένη φορά, `startAfter` αυστηρά μετά, `limit`. */
function fakeQuery(rows: readonly Row[], recorded: Recorded): Query {
  const query = {
    orderBy(field: string, direction: string) { recorded.orderBy.push([String(field), direction]); return query; },
    startAfter(...values: unknown[]) { recorded.startAfter = values; return query; },
    limit(n: number) { recorded.limit = n; return query; },
    async get() {
      const [[field, direction]] = recorded.orderBy;
      const sign = direction === 'desc' ? -1 : 1;
      // Timestamp ⇒ συγκρίσιμο κείμενο (μη αρνητικά δευτερόλεπτα στα δεδομένα της άγκυρας).
      const sortable = (value: unknown): string =>
        typeof value === 'object' && value !== null && 'seconds' in value
          ? `${String((value as { seconds: number }).seconds).padStart(12, '0')}.${String((value as { nanoseconds: number }).nanoseconds).padStart(9, '0')}`
          : String(value);
      const key = (row: Row): [string, string] => [sortable(row.data[field]), row.id];
      const cmp = (a: [string, string], b: [string, string]) =>
        sign * (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
      let sorted = [...rows].sort((a, b) => cmp(key(a), key(b)));
      if (recorded.startAfter !== null) {
        const [value, id] = recorded.startAfter as [unknown, string];
        sorted = sorted.filter((row) => cmp(key(row), [sortable(value), id]) > 0);
      }
      const docs = sorted.slice(0, recorded.limit ?? sorted.length).map((row) => ({ id: row.id, data: () => row.data }));
      return { docs };
    },
  };
  return query as unknown as Query;
}

const ORDER: KeysetOrder = { field: 'date', direction: 'desc' };
const SCOPE: KeysetScope = { fiscalYear: 2026 };

/** 7 εγγραφές, οι 3 με την ΙΔΙΑ ημερομηνία — ώστε το όριο σελίδας να πέσει μέσα στην ισοπαλία. */
const row = (id: string, date: unknown): Row => ({ id, data: { id, date } });
const ROWS: readonly Row[] = [
  row('e1', '2026-03-01'),
  row('e2', '2026-02-15'),
  row('e3', '2026-02-15'),
  row('e4', '2026-02-15'),
  row('e5', '2026-01-10'),
  row('e6', '2026-01-09'),
  row('e7', '2026-01-01'),
];

async function readPage(cursor: string | null, pageSize: number, rows: readonly Row[] = ROWS, order: KeysetOrder = ORDER) {
  const recorded: Recorded = { orderBy: [], startAfter: null, limit: null };
  const after: KeysetPosition | null = decodeKeysetCursor(cursor, order, SCOPE);
  const page = await readKeysetPage({
    base: fakeQuery(rows, recorded), order, scope: SCOPE, pageSize, after, map: (data) => String(data.id),
  });
  return { page, recorded };
}

describe('readKeysetPage', () => {
  it('Κ-1 ταξινόμηση (πεδίο, __name__) στην ίδια φορά + limit = pageSize + 1', async () => {
    const { recorded } = await readPage(null, 2);
    expect(recorded.orderBy).toEqual([['date', 'desc'], ['__name__', 'desc']]);
    expect(recorded.limit).toBe(3);
    expect(recorded.startAfter).toBeNull();
  });

  it.each([1, 2, 3, 4, 7, 10])('Κ-2 όλες οι σελίδες μεγέθους %i = όλες οι εγγραφές, μία φορά η καθεμία', async (size) => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const { page } = await readPage(cursor, size);
      seen.push(...page.items);
      expect(page.nextCursor === null).toBe(!page.hasNext);
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor !== null && pages < 20);
    expect(seen).toEqual(['e1', 'e4', 'e3', 'e2', 'e5', 'e6', 'e7']);
  });

  it('Κ-3 `hasNext` μετριέται: σύνολο ακριβώς πολλαπλάσιο του μεγέθους ⇒ ΟΧΙ ψεύτικη επόμενη σελίδα', async () => {
    const { page } = await readPage(null, 7);
    expect(page.items).toHaveLength(7);
    expect(page.hasNext).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('Κ-4 ο δρομέας άλλων φίλτρων ⇒ InvalidPageTokenError (ποτέ σελίδα του λάθος συνόλου)', () => {
    const cursor = encodeKeysetCursor({ value: '2026-02-15', id: 'e3' }, ORDER, SCOPE);
    expect(decodeKeysetCursor(cursor, ORDER, SCOPE)).toEqual({ value: '2026-02-15', id: 'e3' });
    expect(() => decodeKeysetCursor(cursor, ORDER, { fiscalYear: 2025 })).toThrow(InvalidPageTokenError);
    expect(() => decodeKeysetCursor(cursor, { field: 'date', direction: 'asc' }, SCOPE)).toThrow(InvalidPageTokenError);
  });

  it('Κ-5 χαλασμένος δρομέας ⇒ InvalidPageTokenError, όχι «πρώτη σελίδα» σιωπηλά', () => {
    expect(() => decodeKeysetCursor('not-a-token', ORDER, SCOPE)).toThrow(InvalidPageTokenError);
    expect(() => decodeKeysetCursor('', ORDER, SCOPE)).toThrow(InvalidPageTokenError);
  });

  it('Κ-6 το αποτύπωμα δεν εξαρτάται από τη σειρά των κλειδιών των φίλτρων', () => {
    const a = encodeKeysetCursor({ value: 'v', id: 'i' }, ORDER, { type: 'income', fiscalYear: 2026 });
    expect(decodeKeysetCursor(a, ORDER, { fiscalYear: 2026, type: 'income' })).toEqual({ value: 'v', id: 'i' });
  });

  it('Κ-7 γραμμή χωρίς κειμενική τιμή ταξινόμησης ⇒ ονομασμένο σφάλμα, όχι δρομέας σε λάθος θέση', async () => {
    // Ο ψεύτικος ταξινομεί με String(): το 20260101 έρχεται ΠΡΩΤΟ στη φθίνουσα σειρά ⇒ τελευταίο της σελίδας 1.
    const broken: Row[] = [row('a', '2026-01-02'), row('b', 20260101), row('c', '2025')];
    await expect(readPage(null, 1, broken)).rejects.toThrow(/order field "date".*document b/);
  });
});

/**
 * Ταξινόμηση πάνω σε Firestore `Timestamp` (τα ιστορικά: `serverTimestamp()`). Ως 2026-10-30 τα ιστορικά σελιδοποιούσαν
 * με `doc(cursor).get()` — σβησμένη γραμμή-δρομέας (TTL του ιστορικού!) ⇒ πρώτη σελίδα σιωπηλά.
 */
describe('readKeysetPage — kind: timestamp', () => {
  const TS_ORDER: KeysetOrder = { field: 'date', direction: 'desc', kind: 'timestamp' };
  /** Ίδια νανοδευτερόλεπτα σε τρεις γραμμές + διαφορά ΜΟΝΟ στα νανοδευτερόλεπτα σε δύο — ισοπαλίες στο όριο σελίδας. */
  const TS_ROWS: readonly Row[] = [
    row('t1', ts(1_800_000_300)),
    row('t2', ts(1_800_000_200, 5)),
    row('t3', ts(1_800_000_200, 5)),
    row('t4', ts(1_800_000_200, 5)),
    row('t5', ts(1_800_000_200, 4)),
    row('t6', ts(1_800_000_100)),
  ];

  it.each([1, 2, 3, 6])('Κ-T1 όλες οι σελίδες μεγέθους %i = όλες οι εγγραφές, μία φορά η καθεμία', async (size) => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const { page } = await readPage(cursor, size, TS_ROWS, TS_ORDER);
      seen.push(...page.items);
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor !== null && pages < 20);
    expect(seen).toEqual(['t1', 't4', 't3', 't2', 't5', 't6']);
  });

  it('Κ-T2 το `startAfter` παίρνει Timestamp (ίδιο είδος με το πεδίο), όχι κείμενο — χωρίς απώλεια νανοδευτερολέπτων', async () => {
    const first = await readPage(null, 2, TS_ROWS, TS_ORDER);
    const second = await readPage(first.page.nextCursor, 2, TS_ROWS, TS_ORDER);
    const [value, id] = second.recorded.startAfter as [{ seconds: number; nanoseconds: number }, string];
    expect(typeof value).toBe('object');
    expect({ seconds: value.seconds, nanoseconds: value.nanoseconds }).toEqual({ seconds: 1_800_000_200, nanoseconds: 5 });
    expect(id).toBe('t4');
  });

  it('Κ-T3 δρομέας κειμενικής ταξινόμησης ⇒ άκυρος για Timestamp και αντίστροφα (το είδος είναι στο αποτύπωμα)', async () => {
    const { page } = await readPage(null, 2, TS_ROWS, TS_ORDER);
    expect(() => decodeKeysetCursor(page.nextCursor, ORDER, SCOPE)).toThrow(InvalidPageTokenError);
    const stringCursor = encodeKeysetCursor({ value: '2026-02-15', id: 'e3' }, ORDER, SCOPE);
    expect(() => decodeKeysetCursor(stringCursor, TS_ORDER, SCOPE)).toThrow(InvalidPageTokenError);
  });

  it('Κ-T4 πλαστογραφημένη τιμή με σωστό αποτύπωμα ⇒ InvalidPageTokenError (400), όχι Timestamp(NaN) (500)', () => {
    const forged = encodeKeysetCursor({ value: 'yesterday', id: 't1' }, TS_ORDER, SCOPE);
    expect(() => decodeKeysetCursor(forged, TS_ORDER, SCOPE)).toThrow(InvalidPageTokenError);
  });

  it('Κ-T5 γραμμή με κείμενο αντί για Timestamp ⇒ ονομασμένο σφάλμα', async () => {
    const broken: Row[] = [row('a', ts(1_800_000_300)), row('b', '2026-10-30T10:00:00Z')];
    // Ο ψεύτικος ταξινομεί κείμενο: το '2026-…' > '0018000…' ⇒ το b έρχεται πρώτο στη φθίνουσα σειρά.
    await expect(readPage(null, 1, broken, TS_ORDER)).rejects.toThrow(/order field "date" is not a Timestamp.*document b/);
  });

  it('Κ-T6 `kind: \'string\'` ρητό ≡ απόν (ίδιο αποτύπωμα — οι δρομείς της λογιστικής δεν ακυρώνονται)', () => {
    const implicit = encodeKeysetCursor({ value: 'v', id: 'i' }, ORDER, SCOPE);
    expect(decodeKeysetCursor(implicit, { ...ORDER, kind: 'string' }, SCOPE)).toEqual({ value: 'v', id: 'i' });
    const explicit = encodeKeysetCursor({ value: 'v', id: 'i' }, { ...ORDER, kind: 'string' }, SCOPE);
    expect(explicit).toBe(implicit);
  });
});
