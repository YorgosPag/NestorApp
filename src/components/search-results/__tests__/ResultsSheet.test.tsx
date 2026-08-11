/**
 * 🔴 **Η ΑΓΚΥΡΑ ΤΟΥ ΖΩΓΡΑΦΟΥ** — SPEC-777D §26.7, παραδοτέο 5.
 *
 * Χωρίς αυτή, η επιστροφή στο στοίβαγμα (`grid-cols-1`) **περνά πράσινη**: καμία από τις
 * υπάρχουσες σουίτες δεν ρωτά *τι* αποδίδεται ανά `ViewportClass`.
 *
 * ⚠️ **ΤΙ ΑΠΟΔΕΙΚΝΥΕΙ ΚΑΙ ΤΙ ΟΧΙ — δηλωμένο, όχι υπονοούμενο.** Το jsdom **δεν έχει
 * διάταξη**: δεν λύνει `calc()`, δεν εφαρμόζει `scroll-snap`, και κάθε `offsetTop` είναι 0.
 * Άρα εδώ αποδεικνύεται η **απόφαση** (ποιες στάσεις υπάρχουν, ποιος τις φτάνει, τι μένει
 * ζωντανό, τι δεν κρύβεται ποτέ) — **όχι** η φυσική, που είναι του περιηγητή εξ ορισμού.
 * Τα `offsetTop` δίνονται **ρητά** από το test, ώστε ο ελεγκτής να ελέγχεται σε κόσμο που
 * δηλώνει τι ξέρει.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ResultsSheet } from '../ResultsSheet';
import { BOTTOM_SHEET_STOPS, type BottomSheetStop } from '@/lib/layout/bottom-sheet-stops';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ sm: 'h-4 w-4' }),
}));

// Πραγματικό `<button>`, ώστε το `disabled` να σημαίνει ό,τι σημαίνει στον περιηγητή.
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

/** Πόσο απέχει κάθε στάση από την κορυφή — οι τιμές που στο CSS τις παράγει το `calc()`. */
const OFFSET: Readonly<Record<BottomSheetStop, number>> = { peek: 0, half: 250, full: 600 };

function mountSheet(viewport: 'measuring' | 'narrow' | 'wide') {
  const view = render(
    <ResultsSheet viewport={viewport}>
      <div data-list-scroll data-testid="list">
        <span data-testid="unmapped">3 χωρίς δηλωμένη θέση</span>
      </div>
    </ResultsSheet>
  );

  const scroller = view.container.querySelector<HTMLElement>('[data-sheet-state]');
  if (!scroller) throw new Error('Το δοχείο κύλισης δεν αποδόθηκε.');

  for (const stop of BOTTOM_SHEET_STOPS) {
    const anchor = scroller.querySelector<HTMLElement>(`[data-sheet-stop="${stop}"]`);
    if (anchor) Object.defineProperty(anchor, 'offsetTop', { value: OFFSET[stop], configurable: true });
  }

  // Ο περιηγητής κυλά· το jsdom όχι. Η μίμηση είναι **πιστή**: θέτει τη θέση ΚΑΙ εκπέμπει
  // το γεγονός, ώστε ο βρόχος «κουμπί → scrollTo → scroll → κατάσταση» να ελέγχεται ΟΛΟΣ.
  Object.defineProperty(scroller, 'scrollTo', {
    configurable: true,
    value: ({ top }: ScrollToOptions) => {
      scroller.scrollTop = top ?? 0;
      scroller.dispatchEvent(new Event('scroll'));
    },
  });

  return { ...view, scroller };
}

beforeEach(() => {
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0);
    return 0;
  });
});

afterEach(() => jest.restoreAllMocks());

describe('ResultsSheet — ποια διάταξη αποδίδεται ανά ViewportClass', () => {
  it('Ζ1: ΣΤΕΝΗ ⇒ επικάλυψη πάνω στον χάρτη, ΠΟΤΕ δεύτερη σειρά που στοιβάζει', () => {
    const { scroller } = mountSheet('narrow');
    // `absolute inset-0` = το φύλλο ΚΑΘΕΤΑΙ ΠΑΝΩ στον χάρτη. Αν επέστρεφε το στοίβαγμα,
    // το δοχείο θα ήταν στοιχείο ροής και αυτές οι κλάσεις θα έλειπαν.
    expect(scroller).toHaveClass('absolute', 'inset-0');
    expect(scroller.className).not.toMatch(/\bgrid-cols-1\b/);
  });

  it('Ζ2: ΣΤΕΝΗ ⇒ ΜΗ-ΑΠΟΚΛΕΙΣΤΙΚΟ (κανόνας 2): ο χάρτης σέρνεται μέσα από το κενό', () => {
    const { scroller, container } = mountSheet('narrow');

    // Το δοχείο δεν δέχεται δείκτη· μόνο η ορατή επιφάνεια τον ξαναανάβει.
    expect(scroller).toHaveClass('pointer-events-none');
    expect(container.querySelector('section')).toHaveClass('pointer-events-auto');

    // ⛔ Καμία σκοτεινή επικάλυψη, κανένας ρόλος διαλόγου: αυτά ΕΙΝΑΙ το modal που
    // ο κανόνας 2 απαγορεύει, και θα σκότωναν τον χάρτη.
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector('[aria-modal]')).toBeNull();
  });

  it('Ζ3: ΕΥΡΕΙΑ ⇒ στήλη πλέγματος — χωρίς στάσεις, χωρίς χρώμιο φύλλου', () => {
    const { scroller } = mountSheet('wide');
    expect(scroller).toHaveAttribute('data-sheet-state', 'column');
    expect(scroller.className).toMatch(/md:static/);
    // Το χρώμιο υπάρχει στο DOM αλλά κρύβεται από το CSS — δες Ζ4 για το γιατί.
    expect(scroller.querySelector('header')).toHaveClass('md:hidden');
  });

  it('Ζ4: «ΜΕΤΡΑΩ ΑΚΟΜΗ» ⇒ ΤΑΥΤΟΣΗΜΟ σχήμα με τις δύο άλλες (CLS = 0 εκ κατασκευής)', () => {
    const shapeOf = (viewport: 'measuring' | 'narrow' | 'wide'): string => {
      const { scroller, unmount } = mountSheet(viewport);
      const shape = [
        scroller.className,
        scroller.querySelector('section')?.className ?? '',
        String(scroller.querySelectorAll('[data-sheet-stop]').length),
        String(scroller.querySelectorAll('header').length),
        String(scroller.querySelectorAll('button').length),
      ].join('|');
      unmount();
      return shape;
    };

    // 🔴 Η καρδιά της Π2: αν το «μετράω ακόμη» άλλαζε ΟΤΙΔΗΠΟΤΕ γεωμετρικό, η οθόνη θα
    // αναπηδούσε μετά την ενυδάτωση. Το `data-sheet-state` (συμπεριφορά) ΕΠΙΤΡΕΠΕΤΑΙ να
    // διαφέρει· το σχήμα ΟΧΙ. Γι' αυτό η σύγκριση αγνοεί το γνώρισμα και κοιτά κλάσεις
    // και πλήθη κόμβων.
    expect(shapeOf('measuring')).toBe(shapeOf('narrow'));
    expect(shapeOf('measuring')).toBe(shapeOf('wide'));
  });
});

describe('ResultsSheet — οι τρεις στάσεις, και ποιος τις φτάνει', () => {
  it('Ζ5: υπάρχουν ΤΡΕΙΣ άγκυρες, μία ανά στάση (κανόνας 1)', () => {
    const { scroller } = mountSheet('narrow');
    const anchors = [...scroller.querySelectorAll('[data-sheet-stop]')].map((a) =>
      a.getAttribute('data-sheet-stop')
    );
    expect(anchors).toEqual([...BOTTOM_SHEET_STOPS]);
  });

  it('Ζ6: ΚΑΙ ΟΙ ΤΡΕΙΣ φτάνονται ΜΕ ΚΟΥΜΠΙ — όχι μόνο με τη λαβή (κανόνας 3)', () => {
    const { scroller } = mountSheet('narrow');
    expect(scroller).toHaveAttribute('data-sheet-state', 'peek');

    act(() => void fireEvent.click(screen.getByLabelText('search-results:sheet.moreList')));
    expect(scroller).toHaveAttribute('data-sheet-state', 'half');

    act(() => void fireEvent.click(screen.getByLabelText('search-results:sheet.moreList')));
    expect(scroller).toHaveAttribute('data-sheet-state', 'full');

    act(() => void fireEvent.click(screen.getByLabelText('search-results:sheet.moreMap')));
    expect(scroller).toHaveAttribute('data-sheet-state', 'half');
  });

  it('Ζ7: στα άκρα το κουμπί απενεργοποιείται αντί να υπόσχεται κίνηση που δεν γίνεται', () => {
    const { scroller } = mountSheet('narrow');
    expect(screen.getByLabelText('search-results:sheet.moreMap')).toBeDisabled();
    expect(screen.getByLabelText('search-results:sheet.moreList')).toBeEnabled();

    act(() => void fireEvent.click(screen.getByLabelText('search-results:sheet.moreList')));
    act(() => void fireEvent.click(screen.getByLabelText('search-results:sheet.moreList')));

    expect(scroller).toHaveAttribute('data-sheet-state', 'full');
    expect(screen.getByLabelText('search-results:sheet.moreList')).toBeDisabled();
  });

  it('Ζ8: η λαβή είναι ΣΗΜΑ, όχι χειριστήριο — αόρατη στον αναγνώστη οθόνης', () => {
    const { scroller } = mountSheet('narrow');
    const handle = scroller.querySelector('header > span');
    expect(handle).toHaveAttribute('aria-hidden', 'true');
    // …και δεν είναι κουμπί: αν ήταν, θα ήταν ο μόνος τρόπος και ο κανόνας 3 θα έσπαγε.
    expect(handle?.tagName).toBe('SPAN');
  });
});

describe('ResultsSheet — η λογιστική δεν χάνεται (Α5 §4.1, κανόνας 27)', () => {
  it('Ζ9: το περιεχόμενο της λίστας αποδίδεται σε ΚΑΘΕ στάση — καμία σιωπηλή εξαφάνιση', () => {
    const { scroller } = mountSheet('narrow');

    for (const expected of ['peek', 'half', 'full'] as const) {
      if (expected !== 'peek') {
        act(() => void fireEvent.click(screen.getByLabelText('search-results:sheet.moreList')));
      }
      expect(scroller).toHaveAttribute('data-sheet-state', expected);
      // 🔑 Οι «χωρίς σχήμα» αγγελίες ζουν ΜΕΣΑ στη λίστα. Αν κάποια στάση τις απέκρυπτε,
      // ο χρήστης θα έβλεπε τη λογιστική να λέει «3» και τη λίστα να μη τις έχει.
      expect(screen.getByTestId('unmapped')).toBeInTheDocument();
      expect(screen.getByTestId('list')).toBeInTheDocument();
    }
  });

  it('Ζ10: η εσωτερική κύλιση ανοίγει ΜΟΝΟ στο πλήρες — «expands as the user scrolls»', () => {
    const { scroller } = mountSheet('narrow');
    const surface = scroller.querySelector('section');
    const locked = '[&_[data-list-scroll]]:overflow-y-hidden';

    expect(surface?.className).toContain(locked);
    act(() => void fireEvent.click(screen.getByLabelText('search-results:sheet.moreList')));
    expect(surface?.className).toContain(locked);
    act(() => void fireEvent.click(screen.getByLabelText('search-results:sheet.moreList')));
    expect(surface?.className).not.toContain(locked);
  });

  it('Ζ11: στη ΣΤΗΛΗ το κλείδωμα ακυρώνεται ΑΠΟ ΤΟ CSS, όχι από τη μέτρηση', () => {
    // 🔑 Η στήλη του desktop δεν έχει στάσεις, άρα δεν επιτρέπεται να κληρονομήσει το
    // κλείδωμα του φύλλου — αλλά η ακύρωση οφείλει να ζει στο `md:`, γιατί αν κρεμόταν
    // από το `ViewportClass` θα ξαναγεννούσε τη μετατόπιση που η Ζ4 απαγορεύει.
    const surface = mountSheet('wide').scroller.querySelector('section');
    expect(surface?.className).toContain('[&_[data-list-scroll]]:overflow-y-hidden');
    expect(surface?.className).toContain('md:[&_[data-list-scroll]]:overflow-y-auto');
  });
});
