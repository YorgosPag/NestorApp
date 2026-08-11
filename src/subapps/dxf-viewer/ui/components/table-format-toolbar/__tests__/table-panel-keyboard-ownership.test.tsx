/**
 * 🔴 ADR-753 §26.8 — **ΟΙ ΑΓΚΥΡΕΣ ΤΩΝ ΣΤΟΙΧΕΙΩΝ ΜΕΣΑ ΣΤΑ ΠΑΝΕΛ.**
 *
 * Το §25.6 έκλεισε για τα **κουμπιά της γραμμής** (δες `table-toolbar-keyboard-ownership.test`).
 * Εδώ κρίνεται η επόμενη επιφάνεια: τα δείγματα χρώματος, οι γραμμές λίστας και οι εντολές
 * μενού **μέσα** στα πτυσσόμενα. Το ζητούμενο είναι η συμπεριφορά του Excel — *διαλέγεις χρώμα,
 * ο δρομέας γυρίζει στο κελί* — **χωρίς** να χαλάσει η πλοήγηση με πληκτρολόγιο.
 *
 * ## 🔴 ΔΥΟ ΠΟΡΤΕΣ, ΟΧΙ ΜΙΑ — και η δεύτερη είναι ΑΟΡΑΤΗ στον φρουρό του §25.6
 * Η εστίαση φεύγει από το κελί με **δύο** εντελώς ανεξάρτητους τρόπους:
 *
 * ```
 *   πάτημα σε στοιχείο πάνελ  →  mousedown → (default action) → focus       ⟵ ο φρουρός του §25.6
 *   ΑΝΟΙΓΜΑ του πάνελ         →  React commitMount → item.focus()           ⟵ ΚΑΝΕΝΑ mousedown
 * ```
 *
 * Η δεύτερη είναι το `autoFocus`, που τα `ToolbarListPanel`/`TableMergeMenu`/`TablePasteMenu`
 * βάζουν **επίτηδες** στον πρώτο, ώστε να δουλεύουν τα βέλη (WAI-ARIA APG). Το `autoFocus` το
 * υλοποιεί **το ίδιο το React** καλώντας `.focus()` στο commit — δηλαδή τρέχει **και για τον
 * χρήστη ποντικιού**, χωρίς να εκδοθεί ποτέ `mousedown`. Η {@link Ο2} το **μετράει**: χωρίς
 * αυτήν, όλα τα `Σ*` θα ήταν σωστά και το ελάττωμα θα επιβίωνε ολόκληρο.
 *
 * ⚠️ Εδώ το jsdom είναι **έγκυρο** όργανο, σε αντίθεση με το `mousedown`: το `.focus()` του
 * `autoFocus` δεν είναι προεπιλεγμένη ενέργεια του browser (που το jsdom δεν έχει) — είναι
 * κώδικας του React, ο ίδιος και στα δύο περιβάλλοντα. Για τη διαδρομή του **ποντικιού** η
 * προεπιλεγμένη ενέργεια αναπαράγεται ρητά από τον {@link pressPointer}, όπως και στο §25.6.
 *
 * ## Γιατί ΔΥΟ οικογένειες αγκυρών
 * Οι `Σ*`/`Π*` κρίνουν τον χρήστη **ποντικιού**, οι `Κ*` τον χρήστη **πληκτρολογίου**. Το ζεύγος
 * τους **είναι** η μετάλλαξη: μια υλοποίηση που κόβει το `autoFocus` πάντα κοκκινίζει στις `Κ*`·
 * μια που το αφήνει πάντα κοκκινίζει στις `Α1`/`Π1`.
 *
 * @see ../../../table-cell-editor/table-cell-keyboard-ownership.ts — ο ΕΝΑΣ ορισμός υπό δοκιμή
 * @see ../use-toolbar-panel.ts — εκεί απαντιέται το «ποιος είχε το πληκτρολόγιο πριν ανοίξω;»
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import { act, createEvent, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { ToolbarListItem, ToolbarListPanel } from '../ToolbarListPanel';
import { useToolbarPanel } from '../use-toolbar-panel';
import { useRovingToolbar } from '../use-roving-toolbar';
import { TABLE_CELL_SESSION_MARKER } from '../../../table-cell-editor/table-cell-session-focus';
import { TABLE_CELL_PANEL_SURFACE } from '../../../table-cell-editor/table-cell-keyboard-ownership';

// ──────────────────────────────────────────────────────────────────────────────
// Το όργανο
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Ένα **πραγματικό** πάτημα ποντικιού: το jsdom δεν μεταφέρει την εστίαση στο `mousedown`, οπότε
 * η προεπιλεγμένη ενέργεια αναπαράγεται ρητά. Χωρίς αυτή τη γραμμή κάθε άγκυρα από κάτω θα
 * περνούσε **και χωρίς τη διόρθωση** — το σχήμα «0 = κανείς δεν κοίταξε».
 */
function pressPointer(target: HTMLElement): boolean {
  const event = createEvent.mouseDown(target, { bubbles: true, cancelable: true, detail: 1 });
  fireEvent(target, event);
  if (!event.defaultPrevented) target.focus();
  return event.defaultPrevented;
}

/** Το `<textarea>` του κελιού: κρατά το πληκτρολόγιο **και** μια επιλογή που πρέπει να επιβιώσει. */
function mountSessionField(): HTMLTextAreaElement {
  const field = document.createElement('textarea');
  field.setAttribute('data-table-cell-cursor', 'true');
  field.value = 'ΝΕΣΤΩΡ';
  document.body.appendChild(field);
  field.focus();
  field.setSelectionRange(2, 4);
  return field;
}

const OPTIONS = ['Αριστερά', 'Κέντρο', 'Δεξιά'] as const;

/**
 * Το **πραγματικό** πτυσσόμενο, φτιαγμένο από κώδικα παραγωγής: `useToolbarPanel` +
 * `ToolbarListPanel` + `ToolbarListItem` + `useRovingToolbar`, ακριβώς όπως τα συνθέτει το
 * `TableAlignMenu`. Κανένα fixture — αλλιώς οι άγκυρες θα έκριναν ένα αντίγραφο.
 */
function AlignLikeMenu({ onPick = jest.fn() }: { onPick?: (label: string) => void }): React.ReactElement {
  const control = useToolbarPanel();
  const listRoving = useRovingToolbar(OPTIONS.length, 'vertical');

  return (
    <span>
      <button
        type="button"
        ref={control.triggerRef}
        aria-haspopup="menu"
        aria-expanded={control.isOpen}
        onMouseDown={TABLE_CELL_PANEL_SURFACE.onMouseDown}
        onClick={control.toggle}
        {...TABLE_CELL_SESSION_MARKER}
      >
        Στοίχιση
      </button>
      {control.isOpen ? (
        <ToolbarListPanel panelId={control.panelId} label="Στοίχιση" role="menu" onKeyDown={control.onPanelKeyDown}>
          {OPTIONS.map((label, index) => (
            <ToolbarListItem
              key={label}
              role="menuitemradio"
              label={label}
              selected={index === 0}
              autoFocus={index === 0 && control.mayTakeKeyboard}
              roving={listRoving.itemProps(index)}
              onSelect={() => control.runAndClose(() => onPick(label))}
            />
          ))}
        </ToolbarListPanel>
      ) : null}
    </span>
  );
}

const trigger = (): HTMLElement => screen.getByRole('button', { name: 'Στοίχιση' });
const item = (name: string): HTMLElement => screen.getByRole('menuitemradio', { name });

afterEach(() => {
  document.body.innerHTML = '';
});

// ──────────────────────────────────────────────────────────────────────────────
// Ο* — ΒΑΘΜΟΝΟΜΗΣΗ: το όργανο ΜΠΟΡΕΙ να αποτύχει, και οι δύο πόρτες ΥΠΑΡΧΟΥΝ
// ──────────────────────────────────────────────────────────────────────────────

describe('Ο — βαθμονόμηση', () => {
  it('Ο1 · κουμπί σε πάνελ ΧΩΡΙΣ φρουρό παίρνει την εστίαση από το πεδίο', () => {
    const field = mountSessionField();
    const bare = document.createElement('div');
    const button = document.createElement('button');
    bare.appendChild(button);
    document.body.appendChild(bare);

    expect(pressPointer(button)).toBe(false);
    // Αν αυτό αποτύχει, τα Σ* από κάτω δεν μετρούν τίποτα.
    expect(document.activeElement).toBe(button);
    expect(document.activeElement).not.toBe(field);
  });

  it('Ο2 · 🔴 το `autoFocus` παίρνει την εστίαση ΧΩΡΙΣ κανένα `mousedown` — η ΔΕΥΤΕΡΗ πόρτα', () => {
    const field = mountSessionField();
    const seen: string[] = [];
    document.addEventListener('mousedown', () => seen.push('mousedown'), true);

    render(
      <ToolbarListPanel panelId="p" label="Στοίχιση" role="menu" onKeyDown={() => {}}>
        <ToolbarListItem role="menuitemradio" label="Αριστερά" selected autoFocus onSelect={() => {}} />
      </ToolbarListPanel>,
    );

    // 🔑 Η μέτρηση που ανατρέπει το «ο φρουρός του mousedown αρκεί»: η εστίαση έφυγε από το
    // πεδίο **χωρίς** να εκδοθεί ποτέ το συμβάν πάνω στο οποίο κάθεται ο φρουρός.
    expect(seen).toEqual([]);
    expect(document.activeElement).toBe(item('Αριστερά'));
    expect(document.activeElement).not.toBe(field);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Σ* — Η ΕΠΙΦΑΝΕΙΑ: ένας φρουρός στο δοχείο καλύπτει ό,τι είναι μέσα (ανάδυση)
// ──────────────────────────────────────────────────────────────────────────────

describe('Σ — ο φρουρός της επιφάνειας', () => {
  it('Σ1 · πάτημα σε στοιχείο ΜΕΣΑ στο πάνελ ⇒ το πεδίο κρατά πληκτρολόγιο ΚΑΙ επιλογή', () => {
    const field = mountSessionField();
    render(
      <ToolbarListPanel panelId="p" label="Στοίχιση" role="menu" onKeyDown={() => {}}>
        <ToolbarListItem role="menuitemradio" label="Κέντρο" selected={false} onSelect={() => {}} />
      </ToolbarListPanel>,
    );

    // Ο φρουρός ζει στο **δοχείο**, το πάτημα γίνεται στο **κουμπί**: αυτό που τα ενώνει είναι
    // η ανάδυση του `mousedown` — δηλαδή ΕΝΑΣ ακροατής, όχι ένας ανά χειριστήριο.
    expect(pressPointer(item('Κέντρο'))).toBe(true);
    expect(document.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual([2, 4]);
  });

  it('Σ2 · πάτημα σε ΒΑΘΙΑ ένθετο παιδί (το `<span>` της ετικέτας) καλύπτεται εξίσου', () => {
    const field = mountSessionField();
    render(
      <ToolbarListPanel panelId="p" label="Στοίχιση" role="menu" onKeyDown={() => {}}>
        <ToolbarListItem role="menuitemradio" label="Δεξιά" selected={false} onSelect={() => {}} />
      </ToolbarListPanel>,
    );
    const label = screen.getByText('Δεξιά');
    expect(label.tagName).toBe('SPAN');

    // Χωρίς την ανάδυση αυτό θα ήταν ακάλυπτο — και είναι ακριβώς το σημείο όπου προσγειώνεται
    // το δάχτυλο του χρήστη.
    expect(pressPointer(label)).toBe(true);
    expect(document.activeElement).toBe(field);
  });

  it('Σ3 · κανείς δεν κρατά το πληκτρολόγιο ⇒ καμία αποτροπή (APG)', () => {
    render(
      <ToolbarListPanel panelId="p" label="Στοίχιση" role="menu" onKeyDown={() => {}}>
        <ToolbarListItem role="menuitemradio" label="Κέντρο" selected={false} onSelect={() => {}} />
      </ToolbarListPanel>,
    );
    expect(pressPointer(item('Κέντρο'))).toBe(false);
    expect(document.activeElement).toBe(item('Κέντρο'));
  });

  it('Σ4 · ο φρουρός δεν καταπίνει το συμβάν — μόνο την προεπιλεγμένη ενέργεια', () => {
    mountSessionField();
    render(
      <ToolbarListPanel panelId="p" label="Στοίχιση" role="menu" onKeyDown={() => {}}>
        <ToolbarListItem role="menuitemradio" label="Κέντρο" selected={false} onSelect={() => {}} />
      </ToolbarListPanel>,
    );
    const bubbled: string[] = [];
    document.addEventListener('mousedown', () => bubbled.push('doc'));

    pressPointer(item('Κέντρο'));

    // Οι φύλακες που κλείνουν εφήμερες επιφάνειες ακούνε στο `document`: ένα `stopPropagation`
    // εδώ θα τους σκότωνε σιωπηλά.
    expect(bubbled).toEqual(['doc']);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Α* — Η ΔΕΥΤΕΡΗ ΠΟΡΤΑ: το `autoFocus` υπό όρο ιδιοκτησίας
// ──────────────────────────────────────────────────────────────────────────────

describe('Α — το `autoFocus` ρωτά ποιος είχε το πληκτρολόγιο ΠΡΙΝ ανοίξει το πάνελ', () => {
  it('Α1 · το κελί γράφει ⇒ το άνοιγμα ΔΕΝ παίρνει το πληκτρολόγιο', () => {
    const field = mountSessionField();
    render(<AlignLikeMenu />);

    // Πραγματικό πάτημα στον trigger: ο φρουρός του §25.6 κρατά την εστίαση στο πεδίο…
    expect(pressPointer(trigger())).toBe(true);
    fireEvent.click(trigger(), { detail: 1 });

    // …και το `autoFocus` **δεν** την κλέβει από τη δεύτερη πόρτα.
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(document.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual([2, 4]);
  });

  it('Α2 · ο trigger είχε την εστίαση (πληκτρολόγιο) ⇒ ο πρώτος εστιάζεται κανονικά', () => {
    render(<AlignLikeMenu />);
    act(() => trigger().focus());

    fireEvent.click(trigger(), { detail: 0 });

    expect(document.activeElement).toBe(item('Αριστερά'));
  });

  it('Α3 · η απάντηση παγώνει στο ΑΝΟΙΓΜΑ — δεν ξαναρωτιέται όσο το πάνελ ζει', () => {
    const field = mountSessionField();
    render(<AlignLikeMenu />);
    pressPointer(trigger());
    fireEvent.click(trigger(), { detail: 1 });
    expect(document.activeElement).toBe(field);

    // Ο χρήστης μετακινείται μέσα στη λίστα με το χέρι· η απόφαση του ανοίγματος **δεν**
    // επανεκτιμάται, αλλιώς θα ήταν κατηγόρημα που επικυρώνει τον εαυτό του (§26.8).
    act(() => item('Κέντρο').focus());
    fireEvent.keyDown(item('Κέντρο'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(item('Αριστερά'));
  });

  it('Α4 · κάθε άνοιγμα ρωτά ΑΠΟ ΤΗΝ ΑΡΧΗ — η απάντηση δεν επιβιώνει του κλεισίματος', () => {
    const field = mountSessionField();
    render(<AlignLikeMenu />);

    // 1ο άνοιγμα: με ποντίκι ενώ το κελί γράφει ⇒ καμία εστίαση στο πάνελ.
    pressPointer(trigger());
    fireEvent.click(trigger(), { detail: 1 });
    expect(document.activeElement).toBe(field);
    fireEvent.click(trigger(), { detail: 1 });
    expect(screen.queryByRole('menu')).toBeNull();

    // 2ο άνοιγμα: το πεδίο έχει φύγει από τη μέση ⇒ η ίδια ερώτηση δίνει άλλη απάντηση.
    field.remove();
    act(() => trigger().focus());
    fireEvent.click(trigger(), { detail: 0 });
    expect(document.activeElement).toBe(item('Αριστερά'));
  });

  it('Α5 · **κλειστό** πάνελ δεν δικαιούται ποτέ το πληκτρολόγιο', () => {
    // Καρφώνει τη διακριτή ένωση του `useToolbarPanel`: όσο υπήρχε επίπεδο αντικείμενο, η τιμή
    // στο κλειστό state ήταν μη παρατηρήσιμη — μετάλλαξή της σε `true` άφηνε τα πάντα πράσινα.
    // Αν κάποιος επιστρέψει σε ένα flat state, αυτή η γραμμή πέφτει πρώτη.
    const { result } = renderHook(() => useToolbarPanel());
    expect(result.current).toMatchObject({ isOpen: false, mayTakeKeyboard: false });

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.close());
    expect(result.current).toMatchObject({ isOpen: false, mayTakeKeyboard: false });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Π* — Η ΠΛΗΡΗΣ ΡΟΗ ΤΟΥ ΧΡΗΣΤΗ ΠΟΝΤΙΚΙΟΥ (το κριτήριο τέλους §1.6.1)
// ──────────────────────────────────────────────────────────────────────────────

describe('Π — Excel parity: διαλέγεις, και ο δρομέας είναι ήδη στο κελί', () => {
  it('Π1 · άνοιγμα → επιλογή → κλείσιμο, με την εστίαση ΚΑΙ την επιλογή ανέπαφες', () => {
    const field = mountSessionField();
    const onPick = jest.fn();
    render(<AlignLikeMenu onPick={onPick} />);

    pressPointer(trigger());
    fireEvent.click(trigger(), { detail: 1 });

    // Το πάτημα στο δείγμα/γραμμή δεν μετακινεί το πληκτρολόγιο…
    expect(pressPointer(item('Κέντρο'))).toBe(true);
    fireEvent.click(item('Κέντρο'), { detail: 1 });

    // …η εντολή τρέχει, το πάνελ κλείνει…
    expect(onPick).toHaveBeenCalledWith('Κέντρο');
    expect(screen.queryByRole('menu')).toBeNull();
    // …και το `close()` **δεν** τραβά την εστίαση στον trigger, γιατί ποτέ δεν του την έδωσε
    // κανείς. Καμία επαναφορά, κανένας αγώνας δρόμου: απλώς δεν έφυγε ποτέ.
    expect(document.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual([2, 4]);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Κ* — Ο ΧΡΗΣΤΗΣ ΠΛΗΚΤΡΟΛΟΓΙΟΥ (η ΧΩΡΙΣΤΗ άγκυρα του §1.6.2)
// ──────────────────────────────────────────────────────────────────────────────

describe('Κ — η πλοήγηση με πληκτρολόγιο ΔΕΝ σπάει', () => {
  it('Κ1 · άνοιγμα με πληκτρολόγιο → βέλη → `Enter` → η εστίαση γυρίζει στον trigger (APG)', () => {
    const onPick = jest.fn();
    render(<AlignLikeMenu onPick={onPick} />);
    act(() => trigger().focus());

    fireEvent.click(trigger(), { detail: 0 });
    expect(document.activeElement).toBe(item('Αριστερά'));

    fireEvent.keyDown(item('Αριστερά'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item('Κέντρο'));

    fireEvent.click(item('Κέντρο'), { detail: 0 });
    expect(onPick).toHaveBeenCalledWith('Κέντρο');
    // Χωρίς αυτό ο χρήστης πληκτρολογίου μένει σε κόμβο που μόλις ξεμόνταρε και το επόμενο
    // `Tab` ξεκινά από την αρχή της σελίδας.
    expect(document.activeElement).toBe(trigger());
  });

  it('Κ2 · `Escape` μέσα στο πάνελ κλείνει ΕΝΑ επίπεδο και επιστρέφει στον trigger', () => {
    render(<AlignLikeMenu />);
    act(() => trigger().focus());
    fireEvent.click(trigger(), { detail: 0 });

    fireEvent.keyDown(item('Αριστερά'), { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('Κ3 · η ενεργοποίηση με πληκτρολόγιο δεν περνά ΠΟΤΕ από `mousedown`', () => {
    mountSessionField();
    render(<AlignLikeMenu />);
    act(() => trigger().focus());
    const seen: string[] = [];
    document.addEventListener('mousedown', () => seen.push('mousedown'), true);

    fireEvent.keyDown(trigger(), { key: 'Enter' });
    fireEvent.click(trigger(), { detail: 0 });

    // 🔑 Γι' αυτό ο φρουρός είναι δομικά αδύνατο να βλάψει τον χρήστη πληκτρολογίου: κάθεται σε
    // συμβάν που αυτή η διαδρομή δεν εκδίδει.
    expect(seen).toEqual([]);
    expect(document.activeElement).toBe(item('Αριστερά'));
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Δ* — ΔΟΜΙΚΗ ΑΓΚΥΡΑ: καμία ΕΚΤΗ επιφάνεια δεν γεννιέται χωρίς φρουρό
// ──────────────────────────────────────────────────────────────────────────────

describe('Δ — κάθε ρίζα πάνελ φοράει την επιφάνεια', () => {
  const FOLDER = path.join(__dirname, '..');

  /**
   * Η ρίζα ενός πάνελ αναγνωρίζεται από το `id={…panelId}` — το γνώρισμα που την κάνει στόχο του
   * `aria-controls` του trigger, δηλαδή **ο ορισμός** του «είμαι πάνελ». Η άγκυρα απαιτεί να
   * συνοδεύεται από `{...TABLE_CELL_PANEL_SURFACE}` στο **ίδιο** αρχείο και σε ίσο πλήθος.
   *
   * ⚠️ Χωρίς αυτήν, μια έκτη επιφάνεια θα προσγειωνόταν με τα `Σ*` **πράσινα**: εκείνα κρίνουν
   * τις επιφάνειες που ήδη ξέρουν, όχι αυτές που δεν γράφτηκαν ακόμη.
   */
  const files = fs.readdirSync(FOLDER).filter((name) => name.endsWith('.tsx'));

  it.each(files)('%s — τόσες ρίζες πάνελ όσοι και φρουροί', (name) => {
    const source = fs.readFileSync(path.join(FOLDER, name), 'utf8');
    const roots = source.match(/id=\{[A-Za-z.]*panelId\}/g)?.length ?? 0;
    const guards = source.match(/\{\.\.\.TABLE_CELL_PANEL_SURFACE\}/g)?.length ?? 0;
    expect({ file: name, roots, guards }).toEqual({ file: name, roots, guards: roots });
  });

  it('Δ0 · η άγκυρα ΜΠΟΡΕΙ να αποτύχει — και μετράει τις πραγματικές πέντε επιφάνειες', () => {
    const total = files.reduce((sum, name) => {
      const source = fs.readFileSync(path.join(FOLDER, name), 'utf8');
      return sum + (source.match(/\{\.\.\.TABLE_CELL_PANEL_SURFACE\}/g)?.length ?? 0);
    }, 0);
    // ToolbarListPanel (στοίχιση + γραμματοσειρά + μέγεθος) · συγχώνευση · επικόλληση ·
    // περιγράμματα (μαζί με τα flyout του μολυβιού) · χρωματολόγιο (μαζί με τα 78 δείγματα).
    expect(total).toBe(5);
  });
});
