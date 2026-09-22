/**
 * ADR-367 §2.6 — η μηχανή καταστάσεων «εκκρεμούν εγγραφές;».
 *
 * Το σφάλμα που ΔΕΝ επιτρέπεται: να πούμε «καθαρό» ενώ εκκρεμεί εγγραφή (χάνεται δουλειά στο
 * κλείσιμο). Το ανεκτό: σύντομο ψευδώς θετικό. Τα tests καρφώνουν και τα δύο, με ελεγχόμενο
 * χρόνο και ελεγχόμενες απαντήσεις του SDK.
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

function harness() {
  let clock = 0;
  const timers: Array<{ at: number; fn: () => void }> = [];
  const probes: Deferred[] = [];
  const mark = jest.fn();
  const clear = jest.fn();
  const deps: PendingWritesWatcherDeps = {
    waitForPendingWrites: () =>
      new Promise<void>((resolve, reject) => {
        probes.push({ resolve, reject: () => reject(new Error('terminated')) });
      }),
    mark,
    clear,
    now: () => clock,
    schedule: (fn, delayMs) => {
      timers.push({ at: clock + delayMs, fn });
    },
  };
  const advance = async (ms: number): Promise<void> => {
    clock += ms;
    timers.filter((t) => t.at <= clock).forEach((t) => t.fn());
    timers.splice(0, timers.length, ...timers.filter((t) => t.at > clock));
    await Promise.resolve();
  };
  const settle = async (index: number, how: 'resolve' | 'reject' = 'resolve'): Promise<void> => {
    probes[index][how]();
    await new Promise((r) => setTimeout(r, 0));
  };
  return { watcher: createPendingWritesWatcher(deps), probes, mark, clear, advance, settle };
}

describe('createPendingWritesWatcher', () => {
  it('γρήγορη απάντηση (κανονική εγγραφή online) → ΚΑΝΕΝΑ σημάδι, κανένα τρεμόπαιγμα', async () => {
    const h = harness();
    h.watcher.probe();
    await h.advance(50);
    await h.settle(0);
    await h.advance(SETTLE_THRESHOLD_MS);
    expect(h.mark).not.toHaveBeenCalled();
    expect(h.clear).not.toHaveBeenCalled();
  });

  it('ερώτηση ανοιχτή πάνω από το κατώφλι (εκτός σύνδεσης) → σημάδι', async () => {
    const h = harness();
    h.watcher.probe();
    await h.advance(SETTLE_THRESHOLD_MS);
    expect(h.mark).toHaveBeenCalledTimes(1);
  });

  it('αργή απάντηση ΔΕΝ καθαρίζει — ξαναρωτά· καθαρίζει μόνο η γρήγορη', async () => {
    const h = harness();
    h.watcher.probe();
    await h.advance(SETTLE_THRESHOLD_MS);
    await h.advance(1000);
    await h.settle(0);
    expect(h.clear).not.toHaveBeenCalled();
    expect(h.probes).toHaveLength(2);

    await h.settle(1);
    expect(h.clear).toHaveBeenCalledTimes(1);
  });

  it('δεύτερη αργή απάντηση (εγγραφές μπήκαν ενώ περιμέναμε) → μένει σημαδεμένο', async () => {
    const h = harness();
    h.watcher.probe();
    await h.advance(SETTLE_THRESHOLD_MS + 100);
    await h.settle(0);
    await h.advance(SETTLE_THRESHOLD_MS + 100);
    await h.settle(1);
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
  });

  it('χρονόμετρο παλιάς ερώτησης δεν σημαδεύει νεότερη που μόλις άνοιξε', async () => {
    const h = harness();
    h.watcher.probe();
    await h.settle(0);
    await h.advance(SETTLE_THRESHOLD_MS - 50);
    h.watcher.probe();
    await h.advance(60);
    expect(h.mark).not.toHaveBeenCalled();
  });

  it('απόρριψη (instance τερματισμένο / αλλαγή χρήστη) → καθαρίζει', async () => {
    const h = harness();
    h.watcher.probe();
    await h.advance(SETTLE_THRESHOLD_MS);
    await h.settle(0, 'reject');
    expect(h.clear).toHaveBeenCalledTimes(1);
  });
});
