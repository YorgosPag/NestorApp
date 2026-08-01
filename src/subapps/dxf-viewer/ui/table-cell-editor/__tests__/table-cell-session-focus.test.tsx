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
 *
 * @see ui/table-cell-editor/table-cell-session-focus.ts
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
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

describe('useTableCellSessionBlur — οι τέσσερις δρόμοι', () => {
  let commit: jest.Mock;
  let close: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    commit = jest.fn();
    close = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  function blurTo(relatedTarget: HTMLElement | null): void {
    const { result } = renderHook(() => useTableCellSessionBlur(commit, close));
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
  });
});
