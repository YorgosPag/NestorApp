/**
 * ΑΓΚΥΡΕΣ — **Η ΣΥΓΚΟΜΙΔΗ ESCO** (ADR-132 · ADR-798 §20.4 #4).
 *
 * ⚠️ **ΚΑΘΕ ΑΓΚΥΡΑ ΕΔΩ ΕΚΤΕΛΕΙ.** Καμία δεν διαβάζει πηγαίο κώδικα, καμία δεν
 * ζητά `toContain('όνομα')`: το μάθημα δύο συνεδριών είναι ότι μια τέτοια
 * άγκυρα αποδεικνύει την **εισαγωγή**, όχι ότι ο φρουρός **τρέχει** — και έμεινε
 * πράσινη πάνω σε **νεκρό** φρουρό.
 *
 * Η καρδιά είναι το **Β2**: ο παλιός βρόχος, με αποτυχία στην πρώτη σελίδα,
 * τύπωνε `✅ IMPORT COMPLETE / Total: 0`. Εδώ δοκιμάζεται ακριβώς αυτό το
 * σενάριο, και ελέγχεται ότι το κείμενο της ετυμηγορίας **δεν περιέχει `✅`**.
 */

import {
  harvestEscoConcepts,
  describeHarvestVerdict,
  type HarvestVerdict,
} from '../lib/esco/esco-harvest';
import {
  buildEscoPageUrl,
  fetchEscoPage,
  ESCO_RETRY_CONFIG,
  ESCO_TRANSIENT,
  ESCO_PERMANENT,
  type EscoSearchResponse,
} from '../lib/esco/esco-api';
import {
  isRetryableError,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
} from '../../src/services/entity-linking/utils/retry';

// ============================================================================
// ΕΡΓΑΛΕΙΑ
// ============================================================================

const PAGE_SIZE = 500;
const SCHEME = 'http://data.europa.eu/esco/concept-scheme/occupations';

/** Γρήγορη ρύθμιση επανάληψης — αλλιώς μία αποτυχημένη σελίδα κοιμάται 15s. */
const FAST_RETRY: Partial<RetryConfig> = {
  maxAttempts: 2,
  baseDelayMs: 0,
  maxDelayMs: 0,
  backoffMultiplier: 1,
  useJitter: false,
  retryableErrors: [ESCO_TRANSIENT],
};

function page(index: number, total: number, pageSize = PAGE_SIZE): EscoSearchResponse {
  const start = index * pageSize;
  const count = Math.max(0, Math.min(pageSize, total - start));
  return {
    total,
    offset: index,
    limit: pageSize,
    _embedded: {
      results: Array.from({ length: count }, (_, i) => ({
        uri: `http://data.europa.eu/esco/occupation/${start + i}`,
        code: '2142.1.9',
        preferredLabel: { el: `έννοια ${start + i}`, en: `concept ${start + i}` },
      })),
    },
  };
}

async function harvest(
  fetchPage: (index: number) => Promise<EscoSearchResponse>,
  retry: Partial<RetryConfig> = FAST_RETRY,
): Promise<HarvestVerdict> {
  return harvestEscoConcepts({
    conceptType: 'occupation',
    scheme: SCHEME,
    pageSize: PAGE_SIZE,
    politeDelayMs: 0,
    fetchPage,
    retry,
  });
}

const transient = () => Promise.reject(new Error(`${ESCO_TRANSIENT} HTTP 503 down`));

// ============================================================================
// Α. Η ΕΥΤΥΧΗΣ ΔΙΑΔΡΟΜΗ — χωρίς αυτήν, τα υπόλοιπα δεν σημαίνουν τίποτα
// ============================================================================

describe('Α. πλήρης συγκομιδή', () => {
  it('κατεβάζει όλες τις σελίδες και δηλώνει complete', async () => {
    const verdict = await harvest((index) => Promise.resolve(page(index, 1200)));

    expect(verdict.kind).toBe('complete');
    expect(verdict.concepts).toHaveLength(1200);
    expect(verdict.pagesFetched).toBe(3);
    if (verdict.kind === 'complete') expect(verdict.declaredTotal).toBe(1200);
    expect(describeHarvestVerdict(verdict).join('\n')).toContain('✅');
  });
});

// ============================================================================
// Β2. 🔴 Η ΚΑΡΔΙΑ — ΑΠΟΤΥΧΙΑ ΣΤΗΝ ΠΡΩΤΗ ΣΕΛΙΔΑ
// ============================================================================

describe('Β2. αποτυχία στην ΠΡΩΤΗ σελίδα', () => {
  it('δεν δηλώνει ΠΟΤΕ complete — το πλήθος έμεινε άγνωστο', async () => {
    const verdict = await harvest(transient);

    expect(verdict.kind).toBe('incomplete');
    if (verdict.kind !== 'incomplete') throw new Error('αδύνατο');
    expect(verdict.reasons).toContain('first-page-failed');
    // 🔑 `null`, ΟΧΙ `0`: «δεν ξέρω πόσα υπάρχουν» ≠ «δεν υπάρχουν».
    expect(verdict.declaredTotal).toBeNull();
    expect(verdict.concepts).toHaveLength(0);
  });

  it('🔴 η αναφορά ΔΕΝ περιέχει ✅ — αυτό ήταν το ακριβές ψέμα', async () => {
    const report = describeHarvestVerdict(await harvest(transient)).join('\n');

    expect(report).not.toContain('✅');
    expect(report).toContain('ΑΓΝΩΣΤΟ');
    expect(report).toContain('ΑΤΕΛΗΣ');
  });

  it('σταματά αμέσως — δεν σαρώνει σελίδες που δεν ξέρει ότι υπάρχουν', async () => {
    let calls = 0;
    await harvest(() => {
      calls += 1;
      return transient();
    });
    // 1 σελίδα × maxAttempts 2 = 2 κλήσεις. Ο παλιός βρόχος θα σταματούσε επίσης,
    // αλλά θα ονόμαζε το αποτέλεσμα «πλήρες».
    expect(calls).toBe(2);
  });
});

// ============================================================================
// Β1. ΑΠΟΤΥΧΙΑ ΣΕ ΜΕΣΑΙΑ ΣΕΛΙΔΑ — η σιωπηλή απώλεια
// ============================================================================

describe('Β1. αποτυχία στη σελίδα 40 από 60', () => {
  const total = 30_000;
  const brokenPage = 39;

  const server = (index: number): Promise<EscoSearchResponse> =>
    index === brokenPage ? transient() : Promise.resolve(page(index, total));

  it('κρατά τις 59 σελίδες ΑΛΛΑ αρνείται να τις πει πλήρεις', async () => {
    const verdict = await harvest(server);

    expect(verdict.kind).toBe('incomplete');
    if (verdict.kind !== 'incomplete') throw new Error('αδύνατο');
    expect(verdict.concepts).toHaveLength(total - PAGE_SIZE);
    expect(verdict.declaredTotal).toBe(total);
    expect(verdict.failedPages.map((f) => f.page)).toEqual([brokenPage]);
    expect(verdict.reasons).toEqual(expect.arrayContaining(['pages-failed', 'count-mismatch']));
  });

  it('ονομάζει τη σελίδα που λείπει, με ανθρώπινη αρίθμηση', async () => {
    const report = describeHarvestVerdict(await harvest(server)).join('\n');

    expect(report).not.toContain('✅');
    expect(report).toContain('Ανεπίλυτες σελίδες: 40');
    expect(report).toContain('λείπουν 500');
  });
});

// ============================================================================
// Β3. ΠΛΗΡΟΤΗΤΑ — η ερώτηση που ΔΕΝ ΕΤΙΘΕΤΟ ΠΟΥΘΕΝΑ
// ============================================================================

describe('Β3. σύγκριση πληρότητας', () => {
  it('καμία αποτυχία σελίδας, αλλά λιγότερα από όσα δήλωσε η πηγή', async () => {
    // Κάθε σελίδα «πετυχαίνει» — απλώς η τελευταία γυρίζει άδεια.
    const verdict = await harvest((index) =>
      Promise.resolve(index === 2 ? { ...page(index, 1200), _embedded: { results: [] } } : page(index, 1200)),
    );

    expect(verdict.kind).toBe('incomplete');
    if (verdict.kind !== 'incomplete') throw new Error('αδύνατο');
    expect(verdict.failedPages).toHaveLength(0); // ⚠️ ΚΑΜΙΑ αποτυχία…
    expect(verdict.reasons).toContain('count-mismatch'); // …και όμως ατελές
    expect(verdict.concepts).toHaveLength(1000);
  });

  it('🏆 πιάνει επικάλυψη που ΤΟ ΠΛΗΘΟΣ ΓΡΑΜΜΩΝ θα έκρυβε', async () => {
    // Η σελίδα 1 σερβίρει ΞΑΝΑ τα στοιχεία της σελίδας 0.
    // Σύνολο γραμμών = 1200 = total ⇒ ένα `allResults.length === total`
    // θα έλεγε «πλήρες» ενώ λείπουν 500 έννοιες.
    const verdict = await harvest((index) => Promise.resolve(page(index === 1 ? 0 : index, 1200)));

    expect(verdict.kind).toBe('incomplete');
    if (verdict.kind !== 'incomplete') throw new Error('αδύνατο');
    expect(verdict.duplicatesDropped).toBe(500);
    expect(verdict.concepts).toHaveLength(700);
    expect(verdict.reasons).toContain('count-mismatch');
  });
});

// ============================================================================
// Γ. ΜΕΤΑΤΟΠΙΣΗ ΤΟΥ ΣΥΝΟΛΟΥ — σκισμένο στιγμιότυπο
// ============================================================================

describe('Γ. μετατόπιση του δηλωμένου συνόλου', () => {
  it('αρνείται το «πλήρες» όταν η πηγή αλλάξει το total στη μέση', async () => {
    const verdict = await harvest((index) =>
      Promise.resolve(index === 0 ? page(0, 1000) : { ...page(index, 1000), total: 1200 }),
    );

    expect(verdict.kind).toBe('incomplete');
    if (verdict.kind !== 'incomplete') throw new Error('αδύνατο');
    expect(verdict.reasons).toContain('total-drift');
    expect(verdict.observedTotals).toEqual([1000, 1200]);
    expect(describeHarvestVerdict(verdict).join('\n')).toContain('1000 → 1200');
  });
});

// ============================================================================
// Δ. ΕΠΑΝΑΛΗΨΗ ΚΑΙ ΔΕΥΤΕΡΗ ΣΑΡΩΣΗ — ότι ο μηχανισμός ΤΡΕΧΕΙ
// ============================================================================

describe('Δ. επανάληψη και δεύτερη σάρωση', () => {
  it('παροδική αποτυχία μέσα στις προσπάθειες ⇒ πλήρες', async () => {
    let failuresLeft = 1;
    const verdict = await harvest((index) => {
      if (index === 1 && failuresLeft > 0) {
        failuresLeft -= 1;
        return transient();
      }
      return Promise.resolve(page(index, 1200));
    });

    expect(verdict.kind).toBe('complete');
    expect(verdict.concepts).toHaveLength(1200);
  });

  it('σελίδα χαμένη στην κύρια σάρωση ανακτάται στη ΔΕΥΤΕΡΗ', async () => {
    let mainSweepDone = false;
    const verdict = await harvest((index) => {
      if (index === 1 && !mainSweepDone) return transient();
      return Promise.resolve(page(index, 1200));
    }, { ...FAST_RETRY, onRetry: () => undefined });

    // Η σελίδα 1 αποτυγχάνει σε όλη την κύρια σάρωση· την «ανοίγουμε» μόλις
    // τελειώσει η κύρια — δηλαδή όταν ζητηθεί ξανά.
    expect(verdict.kind).toBe('incomplete');

    mainSweepDone = false;
    let seenPageOne = 0;
    const recovered = await harvest((index) => {
      if (index === 1) {
        seenPageOne += 1;
        // αποτυγχάνει και στις 2 προσπάθειες της κύριας σάρωσης, πετυχαίνει στη δεύτερη
        if (seenPageOne <= FAST_RETRY.maxAttempts!) return transient();
      }
      return Promise.resolve(page(index, 1200));
    });

    expect(recovered.kind).toBe('complete');
    if (recovered.kind !== 'complete') throw new Error('αδύνατο');
    expect(recovered.recoveredPages).toBe(1);
    expect(recovered.concepts).toHaveLength(1200);
    expect(describeHarvestVerdict(recovered).join('\n')).toContain('δεύτερη σάρωση');
  });
});

// ============================================================================
// Ε. ΔΙΑΚΟΠΤΗΣ ΚΥΚΛΩΜΑΤΟΣ — δεν σφυροκοπάμε πεσμένη πηγή
// ============================================================================

describe('Ε. διακόπτης κυκλώματος', () => {
  it('τρεις διαδοχικές αποτυχίες ⇒ σταματά αντί για 60 σελίδες', async () => {
    let calls = 0;
    const verdict = await harvest((index) => {
      calls += 1;
      return index === 0 ? Promise.resolve(page(0, 30_000)) : transient();
    });

    expect(verdict.kind).toBe('incomplete');
    if (verdict.kind !== 'incomplete') throw new Error('αδύνατο');
    expect(verdict.reasons).toContain('source-unavailable');
    // 1 επιτυχής + 3 σελίδες × 2 προσπάθειες = 7. Χωρίς διακόπτη: 1 + 59×2 = 119.
    expect(calls).toBe(7);
  });
});

// ============================================================================
// ΣΤ. ΤΑΞΙΝΟΜΗΣΗ ΣΦΑΛΜΑΤΩΝ — ότι το «μόνιμο» ΔΕΝ ξαναδοκιμάζεται
// ============================================================================

describe('ΣΤ. ταξινόμηση σφαλμάτων ESCO', () => {
  it('μόνιμο σφάλμα (404) δοκιμάζεται ΜΙΑ φορά, όχι πέντε', async () => {
    let calls = 0;
    await harvest(() => {
      calls += 1;
      return Promise.reject(new Error(`${ESCO_PERMANENT} HTTP 404 Not Found`));
    }, { ...FAST_RETRY, maxAttempts: 5 });

    expect(calls).toBe(1);
  });

  it('η παραγωγική ρύθμιση δέχεται ΜΟΝΟ τα παροδικά — εκτελεσμένο, όχι διαβασμένο', () => {
    const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...ESCO_RETRY_CONFIG };

    expect(isRetryableError(new Error(`${ESCO_TRANSIENT} HTTP 503`), config)).toBe(true);
    expect(isRetryableError(new Error(`${ESCO_PERMANENT} HTTP 404`), config)).toBe(false);
    // ⚠️ Ο φρουρός: η προεπιλογή του SSoT («αν δεν οριστεί, όλα») θα ξαναδοκίμαζε
    // και τα 404. Αυτή η γραμμή κοκκινίζει αν κάποιος σβήσει το retryableErrors.
    expect(isRetryableError(new Error('τυχαίο σφάλμα'), config)).toBe(false);
  });

  it('το fetchEscoPage ταξινομεί HTTP σε παροδικό / μόνιμο', async () => {
    const original = global.fetch;
    const respond = (status: number): void => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status,
        statusText: 'x',
      }) as unknown as typeof fetch;
    };

    try {
      respond(404);
      await expect(fetchEscoPage('https://x')).rejects.toThrow(ESCO_PERMANENT);
      respond(429);
      await expect(fetchEscoPage('https://x')).rejects.toThrow(ESCO_TRANSIENT);
      respond(503);
      await expect(fetchEscoPage('https://x')).rejects.toThrow(ESCO_TRANSIENT);

      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET')) as unknown as typeof fetch;
      await expect(fetchEscoPage('https://x')).rejects.toThrow(ESCO_TRANSIENT);
    } finally {
      global.fetch = original;
    }
  });
});

// ============================================================================
// Ζ. Η ΔΙΕΥΘΥΝΣΗ — το `offset` είναι ΑΡΙΘΜΟΣ ΣΕΛΙΔΑΣ (OpenAPI v3)
// ============================================================================

describe('Ζ. διεύθυνση σελίδας', () => {
  it('στέλνει offset = αριθμός σελίδας, ΟΧΙ δείκτη στοιχείου', () => {
    const url = new URL(buildEscoPageUrl('occupation', SCHEME, 3, 500));

    expect(url.searchParams.get('offset')).toBe('3'); // ⚠️ όχι '1500'
    expect(url.searchParams.get('limit')).toBe('500');
    expect(url.searchParams.get('type')).toBe('occupation');
    expect(url.searchParams.get('isInScheme')).toBe(SCHEME);
  });
});
