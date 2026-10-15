/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΑ ΙΣΟΤΙΜΙΑΣ «ερώτημα ⇄ δείκτης» — οι 4 λίστες οθόνης (ADR-ACC-010 §2.1.1 Φάση 3β).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: το `.get()` των λιστών ζει στο `lib/admin-keyset-page.ts`, άρα το CHECK 3.91 ΔΕΝ τις βλέπει.
 * Πριν από τη Φάση 3β, η οθόνη τιμολογίων με «έτος + τύπος» ή «έτος + κατάσταση πληρωμής» ΔΕΝ είχε δείκτη:
 * `FAILED_PRECONDITION` ⇒ fallback ⇒ «κανένα τιμολόγιο», χωρίς κανείς να το μάθει.
 * Η άγκυρα ΕΚΤΕΛΕΙ τον ΠΡΑΓΜΑΤΙΚΟ κατασκευαστή (`buildListQuery`) για ΚΑΘΕ δηλωμένο συνδυασμό του κλειστού
 * συνόλου (`accounting-list-specs.ts`) και απαιτεί δείκτη.
 */

import type { Query } from 'firebase-admin/firestore';

import {
  indexesForShape,
  readCompositeIndexes,
  recordQueryShape,
  type RecordedQueryShape,
} from '@/test-utils/firestore-indexes';

import {
  BANK_TRANSACTION_LIST,
  FIXED_ASSET_LIST,
  INVOICE_LIST,
  JOURNAL_LIST,
} from '../accounting-list-specs';
import {
  UnsupportedListFilterError,
  buildListQuery,
  type AccountingListSpec,
  type ListFilters,
} from '../accounting-repo-list';

jest.mock('@/lib/firebaseAdmin', () => ({ safeFirestoreOperation: jest.fn() }));

const INDEXES = readCompositeIndexes();

/** Οποιαδήποτε μη κενή τιμή — ο δείκτης εξαρτάται από τα ΠΕΔΙΑ, όχι από τις τιμές. */
const SAMPLE = 'x';

type Case = readonly [label: string, collection: string, shape: RecordedQueryShape];

/** Ο ΠΡΑΓΜΑΤΙΚΟΣ κατασκευαστής + η ταξινόμηση που βάζει ο αναγνώστης keyset (`orderBy(spec.order)`). */
function shapeOf<F extends ListFilters<F>>(spec: AccountingListSpec<F>, keys: readonly (keyof F & string)[]): RecordedQueryShape {
  const filters = Object.fromEntries(keys.map((key) => [key, SAMPLE])) as F;
  return recordQueryShape<Query>((recorder) =>
    buildListQuery(recorder, 'comp_a', spec, filters).orderBy(spec.order.field, spec.order.direction));
}

function casesOf<F extends ListFilters<F>>(label: string, spec: AccountingListSpec<F>): Case[] {
  return spec.shapes.map((keys): Case => [`${label} · [${keys.join(', ')}]`, spec.collection, shapeOf(spec, keys)]);
}

/** Φίλτρα δηλωμένα στο `fields` που κανένας συνδυασμός δεν χρησιμοποιεί. */
function deadFilters<F extends ListFilters<F>>(spec: AccountingListSpec<F>): string[] {
  const used = new Set<string>(spec.shapes.flat());
  return Object.keys(spec.fields).filter((key) => !used.has(key));
}

const CASES: readonly Case[] = [
  ...casesOf('ημερολόγιο', JOURNAL_LIST),
  ...casesOf('τιμολόγια', INVOICE_LIST),
  ...casesOf('τράπεζα', BANK_TRANSACTION_LIST),
  ...casesOf('πάγια', FIXED_ASSET_LIST),
];

describe('Λ — κάθε δηλωμένος συνδυασμός φίλτρων λίστας οθόνης έχει δείκτη', () => {
  it.each(CASES)('Λ-1 %s', (_label, collection, shape) => {
    expect(shape.equality).toContain('companyId');
    expect(shape.range.size).toBe(0);
    expect(indexesForShape(INDEXES, collection, shape).length).toBeGreaterThanOrEqual(1);
  });

  it('Λ-2 ο καταγραφέας ΟΝΤΩΣ βλέπει διαφορά ανάμεσα στους συνδυασμούς (αλλιώς το Λ-1 θα περνούσε κενό)', () => {
    const distinct = new Set(CASES.map(([, collection, s]) => `${collection}|${[...s.equality].sort().join(',')}`));
    expect(distinct.size).toBe(CASES.length);
  });

  it('Λ-3 συνδυασμός ΕΚΤΟΣ συνόλου ⇒ σφάλμα πριν από τη βάση, όχι `FAILED_PRECONDITION` που γίνεται «κενό»', () => {
    expect(() => shapeOf(INVOICE_LIST, ['type'])).toThrow(UnsupportedListFilterError);
    expect(() => shapeOf(JOURNAL_LIST, ['contactId', 'type'])).toThrow(UnsupportedListFilterError);
  });

  it('Λ-4 φίλτρο χωρίς δείκτη ⇒ καμία κάλυψη (ο φύλακας δεν είναι διακοσμητικός)', () => {
    const wrong = recordQueryShape<Query>((recorder) =>
      recorder.where('companyId', '==', 'c').where('mydataStatus', '==', 'x').orderBy('issueDate', 'desc'));
    expect(indexesForShape(INDEXES, INVOICE_LIST.collection, wrong)).toEqual([]);
  });

  it('Λ-5 κάθε πεδίο φίλτρου του `fields` εμφανίζεται σε τουλάχιστον έναν συνδυασμό (κανένα νεκρό φίλτρο)', () => {
    expect(deadFilters(JOURNAL_LIST)).toEqual([]);
    expect(deadFilters(INVOICE_LIST)).toEqual([]);
    expect(deadFilters(BANK_TRANSACTION_LIST)).toEqual([]);
    expect(deadFilters(FIXED_ASSET_LIST)).toEqual([]);
  });
});
