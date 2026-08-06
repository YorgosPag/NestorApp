/**
 * 🔴 ADR-739 §52 — **Η ΑΠΟΔΕΙΞΗ ΟΤΙ Η ΚΟΡΔΕΛΑ ΔΕΝ ΣΚΟΤΩΝΕΙ ΤΟΝ ΔΡΟΜΕΑ.**
 *
 * Το ελάττωμα που κλείνει είναι **αυτοαναφορικό**, και γι' αυτό ήταν ο #1 κίνδυνος όλης της
 * φάσης: το κλικ στο «Β» της contextual καρτέλας κλείνει τη συνεδρία κελιού ⇒ χάνεται το
 * token `table-cell-active` ⇒ **η ίδια η καρτέλα εξαφανίζεται τη στιγμή που την πατάς**. Ο
 * χρήστης δεν βλέπει σφάλμα· βλέπει την κορδέλα να «αναπηδά» και το κουμπί να μη δουλεύει.
 *
 * ## 🔴 ΓΙΑΤΙ ΕΛΕΓΧΟΝΤΑΙ **ΔΥΟ** ΣΕΙΡΕΣ ΣΥΜΒΑΝΤΩΝ
 * Ο φύλακας αποφασίζει μέσα σε `requestAnimationFrame`, και το `click` του browser έρχεται
 * **μετά** το `mouseup`. Άρα η σειρά εξαρτάται από το πόσο κρατά ο χρήστης το πλήκτρο:
 *
 * ```
 *   γρήγορο κλικ  (<16ms):  blur → click → rAF
 *   κανονικό κλικ (>16ms):  blur → rAF  → click      ← ΕΔΩ ζει το ελάττωμα
 * ```
 *
 * Η δεύτερη σειρά είναι που κάνει **αδύνατη** κάθε «διόρθωση μετά»: ένα
 * `restartTableCellCursorSession()` μέσα στον χειριστή του `click` τρέχει όταν ο δρομέας έχει
 * **ήδη** κλείσει. Ένα test που ελέγχει μόνο τη μία σειρά θα ήταν πράσινο με σπασμένη
 * υλοποίηση — και θα ήταν πράσινο ακριβώς στην περίπτωση που δεν συμβαίνει ποτέ στην πράξη.
 *
 * ## Τι ΔΕΝ αποδεικνύει
 * Ότι τα panels της κορδέλας φορούν όντως το σημάδι — αυτό είναι δήλωση δεδομένων
 * (`RibbonPanelDef.keepsTableCellSession`) και το ελέγχει το `table-contextual-tabs.test`.
 * Εδώ ελέγχεται ο **φύλακας**: δοθέντος του σημαδιού, τι αποφασίζει.
 *
 * @see ui/table-cell-editor/table-cell-session-focus.ts
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §52
 */

import type React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  __resetTableCellSessionFocusForTests,
  isTableSessionKeepAliveElement,
  TABLE_CELL_SESSION_MARKER,
  TABLE_SESSION_KEEPALIVE_MARKER,
  useTableCellSessionBlur,
} from '../table-cell-session-focus';

/** Ένα panel κορδέλας που δηλώνει «μη με κλείσεις», με ένα κουμπί μέσα του. */
function ribbonPanelWithButton(): HTMLButtonElement {
  const panel = document.createElement('section');
  for (const [name, value] of Object.entries(TABLE_SESSION_KEEPALIVE_MARKER)) {
    panel.setAttribute(name, value);
  }
  const button = document.createElement('button');
  panel.appendChild(button);
  document.body.appendChild(panel);
  return button;
}

/** Ένα κουμπί κορδέλας **χωρίς** το σημάδι — π.χ. «Αρχική → Γραμμή». */
function plainRibbonButton(): HTMLButtonElement {
  const button = document.createElement('button');
  document.body.appendChild(button);
  return button;
}

function nextFrame(): void {
  jest.advanceTimersByTime(20);
}

describe('isTableSessionKeepAliveElement — η εμβέλεια είναι `closest`, όχι το ίδιο το στοιχείο', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('🔴 αναγνωρίζει κουμπί ΜΕΣΑ σε σημαδεμένο panel', () => {
    // Είναι ολόκληρος ο λόγος που η τέταρτη μορφή χρησιμοποιεί `closest()`: το σημάδι μπαίνει
    // στο panel **μία** φορά, όχι σε ~40 κουμπιά που το καθένα θα μπορούσε να το ξεχάσει.
    expect(isTableSessionKeepAliveElement(ribbonPanelWithButton())).toBe(true);
  });

  it('δεν αναγνωρίζει κουμπί εκτός σημαδεμένου panel', () => {
    expect(isTableSessionKeepAliveElement(plainRibbonButton())).toBe(false);
  });

  it('το σημάδι ΜΕΛΟΥΣ συνεδρίας ΔΕΝ μετράει ως keep-alive — είναι άλλη ερώτηση', () => {
    // «Είμαι μέλος» ⇒ μη δεσμεύσεις· «μη με κλείσεις» ⇒ **δέσμευσε** αλλά μείνε ζωντανός.
    // Αν τα δύο συγχέονταν, το «Β» θα εφάρμοζε έντονα σε κείμενο που δεν έχει γραφτεί ακόμη.
    const el = document.createElement('input');
    for (const [name, value] of Object.entries(TABLE_CELL_SESSION_MARKER)) el.setAttribute(name, value);
    document.body.appendChild(el);
    expect(isTableSessionKeepAliveElement(el)).toBe(false);
  });

  it('`null` / μη-στοιχείο ⇒ false, χωρίς σφάλμα', () => {
    expect(isTableSessionKeepAliveElement(null)).toBe(false);
  });
});

describe('🔴 useTableCellSessionBlur — κλικ σε κουμπί κορδέλας ενώ γράφεται κελί', () => {
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

  /**
   * 🔴 ΣΕΙΡΑ Α — `blur → rAF → click` (κανονικό κλικ, >16ms). **Εδώ ζει το ελάττωμα.**
   *
   * Ο φύλακας αποφασίζει **πριν** τρέξει ο χειριστής του κουμπιού. Χωρίς το keep-alive, εδώ
   * θα καλούσε `onClose()` — και καμία διόρθωση μέσα στο `click` δεν θα προλάβαινε.
   */
  it('ΣΕΙΡΑ Α (rAF ΠΡΙΝ το click): δεσμεύει, ΑΝΑΚΤΑ, ΔΕΝ κλείνει', () => {
    const button = ribbonPanelWithButton();
    button.focus();
    blurTo(button);

    act(() => { nextFrame(); });

    expect(commit).toHaveBeenCalledTimes(1);
    expect(reclaim).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  /** ΣΕΙΡΑ Β — `blur → click → rAF` (γρήγορο κλικ). Ίδιο αποτέλεσμα, από άλλη διαδρομή. */
  it('ΣΕΙΡΑ Β (click ΠΡΙΝ το rAF): δεσμεύει, ΑΝΑΚΤΑ, ΔΕΝ κλείνει', () => {
    const button = ribbonPanelWithButton();
    button.focus();
    blurTo(button);

    // Ο χειριστής του κουμπιού τρέχει εδώ (η εντολή μορφοποίησης). Δεν αγγίζει την εστίαση:
    // το `useLiveTableMutation` **δεν** γράφει δρομέα, ακριβώς για να μην κλέψει την εστίαση
    // από το κουμπί που μόλις πατήθηκε.
    act(() => { button.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    act(() => { nextFrame(); });

    expect(commit).toHaveBeenCalledTimes(1);
    expect(reclaim).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  /**
   * 🔴 Η ΜΙΣΗ ΠΡΟΔΙΑΓΡΑΦΗ: το σημάδι είναι **opt-in**, όχι καθολικό.
   *
   * Πατώντας «Αρχική → Γραμμή» ο χρήστης **φεύγει** από τον πίνακα. Μια καθολική εξαίρεση για
   * ολόκληρη την κορδέλα θα τον κρατούσε κλειδωμένο στη συνεδρία κελιού — και θα ήταν πολύ
   * χειρότερη από το ελάττωμα που διορθώνει.
   */
  it('🔴 κουμπί κορδέλας ΧΩΡΙΣ το σημάδι ⇒ δεσμεύει και ΚΛΕΙΝΕΙ κανονικά', () => {
    const button = plainRibbonButton();
    button.focus();
    blurTo(button);

    act(() => { nextFrame(); });

    expect(commit).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(reclaim).not.toHaveBeenCalled();
  });

  it('η εστίαση επιστρέφει σε ΜΕΛΟΣ πριν το καρέ ⇒ τίποτα, ούτε ανάκτηση', () => {
    // Ο πρώτος έλεγχος του `rAF` κερδίζει: αν το πληκτρολόγιο είναι ήδη πίσω στο κελί, μια
    // ανάκτηση θα πλήρωνε περιττό ξαναστήσιμο του `<textarea>` σε κάθε επιτυχημένη μετακίνηση.
    const button = ribbonPanelWithButton();
    button.focus();
    blurTo(button);

    const field = document.createElement('input');
    for (const [name, value] of Object.entries(TABLE_CELL_SESSION_MARKER)) field.setAttribute(name, value);
    document.body.appendChild(field);
    field.focus();

    act(() => { nextFrame(); });

    expect(reclaim).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});
