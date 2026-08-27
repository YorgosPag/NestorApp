/**
 * ADR-132 / ADR-798 §20.4 #4 — **Η ΣΥΓΚΟΜΙΔΗ ΜΕ ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ**.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΤΙ ΑΝΤΙΚΑΘΙΣΤΑ — Η ΣΙΩΠΗ ΠΟΥ ΑΝΕΦΕΡΕ ΕΠΙΤΥΧΙΑ
 *
 * Ο προηγούμενος βρόχος *(γραμμένος **δύο** φορές: occupations **και** skills)*
 * ήταν, κατά λέξη:
 *
 *     let totalItems = 1;                        // ← ΑΡΧΙΚΗ ΤΙΜΗ
 *     while (page < Math.ceil(totalItems / PAGE)) {
 *       try { …; totalItems = data.total; … }
 *       catch { console.error(…); page++; }      // ← ΠΡΟΣΠΕΡΝΑ ΤΗ ΣΕΛΙΔΑ
 *     }
 *     console.log(`✅ Fetched ${allResults.length}`);   // ← ✅ ΠΑΝΩ ΣΕ ΑΠΩΛΕΙΑ
 *
 * **Τρία ανεξάρτητα ελαττώματα**, όχι ένα:
 *
 * | # | Βλάβη | Πώς πεθαίνει **δομικά** εδώ |
 * |---|---|---|
 * | Β1 | Αποτυχία σελίδας ⇒ `page++` ⇒ εκατοντάδες έννοιες χάνονται **σιωπηλά**, και η επόμενη γραμμή τυπώνει `✅` | κάθε αποτυχία μπαίνει στο `failedPages`· η ετυμηγορία **δεν μπορεί** να γίνει `complete` όσο ο πίνακας δεν είναι άδειος |
 * | Β2 | 🔴 Αποτυχία στην **πρώτη** σελίδα ⇒ το `totalItems` μένει `1` ⇒ ο βρόχος τελειώνει **αμέσως** ⇒ `✅ IMPORT COMPLETE / Total: 0`. **Ολική αποτυχία ως πλήρης επιτυχία** | το `declaredTotal` ξεκινά **`null`**, όχι `1`. Χωρίς απάντηση από την πηγή **δεν υπάρχει** πλήθος σελίδων, άρα ούτε «τελείωσε»: η ετυμηγορία είναι `first-page-failed` και **δεν υπάρχει τιμή** που να την κάνει `complete` |
 * | Β3 | Καμία σύγκριση πληρότητας — το *«πήρα όσα υπάρχουν;»* δεν τίθεται **πουθενά** | η ερώτηση **ΕΙΝΑΙ** η ετυμηγορία: `uniqueCount === declaredTotal` |
 * ═════════════════════════════════════════════════════════════════════════════
 * 🏆 ΠΟΥ ΠΑΜΕ ΠΙΟ ΠΕΡΑ ΑΠΟ ΤΟ ΠΡΟΦΑΝΕΣ
 *
 * **1. Μετράμε ΜΟΝΑΔΙΚΑ URI, όχι πλήθος γραμμών.** Η προφανής θεραπεία
 * *(«σύγκρινε `allResults.length` με το `total`»)* είναι **ανεπαρκής**: αν η
 * σελίδα 3 σερβιριστεί δύο φορές και η 4 παραλειφθεί, τα **πλήθη ταιριάζουν**
 * ενώ λείπουν 500 έννοιες. Η σύγκριση γίνεται σε **σύνολο URI**, οπότε η
 * επικάλυψη εμφανίζεται ως **έλλειμμα** — και μαζί της κάθε λανθασμένη
 * σημασιολογία `offset` *(δείκτης στοιχείου αντί για αριθμό σελίδας)*.
 *
 * **2. Ανιχνεύουμε ΜΕΤΑΤΟΠΙΣΗ ΤΟΥ ΣΥΝΟΛΟΥ.** Το ESCO **δεν** προσφέρει
 * στιγμιότυπο *(ούτε `search_after`, ούτε point-in-time token όπως το
 * Elasticsearch)*. Αν το `total` αλλάξει ανάμεσα σε δύο σελίδες, η σελιδοποίηση
 * είναι **σκισμένη**: έννοιες μπορεί να μετακινήθηκαν από σελίδα σε σελίδα και
 * να χάθηκαν χωρίς κανένα σφάλμα. Δεν μπορούμε να το **αποτρέψουμε** — μπορούμε
 * όμως να αρνηθούμε να το ονομάσουμε «πλήρες».
 *
 * **3. Διακόπτης κυκλώματος.** Τρεις **διαδοχικές** αποτυχίες σελίδας δεν είναι
 * τρεμοπαίξιμο, είναι **πηγή εκτός λειτουργίας**. Το να συνεχίσεις σημαίνει 60
 * σελίδες × 5 προσπάθειες × εκθετική υποχώρηση — μισή ώρα για να καταλήξεις στο
 * ίδιο συμπέρασμα.
 *
 * **4. Δεύτερη σάρωση.** Οι σελίδες που απέτυχαν ξαναζητούνται **μετά** το τέλος
 * της κύριας σάρωσης — δηλαδή μετά από πολύ μεγαλύτερο κενό χρόνου από όσο δίνει
 * η υποχώρηση. Μια στιγμιαία διακοπή δεν πετάει 39 σελίδες δουλειάς.
 *
 * ⛔ **ΜΗΝ** προσθέσεις εδώ γραφή σε Firestore. Η συγκομιδή **δεν ξέρει** πού
 * πάνε τα δεδομένα· ο `esco-import-runner` αποφασίζει αν επιτρέπεται να γραφτούν.
 * ⛔ **ΜΗΝ** γράψεις εδώ backoff — ο μηχανισμός είναι το κοινό `withRetry`.
 *
 * @module scripts/lib/esco/esco-harvest
 */

import { sleep } from '../../../src/lib/async-utils';
import {
  withRetry,
  type RetryConfig,
} from '../../../src/services/entity-linking/utils/retry';
import {
  buildEscoPageUrl,
  fetchEscoPage,
  ESCO_RETRY_CONFIG,
  type EscoConceptType,
  type EscoSearchResponse,
  type EscoSearchResult,
} from './esco-api';

/** Πόσες **διαδοχικές** αποτυχίες σημαίνουν «η πηγή έπεσε», όχι «τρεμόπαιξε». */
const CONSECUTIVE_FAILURE_LIMIT = 3;

/** Μία σελίδα που δεν λύθηκε ούτε μετά από όλες τις προσπάθειες. */
export interface FailedEscoPage {
  readonly page: number;
  readonly attempts: number;
  readonly error: string;
}

/** Γιατί η συγκομιδή **δεν** μπορεί να δηλωθεί πλήρης. Ποτέ ένα σκέτο `false`. */
export type HarvestFailureReason =
  /** Η **πρώτη** σελίδα δεν απάντησε ⇒ **δεν μάθαμε ποτέ** πόσα υπάρχουν (Β2). */
  | 'first-page-failed'
  /** Τρεις διαδοχικές αποτυχίες ⇒ η πηγή είναι εκτός, όχι ασταθής. */
  | 'source-unavailable'
  /** Σελίδες έμειναν ανεπίλυτες μετά και τη δεύτερη σάρωση (Β1). */
  | 'pages-failed'
  /** Τα μοναδικά URI **δεν** ισούνται με το δηλωμένο σύνολο (Β3). */
  | 'count-mismatch'
  /** Η πηγή άλλαξε το `total` στη μέση ⇒ σκισμένο στιγμιότυπο. */
  | 'total-drift';

/** Τι κατέβηκε, και **αν επιτρέπεται** να θεωρηθεί πλήρες. */
export type HarvestVerdict =
  | {
      readonly kind: 'complete';
      readonly concepts: readonly EscoSearchResult[];
      readonly declaredTotal: number;
      readonly pagesFetched: number;
      readonly duplicatesDropped: number;
      readonly recoveredPages: number;
    }
  | {
      readonly kind: 'incomplete';
      readonly concepts: readonly EscoSearchResult[];
      /** `null` όταν η πηγή **δεν απάντησε ποτέ** — άγνωστο, όχι μηδέν. */
      readonly declaredTotal: number | null;
      readonly pagesFetched: number;
      readonly duplicatesDropped: number;
      readonly recoveredPages: number;
      readonly failedPages: readonly FailedEscoPage[];
      readonly observedTotals: readonly number[];
      readonly reasons: readonly HarvestFailureReason[];
    };

/** Τι ζητάμε από τη συγκομιδή. Το `fetchPage` είναι **ενέσιμο** για τις άγκυρες. */
export interface HarvestRequest {
  readonly conceptType: EscoConceptType;
  readonly scheme: string;
  readonly pageSize: number;
  readonly politeDelayMs: number;
  /** Προεπιλογή: πραγματικό HTTP. Οι άγκυρες περνούν πλαστό. */
  readonly fetchPage?: (page: number) => Promise<EscoSearchResponse>;
  /**
   * Παράκαμψη της ρύθμισης επανάληψης. Προεπιλογή: `ESCO_RETRY_CONFIG`.
   *
   * ⚠️ Υπάρχει **για τις άγκυρες**: η παραγωγική ρύθμιση κοιμάται έως 15
   * δευτερόλεπτα ανά αποτυχημένη σελίδα, που θα έκανε τη σουίτα ανεκτέλεστη —
   * και μια σουίτα που δεν τρέχει είναι σχόλιο, όχι φρουρός (CHECK 3.54).
   */
  readonly retry?: Partial<RetryConfig>;
  readonly onProgress?: (line: string) => void;
}

interface HarvestState {
  readonly unique: Map<string, EscoSearchResult>;
  readonly failedPages: FailedEscoPage[];
  readonly observedTotals: number[];
  rawCount: number;
  declaredTotal: number | null;
  plannedPages: number | null;
  pagesFetched: number;
  recoveredPages: number;
  consecutiveFailures: number;
}

function createState(): HarvestState {
  return {
    unique: new Map(),
    failedPages: [],
    observedTotals: [],
    rawCount: 0,
    declaredTotal: null,
    plannedPages: null,
    pagesFetched: 0,
    recoveredPages: 0,
    consecutiveFailures: 0,
  };
}

/**
 * Ενσωματώνει μία επιτυχημένη σελίδα: **μοναδικοποίηση** + καταγραφή του `total`.
 *
 * Το πρώτο `total` που ακούγεται είναι το **δηλωμένο σύνολο**· κάθε **άλλο**
 * μπαίνει στο `observedTotals` και κάνει την ετυμηγορία `total-drift`.
 */
function absorbPage(state: HarvestState, body: EscoSearchResponse): void {
  if (!state.observedTotals.includes(body.total)) {
    state.observedTotals.push(body.total);
  }
  if (state.declaredTotal === null) {
    state.declaredTotal = body.total;
    state.plannedPages = Math.ceil(body.total / Math.max(1, body.limit || 1));
  }

  for (const result of body._embedded?.results ?? []) {
    state.rawCount += 1;
    if (result.uri) state.unique.set(result.uri, result);
  }
  state.pagesFetched += 1;
}

/** Μία σελίδα, με τον **κοινό** μηχανισμό επανάληψης. Ποτέ δικό μας backoff. */
async function attemptPage(
  request: HarvestRequest,
  page: number,
): Promise<{ ok: true; body: EscoSearchResponse } | { ok: false; failure: FailedEscoPage }> {
  const load =
    request.fetchPage ??
    ((p: number) =>
      fetchEscoPage(buildEscoPageUrl(request.conceptType, request.scheme, p, request.pageSize)));

  const outcome = await withRetry(() => load(page), request.retry ?? ESCO_RETRY_CONFIG);
  if (outcome.success && outcome.data !== undefined) {
    return { ok: true, body: outcome.data };
  }
  return {
    ok: false,
    failure: { page, attempts: outcome.attempts, error: outcome.error?.message ?? 'unknown' },
  };
}

/**
 * Η **κύρια σάρωση**. Σταματά μόνο σε: όλες οι σελίδες τελείωσαν · η πρώτη
 * σελίδα δεν απάντησε · ο διακόπτης κυκλώματος άνοιξε.
 */
async function mainSweep(
  request: HarvestRequest,
  state: HarvestState,
): Promise<HarvestFailureReason | null> {
  let page = 0;
  while (state.plannedPages === null || page < state.plannedPages) {
    const attempt = await attemptPage(request, page);

    if (attempt.ok) {
      absorbPage(state, attempt.body);
      state.consecutiveFailures = 0;
      request.onProgress?.(
        `  📊 Σελίδα ${page + 1}/${state.plannedPages ?? '?'} · ` +
          `${state.unique.size}/${state.declaredTotal ?? '?'} μοναδικά`,
      );
    } else {
      state.failedPages.push(attempt.failure);
      state.consecutiveFailures += 1;
      request.onProgress?.(
        `  ❌ Σελίδα ${page + 1} ανεπίλυτη μετά από ${attempt.failure.attempts} προσπάθειες`,
      );
      // Β2: χωρίς απάντηση στην πρώτη σελίδα ΔΕΝ ΞΕΡΟΥΜΕ πόσα υπάρχουν.
      if (state.declaredTotal === null) return 'first-page-failed';
      if (state.consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) return 'source-unavailable';
    }

    page += 1;
    if (request.politeDelayMs > 0) await sleep(request.politeDelayMs);
  }
  return null;
}

/**
 * **Δεύτερη σάρωση** στις ανεπίλυτες σελίδες — μετά από πολύ μεγαλύτερο κενό
 * χρόνου από όσο δίνει η υποχώρηση. Ό,τι ανακτηθεί φεύγει από το `failedPages`.
 */
async function retrySweep(request: HarvestRequest, state: HarvestState): Promise<void> {
  const pending = [...state.failedPages];
  if (pending.length === 0) return;
  request.onProgress?.(`  🔁 Δεύτερη σάρωση σε ${pending.length} ανεπίλυτες σελίδες…`);

  for (const failure of pending) {
    const attempt = await attemptPage(request, failure.page);
    if (attempt.ok) {
      absorbPage(state, attempt.body);
      state.recoveredPages += 1;
      const index = state.failedPages.findIndex((entry) => entry.page === failure.page);
      if (index >= 0) state.failedPages.splice(index, 1);
      request.onProgress?.(`  ✔️  Σελίδα ${failure.page + 1} ανακτήθηκε`);
    }
    if (request.politeDelayMs > 0) await sleep(request.politeDelayMs);
  }
}

/** Ένα κείμενο ανά λόγο — **δηλωμένο**, ώστε νέος λόγος να μη μείνει άφωνος. */
const HARVEST_REASON_TEXT: Readonly<Record<HarvestFailureReason, string>> = {
  'first-page-failed': 'Η ΠΡΩΤΗ σελίδα δεν απάντησε — το πλήθος των εννοιών έμεινε ΑΓΝΩΣΤΟ',
  'source-unavailable': `${CONSECUTIVE_FAILURE_LIMIT} διαδοχικές αποτυχίες — η πηγή είναι εκτός λειτουργίας`,
  'pages-failed': 'Σελίδες έμειναν ανεπίλυτες και μετά τη δεύτερη σάρωση',
  'count-mismatch': 'Τα μοναδικά URI ΔΕΝ ισούνται με το δηλωμένο σύνολο της πηγής',
  'total-drift': 'Η πηγή άλλαξε το δηλωμένο σύνολο στη μέση — σκισμένο στιγμιότυπο',
};

/** Συγκεντρώνει **όλους** τους λόγους αποτυχίας — ποτέ μόνο τον πρώτο. */
function judge(state: HarvestState, early: HarvestFailureReason | null): HarvestVerdict {
  const reasons: HarvestFailureReason[] = [];
  if (early !== null) reasons.push(early);
  if (state.failedPages.length > 0 && !reasons.includes('first-page-failed')) {
    reasons.push('pages-failed');
  }
  if (state.observedTotals.length > 1) reasons.push('total-drift');
  if (state.declaredTotal !== null && state.unique.size !== state.declaredTotal) {
    reasons.push('count-mismatch');
  }

  const concepts = Array.from(state.unique.values());
  const duplicatesDropped = state.rawCount - state.unique.size;

  if (reasons.length === 0 && state.declaredTotal !== null) {
    return {
      kind: 'complete',
      concepts,
      declaredTotal: state.declaredTotal,
      pagesFetched: state.pagesFetched,
      duplicatesDropped,
      recoveredPages: state.recoveredPages,
    };
  }
  return {
    kind: 'incomplete',
    concepts,
    declaredTotal: state.declaredTotal,
    pagesFetched: state.pagesFetched,
    duplicatesDropped,
    recoveredPages: state.recoveredPages,
    failedPages: state.failedPages,
    observedTotals: state.observedTotals,
    reasons,
  };
}

/**
 * Κατεβάζει **όλες** τις έννοιες ενός concept-scheme, ή λέει **γιατί όχι**.
 *
 * ⚠️ Δεν πετά ποτέ για αποτυχία δικτύου: η αποτυχία είναι **τιμή επιστροφής**,
 * ώστε ο καλών να μην μπορεί να την προσπεράσει με `catch {}` — που είναι
 * ακριβώς ο τρόπος με τον οποίο γεννήθηκε το Β1.
 */
export async function harvestEscoConcepts(request: HarvestRequest): Promise<HarvestVerdict> {
  const state = createState();
  const early = await mainSweep(request, state);
  if (early !== 'first-page-failed' && early !== 'source-unavailable') {
    await retrySweep(request, state);
  }
  return judge(state, early);
}

/** Οι γραμμές της ατελούς ετυμηγορίας — λόγοι, σελίδες, μετατόπιση συνόλου. */
function describeIncomplete(
  verdict: Extract<HarvestVerdict, { kind: 'incomplete' }>,
): string[] {
  const declared = verdict.declaredTotal === null ? 'ΑΓΝΩΣΤΟ' : String(verdict.declaredTotal);
  const shortfall =
    verdict.declaredTotal === null ? null : verdict.declaredTotal - verdict.concepts.length;
  const lines = [
    `❌ ΑΤΕΛΗΣ ΣΥΓΚΟΜΙΔΗ — ${verdict.concepts.length} μοναδικά / ${declared} δηλωμένα` +
      (shortfall !== null && shortfall !== 0 ? ` (λείπουν ${shortfall})` : ''),
  ];
  for (const reason of verdict.reasons) lines.push(`  • ${HARVEST_REASON_TEXT[reason]}`);
  if (verdict.failedPages.length > 0) {
    lines.push(`  • Ανεπίλυτες σελίδες: ${verdict.failedPages.map((f) => f.page + 1).join(', ')}`);
    lines.push(`  • Πρώτο σφάλμα: ${verdict.failedPages[0].error}`);
  }
  if (verdict.observedTotals.length > 1) {
    lines.push(`  • Το «total» της πηγής άλλαξε: ${verdict.observedTotals.join(' → ')}`);
  }
  return lines;
}

/** Ανθρώπινη περιγραφή της ετυμηγορίας — μία γραμμή ανά λόγο, με **αριθμούς**. */
export function describeHarvestVerdict(verdict: HarvestVerdict): string[] {
  if (verdict.kind === 'incomplete') return describeIncomplete(verdict);
  return [
    `✅ Πλήρης συγκομιδή: ${verdict.declaredTotal} μοναδικές έννοιες σε ${verdict.pagesFetched} σελίδες`,
    ...(verdict.duplicatesDropped > 0
      ? [`  ⚠️  ${verdict.duplicatesDropped} διπλότυπα URI αγνοήθηκαν (επικάλυψη σελίδων)`]
      : []),
    ...(verdict.recoveredPages > 0
      ? [`  🔁 ${verdict.recoveredPages} σελίδες ανακτήθηκαν στη δεύτερη σάρωση`]
      : []),
  ];
}
