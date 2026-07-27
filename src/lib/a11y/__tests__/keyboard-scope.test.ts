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
  consumesTypedCharacters,
  focusConsumesTypedCharacters,
  inspectModalKeyboardScope,
  isModalKeyboardScopeActive,
  isTextEntryFocused,
  isTextEntryTarget,
  pushModalKeyboardScope,
  shouldGlobalShortcutYield,
} from '../keyboard-scope';

function keyEvent(target: EventTarget | null): Pick<KeyboardEvent, 'target'> {
  return { target };
}

/** Φτιάχνει element με ρόλο και το προσαρτά, ώστε το `focus()` να πιάνει. */
function withRole(tag: string, role: string): HTMLElement {
  const el = document.createElement(tag);
  el.setAttribute('role', role);
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  __resetModalKeyboardScopeForTests();
  document.body.innerHTML = '';
});

describe('isTextEntryTarget — ερώτηση 1: «γράφει ο χρήστης κείμενο;»', () => {
  it.each([
    ['INPUT', true],
    ['TEXTAREA', true],
    ['BUTTON', false],
    ['DIV', false],
    ['SELECT', false], // ← ΕΠΙΤΗΔΕΣ: το Escape σε dropdown πρέπει να κλείνει τον dialog
  ])('%s → %s', (tag, expected) => {
    const el = document.createElement(tag);
    expect(isTextEntryTarget(el)).toBe(expected);
  });

  it('πιάνει contenteditable="true"', () => {
    const el = document.createElement('div');
    el.setAttribute('contenteditable', 'true');
    expect(isTextEntryTarget(el)).toBe(true);
  });

  it('υπερσύνολο των παλιών: πιάνει και το κενό contenteditable=""', () => {
    const el = document.createElement('div');
    el.setAttribute('contenteditable', '');
    document.body.appendChild(el);
    // Κατά προδιαγραφή HTML ισοδυναμεί με `true`. Τα δέκα προηγούμενα αντίγραφα
    // σύγκριναν μόνο με τη συμβολοσειρά 'true' και το έχαναν.
    // ⚠️ Το **κληρονομημένο** contenteditable ΔΕΝ ελέγχεται εδώ: το jsdom δεν
    // υλοποιεί το `isContentEditable`. Ισχύει μόνο σε πραγματικό browser.
    expect(isTextEntryTarget(el)).toBe(true);
  });

  it.each(['textbox', 'searchbox'])('role="%s" → true (δηλωμένο πεδίο κειμένου)', (role) => {
    expect(isTextEntryTarget(withRole('div', role))).toBe(true);
  });

  it('role="combobox" → false — ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΟΥ ESCAPE BUS (ADR-364)', () => {
    // Αν αυτό γίνει `true`, το `Escape` με focus σε dropdown ΜΕΣΑ σε dialog παύει να
    // κλείνει τον dialog. Είναι ο λόγος που οι δύο ερωτήσεις είναι χωριστές.
    expect(isTextEntryTarget(withRole('button', 'combobox'))).toBe(false);
  });

  it('null / non-element → false (δεν σκάει σε EventTarget χωρίς tagName)', () => {
    expect(isTextEntryTarget(null)).toBe(false);
    expect(isTextEntryTarget(undefined)).toBe(false);
    expect(isTextEntryTarget(window)).toBe(false);
  });
});

describe('consumesTypedCharacters — ερώτηση 2: «θα καταναλώσει τον χαρακτήρα;»', () => {
  it('γνήσιο υπερσύνολο της ερώτησης 1', () => {
    for (const tag of ['input', 'textarea']) {
      const el = document.createElement(tag);
      expect(isTextEntryTarget(el)).toBe(true);
      expect(consumesTypedCharacters(el)).toBe(true);
    }
  });

  it('native <select> → true (type-ahead του browser· τα 47 legacy του repo)', () => {
    // Δεν έχει `role` attribute — ο έλεγχος tagName είναι ο ΜΟΝΟΣ τρόπος να φανεί.
    expect(consumesTypedCharacters(document.createElement('select'))).toBe(true);
  });

  it('Radix Select trigger `<button role="combobox">` → true — ΤΟ ΜΕΤΡΗΜΕΝΟ ΕΛΑΤΤΩΜΑ', () => {
    // ADR-711 §5.6, μετρημένο ζωντανά 2026-07-27: εδώ και οι ΔΥΟ προηγούμενες
    // υλοποιήσεις επέστρεφαν `false`, και η γραμμή εντολών έκλεβε το πλήκτρο.
    // Το canonical dropdown της εφαρμογής (ADR-001) είναι ΑΥΤΟ, σε 237 αρχεία.
    expect(consumesTypedCharacters(withRole('button', 'combobox'))).toBe(true);
  });

  it.each([
    ['listbox', 'div'],   // Radix SelectContent — μπορεί να κρατά το focus (content.focus())
    ['option', 'div'],    // ← το `activeElement` όσο το Radix Select είναι ΑΝΟΙΧΤΟ
    ['menu', 'div'],
    ['menubar', 'div'],
    ['menuitem', 'div'],
    ['menuitemcheckbox', 'div'],
    ['menuitemradio', 'div'],
    ['tree', 'div'],
    ['treeitem', 'div'],
    ['spinbutton', 'div'],
  ])('role="%s" → true (APG composite widget με type-ahead)', (role, tag) => {
    expect(consumesTypedCharacters(withRole(tag, role))).toBe(true);
  });

  it.each(['slider', 'radio', 'radiogroup', 'tab', 'tablist', 'grid'])(
    'role="%s" → false — πλοηγείται με ΒΕΛΗ, όχι με χαρακτήρα',
    (role) => {
      // Αν μπουν εδώ, οι global accelerators του viewer πεθαίνουν με focus πάνω τους.
      // Το react-hotkeys-hook περιλαμβάνει `slider`/`radio` — εκείνο απαντά άλλη ερώτηση.
      expect(consumesTypedCharacters(withRole('div', role))).toBe(false);
    },
  );

  it('σκέτο <button> / <div> → false (αλλιώς κάθε accelerator θα ήταν νεκρός)', () => {
    expect(consumesTypedCharacters(document.createElement('button'))).toBe(false);
    expect(consumesTypedCharacters(document.createElement('div'))).toBe(false);
  });

  it('null / non-element → false', () => {
    expect(consumesTypedCharacters(null)).toBe(false);
    expect(consumesTypedCharacters(undefined)).toBe(false);
    expect(consumesTypedCharacters(window)).toBe(false);
  });
});

describe('οι δύο αναγνώστες του activeElement — SSoT του πέμπτου αντιγράφου', () => {
  it('χωρίς focus → και οι δύο false', () => {
    expect(isTextEntryFocused()).toBe(false);
    expect(focusConsumesTypedCharacters()).toBe(false);
  });

  it('focus σε Radix trigger → ΜΟΝΟ η ερώτηση 2 απαντά true', () => {
    const trigger = withRole('button', 'combobox');
    trigger.tabIndex = 0;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    expect(isTextEntryFocused()).toBe(false);          // Escape → κλείσε τον dialog
    expect(focusConsumesTypedCharacters()).toBe(true); // «m» → type-ahead, μη το κλέψεις
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

  // ── ADR-711 §5.6 — REGRESSION GUARD ΤΟΥ ΜΕΤΡΗΜΕΝΟΥ ΕΛΑΤΤΩΜΑΤΟΣ (Μ2, 2026-07-27) ──
  //
  // Πριν: `shouldGlobalShortcutYield` ρωτούσε την ερώτηση 1 ⇒ `false` σε Radix trigger ⇒
  // η γραμμή εντολών (`useKeyboardShortcuts.ts`) άνοιγε με το πλήκτρο και το
  // `preventDefault` σκότωνε το type-ahead του Radix. Μετρημένο ζωντανά: «cm» + `m` → η
  // μονάδα έμενε «cm» και η γραμμή εντολών έδειχνε «M».
  //
  // ⚠️ Το jsdom ΔΕΝ εκτελεί type-ahead — εδώ κλειδώνεται **η απόφαση του φύλακα**, που
  // είναι η αιτία. Το ορατό αποτέλεσμα μετρήθηκε στον browser, όχι εδώ.
  it('παραιτείται σε Radix Select trigger — ο φύλακας που άφηνε τη γραμμή εντολών να κλέβει', () => {
    const trigger = withRole('button', 'combobox');
    expect(shouldGlobalShortcutYield(keyEvent(trigger))).toBe(true);
  });

  it('παραιτείται σε native <select> (type-ahead του browser)', () => {
    expect(shouldGlobalShortcutYield(keyEvent(document.createElement('select')))).toBe(true);
  });

  it('ΔΕΝ παραιτείται σε σκέτο <button> — αλλιώς κάθε accelerator του viewer θα ήταν νεκρός', () => {
    // Ο πήχης της υπερδιόρθωσης: role-based κάλυψη ΔΕΝ σημαίνει «κάθε button».
    expect(shouldGlobalShortcutYield(keyEvent(document.createElement('button')))).toBe(false);
  });
});
