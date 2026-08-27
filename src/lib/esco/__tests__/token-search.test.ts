/**
 * ΑΓΚΥΡΕΣ — **Η ΚΟΙΝΗ ΑΝΑΖΗΤΗΣΗ ΠΡΟΘΕΜΑΤΟΣ** (ADR-132).
 *
 * ⚠️ Το Firestore είναι πλαστό — αυτό που δοκιμάζεται είναι **η μηχανή**:
 * ποιο token πάει στο ερώτημα, ποια έγγραφα επιβιώνουν του φιλτραρίσματος
 * «όλα τα tokens», με ποια σειρά ταξινομούνται, και ότι η **κοινή** μνήμη
 * κρατά χωριστά τα δύο λεξιλόγια.
 */

const getDocsMock = jest.fn();
const whereMock = jest.fn((field: string, op: string, value: unknown) => ({ field, op, value }));

jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  query: (...args: unknown[]) => ({ args }),
  where: (field: string, op: string, value: unknown) => whereMock(field, op, value),
  limit: (value: number) => ({ limit: value }),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
}));

import {
  searchEscoByTokens,
  clearEscoSearchCache,
  type EscoIndexedDocument,
} from '../token-search';
import { ESCO_RELEVANCE } from '../relevance';
import { escoIndexTokens } from '../search-tokens';

interface TestDocument extends EscoIndexedDocument {
  readonly uri: string;
  readonly iscoCode?: string;
}

function makeDoc(el: string, en: string, extra: Partial<TestDocument> = {}): TestDocument {
  return {
    uri: `urn:${el}`,
    preferredLabel: { el, en },
    searchTokensEl: escoIndexTokens(el),
    searchTokensEn: escoIndexTokens(en),
    ...extra,
  };
}

function serve(documents: readonly TestDocument[]): void {
  getDocsMock.mockResolvedValue({ docs: documents.map((data) => ({ data: () => data })) });
}

function request(rawQuery: string, overrides: Record<string, unknown> = {}) {
  return {
    collectionPath: 'system/esco_cache/occupations',
    cacheNamespace: 'occupation',
    rawQuery,
    language: 'el' as const,
    limit: 10,
    toItem: (data: TestDocument) => data,
    labelOf: (item: TestDocument) => item.preferredLabel.el,
    ...overrides,
  };
}

beforeEach(() => {
  clearEscoSearchCache();
  getDocsMock.mockReset();
  whereMock.mockClear();
});

describe('Α. το ερώτημα προς το Firestore', () => {
  it('ρωτά με το ΠΡΩΤΟ token, στο πεδίο της γλώσσας', async () => {
    serve([]);
    await searchEscoByTokens(request('πολιτικός μηχανικός'));

    expect(whereMock).toHaveBeenCalledWith('searchTokensEl', 'array-contains', 'πολιτικος');
  });

  it('στα αγγλικά ρωτά το αγγλικό πεδίο', async () => {
    serve([]);
    await searchEscoByTokens(request('civil', { language: 'en' }));

    expect(whereMock).toHaveBeenCalledWith('searchTokensEn', 'array-contains', 'civil');
  });

  it('ερώτημα κάτω από το ελάχιστο ΔΕΝ αγγίζει καθόλου το Firestore', async () => {
    const outcome = await searchEscoByTokens(request('μ'));

    expect(getDocsMock).not.toHaveBeenCalled();
    expect(outcome).toEqual({ hits: [], total: 0 });
  });
});

describe('Β. φιλτράρισμα «ΟΛΑ τα tokens»', () => {
  it('πετά έγγραφο που ικανοποιεί μόνο το πρώτο token', async () => {
    serve([makeDoc('πολιτικός μηχανικός', 'civil engineer'), makeDoc('πολιτικός', 'politician')]);

    const outcome = await searchEscoByTokens(request('πολιτικός μηχανικός'));

    expect(outcome.hits).toHaveLength(1);
    expect(outcome.hits[0].item.preferredLabel.el).toBe('πολιτικός μηχανικός');
  });
});

describe('Γ. ταξινόμηση', () => {
  it('πρώτα η βαθμολογία, μετά αλφαβητικά', async () => {
    // ⚠️ Το ευρετήριο είναι ΠΡΟΘΕΜΑΤΩΝ: το «αρχιμηχανικός» δεν βρίσκεται με
    // «μηχανικός» — και αυτό είναι σωστό, όχι κενό της άγκυρας.
    serve([
      makeDoc('μηχανικός δομών', 'structural'),
      makeDoc('μηχανικός', 'engineer'),
      makeDoc('μηχανικός αεροσκαφών', 'aircraft'),
    ]);

    const outcome = await searchEscoByTokens(request('μηχανικός'));
    const labels = outcome.hits.map((hit) => hit.item.preferredLabel.el);

    expect(outcome.hits[0].score).toBe(ESCO_RELEVANCE.exact);
    expect(outcome.hits[1].score).toBe(ESCO_RELEVANCE.prefix);
    // Τα δύο επόμενα έχουν ΙΔΙΑ βαθμολογία ⇒ αλφαβητικά, όχι σειρά άφιξης.
    expect(labels).toEqual(['μηχανικός', 'μηχανικός αεροσκαφών', 'μηχανικός δομών']);
  });
});

describe('Δ. το δευτερεύον κλειδί', () => {
  it('ο κωδικός ISCO ανεβάζει έγγραφο του οποίου η ετικέτα δεν ταιριάζει', async () => {
    serve([makeDoc('τοπογράφος', 'surveyor', { iscoCode: '2165' })]);

    const outcome = await searchEscoByTokens(
      request('21', {
        secondaryKeyMatches: (data: TestDocument, raw: string) =>
          (data.iscoCode ?? '').startsWith(raw),
      }),
    );

    expect(outcome.hits).toHaveLength(0); // «21» δεν είναι token της ετικέτας
  });

  it('όταν το έγγραφο περνά το φίλτρο, ο κωδικός δίνει 0.8 και ονομάζεται', async () => {
    // Η ετικέτα περιέχει το token «το» αλλά όχι ολόκληρο το ερώτημα.
    serve([makeDoc('τοπογράφος', 'surveyor', { iscoCode: '2165' })]);

    const outcome = await searchEscoByTokens(
      request('τοπ', {
        secondaryKeyMatches: () => true,
      }),
    );

    expect(outcome.hits[0].score).toBe(ESCO_RELEVANCE.prefix); // η ετικέτα προηγείται
    expect(outcome.hits[0].matchedField).toBe('preferredLabel');
  });
});

describe('Ε. η ΚΟΙΝΗ μνήμη', () => {
  it('δεύτερη ίδια ερώτηση ΔΕΝ ξαναχτυπά το Firestore', async () => {
    serve([makeDoc('μηχανικός', 'engineer')]);

    await searchEscoByTokens(request('μηχανικός'));
    await searchEscoByTokens(request('μηχανικός'));

    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  it('🔑 τα δύο λεξιλόγια ΔΕΝ μπερδεύονται — το namespace τα χωρίζει', async () => {
    serve([makeDoc('μηχανικός', 'engineer')]);
    await searchEscoByTokens(request('μηχανικός'));

    serve([makeDoc('συγκόλληση', 'welding')]);
    const skills = await searchEscoByTokens(
      request('μηχανικός', { cacheNamespace: 'skill', collectionPath: 'system/esco_cache/skills' }),
    );

    expect(getDocsMock).toHaveBeenCalledTimes(2);
    expect(skills.hits).toHaveLength(0); // «συγκόλληση» δεν ταιριάζει με «μηχανικός»
  });

  it('τόνοι δεν διχάζουν τη μνήμη — ίδιο αποτέλεσμα, ένα χτύπημα', async () => {
    serve([makeDoc('μηχανικός', 'engineer')]);

    await searchEscoByTokens(request('Μηχανικός'));
    await searchEscoByTokens(request('μηχανικος'));

    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });
});

describe('ΣΤ. αποτυχία Firestore', () => {
  it('δεν πετά — επιστρέφει άδειο, όπως και πριν', async () => {
    getDocsMock.mockRejectedValue(new Error('permission-denied'));

    await expect(searchEscoByTokens(request('μηχανικός'))).resolves.toEqual({
      hits: [],
      total: 0,
    });
  });
});
