/**
 * ADR-367 §2.6 — η μηχανή καταστάσεων «εκκρεμούν εγγραφές;».
 *
 * Το σφάλμα που ΔΕΝ επιτρέπεται: να πούμε «καθαρό» ενώ εκκρεμεί εγγραφή (χάνεται δουλειά στο
 * κλείσιμο). Και (2026-11-12) το ψευδώς θετικό που ΜΕΤΡΗΘΗΚΕ στην παραγωγή: ουρά του SDK
 * απασχολημένη, καμία εγγραφή ⇒ «Leave site?». Τα tests ελέγχουν χρόνο, απάντηση της ερώτησης και
 * πέρασμα του φράγματος ουράς ανεξάρτητα — όπως τα διατάσσει η σειριακή ουρά του SDK.
 */

jest.mock('../firebase', () => ({ __esModule: true, db: {}, default: {} }));

import {
  createPendingWritesWatcher,
  SETTLE_THRESHOLD_MS,
  type PendingWritesWatcherDeps,
} from '../firestore-pending-writes';

interface Deferred {
  resolve: () => void;
  reject: () => void;
}

function deferredInto(list: Deferred[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    list.push({ resolve, reject: () => reject(new Error('settled')) });
  });
}

function harness() {
  let clock = 0;
  const timers: Array<{ at: number; fn: () => void }> = [];
  const probes: Deferred[] = [];
  const barriers: Deferred[] = [];
  const mark = jest.fn();
  const clear = jest.fn();
  const deps: PendingWritesWatcherDeps = {
    waitForPendingWrites: () => deferredInto(probes),
    queueBarrier: () => deferredInto(barriers),
    mark,
    clear,
    now: () => clock,
    schedule: (fn, delayMs) => {
      timers.push({ at: clock + delayMs, fn });
    },
  };
  const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
  const advance = async (ms: number): Promise<void> => {
    clock += ms;
    timers.filter((t) => t.at <= clock).forEach((t) => t.fn());
    timers.splice(0, timers.length, ...timers.filter((t) => t.at > clock));
    await flush();
  };
  /** Η ερώτηση `waitForPendingWrites` απαντά. */
  const answer = async (index: number, how: 'resolve' | 'reject' = 'resolve'): Promise<void> => {
    probes[index][how]();
    await flush();
  };
  /** Η πράξη-φράγμα της ουράς κλείνει (λύση ή απόρριψη: ίδιο νόημα). */
  const passBarrier = async (index: number, how: 'resolve' | 'reject' = 'resolve'): Promise<void> => {
    barriers[index][how]();
    await flush();
  };
  /** Η σειρά του SDK όταν ΔΕΝ εκκρεμεί τίποτα: η ερώτηση λύνεται μέσα στη δική της πράξη, πριν το φράγμα. */
  const nothingPending = async (index: number): Promise<void> => {
    await answer(index);
    await passBarrier(index);
  };
  return { watcher: createPendingWritesWatcher(deps), probes, barriers, mark, clear, advance, answer, passBarrier, nothingPending };
}

describe('createPendingWritesWatcher', () => {
  it('απάντηση πριν το φράγμα (κανονική κατάσταση) → ΚΑΝΕΝΑ σημάδι, κανένα τρεμόπαιγμα', async () => {
    const h = harness();
    h.watcher.probe();
    await h.advance(50);
    await h.nothingPending(0);
    await h.advance(SETTLE_THRESHOLD_MS);
    expect(h.mark).not.toHaveBeenCalled();
    expect(h.clear).not.toHaveBeenCalled();
  });

  it('φράγμα περασμένο + ερώτηση ανοιχτή πάνω από το κατώφλι (εκτός σύνδεσης) → σημάδι', async () => {
    const h = harness();
    h.watcher.probe();
    await h.passBarrier(0);
    expect(h.mark).not.toHaveBeenCalled();
    await h.advance(SETTLE_THRESHOLD_MS);
    expect(h.mark).toHaveBeenCalledTimes(1);
  });

  it('ΤΟ ΣΦΑΛΜΑ ΤΗΣ ΠΑΡΑΓΩΓΗΣ: ουρά απασχολημένη πέρα από το κατώφλι, καμία εγγραφή → ΚΑΝΕΝΑ σημάδι', async () => {
    const h = harness();
    h.watcher.probe();
    await h.advance(SETTLE_THRESHOLD_MS + 5000);
    expect(h.mark).not.toHaveBeenCalled();
    await h.nothingPending(0);
    await h.advance(SETTLE_THRESHOLD_MS);
    expect(h.mark).not.toHaveBeenCalled();
    expect(h.clear).not.toHaveBeenCalled();
  });

  it('ουρά απασχολημένη ΚΑΙ εκκρεμής εγγραφή → σημάδι μόλις περάσει το φράγμα', async () => {
    const h = harness();
    h.watcher.probe();
    await h.advance(SETTLE_THRESHOLD_MS + 2000);
    expect(h.mark).not.toHaveBeenCalled();
    await h.passBarrier(0, 'reject');
    expect(h.mark).toHaveBeenCalledTimes(1);
  });

  it('απάντηση ΜΕΤΑ το φράγμα ΔΕΝ καθαρίζει — ξαναρωτά· καθαρίζει μόνο απάντηση πριν το φράγμα', async () => {
    const h = harness();
    h.watcher.probe();
    await h.passBarrier(0);
    await h.advance(SETTLE_THRESHOLD_MS + 1000);
    await h.answer(0);
    expect(h.clear).not.toHaveBeenCalled();
    expect(h.probes).toHaveLength(2);

    await h.nothingPending(1);
    expect(h.clear).toHaveBeenCalledTimes(1);
  });

  it('δεύτερη απάντηση μετά το φράγμα (εγγραφές μπήκαν ενώ περιμέναμε) → μένει σημαδεμένο', async () => {
    const h = harness();
    h.watcher.probe();
    await h.passBarrier(0);
    await h.advance(SETTLE_THRESHOLD_MS + 100);
    await h.answer(0);
    await h.passBarrier(1);
    await h.advance(SETTLE_THRESHOLD_MS + 100);
    await h.answer(1);
    expect(h.clear).not.toHaveBeenCalled();
    expect(h.mark).toHaveBeenCalledTimes(1);
    expect(h.probes).toHaveLength(3);
  });

  it('όσο μια ερώτηση είναι ανοιχτή, νέα probe δεν ανοίγει δεύτερη', () => {
    const h = harness();
    h.watcher.probe();
    h.watcher.probe();
    h.watcher.probe();
    expect(h.probes).toHaveLength(1);
    expect(h.barriers).toHaveLength(1);
  });

  it('χρονόμετρο ή φράγμα παλιάς ερώτησης δεν σημαδεύει νεότερη που μόλις άνοιξε', async () => {
    const h = harness();
    h.watcher.probe();
    await h.answer(0);
    await h.advance(SETTLE_THRESHOLD_MS - 50);
    h.watcher.probe();
    await h.passBarrier(0);
    await h.advance(60);
    expect(h.mark).not.toHaveBeenCalled();
  });

  it('απόρριψη (instance τερματισμένο / αλλαγή χρήστη) → καθαρίζει', async () => {
    const h = harness();
    h.watcher.probe();
    await h.passBarrier(0);
    await h.advance(SETTLE_THRESHOLD_MS);
    expect(h.mark).toHaveBeenCalledTimes(1);
    await h.answer(0, 'reject');
    expect(h.clear).toHaveBeenCalledTimes(1);
  });
});
