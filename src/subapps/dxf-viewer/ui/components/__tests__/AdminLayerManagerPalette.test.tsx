/**
 * ADR-723 — Ο «Διαχειριστής Στρώσεων» ως modeless palette.
 *
 * ── ΤΙ ΦΥΛΑΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ──
 *
 * Τα δύο κατηγορήματα που **ορίζουν** τη διαφορά παλέτας/dialog. Και τα δύο είναι αόρατα σε
 * οπτικό έλεγχο — μοιάζουν ίδια στην οθόνη και αστοχούν μόνο όταν ο χρήστης προσπαθήσει να
 * δουλέψει:
 *
 *   1. **Ο καμβάς κρατά το πληκτρολόγιο.** Καμία ώθηση modal scope (ADR-711) ⇒ οι ~43 global
 *      accelerators του viewer συνεχίζουν να δουλεύουν όσο η παλέτα είναι ανοιχτή. Αυτό ΕΙΝΑΙ
 *      το αίτημα· αν σπάσει, η παλέτα ξαναγίνεται modal χωρίς να το δει κανείς.
 *   2. **Το ESC δεν ανήκει στην παλέτα.** Κλείνει μόνο όταν η εστίαση είναι ΜΕΣΑ της. Με
 *      εστίαση στον καμβά το ESC πρέπει να περνά ανέγγιχτο — είναι το «ακύρωση εντολής /
 *      αποεπιλογή», το συχνότερο πλήκτρο του σχεδιαστή.
 *
 * Τρέξε: `npx jest AdminLayerManagerPalette`
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';

// ── Mocks (πριν από τα imports των υπό δοκιμή μονάδων) ───────────────────────

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

// Το πραγματικό περιεχόμενο είναι lazy + βαρύ (Firestore, φίλτρα, 58 σειρές). Το κέλυφος
// είναι το αντικείμενο της δοκιμής· βάζουμε ένα εστιάσιμο στοιχείο για τον έλεγχο του ESC.
jest.mock('../LazyLoadWrapper', () => ({
  LazyAdminLayerManager: () => (
    <button type="button" data-testid="palette-inner-control">
      inner
    </button>
  ),
}));

import { AdminLayerManagerPalette } from '../AdminLayerManagerPalette';
import { LayerManagerPaletteStore } from '../../../stores/LayerManagerPaletteStore';
import { escapeBus } from '../../../systems/escape-bus';
import {
  inspectModalKeyboardScope,
  __resetModalKeyboardScopeForTests,
} from '@/lib/a11y/keyboard-scope';

const PALETTE_ID = 'dxf-layer-manager-palette';

function dispatchEscape(): boolean {
  const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
  let consumed = false;
  act(() => {
    consumed = escapeBus.__dispatchForTests(event).consumed;
  });
  return consumed;
}

beforeEach(() => {
  __resetModalKeyboardScopeForTests();
  LayerManagerPaletteStore.close();
  window.localStorage.clear();
});

afterEach(() => {
  LayerManagerPaletteStore.close();
});

describe('ορατότητα', () => {
  it('κλειστή ⇒ τίποτα στο DOM (κανένα listener, κανένα render των σειρών)', () => {
    render(<AdminLayerManagerPalette />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ανοιχτή ⇒ αποδίδεται', () => {
    render(<AdminLayerManagerPalette />);
    act(() => LayerManagerPaletteStore.open());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('το Ctrl+L ισοδύναμο (store.toggle) ανοίγει και κλείνει', () => {
    render(<AdminLayerManagerPalette />);
    act(() => LayerManagerPaletteStore.toggle());
    expect(screen.queryByRole('dialog')).toBeInTheDocument();
    act(() => LayerManagerPaletteStore.toggle());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ΚΑΤΗΓΟΡΗΜΑ 1 — ο καμβάς κρατά το πληκτρολόγιο', () => {
  it('ΔΕΝ ωθεί modal keyboard scope όσο είναι ανοιχτή', () => {
    render(<AdminLayerManagerPalette />);
    expect(inspectModalKeyboardScope().depth).toBe(0);

    act(() => LayerManagerPaletteStore.open());

    // Αν αυτό γίνει > 0, το `shouldGlobalShortcutYield` επιστρέφει `true` και ΚΑΘΕ global
    // accelerator του viewer πεθαίνει — δηλαδή η παλέτα έγινε ξανά modal.
    expect(inspectModalKeyboardScope().depth).toBe(0);
  });

  it('παραμένει 0 και μετά το κλείσιμο (κανένα ξεχασμένο βάθος)', () => {
    render(<AdminLayerManagerPalette />);
    act(() => LayerManagerPaletteStore.open());
    act(() => LayerManagerPaletteStore.close());
    expect(inspectModalKeyboardScope().depth).toBe(0);
  });
});

describe('ΚΑΤΗΓΟΡΗΜΑ 2 — το ESC δεν ανήκει στην παλέτα', () => {
  it('με εστίαση ΕΚΤΟΣ, το ESC ΔΕΝ κλείνει την παλέτα και ΔΕΝ καταναλώνεται', () => {
    render(
      <>
        <button type="button" data-testid="canvas-proxy">
          canvas
        </button>
        <AdminLayerManagerPalette />
      </>,
    );
    act(() => LayerManagerPaletteStore.open());

    screen.getByTestId('canvas-proxy').focus();
    const consumed = dispatchEscape();

    expect(consumed).toBe(false);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('με εστίαση ΜΕΣΑ, το ESC κλείνει την παλέτα', () => {
    render(<AdminLayerManagerPalette />);
    act(() => LayerManagerPaletteStore.open());

    screen.getByTestId('palette-inner-control').focus();
    const consumed = dispatchEscape();

    expect(consumed).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('κλειστή ⇒ κανένας handler εγγεγραμμένος στον bus', () => {
    render(<AdminLayerManagerPalette />);
    const ids = escapeBus.inspect().handlers.map((h) => h.id);
    expect(ids).not.toContain('layer-manager-palette');
  });

  it('ανοιχτή ⇒ ο handler ζει στο σκαλί των εστιασμένων παλετών', () => {
    render(<AdminLayerManagerPalette />);
    act(() => LayerManagerPaletteStore.open());
    const handler = escapeBus.inspect().handlers.find((h) => h.id === 'layer-manager-palette');
    expect(handler).toBeDefined();
    expect(handler?.priority).toBe(990);
  });
});

describe('προσβασιμότητα του κελύφους', () => {
  it('είναι NON-modal dialog με προσβάσιμο όνομα', () => {
    render(<AdminLayerManagerPalette />);
    act(() => LayerManagerPaletteStore.open());

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'false');
    // Το `aria-labelledby` πρέπει να δείχνει σε ΥΠΑΡΚΤΟ κόμβο με κείμενο — αλλιώς το
    // `role="dialog"` είναι ανώνυμο (παραβίαση axe «dialog must have accessible name»).
    expect(dialog).toHaveAccessibleName('layerManagerPalette.title');
  });

  it('δεν έχει backdrop — ο καμβάς παραμένει προσπελάσιμος με τον δείκτη', () => {
    const { container } = render(<AdminLayerManagerPalette />);
    act(() => LayerManagerPaletteStore.open());
    // Ο Radix Dialog θα είχε overlay με `fixed inset-0`. Η παλέτα δεν έχει κανένα.
    expect(container.querySelector('.inset-0')).toBeNull();
  });

  it('αποδίδει και τις 8 λαβές αλλαγής μεγέθους, όλες κρυμμένες από την υποστηρικτική τεχνολογία', () => {
    render(<AdminLayerManagerPalette />);
    act(() => LayerManagerPaletteStore.open());

    const handles = document.querySelectorAll(`#${PALETTE_ID} [data-resize-edge]`);
    expect(handles).toHaveLength(8);
    handles.forEach((handle) => expect(handle).toHaveAttribute('aria-hidden', 'true'));
  });

  it('η λαβή συρσίματος δεν είναι στάση πληκτρολογίου (δεν κάνει τίποτα με Enter)', () => {
    render(<AdminLayerManagerPalette />);
    act(() => LayerManagerPaletteStore.open());

    const dragHandle = document.querySelector(`#${PALETTE_ID} [data-drag-handle="true"]`);
    expect(dragHandle).not.toBeNull();
    expect(dragHandle).toHaveAttribute('aria-hidden', 'true');
    expect(dragHandle).not.toHaveAttribute('tabindex');
  });
});
