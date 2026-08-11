/**
 * 🔴 ADR-753 §25.6 — **ΟΙ ΑΓΚΥΡΕΣ ΤΗΣ ΙΔΙΟΚΤΗΣΙΑΣ ΤΟΥ ΠΛΗΚΤΡΟΛΟΓΙΟΥ.**
 *
 * Το ελάττωμα: κλικ «Έντονα» με το ποντίκι ⇒ η εστίαση φεύγει στο κουμπί ⇒ το `Enter` ξαναπατά
 * το κουμπί αντί να δεσμεύσει το κελί. Επαληθευμένο ζωντανά (`aria-pressed` true→false).
 *
 * ## 🔴 ΤΟ ΟΡΓΑΝΟ — ΧΩΡΙΣ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΘΑ ΗΤΑΝ ΨΕΥΔΩΣ ΠΡΑΣΙΝΟ
 * **Το jsdom ΔΕΝ μεταφέρει την εστίαση στο `mousedown`.** Δηλαδή ένα test που απλώς κάνει
 * `fireEvent.mouseDown` και μετά ελέγχει «*το πεδίο κρατά ακόμη την εστίαση;*» περνά **και
 * χωρίς τη διόρθωση** — το ακριβές σχήμα «0 = κανείς δεν κοίταξε» που κυνηγά όλο το έργο.
 *
 * Γι' αυτό ο {@link pressPointer} **αναπαράγει ρητά** την προεπιλεγμένη ενέργεια του browser,
 * όπως μετρήθηκε ζωντανά σε πραγματικό Chrome (2026-08-11, το ίδιο κουμπί «Έντονα»):
 *
 * ```
 *   πραγματικό κλικ  →  mousedown(detail:1) → focusin(κουμπί) → mouseup → click(detail:1)
 *   Enter στο κουμπί →  keydown(Enter)      → click(detail:0) → keyup      (ΚΑΝΕΝΑ mousedown)
 * ```
 *
 * Και η **Ο1** αποδεικνύει ότι το όργανο *μπορεί* να αποτύχει: το ίδιο πάτημα πάνω σε σκέτο
 * `<button>` χωρίς φρουρό **παίρνει** την εστίαση. Χωρίς αυτή την άγκυρα, οι υπόλοιπες θα
 * ήταν ισχυρισμοί για μια μηχανή που κανείς δεν επαλήθευσε ότι μετράει.
 *
 * ## Γιατί ΔΥΟ οικογένειες αγκυρών και όχι μία με «ή»
 * Το §5 του handoff το ζητά ρητά: η διόρθωση του **ποντικιού** δεν επιτρέπεται να σπάσει το
 * **πληκτρολόγιο**, και μια μόνο άγκυρα δεν μπορεί να το δείξει. Οι `Π*` κρίνουν τον χρήστη
 * ποντικιού, οι `Κ*` τον χρήστη πληκτρολογίου (roving `Tab`/βέλη/`Enter`, WAI-ARIA APG).
 *
 * ⚠️ Οι `Π2`/`Π3` δεν είναι διακοσμητικές: μαζί με την `Π1` **καρφώνουν και τους δύο κλάδους**
 * του φρουρού. Μια υλοποίηση που κάνει `preventDefault` **πάντα** (το μοτίβο των ProseMirror /
 * Quill / Slate) κοκκινίζει στις `Π2`/`Π3`· μια που δεν το κάνει **ποτέ** κοκκινίζει στην `Π1`.
 * Δηλαδή το ζεύγος τους είναι η μετάλλαξη, γραμμένη ως απαίτηση.
 *
 * @see ../../../table-cell-editor/table-cell-keyboard-ownership.ts — ο ΕΝΑΣ ορισμός υπό δοκιμή
 * @see ../ToolbarButton.tsx — ο κύριος καταναλωτής
 * @see ../use-toolbar-panel.ts — η δεύτερη πόρτα (επιστροφή εστίασης στο κλείσιμο)
 */

import React from 'react';
import { act, createEvent, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ToolbarButton } from '../ToolbarButton';
import { useToolbarPanel } from '../use-toolbar-panel';
import { useRovingToolbar } from '../use-roving-toolbar';
import { TABLE_CELL_SESSION_MARKER } from '../../../table-cell-editor/table-cell-session-focus';
import {
  focusUnlessTableCellFieldOwnsKeyboard,
  keepTableCellKeyboardOwnership,
  tableCellFieldOwnsKeyboard,
} from '../../../table-cell-editor/table-cell-keyboard-ownership';

// ──────────────────────────────────────────────────────────────────────────────
// Το όργανο
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Ένα **πραγματικό** πάτημα ποντικιού, με την προεπιλεγμένη ενέργεια του browser
 * αναπαραγμένη ρητά — δες την κεφαλίδα για το γιατί είναι υποχρεωτική.
 */
function pressPointer(target: HTMLElement): boolean {
  const event = createEvent.mouseDown(target, { bubbles: true, cancelable: true, detail: 1 });
  fireEvent(target, event);
  // Η μεταφορά εστίασης είναι *προεπιλεγμένη ενέργεια* του `mousedown`: γίνεται **μόνο** αν
  // κανείς δεν την απέτρεψε. Αυτή ακριβώς η γραμμή είναι το ελάττωμα του §25.6.
  if (!event.defaultPrevented) target.focus();
  return event.defaultPrevented;
}

/**
 * Ενεργοποίηση με **πληκτρολόγιο**: `keydown` → `click(detail:0)` → `keyup`, **χωρίς**
 * `mousedown`. Δεν είναι απλοποίηση — είναι η μετρημένη ακολουθία (κεφαλίδα).
 */
function pressKeyboard(target: HTMLElement): void {
  fireEvent.keyDown(target, { key: 'Enter' });
  fireEvent.click(target, { detail: 0 });
  fireEvent.keyUp(target, { key: 'Enter' });
}

/** Ένα πεδίο της συνεδρίας που κρατά το πληκτρολόγιο — όπως το `<textarea>` του κελιού. */
function mountSessionField(): HTMLTextAreaElement {
  const field = document.createElement('textarea');
  field.setAttribute('data-table-cell-cursor', 'true');
  field.value = 'ΝΕΣΤΩΡ';
  document.body.appendChild(field);
  field.focus();
  field.setSelectionRange(2, 4);
  return field;
}

const ROVING = { ref: () => {}, tabIndex: 0 as const, onKeyDown: () => {}, onFocus: () => {} };

function renderBoldButton(onActivate = jest.fn()) {
  render(
    <TooltipProvider>
      <ToolbarButton roving={ROVING} title="Έντονα" onActivate={onActivate}>
        <span>B</span>
      </ToolbarButton>
    </TooltipProvider>,
  );
  return { button: screen.getByRole('button', { name: 'Έντονα' }), onActivate };
}

afterEach(() => {
  document.body.innerHTML = '';
});

// ──────────────────────────────────────────────────────────────────────────────
// Ο1 — το όργανο ΜΠΟΡΕΙ να αποτύχει
// ──────────────────────────────────────────────────────────────────────────────

describe('Ο1 — βαθμονόμηση του οργάνου', () => {
  it('σκέτο <button> χωρίς φρουρό ΠΑΙΡΝΕΙ την εστίαση από το πεδίο', () => {
    const field = mountSessionField();
    const plain = document.createElement('button');
    document.body.appendChild(plain);

    expect(document.activeElement).toBe(field);
    expect(pressPointer(plain)).toBe(false);
    // Αν αυτό αποτύχει, το όργανο δεν μετράει τίποτα και όλες οι Π* από κάτω είναι κενές.
    expect(document.activeElement).toBe(plain);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Π* — ο χρήστης ΠΟΝΤΙΚΙΟΥ
// ──────────────────────────────────────────────────────────────────────────────

describe('Π — το πάτημα του ποντικιού δεν μετακινεί το πληκτρολόγιο', () => {
  it('Π1 · πεδίο της συνεδρίας κρατά το πληκτρολόγιο ⇒ το κουμπί ΔΕΝ το παίρνει', () => {
    const field = mountSessionField();
    const { button, onActivate } = renderBoldButton();

    expect(pressPointer(button)).toBe(true);
    expect(document.activeElement).toBe(field);
    // Και η επιλογή επιβιώνει — γι' αυτό ακριβώς παγώνει η γραμμή τα γράμματα στο άνοιγμα.
    expect([field.selectionStart, field.selectionEnd]).toEqual([2, 4]);

    // Η εντολή εκτελείται κανονικά: ο φρουρός αφαιρεί εστίαση, όχι ενεργοποίηση.
    fireEvent.click(button, { detail: 1 });
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('Π2 · κανείς δεν κρατά το πληκτρολόγιο ⇒ το κουμπί εστιάζεται κανονικά (APG)', () => {
    const { button } = renderBoldButton();
    expect(tableCellFieldOwnsKeyboard()).toBe(false);

    expect(pressPointer(button)).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  it('Π3 · το πληκτρολόγιο το κρατά ΑΛΛΟ κουμπί της γραμμής ⇒ καμία αποτροπή', () => {
    // Το κουμπί φοράει κι αυτό το σημάδι της συνεδρίας — γι' αυτό ένα
    // `isTableCellSessionElement` θα απαντούσε λάθος εδώ (δες την κεφαλίδα του module).
    const sibling = document.createElement('button');
    Object.assign(sibling.dataset, { tableCellCursor: 'true' });
    document.body.appendChild(sibling);
    sibling.focus();

    const { button } = renderBoldButton();
    expect(pressPointer(button)).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  it('Π4 · η γραμμή ΤΥΠΩΝ είναι εξίσου πεδίο της συνεδρίας', () => {
    const bar = document.createElement('input');
    bar.type = 'text';
    Object.assign(bar.dataset, { tableCellCursor: 'true' });
    bar.value = 'ΝΕΣΤΩΡ';
    document.body.appendChild(bar);
    bar.focus();

    const { button } = renderBoldButton();
    expect(pressPointer(button)).toBe(true);
    expect(document.activeElement).toBe(bar);
  });

  it('Π5 · κέρσορας στη ΘΕΣΗ 0 μετράει — `!== null`, όχι αληθοφάνεια', () => {
    const field = mountSessionField();
    field.setSelectionRange(0, 0);
    const { button } = renderBoldButton();

    expect(pressPointer(button)).toBe(true);
    expect(document.activeElement).toBe(field);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Κ* — ο χρήστης ΠΛΗΚΤΡΟΛΟΓΙΟΥ (η ΧΩΡΙΣΤΗ άγκυρα που ζητά το §5)
// ──────────────────────────────────────────────────────────────────────────────

describe('Κ — η πλοήγηση με πληκτρολόγιο ΔΕΝ σπάει', () => {
  it('Κ1 · `Enter` σε εστιασμένο κουμπί ενεργοποιεί — καμία διαδρομή δεν περνά από `mousedown`', () => {
    mountSessionField();
    const { button, onActivate } = renderBoldButton();
    button.focus();

    const seen: string[] = [];
    button.addEventListener('mousedown', () => seen.push('mousedown'), true);

    pressKeyboard(button);

    expect(onActivate).toHaveBeenCalledTimes(1);
    // 🔑 Η απόδειξη ότι η ένταση του §1.4 δεν υπάρχει: ο φρουρός κάθεται σε συμβάν που η
    // ενεργοποίηση με πληκτρολόγιο δεν εκδίδει ΠΟΤΕ.
    expect(seen).toEqual([]);
    expect(document.activeElement).toBe(button);
  });

  it('Κ2 · τα βέλη του roving εξακολουθούν να μετακινούν την εστίαση', () => {
    function Bar(): React.ReactElement {
      const roving = useRovingToolbar(3);
      return (
        <TooltipProvider>
          {['Α', 'Β', 'Γ'].map((label, index) => (
            <ToolbarButton key={label} roving={roving.itemProps(index)} title={label} onActivate={() => {}}>
              <span>{label}</span>
            </ToolbarButton>
          ))}
        </TooltipProvider>
      );
    }
    render(<Bar />);
    const first = screen.getByRole('button', { name: 'Α' });
    const second = screen.getByRole('button', { name: 'Β' });

    act(() => first.focus());
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(second);

    // Και η μία στάση `Tab` της γραμμής μένει μία: ο δείκτης μετακινήθηκε, δεν διπλασιάστηκε.
    expect(first.tabIndex).toBe(-1);
    expect(second.tabIndex).toBe(0);
  });

  it('Κ3 · ο φρουρός δεν καταπίνει το συμβάν — μόνο την προεπιλεγμένη ενέργεια', () => {
    mountSessionField();
    const { button } = renderBoldButton();
    const bubbled: string[] = [];
    document.addEventListener('mousedown', () => bubbled.push('doc'));

    pressPointer(button);

    // Η λήξη των δηλώσεων (`installClaimExpiry`) και ο φύλακας `keepOpenOnToolbar` του Radix
    // ακούνε στο `document`: ένα `stopPropagation` εδώ θα τους σκότωνε σιωπηλά.
    expect(bubbled).toEqual(['doc']);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Ε* — η ΕΠΙΣΤΡΟΦΗ της εστίασης (η δεύτερη πόρτα)
// ──────────────────────────────────────────────────────────────────────────────

describe('Ε — το κλείσιμο πάνελ δεν κλέβει το πληκτρολόγιο', () => {
  it('Ε1 · πεδίο κρατά το πληκτρολόγιο ⇒ η επιστροφή σιωπά', () => {
    const field = mountSessionField();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);

    focusUnlessTableCellFieldOwnsKeyboard(trigger);
    expect(document.activeElement).toBe(field);
  });

  it('Ε2 · κανείς δεν το κρατά ⇒ η εστίαση γυρίζει στον trigger (APG)', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);

    focusUnlessTableCellFieldOwnsKeyboard(trigger);
    expect(document.activeElement).toBe(trigger);
  });

  it('Ε3 · ο ΙΔΙΟΣ κανόνας τρέχει μέσα από το `useToolbarPanel.close()`', () => {
    const field = mountSessionField();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);

    const { result } = renderHook(() => useToolbarPanel());
    act(() => {
      result.current.triggerRef.current = trigger;
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
    // Χωρίς τον κανόνα, εδώ θα ήταν ο `trigger` — και το §25.6 θα επέστρεφε από τη δεύτερη πόρτα.
    expect(document.activeElement).toBe(field);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Μ0 — ο ίδιος ο ορισμός
// ──────────────────────────────────────────────────────────────────────────────

describe('Μ0 — `tableCellFieldOwnsKeyboard` ξεχωρίζει ΠΕΔΙΟ από ΚΟΥΜΠΙ', () => {
  it('πεδίο ⇒ ναι · κουμπί με το ίδιο σημάδι ⇒ όχι · κανείς ⇒ όχι', () => {
    expect(tableCellFieldOwnsKeyboard()).toBe(false);

    const field = mountSessionField();
    expect(tableCellFieldOwnsKeyboard()).toBe(true);

    const marked = document.createElement('button');
    Object.assign(marked.dataset, { tableCellCursor: 'true' });
    document.body.appendChild(marked);
    marked.focus();
    expect(tableCellFieldOwnsKeyboard()).toBe(false);

    field.focus();
    expect(tableCellFieldOwnsKeyboard()).toBe(true);
  });

  it('το σημάδι της συνεδρίας είναι ο ΕΝΑΣ ορισμός — καμία δεύτερη ορθογραφία εδώ', () => {
    // Αν κάποιος μετονομάσει το γνώρισμα, αυτό το test πέφτει μαζί με την παραγωγή αντί να
    // μείνει πράσινο πάνω σε χειρόγραφο αντίγραφο του ονόματος.
    const field = document.createElement('textarea');
    Object.assign(field.dataset, {});
    Object.entries(TABLE_CELL_SESSION_MARKER).forEach(([key, value]) => {
      field.setAttribute(key, value);
    });
    document.body.appendChild(field);
    field.focus();
    expect(tableCellFieldOwnsKeyboard()).toBe(true);
  });

  it('ο φρουρός δεν αγγίζει συμβάν όταν δεν υπάρχει ιδιοκτήτης', () => {
    const calls: string[] = [];
    keepTableCellKeyboardOwnership({ preventDefault: () => calls.push('prevented') });
    expect(calls).toEqual([]);

    mountSessionField();
    keepTableCellKeyboardOwnership({ preventDefault: () => calls.push('prevented') });
    expect(calls).toEqual(['prevented']);
  });
});
