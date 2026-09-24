/**
 * @fileoverview **ΟΙ ΑΓΚΥΡΕΣ ΤΩΝ ΔΥΟ ΕΡΩΤΗΣΕΩΝ** — ADR-777 Α3 · CHECK 3.41.
 *
 * Η κάθε μία κρατά μια απόφαση που **έμοιαζε αυθαίρετη** και δεν είναι.
 */

import { renderHook, act } from '@testing-library/react';

import {
  NO_LISTING_FOCUS,
  focusedListingId,
  hasListingFocus,
  listingFocusStrength,
  listingSelectionHref,
} from '../listing-focus';
import { useListingFocus } from '@/hooks/listings/useListingFocus';

describe('listing-focus — το λεξιλόγιο', () => {
  it('Λ1: κενή εστίαση δεν αφορά κανένα ακίνητο', () => {
    expect(listingFocusStrength(NO_LISTING_FOCUS, 'lst_1')).toBe('none');
    expect(focusedListingId(NO_LISTING_FOCUS)).toBeNull();
    expect(hasListingFocus(NO_LISTING_FOCUS)).toBe(false);
  });

  it('Λ2: το peeked βάφεται εφήμερα, το selected επίμονα', () => {
    const focus = { peeked: 'lst_a', selected: 'lst_b' };
    expect(listingFocusStrength(focus, 'lst_a')).toBe('peeked');
    expect(listingFocusStrength(focus, 'lst_b')).toBe('selected');
    expect(listingFocusStrength(focus, 'lst_c')).toBe('none');
  });

  /**
   * 🔴 **Λ3 — Η ΕΝΤΑΣΗ ΕΙΝΑΙ ΣΕΙΡΑ, ΟΧΙ ΣΥΝΟΛΟ.**
   *
   * Μια αγγελία **και** επιλεγμένη **και** κάτω από τον δείκτη δεν είναι «διπλά
   * επισημασμένη»: είναι **επιλεγμένη**. Ο δείκτης δεν προσθέτει τίποτα που δεν λέει
   * ήδη η επιλογή — και μια «τρίτη, εντονότερη» κατάσταση θα ήταν κανάλι που ο
   * άνθρωπος δεν μπορεί να αποκωδικοποιήσει.
   */
  it('Λ3: όταν συμπίπτουν, νικά το selected', () => {
    expect(listingFocusStrength({ peeked: 'lst_x', selected: 'lst_x' }, 'lst_x')).toBe('selected');
  });

  /**
   * 🔴 **Λ4 — ΤΟ `focusedListingId` ΑΝΤΙΣΤΡΕΦΕΙ ΤΗ ΣΕΙΡΑ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΑΝΤΙΦΑΣΗ.**
   *
   * Η **ένταση** απαντά *«πώς να το βάψω;»* — εκεί νικά η επιλογή (Λ3). Αυτό απαντά
   * *«πού κοιτάζει ΤΩΡΑ;»* — εκεί νικά το **πιο πρόσφατο**, δηλαδή ο δείκτης.
   *
   * ⚠️ Αν συμφωνούσαν, ο **δείκτης άκρης** θα έδειχνε προς το παλιό επιλεγμένο ακίνητο
   * ενώ ο άνθρωπος σαρώνει με το ποντίκι κάπου αλλού — θα έλεγε ψέματα για το πού
   * βρίσκεται η προσοχή του.
   */
  it('Λ4: για «πού κοιτάζω τώρα», το peeked προηγείται του selected', () => {
    expect(focusedListingId({ peeked: 'lst_hover', selected: 'lst_click' })).toBe('lst_hover');
    expect(focusedListingId({ peeked: null, selected: 'lst_click' })).toBe('lst_click');
  });
});

describe('useListingFocus — οι μεταβάσεις', () => {
  /**
   * 🔴 **Μ1 — ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΚΛΕΙΝΕΙ ΟΛΗ Η ΑΛΛΑΓΗ.**
   *
   * Με το παλιό ενιαίο `highlightedId`, το πέρασμα του ποντικιού πάνω από **οποιοδήποτε**
   * άλλο σχήμα **έσβηνε** το ακίνητο που μόλις είχε διαλέξει ο άνθρωπος.
   */
  it('Μ1: το peek ΔΕΝ αγγίζει την επιλογή', () => {
    const { result } = renderHook(() => useListingFocus());

    act(() => result.current.select('lst_chosen'));
    act(() => result.current.peek('lst_passing'));

    expect(result.current.focus.selected).toBe('lst_chosen');
    expect(result.current.focus.peeked).toBe('lst_passing');
  });

  /**
   * 🔴 **Μ2 — ΤΟ ΚΛΙΚ ΣΒΗΝΕΙ ΤΟ peek, ΚΑΙ ΕΙΝΑΙ ΑΠΑΙΤΗΣΗ ΑΦΗΣ.**
   *
   * Σε συσκευή αφής δεν υπάρχει `mouseleave`: το πάτημα παράγει συνθετικό `mouseenter`
   * που **δεν καθαρίζεται ποτέ**. Χωρίς αυτή τη γραμμή, το `peeked` κολλά για πάντα στο
   * τελευταίο πατημένο σχήμα — σε κινητό, όπου η Α3 δηλώνει ότι μπαίνουν οι περισσότεροι.
   */
  it('Μ2: το select καθαρίζει το peeked', () => {
    const { result } = renderHook(() => useListingFocus());

    act(() => result.current.peek('lst_hover'));
    act(() => result.current.select('lst_hover'));

    expect(result.current.focus).toEqual({ peeked: null, selected: 'lst_hover' });
  });

  it('Μ3: το peek(null) σβήνει μόνο το εφήμερο', () => {
    const { result } = renderHook(() => useListingFocus());

    act(() => result.current.select('lst_kept'));
    act(() => result.current.peek('lst_gone'));
    act(() => result.current.peek(null));

    expect(result.current.focus).toEqual({ peeked: null, selected: 'lst_kept' });
  });

  /** **Μ4** — το `Escape` είναι η έξοδος που κάθε επίμονη κατάσταση οφείλει (ADR-711). */
  it('Μ4: το Escape ακυρώνει ολόκληρη την εστίαση', () => {
    const { result } = renderHook(() => useListingFocus());

    act(() => result.current.select('lst_1'));
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });

    expect(result.current.focus).toEqual(NO_LISTING_FOCUS);
  });

  /**
   * **Μ5 — ΚΑΝΕΝΑΣ ΑΚΡΟΑΤΗΣ ΟΤΑΝ ΔΕΝ ΥΠΑΡΧΕΙ ΤΙ ΝΑ ΑΚΥΡΩΘΕΙ.**
   *
   * Ένας μόνιμος ακροατής `keydown` στο παράθυρο θα διεκδικούσε το `Escape` από κάθε
   * διάλογο και μενού της σελίδας — και το `inert` **δεν** σταματά το `window keydown`
   * (μάθημα ADR-364/ADR-711).
   */
  it('Μ5: χωρίς εστίαση, δεν δεσμεύεται ακροατής πληκτρολογίου', () => {
    const add = jest.spyOn(window, 'addEventListener');
    renderHook(() => useListingFocus());
    expect(add.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(0);
    add.mockRestore();
  });

  /** **Μ6** — δύο `peek` με το ίδιο id δίνουν το **ίδιο** αντικείμενο: καμία απόδοση χωρίς αλλαγή. */
  it('Μ6: επαναλαμβανόμενο peek στο ίδιο ακίνητο δεν παράγει νέα κατάσταση', () => {
    const { result } = renderHook(() => useListingFocus());

    act(() => result.current.peek('lst_same'));
    const first = result.current.focus;
    act(() => result.current.peek('lst_same'));

    expect(result.current.focus).toBe(first);
  });
});

describe('Σ — ο σύνδεσμος της επιλογής (ADR-777 §8.78)', () => {
  it('Σ1: κρατά κριτήρια και κάδρο, προσθέτει ΑΥΤΗ την αγγελία', () => {
    const href = listingSelectionHref('https://x.gr/search/results?bedsmin=1&box=1,2,3,4', 'pl_9');
    const url = new URL(href);
    expect(url.pathname).toBe('/search/results');
    expect(url.searchParams.get('bedsmin')).toBe('1');
    expect(url.searchParams.get('box')).toBe('1,2,3,4');
    expect(url.searchParams.get('selected')).toBe('pl_9');
  });

  it('Σ2: άλλη επιλογή στη διεύθυνση ⇒ αντικαθίσταται, ποτέ δύο `selected`', () => {
    const url = new URL(listingSelectionHref('https://x.gr/offers?selected=old', 'new'));
    expect(url.searchParams.getAll('selected')).toEqual(['new']);
  });

  it('Σ3: το fragment δεν ταξιδεύει (εφήμερη κατάσταση της σελίδας)', () => {
    expect(listingSelectionHref('https://x.gr/offers#photo-3', 'a')).toBe('https://x.gr/offers?selected=a');
  });
});
