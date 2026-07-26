/**
 * @tests ADR-711 — keyboard scope SSoT
 *
 * ⚠️ ΤΙ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ: ότι το `Tab` κυκλώνει μέσα σε πραγματικό
 * dialog ή ότι τα βέλη δεν μετακινούν το viewport. Το jsdom δεν εκτελεί διαδοχική
 * πλοήγηση focus ούτε αποδίδει canvas. Αυτά μετρήθηκαν ζωντανά (ADR-364 §10.15).
 * Εδώ κλειδώνεται **η λογική** του predicate και του σωρού.
 */

import {
  __resetModalKeyboardScopeForTests,
  inspectModalKeyboardScope,
  isEditableTarget,
  isModalKeyboardScopeActive,
  pushModalKeyboardScope,
  shouldGlobalShortcutYield,
} from '../keyboard-scope';

function keyEvent(target: EventTarget | null): Pick<KeyboardEvent, 'target'> {
  return { target };
}

afterEach(() => {
  __resetModalKeyboardScopeForTests();
  document.body.innerHTML = '';
});

describe('isEditableTarget — ο SSoT των έξι αντιγράφων', () => {
  it.each([
    ['INPUT', true],
    ['TEXTAREA', true],
    ['BUTTON', false],
    ['DIV', false],
  ])('%s → %s', (tag, expected) => {
    const el = document.createElement(tag);
    expect(isEditableTarget(el)).toBe(expected);
  });

  it('πιάνει contenteditable="true"', () => {
    const el = document.createElement('div');
    el.setAttribute('contenteditable', 'true');
    expect(isEditableTarget(el)).toBe(true);
  });

  it('υπερσύνολο των παλιών: πιάνει και το κενό contenteditable=""', () => {
    const el = document.createElement('div');
    el.setAttribute('contenteditable', '');
    document.body.appendChild(el);
    // Κατά προδιαγραφή HTML ισοδυναμεί με `true`. Τα έξι προηγούμενα αντίγραφα
    // σύγκριναν μόνο με τη συμβολοσειρά 'true' και το έχαναν.
    // ⚠️ Το **κληρονομημένο** contenteditable ΔΕΝ ελέγχεται εδώ: το jsdom δεν
    // υλοποιεί το `isContentEditable`. Ισχύει μόνο σε πραγματικό browser.
    expect(isEditableTarget(el)).toBe(true);
  });

  it('null / non-element → false (δεν σκάει σε EventTarget χωρίς tagName)', () => {
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(undefined)).toBe(false);
    expect(isEditableTarget(window)).toBe(false);
  });
});

describe('modal keyboard scope — σωρός, όχι σημαία', () => {
  it('ξεκινά ανενεργό', () => {
    expect(isModalKeyboardScopeActive()).toBe(false);
    expect(inspectModalKeyboardScope().depth).toBe(0);
  });

  it('nested dialogs: το κλείσιμο του δεύτερου ΔΕΝ ξεκλειδώνει το πρώτο', () => {
    const releaseOuter = pushModalKeyboardScope();
    const releaseInner = pushModalKeyboardScope();
    expect(inspectModalKeyboardScope().depth).toBe(2);

    releaseInner();
    expect(isModalKeyboardScopeActive()).toBe(true); // ← η ουσία του σωρού

    releaseOuter();
    expect(isModalKeyboardScopeActive()).toBe(false);
  });

  it('η αποδέσμευση είναι ιδempotent (React StrictMode διπλό effect)', () => {
    const release = pushModalKeyboardScope();
    release();
    release();
    release();
    expect(inspectModalKeyboardScope().depth).toBe(0);
  });
});

describe('shouldGlobalShortcutYield — η μία ερώτηση των global accelerators', () => {
  it('παραιτείται όσο modal κατέχει το πληκτρολόγιο, ό,τι κι αν κρατά το focus', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();

    expect(shouldGlobalShortcutYield(keyEvent(button))).toBe(false);

    const release = pushModalKeyboardScope();
    // ΑΥΤΟ ΕΙΝΑΙ ΤΟ Ε1/Ε4: πριν το ADR-711 το focus σε <button> περνούσε τον φύλακα.
    expect(shouldGlobalShortcutYield(keyEvent(button))).toBe(true);

    release();
    expect(shouldGlobalShortcutYield(keyEvent(button))).toBe(false);
  });

  it('παραιτείται όταν ο στόχος είναι πεδίο κειμένου', () => {
    const input = document.createElement('input');
    expect(shouldGlobalShortcutYield(keyEvent(input))).toBe(true);
  });

  it('δίχτυ: παραιτείται όταν το activeElement είναι πεδίο, ακόμη κι αν ο στόχος δεν είναι', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(shouldGlobalShortcutYield(keyEvent(document.body))).toBe(true);
  });
});
