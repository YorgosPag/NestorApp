/**
 * ADR-901 §14.8 — άγκυρα Α37: ο ελεγκτής της ζωντανής όψης. Κάθε κανόνας του — πύλη αναθεώρησης, μία ανάγνωση τη
 * φορά, συνένωση, αναμονή αισιόδοξων εντολών, καμία επανάληψη σε αποτυχία — έχει εδώ το δικό του κόκκινο.
 */

import { createServerViewRefresh, type ServerViewRefresh } from '../server-view-refresh';

const COALESCE = 250;

interface Harness {
  readonly refresh: ServerViewRefresh;
  readonly fetches: () => number;
  /** Ολοκληρώνει την τρέχουσα ανάγνωση με αυτή την αναθεώρηση (`null` = αποτυχία). */
  readonly resolve: (revision: number | null) => Promise<void>;
  held: boolean;
}

function harness(): Harness {
  let count = 0;
  const pending: Array<(revision: number | null) => void> = [];
  const state: Harness = {
    held: false,
    fetches: () => count,
    resolve: async (revision) => {
      pending.shift()?.(revision);
      await Promise.resolve();
      await Promise.resolve();
    },
    refresh: createServerViewRefresh({
      fetch: () => {
        count += 1;
        return new Promise<number | null>((done) => pending.push(done));
      },
      isHeld: () => state.held,
      coalesceMs: COALESCE,
      setTimer: (run, ms) => setTimeout(run, ms),
      clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    }),
  };
  return state;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('Α37 — πύλη αναθεώρησης (η δική μου πράξη δεν φέρνει δεύτερη ανάγνωση)', () => {
  it('σήμα ≤ αναθεώρηση της όψης ⇒ ΚΑΜΙΑ ανάγνωση · σήμα > ⇒ μία', () => {
    const h = harness();
    h.refresh.noteView(5);
    h.refresh.noteSignal(5);
    jest.advanceTimersByTime(COALESCE);
    expect(h.fetches()).toBe(0);
    h.refresh.noteSignal(6);
    jest.advanceTimersByTime(COALESCE);
    expect(h.fetches()).toBe(1);
  });

  it('η όψη που ήρθε στο μεταξύ (π.χ. απάντηση πράξης) ακυρώνει το σήμα που περίμενε', () => {
    const h = harness();
    h.refresh.noteView(1);
    h.refresh.noteSignal(2);
    h.refresh.noteView(2);
    jest.advanceTimersByTime(COALESCE);
    expect(h.fetches()).toBe(0);
  });
});

describe('Α37 — συνένωση και μία ανάγνωση τη φορά', () => {
  it('ριπή δέκα σημάτων ⇒ ΜΙΑ ανάγνωση', () => {
    const h = harness();
    for (let r = 1; r <= 10; r += 1) h.refresh.noteSignal(r);
    jest.advanceTimersByTime(COALESCE);
    expect(h.fetches()).toBe(1);
  });

  it('σήμα ΚΑΤΑ τη διάρκεια ανάγνωσης ⇒ ΜΙΑ επόμενη, μόνο αν η όψη που ήρθε είναι ακόμη πίσω', async () => {
    const h = harness();
    h.refresh.noteSignal(1);
    jest.advanceTimersByTime(COALESCE);
    h.refresh.noteSignal(2);
    h.refresh.noteSignal(3);
    jest.advanceTimersByTime(COALESCE);
    expect(h.fetches()).toBe(1); // δεύτερη παράλληλη ΟΧΙ
    await h.resolve(1);
    jest.advanceTimersByTime(COALESCE);
    expect(h.fetches()).toBe(2);
    await h.resolve(3);
    jest.advanceTimersByTime(COALESCE);
    expect(h.fetches()).toBe(2);
  });

  it('η ανάγνωση έφερε ήδη το νεότερο ⇒ καμία επόμενη', async () => {
    const h = harness();
    h.refresh.noteSignal(1);
    jest.advanceTimersByTime(COALESCE);
    h.refresh.noteSignal(2);
    await h.resolve(2);
    jest.advanceTimersByTime(COALESCE);
    expect(h.fetches()).toBe(1);
  });
});

describe('Α37 — αισιόδοξες εντολές, αποτυχία, εξαναγκασμός', () => {
  it('όσο εκκρεμεί εντολή η ανάγνωση ΠΕΡΙΜΕΝΕΙ· `release()` ⇒ ξεκινά', () => {
    const h = harness();
    h.held = true;
    h.refresh.noteSignal(1);
    jest.advanceTimersByTime(COALESCE);
    expect(h.fetches()).toBe(0);
    h.held = false;
    h.refresh.release();
    jest.advanceTimersByTime(COALESCE);
    expect(h.fetches()).toBe(1);
  });

  it('αποτυχία ⇒ ΚΑΜΙΑ άμεση επανάληψη (ούτε βρόχος) · το επόμενο σήμα ξαναδοκιμάζει', async () => {
    const h = harness();
    h.refresh.noteSignal(1);
    jest.advanceTimersByTime(COALESCE);
    await h.resolve(null);
    jest.advanceTimersByTime(COALESCE * 10);
    expect(h.fetches()).toBe(1);
    h.refresh.noteSignal(1);
    jest.advanceTimersByTime(COALESCE);
    expect(h.fetches()).toBe(2);
  });

  it('`force()` (ορατότητα · επανασύνδεση · freshUntil) ⇒ ανάγνωση ΧΩΡΙΣ πύλη', () => {
    const h = harness();
    h.refresh.noteView(9);
    h.refresh.force();
    jest.advanceTimersByTime(COALESCE);
    expect(h.fetches()).toBe(1);
  });

  it('`dispose()` ⇒ καμία ανάγνωση μετά το unmount', () => {
    const h = harness();
    h.refresh.noteSignal(1);
    h.refresh.dispose();
    jest.advanceTimersByTime(COALESCE);
    expect(h.fetches()).toBe(0);
  });
});
