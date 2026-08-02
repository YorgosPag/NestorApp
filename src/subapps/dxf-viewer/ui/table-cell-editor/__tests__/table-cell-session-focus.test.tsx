/**
 * 🔴 ADR-739 Φ.Δ βήμα 7 — **Η ΑΠΟΔΕΙΞΗ ΟΤΙ ΤΟ ΔΕΥΤΕΡΟ ΠΕΔΙΟ ΔΕΝ ΣΚΟΤΩΝΕΙ ΤΗ ΣΥΝΕΔΡΙΑ.**
 *
 * Είναι το ένα σημείο όπου η γραμμή τύπων μπορούσε να καταστρέψει όλα τα προηγούμενα βήματα.
 * Μέχρι το βήμα 6 υπήρχε **ένα** εστιασμένο πεδίο· το κριτήριο εξόδου ήταν «η εστίαση δεν
 * κάθεται στον δρομέα κελιού ⇒ κλείσε». Ένα δεύτερο πεδίο το ικανοποιεί **αμέσως**: πατάς
 * τη γραμμή τύπων, το κελί κάνει blur, ο δρομέας κλείνει, και μαζί του λύνεται το modal
 * scope — δηλαδή η λειτουργία Excel (αποκοπή 43 window listeners) πεθαίνει στο πρώτο κλικ.
 *
 * Δεν φαίνεται σε κανένα test κατάστασης, γιατί η κατάσταση είναι **σωστή**: ο δρομέας όντως
 * έκλεισε, απλώς δεν έπρεπε.
 *
 * Και η δεύτερη, πιο ύπουλη αστοχία: αν το πέρασμα κελί→γραμμή έκανε **commit**, ο φρουρός
 * «μία φορά» του `useInlineEditorKeys` θα κλείδωνε — και ό,τι έγραφε ο χρήστης **μέσα** στη
 * γραμμή τύπων δεν θα δεσμευόταν ποτέ. Σιωπηλή απώλεια πληκτρολόγησης.
 *
 * Και οι τέσσερις δρόμοι απώλειας εστίασης ελέγχονται ρητά — ο κατάλογος ΕΙΝΑΙ η προδιαγραφή:
 *
 *   1. κελί → γραμμή τύπων (μέλος συνεδρίας)   ⇒ τίποτα: ούτε commit, ούτε κλείσιμο
 *   2. γραμμή τύπων → κελί (μέλος συνεδρίας)   ⇒ τίποτα (συμμετρικά)
 *   3. εστίαση αλλού (κουμπί κορδέλας)         ⇒ commit + κλείσιμο
 *   4. εστίαση πουθενά, αλλά ένα καρέ μετά την έχει άλλο κελί (`Tab`) ⇒ commit, ΟΧΙ κλείσιμο
 *   5. εστίαση πουθενά **και** κανείς ένα καρέ μετά, αλλά το blur το προκάλεσε **κλικ μέσα
 *      στη συνεδρία** (ADR-739 §26.15) ⇒ commit + **ανάκτηση**, ΟΧΙ κλείσιμο
 *
 * Ο πέμπτος δρόμος είναι ο μόνος που δεν απαντιέται από το DOM: το κλικ σε καμβά δεν αφήνει
 * εστιασμένο στοιχείο να ρωτήσεις. Ελέγχεται εδώ ως **σύμβαση** του φύλακα· ότι ο pointer
 * όντως τη δηλώνει στη σωστή στιγμή το αποδεικνύει το `table-cell-pointer-session-survival`.
 *
 * @see ui/table-cell-editor/table-cell-session-focus.ts
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  __resetTableCellSessionFocusForTests,
  claimTableCellSessionPointerDown,
  isTableCellSessionElement,
  TABLE_CELL_SESSION_MARKER,
  useTableCellSessionBlur,
} from '../table-cell-session-focus';

/** Ένα στοιχείο που φέρει το σημάδι συνεδρίας — φτιαγμένο από τον ΙΔΙΟ ορισμό. */
function sessionElement(): HTMLElement {
  const el = document.createElement('input');
  for (const [name, value] of Object.entries(TABLE_CELL_SESSION_MARKER)) {
    el.setAttribute(name, value);
  }
  document.body.appendChild(el);
  return el;
}

function outsiderElement(): HTMLElement {
  const el = document.createElement('button');
  document.body.appendChild(el);
  return el;
}

/** Τρέχει ό,τι έχει προγραμματιστεί για το επόμενο καρέ. */
function nextFrame(): void {
  jest.advanceTimersByTime(20);
}

describe('isTableCellSessionElement', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('αναγνωρίζει στοιχείο που φέρει το σημάδι', () => {
    expect(isTableCellSessionElement(sessionElement())).toBe(true);
  });

  it('δεν αναγνωρίζει ό,τι δεν το φέρει — ούτε το `null`', () => {
    expect(isTableCellSessionElement(outsiderElement())).toBe(false);
    expect(isTableCellSessionElement(null)).toBe(false);
  });

  it('🔴 το σημάδι που εξάγεται ΕΙΝΑΙ αυτό που αναγνωρίζεται', () => {
    // Ο λόγος ύπαρξης του module: ένα αλφαριθμητικό γραμμένο στο ένα αρχείο και διαβασμένο
    // στο άλλο δεν ελέγχεται από κανέναν μεταγλωττιστή. Μια ορθογραφική διαφορά δεν σπάει
    // το build — απλώς σκοτώνει τη συνεδρία στο πρώτο κλικ.
    expect(Object.keys(TABLE_CELL_SESSION_MARKER)).toEqual(['data-table-cell-cursor']);
  });
});

describe('useTableCellSessionBlur — οι πέντε δρόμοι', () => {
  let commit: jest.Mock;
  let close: jest.Mock;
  let reclaim: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    __resetTableCellSessionFocusForTests();
    commit = jest.fn();
    close = jest.fn();
    reclaim = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    __resetTableCellSessionFocusForTests();
    document.body.innerHTML = '';
  });

  function blurTo(relatedTarget: HTMLElement | null): void {
    const { result } = renderHook(() => useTableCellSessionBlur(commit, close, reclaim));
    act(() => {
      result.current({ relatedTarget } as unknown as React.FocusEvent<HTMLElement>);
    });
  }

  it('1+2. εστίαση σε ΜΕΛΟΣ της συνεδρίας ⇒ ούτε commit, ούτε κλείσιμο', () => {
    blurTo(sessionElement());
    act(() => { nextFrame(); });
    // 🔴 Το «ούτε commit» είναι το ουσιώδες: ένα commit εδώ θα κλείδωνε τον φρουρό «μία
    // φορά» και ό,τι γραφόταν μετά **στη γραμμή τύπων** δεν θα δεσμευόταν ποτέ.
    expect(commit).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('3. εστίαση ΕΞΩ από τη συνεδρία ⇒ commit και κλείσιμο', () => {
    const outsider = outsiderElement();
    outsider.focus();
    blurTo(outsider);
    act(() => { nextFrame(); });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('4. `Tab` σε άλλο κελί (παραλήπτης `null`, μέλος ένα καρέ μετά) ⇒ commit, ΟΧΙ κλείσιμο', () => {
    // Ο παλιός επεξεργαστής ξεφορτώνεται πριν προλάβει ο νέος να εστιαστεί, οπότε το
    // `relatedTarget` είναι `null`. Άμεσο κλείσιμο εδώ θα σκότωνε **κάθε** `Tab` — γι' αυτό
    // η απόφαση κλεισίματος μένει ένα καρέ αργότερα.
    blurTo(null);
    sessionElement().focus();
    act(() => { nextFrame(); });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it('παραλήπτης `null` και ένα καρέ μετά κανείς ⇒ ο χρήστης έφυγε', () => {
    blurTo(null);
    act(() => { nextFrame(); });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(reclaim).not.toHaveBeenCalled();
  });

  it('🔴 5. κλικ ΜΕΣΑ στη συνεδρία (καμβάς) ⇒ commit + ΑΝΑΚΤΗΣΗ, ποτέ κλείσιμο', () => {
    // Ο pointer δηλώνει μόνο όσο η συνεδρία κρατά την εστίαση — αλλιώς δεν θα ακολουθούσε
    // blur και η δήλωση θα έμενε ορφανή. Το στήνουμε όπως στην πραγματικότητα.
    const field = sessionElement();
    field.focus();
    claimTableCellSessionPointerDown();
    field.blur();

    blurTo(null);
    act(() => { nextFrame(); });

    expect(commit).toHaveBeenCalledTimes(1);
    expect(reclaim).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it('🔴 η δήλωση επιβιώνει ΔΕΥΤΕΡΟΥ blur της ίδιας χειρονομίας', () => {
    // Μετρημένο ζωντανά: ένα κλικ σε κελί παράγει **δύο** `focusout` — ένα από το ξαναστήσιμο
    // του πεδίου και ένα από τη μεταφορά εστίασης του browser. Μια «διάβασε-και-σβήσε»
    // δήλωση καταναλωνόταν από το πρώτο και άφηνε το δεύτερο ορφανό: η συνεδρία επιβίωνε
    // αλλά **έχανε το πληκτρολόγιο**, διαλείπουσα σε 2 από 3 τρεξίματα.
    const field = sessionElement();
    field.focus();
    claimTableCellSessionPointerDown();
    field.blur();

    blurTo(null);
    act(() => { nextFrame(); });
    blurTo(null);
    act(() => { nextFrame(); });

    expect(reclaim).toHaveBeenCalledTimes(2);
    expect(close).not.toHaveBeenCalled();
  });

  it('🔴 η δήλωση ΛΗΓΕΙ στο επόμενο `mousedown` — αλλιώς δεν βγαίνεις ποτέ από τον πίνακα', () => {
    const field = sessionElement();
    field.focus();
    claimTableCellSessionPointerDown();
    field.blur();

    // Νέα χειρονομία, οπουδήποτε — ακόμα και σε στοιχείο που δεν φτάνει ποτέ στον ακροατή
    // του καμβά (κουμπί κορδέλας). Η λήξη ζει στο `document`, σε φάση σύλληψης.
    act(() => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    blurTo(null);
    act(() => { nextFrame(); });

    expect(close).toHaveBeenCalledTimes(1);
    expect(reclaim).not.toHaveBeenCalled();
  });

  it('🔴 η δήλωση ΛΗΓΕΙ και σε `keydown` — το `Tab` έξω πρέπει να βγάζει', () => {
    const field = sessionElement();
    field.focus();
    claimTableCellSessionPointerDown();
    field.blur();

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });

    blurTo(null);
    act(() => { nextFrame(); });

    expect(close).toHaveBeenCalledTimes(1);
    expect(reclaim).not.toHaveBeenCalled();
  });

  it('🔴 δήλωση χωρίς εστιασμένο μέλος ΔΕΝ γεννιέται — καμία μπαγιάτικη σημαία', () => {
    // Ο κύκλος ζωής της σημαίας είναι δομικός, όχι χρονικός: αν κανένα πεδίο δεν έχει την
    // εστίαση, κανένα blur δεν έρχεται να την καταναλώσει — άρα δεν πρέπει να υπάρχει.
    outsiderElement().focus();
    claimTableCellSessionPointerDown();

    blurTo(null);
    act(() => { nextFrame(); });

    expect(close).toHaveBeenCalledTimes(1);
    expect(reclaim).not.toHaveBeenCalled();
  });
});
