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
  consumesDirectionalKeys,
  consumesTypedCharacters,
  focusConsumesDirectionalKeys,
  focusConsumesTypedCharacters,
  inspectModalKeyboardScope,
  isDirectionalKey,
  isModalKeyboardScopeActive,
  isTextEntryFocused,
  isTextEntryTarget,
  pushModalKeyboardScope,
  shouldGlobalShortcutYield,
} from '../keyboard-scope';

/**
 * Προεπιλογή `'a'` — **εκτυπώσιμος** χαρακτήρας, δηλαδή η ερώτηση 2. Έτσι κάθε
 * προϋπάρχον assertion κρατά ακριβώς το νόημα που είχε πριν την ερώτηση 3, και τα
 * πλοηγικά πλήκτρα δηλώνονται **ρητά** εκεί που τα αφορά.
 */
function keyEvent(target: EventTarget | null, key = 'a'): Pick<KeyboardEvent, 'target' | 'key'> {
  return { target, key };
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

describe('consumesDirectionalKeys — ερώτηση 3: «θα καταναλώσει το βέλος;» (ADR-724)', () => {
  it('γνήσιο υπερσύνολο της ερώτησης 2', () => {
    // Ό,τι καταναλώνει χαρακτήρα καταναλώνει και βέλος (ο κέρσορας μέσα στο πεδίο).
    for (const el of [
      document.createElement('input'),
      document.createElement('select'),
      withRole('button', 'combobox'),
    ]) {
      expect(consumesTypedCharacters(el)).toBe(true);
      expect(consumesDirectionalKeys(el)).toBe(true);
    }
  });

  it('role="separator" → true — ΤΟ ΜΕΤΡΗΜΕΝΟ ΕΛΑΤΤΩΜΑ ΤΟΥ ADR-724', () => {
    // Ζωντανά: focus στο DIV[role=separator], 3× ArrowLeft → πλάτος 670→670 (τίποτα)
    // και offsetX 3883→4123, δηλαδή τα βέλη πάναραν το ΣΧΕΔΙΟ ~80px/πάτημα.
    expect(consumesDirectionalKeys(withRole('div', 'separator'))).toBe(true);
  });

  it.each(['slider', 'scrollbar', 'radio', 'radiogroup', 'tab', 'tablist', 'grid'])(
    'role="%s" → true στην ερώτηση 3, αλλά ΠΑΡΑΜΕΝΕΙ false στην ερώτηση 2',
    (role) => {
      const el = withRole('div', role);
      expect(consumesDirectionalKeys(el)).toBe(true);
      // Ο πήχης της υπερδιόρθωσης: ένας accelerator ΓΡΑΜΜΑΤΟΣ επιτρέπεται να τρέξει
      // με focus σε slider. Αν αυτό γίνει `true`, το §TYPEAHEAD_ROLES προειδοποιεί
      // ρητά ότι πεθαίνουν οι accelerators του viewer.
      expect(consumesTypedCharacters(el)).toBe(false);
    },
  );

  it('role="toolbar" → false — roving tabindex, το focus κάθεται στο ΚΟΥΜΠΙ', () => {
    // Και οι 12 `role="toolbar"` του repo είναι <nav> χωρίς tabIndex. Εγγραφή που δεν
    // πυροδοτείται ποτέ = ψεύτικη αίσθηση κάλυψης.
    expect(consumesDirectionalKeys(withRole('nav', 'toolbar'))).toBe(false);
  });

  it('σκέτο <button> / <div> → false (αλλιώς τα βέλη δεν παnάρουν ποτέ τον καμβά)', () => {
    expect(consumesDirectionalKeys(document.createElement('button'))).toBe(false);
    expect(consumesDirectionalKeys(document.createElement('div'))).toBe(false);
  });

  it('null / non-element → false', () => {
    expect(consumesDirectionalKeys(null)).toBe(false);
    expect(consumesDirectionalKeys(undefined)).toBe(false);
    expect(consumesDirectionalKeys(window)).toBe(false);
  });
});

describe('isDirectionalKey — ποιο πλήκτρο επιλέγει την ερώτηση 3', () => {
  it.each(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'])(
    '%s → true',
    (key) => expect(isDirectionalKey(key)).toBe(true),
  );

  it.each(['a', 'Escape', 'Enter', ' ', 'F6'])('%s → false', (key) => {
    expect(isDirectionalKey(key)).toBe(false);
  });

  it('Tab → false — πλοήγηση εστίασης του browser, ΟΧΙ πλήκτρο widget', () => {
    // Το ελάττωμα Ε1 του ADR-711 ήταν ακριβώς ότι κάποιος διεκδίκησε το Tab.
    expect(isDirectionalKey('Tab')).toBe(false);
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

  // ── ADR-724 §5.2 — REGRESSION GUARD ΤΟΥ ΜΕΤΡΗΜΕΝΟΥ ΕΛΑΤΤΩΜΑΤΟΣ (Φ1, 2026-07-28) ──
  //
  // Πριν: ο φύλακας ρωτούσε **μόνο** την ερώτηση 2 ⇒ `role="separator"` → `false` ⇒ ο
  // accelerator του viewer έκανε pan ±80px **και** `preventDefault()`, οπότε ο
  // element-level handler του `react-resizable-panels` (φάση bubble, ξεκινά με
  // `if (e.defaultPrevented) return;`) παραιτούνταν. Δηλαδή το πλάτος δεν άλλαζε ΚΑΙ
  // το σχέδιο έφευγε — με μία μόνο αιτία.
  //
  // ⚠️ Το jsdom δεν κάνει διάταξη, άρα εδώ κλειδώνεται **η απόφαση του φύλακα**, που
  // είναι η αιτία. Το ορατό αποτέλεσμα (πλάτος αλλάζει, σχέδιο ακίνητο) μετριέται ζωντανά.
  describe('πλοηγικά πλήκτρα — η ερώτηση εξαρτάται από το πλήκτρο', () => {
    it('παραιτείται σε ArrowLeft με στόχο τον splitter (το ελάττωμα ADR-724)', () => {
      const separator = withRole('div', 'separator');
      expect(shouldGlobalShortcutYield(keyEvent(separator, 'ArrowLeft'))).toBe(true);
    });

    it('δίχτυ: παραιτείται όταν ο splitter έχει την ΕΣΤΙΑΣΗ, ό,τι κι αν λέει ο στόχος', () => {
      const separator = withRole('div', 'separator');
      separator.tabIndex = 0;
      separator.focus();
      expect(document.activeElement).toBe(separator);
      expect(shouldGlobalShortcutYield(keyEvent(document.body, 'ArrowLeft'))).toBe(true);
      expect(focusConsumesDirectionalKeys()).toBe(true);
    });

    it.each(['ArrowUp', 'ArrowDown', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'])(
      'παραιτείται και σε %s — ο splitter τα δέχεται όλα',
      (key) => {
        expect(shouldGlobalShortcutYield(keyEvent(withRole('div', 'separator'), key))).toBe(true);
      },
    );

    it('ΔΕΝ παραιτείται σε ΓΡΑΜΜΑ πάνω στον splitter — μόνο τα βέλη του ανήκουν', () => {
      // Ο πήχης της υπερδιόρθωσης προς την άλλη κατεύθυνση: με εστίαση στο διαχωριστικό,
      // το «Z» (zoom) ή το «L» (γραμμή) πρέπει να φτάνουν κανονικά στον viewer.
      expect(shouldGlobalShortcutYield(keyEvent(withRole('div', 'separator'), 'z'))).toBe(false);
    });

    it('ΔΕΝ παραιτείται σε ArrowLeft πάνω στον καμβά — το pan παραμένει ζωντανό', () => {
      // Η μισή διόρθωση θα ήταν να παραιτείται ο accelerator από ΚΑΘΕ βέλος. Τότε δεν
      // θα υπήρχε ποτέ pan με πληκτρολόγιο — παλινδρόμηση, όχι διόρθωση.
      expect(shouldGlobalShortcutYield(keyEvent(document.createElement('canvas'), 'ArrowLeft')))
        .toBe(false);
    });

    it('το modal scope υπερισχύει και στα πλοηγικά πλήκτρα', () => {
      const release = pushModalKeyboardScope();
      expect(shouldGlobalShortcutYield(keyEvent(document.createElement('canvas'), 'ArrowLeft')))
        .toBe(true);
      release();
    });
  });
});
