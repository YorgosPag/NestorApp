/**
 * @fileoverview ΑΓΚΥΡΑ — **η αποκάλυψη που επαληθεύει ότι έφτασε** (ADR-907 §8.3 Β6).
 * @related lib/a11y/reveal-in-scroll.ts (`revealInScrollUntilSettled`) · search-results/ListingCard.module.css
 *
 * 🔴 Το περιστατικό: κάρτες με `content-visibility: auto` έχουν **εκτιμώμενο** ύψος ώσπου να ζωγραφιστούν. Ο προορισμός
 * του `scrollIntoView` υπολογίζεται με τις εκτιμήσεις ⇒ η επιλεγμένη κάρτα του `/search/results?selected=…` έμενε
 * 317px (1440px) έως 661px (320px) **έξω** από το κάδρο. Το jsdom δεν έχει διάταξη· εδώ η «διάταξη» είναι σενάριο.
 *
 *   Η1 · η πρώτη αίτηση προσπερνά ⇒ δεύτερη αίτηση· η δεύτερη φτάνει ⇒ τρίτη που **δεν μετακινεί τίποτα** ⇒ τέλος.
 *   Η2 · στοιχείο που ήταν ήδη στη θέση του ⇒ μία επιβεβαίωση και τέλος (ποτέ ατέρμονος βρόχος).
 *   Η3 · ο άνθρωπος αγγίζει την κύλιση ⇒ **καμία** διόρθωση μετά.
 *   Η4 · η ακύρωση (cleanup ενός effect) σταματά τον βρόχο.
 *   Η5 · στόχος που δεν ηρεμεί ποτέ ⇒ ταβάνι αιτήσεων, όχι αιώνιο κυνήγι.
 *   Η6 · στοιχείο που δεν μετριέται (jsdom, `display: none`) ⇒ **μία** αίτηση.
 *   Η7 · νέα αποκάλυψη ακυρώνει την προηγούμενη — μία τη φορά.
 *   Η8 · στοιχείο που βγήκε από το DOM ⇒ τέλος, χωρίς αίτηση.
 */

import { revealInScrollUntilSettled } from '../reveal-in-scroll';

/** Ένα καρέ του ψεύτικου ρολογιού (jsdom: `requestAnimationFrame` ≈ 16ms). */
const FRAME_MS = 16;
/** Αρκετά καρέ ώστε να ηρεμήσει **μία** φορά η θέση (το όριο του κώδικα είναι 6). */
const SETTLE_MS = FRAME_MS * 10;

interface Scripted {
  readonly el: HTMLElement;
  /** Πόσες φορές ζητήθηκε αποκάλυψη. */
  readonly requests: () => number;
  /** Η «διάταξη»: πού βρίσκεται η κορυφή του στοιχείου **τώρα**. */
  setTop(top: number): void;
}

/**
 * Στοιχείο του οποίου η θέση είναι σενάριο. `onRequest` = τι κάνει ο «browser» σε κάθε αίτηση (π.χ. προσπερνά).
 */
function scripted(initialTop: number, onRequest: (request: number, api: Scripted) => void = () => undefined): Scripted {
  let top = initialTop;
  let count = 0;
  const el = document.createElement('div');
  document.body.appendChild(el);
  const api: Scripted = { el, requests: () => count, setTop: (next) => void (top = next) };
  el.getBoundingClientRect = () =>
    ({ top, bottom: top + 340, height: 340, width: 300, left: 0, right: 300, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
  el.scrollIntoView = () => {
    count += 1;
    onRequest(count, api);
  };
  return api;
}

beforeEach(() => {
  jest.useFakeTimers();
  window.matchMedia = undefined as unknown as typeof window.matchMedia;
});

afterEach(() => {
  jest.useRealTimers();
  document.body.innerHTML = '';
});

describe('revealInScrollUntilSettled — ο προορισμός ενός scrollIntoView είναι στιγμιότυπο, όχι υπόσχεση', () => {
  it('Η1: η πρώτη αίτηση προσπερνά τον στόχο ⇒ ξαναζητά ώσπου μια αίτηση να μη μετακινεί τίποτα', () => {
    // 1η αίτηση: προσγείωση 317px πάνω από το κάδρο (το μετρημένο)· 2η: σωστά στο 76· 3η: καμία κίνηση.
    const target = scripted(1526, (request, api) => api.setTop(request === 1 ? -317 : 76));
    revealInScrollUntilSettled(target.el, { block: 'nearest' });
    expect(target.requests()).toBe(1);

    jest.advanceTimersByTime(SETTLE_MS);
    expect(target.requests()).toBe(2);

    jest.advanceTimersByTime(SETTLE_MS);
    expect(target.requests()).toBe(3);

    jest.advanceTimersByTime(SETTLE_MS * 5);
    expect(target.requests()).toBe(3);
  });

  it('Η2: στοιχείο ήδη στη θέση του ⇒ μία επιβεβαίωση και τέλος', () => {
    const target = scripted(120);
    revealInScrollUntilSettled(target.el);
    jest.advanceTimersByTime(SETTLE_MS * 6);
    expect(target.requests()).toBe(2);
  });

  it.each(['wheel', 'touchstart', 'pointerdown', 'keydown'])(
    'Η3: «%s» = ο άνθρωπος πήρε την κύλιση ⇒ καμία διόρθωση μετά',
    (type) => {
      const target = scripted(1526, (_request, api) => api.setTop(-317));
      revealInScrollUntilSettled(target.el);
      window.dispatchEvent(new Event(type));
      jest.advanceTimersByTime(SETTLE_MS * 6);
      expect(target.requests()).toBe(1);
    },
  );

  it('Η4: η ακύρωση σταματά τον βρόχο', () => {
    const target = scripted(1526, (_request, api) => api.setTop(-317));
    const cancel = revealInScrollUntilSettled(target.el);
    cancel();
    jest.advanceTimersByTime(SETTLE_MS * 6);
    expect(target.requests()).toBe(1);
  });

  it('Η5: στόχος που μετακινείται σε ΚΑΘΕ αίτηση ⇒ ταβάνι, όχι αιώνιο κυνήγι', () => {
    const target = scripted(1526, (request, api) => api.setTop(-100 * request));
    revealInScrollUntilSettled(target.el);
    jest.advanceTimersByTime(SETTLE_MS * 20);
    expect(target.requests()).toBe(4);
  });

  it('Η6: στοιχείο χωρίς διάταξη ⇒ μία αίτηση, κανένας βρόχος', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const scrollIntoView = jest.fn();
    el.scrollIntoView = scrollIntoView;
    revealInScrollUntilSettled(el);
    jest.advanceTimersByTime(SETTLE_MS * 6);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(() => revealInScrollUntilSettled(null)).not.toThrow();
  });

  it('Η7: νέα αποκάλυψη ακυρώνει την προηγούμενη', () => {
    const first = scripted(1526, (_request, api) => api.setTop(-317));
    const second = scripted(900);
    revealInScrollUntilSettled(first.el);
    revealInScrollUntilSettled(second.el);
    jest.advanceTimersByTime(SETTLE_MS * 6);
    expect(first.requests()).toBe(1);
    expect(second.requests()).toBe(2);
  });

  it('Η8: στοιχείο που βγήκε από το DOM ⇒ τέλος χωρίς αίτηση', () => {
    const target = scripted(1526, (_request, api) => api.setTop(-317));
    revealInScrollUntilSettled(target.el);
    target.el.remove();
    jest.advanceTimersByTime(SETTLE_MS * 6);
    expect(target.requests()).toBe(1);
  });
});
