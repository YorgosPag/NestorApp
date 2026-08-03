/**
 * ADR-739 Φ.Ε βήμα 5 — **το mini toolbar μορφοποίησης των ζωνών δείκτη** (`TableFormatToolbar`)
 * + το roving tabindex του (`use-roving-toolbar`) + η ενσωμάτωσή του στο
 * `TableHeaderContextMenu`.
 *
 * ## 🔴 Γιατί ΠΡΑΓΜΑΤΙΚΟ i18next + το ΠΡΑΓΜΑΤΙΚΟ locale, όχι raw-key fallback
 * Το αδελφό `table-header-menu.test.tsx` δεν αρχικοποιεί ποτέ i18next και βασίζεται στο ότι
 * το `t()` γυρίζει το ίδιο το κλειδί όταν δεν υπάρχει φορτωμένος πόρος — αρκετό εκεί, γιατί
 * κανένα test του δεν χρειάζεται να δει **παρεμβολή** μέσα στο κείμενο. Εδώ όμως το §28.7.7
 * ζητά ρητά να αποδειχθεί ότι το `aria-label` του toolbar **περιέχει** την ετικέτα («A» / «3»)
 * — κάτι που το ωμό κλειδί (`table.formatToolbar.columnLabel`) ποτέ δεν θα δείξει, αφού δεν
 * κουβαλάει το `{label}` μέσα στα γράμματά του. Γι' αυτό εδώ φορτώνεται το ΙΔΙΟ αρχείο που
 * φορτώνει η παραγωγή (`el/dxf-viewer.json`) σε ξεχωριστό i18next instance + ICU (ίδιο μοτίβο
 * με `src/components/generic/__tests__/select-placeholder-contract.test.ts` και
 * `src/i18n/__tests__/use-translation-prefixed-key-resolution.test.tsx`) — πραγματική
 * παρεμβολή, όχι εφεύρεση.
 *
 * ## 🔴 ΤΟ ΚΡΙΣΙΜΟΤΕΡΟ (ρίσκο 1 του §28.7)
 * Το toolbar ζει σε ΔΙΚΟ ΤΟΥ portal, ξεκομμένο από το `DxfMenuContent` του Radix (απόφαση Α7 —
 * δες την κεφαλίδα του `TableFormatToolbar.tsx`). Άρα κάθε πάτημα κουμπιού φτάνει στο Radix
 * ως `pointerDownOutside`, και ο ΜΟΝΟΣ λόγος που δεν κλείνει το μενού είναι ο φύλακας
 * `keepOpenOnToolbar` στο `TableHeaderContextMenu`. Το πρώτο describe παρακάτω ασκεί ΤΗΝ ΙΔΙΑ
 * μηχανή του Radix που τρέχει σε παραγωγή (`@radix-ui/react-dismissable-layer`,
 * `usePointerDownOutside`): πραγματικό `pointerdown` στο κουμπί, μετά το ξέπλυμα του
 * `setTimeout(0)` με το οποίο ο ακροατής του Radix καταχωρείται στο `document` — χωρίς αυτό
 * το ξέπλυμα ο φύλακας δεν προλαβαίνει καν να «ακούει» και το test θα ήταν ψευδώς πράσινο.
 *
 * @see TableFormatToolbar.tsx — το component υπό δοκιμή
 * @see use-roving-toolbar.ts — το roving tabindex υπό δοκιμή
 * @see ../../TableHeaderContextMenu.tsx — ο φύλακας `keepOpenOnToolbar` (ρίσκο 1)
 * @see ../../../table-cell-editor/__tests__/table-header-menu.test.tsx — το ύφος που μιμείται αυτό το αρχείο
 */

import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import i18next from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import elDxfViewer from '@/i18n/locales/el/dxf-viewer.json';
import {
  TableFormatToolbar,
  type TableAxisFormatSnapshot,
  type TableFormatToolbarProps,
  type TableToggleFormatState,
} from '../TableFormatToolbar';
import {
  TableHeaderContextMenu,
  type TableHeaderContextMenuHandle,
} from '../../TableHeaderContextMenu';
import { isTableCellSessionElement } from '../../../table-cell-editor/table-cell-session-focus';

// Ίδιο μοτίβο με `use-translation-prefixed-key-resolution.test.tsx`: ο πραγματικός
// `loadNamespace` κάνει δυναμικό import αρχείων που δεν χρειάζονται εδώ — το bundle το
// δίνουμε ήδη έτοιμο παρακάτω μέσω `addResourceBundle`.
jest.mock('@/i18n/lazy-config', () => ({
  loadNamespace: jest.fn(() => Promise.resolve()),
  CRITICAL_NAMESPACES: [],
}));

const i18nInstance = i18next.createInstance();

beforeAll(async () => {
  await i18nInstance.use(initReactI18next).use(ICU).init({
    lng: 'el',
    fallbackLng: 'el',
    resources: {},
    react: { useSuspense: false },
    interpolation: { escapeValue: false },
  });
  // Το ΙΔΙΟ αρχείο που φορτώνει η παραγωγή — όχι χειροποίητα κλειδιά.
  i18nInstance.addResourceBundle('el', 'dxf-viewer', elDxfViewer, true, true);
});

function I18nWrapper({ children }: { children: React.ReactNode }): React.ReactElement {
  return <I18nextProvider i18n={i18nInstance}>{children}</I18nextProvider>;
}

const wrapper = { wrapper: I18nWrapper };

// ─── Βοηθοί κατάστασης μορφοποίησης ────────────────────────────────────────────

function fmt(active: boolean, mixed: boolean, explicit: boolean): TableToggleFormatState {
  return { active, mixed, explicit };
}

/** bold: ενεργό+ρητό· italic: μεικτό (όχι ρητό)· underline: τίποτα. */
const SAMPLE_FORMAT: TableAxisFormatSnapshot = {
  bold: fmt(true, false, true),
  italic: fmt(false, true, false),
  underline: fmt(false, false, false),
  canReset: true,
};

function renderToolbar(overrides: Partial<TableFormatToolbarProps> = {}) {
  const surfaceRef = React.createRef<HTMLDivElement>();
  const onToggle = jest.fn();
  const onStepSize = jest.fn();
  const onReset = jest.fn();

  const utils = render(
    <TableFormatToolbar
      anchorX={100}
      anchorY={200}
      axis="column"
      label="A"
      format={SAMPLE_FORMAT}
      surfaceRef={surfaceRef}
      onToggle={onToggle}
      onStepSize={onStepSize}
      onReset={onReset}
      {...overrides}
    />,
    wrapper,
  );

  return { ...utils, surfaceRef, onToggle, onStepSize, onReset };
}

/** Τα ΕΞΙ κουμπιά της γραμμής, με τη σειρά του DOM: Β, Π, Υ, Α↑, Α↓, ↺. */
function getToolbarButtons(): HTMLButtonElement[] {
  const toolbar = screen.getByRole('toolbar');
  return within(toolbar).getAllByRole('button') as HTMLButtonElement[];
}

describe('🔴 ΤΟ ΚΡΙΣΙΜΟΤΕΡΟ — ρίσκο 1 του §28.7: πάτημα «Β» ΔΕΝ κλείνει το μενού', () => {
  const noop = (): void => {};
  const NO_FORMAT: TableToggleFormatState = { active: false, mixed: false, explicit: false };
  /** Ό,τι χρειάζεται το `TableHeaderContextMenu` με αδρανείς χειριστές — βλ. sibling test. */
  const menuProps = {
    onInsertBefore: noop,
    onInsertAfter: noop,
    onDelete: noop,
    resolveState: () => ({ label: 'B', canInsert: true, canDelete: true }),
    resolveFormat: (): TableAxisFormatSnapshot => ({
      bold: NO_FORMAT, italic: NO_FORMAT, underline: NO_FORMAT, canReset: false,
    }),
    onStepTextHeight: noop,
    onResetFormat: noop,
  };

  it('🔴 «Β»: onToggleFormat(hit, "bold") κλήθηκε, onClosed ΔΕΝ κλήθηκε, το μενού μένει στο DOM', async () => {
    const onToggleFormat = jest.fn();
    const onClosed = jest.fn();
    const ref = React.createRef<TableHeaderContextMenuHandle>();
    const hit = { axis: 'column', colId: 'c1', index: 1 } as const;

    render(
      <TableHeaderContextMenu
        ref={ref}
        {...menuProps}
        onToggleFormat={onToggleFormat}
        onClosed={onClosed}
      />,
      wrapper,
    );
    await act(async () => { ref.current?.open(10, 10, hit); });

    // 🔴 Ξέπλυμα του `setTimeout(0)` με το οποίο το `usePointerDownOutside` του Radix
    // καταχωρεί τον ακροατή `pointerdown` στο `document`. Χωρίς αυτό, ο φύλακας
    // `keepOpenOnToolbar` δεν προλαβαίνει καν να κληθεί, και το test θα περνούσε ΨΕΥΔΩΣ
    // ακόμη κι αν ο φύλακας λείπει εντελώς (μηδενική κάλυψη κρυμμένη πίσω από πράσινο).
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    // 🔴 ΕΥΡΗΜΑ (boy scout, N.0.2): το `DropdownMenu` του Radix είναι `modal` από προεπιλογή
    // και καλεί `hideOthers()` (πακέτο `aria-hidden`) στο mount — σημαδεύει `aria-hidden="true"`
    // ΚΑΘΕ sibling κάτω από το `document.body` που δεν ανήκει στο δικό του δέντρο. Το toolbar
    // ζει σε ΔΙΚΟ ΤΟΥ portal (απόφαση Α7), άρα θεωρείται «άσχετο υπόβαθρο» και κρύβεται από
    // την προσβασιμότητα ΟΣΟ το μενού είναι ανοιχτό — πιθανό πραγματικό a11y κενό σε παραγωγή
    // (screen reader user δεν βλέπει καθόλου το toolbar), ΕΚΤΟΣ του σκοπού αυτού του task
    // (ρίσκο 1 §28.7 = το κλείσιμο του μενού, όχι η έκθεση σε assistive tech). Το
    // `{ hidden: true }` παρακάτω είναι επίτηδες: ζητά το ΚΟΥΜΠΙ που στ' αλήθεια υπάρχει στο
    // DOM και δέχεται συμβάντα ποντικιού, όχι αυτό που βλέπει ένας screen reader.
    const boldButton = screen.getByRole('button', { name: 'Έντονα', hidden: true });

    // Πραγματική χειρονομία ποντικιού: `pointerdown` (αυτό ενεργοποιεί τον φύλακα Radix) →
    // `pointerup` → `click` (αυτό καλεί το `onActivate` του κουμπιού).
    await act(async () => {
      fireEvent.pointerDown(boldButton, { pointerId: 1, isPrimary: true, button: 0 });
      fireEvent.pointerUp(boldButton, { pointerId: 1, isPrimary: true, button: 0 });
      fireEvent.click(boldButton);
    });

    expect(onToggleFormat).toHaveBeenCalledWith(hit, 'bold');
    expect(onClosed).not.toHaveBeenCalled();
    expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
    // `hidden: true` για τον ίδιο λόγο με το `boldButton` παραπάνω — δες το σχόλιο εκεί.
    expect(screen.getByRole('toolbar', { hidden: true })).toBeInTheDocument();
  });
});

describe('κατάσταση κουμπιών: aria-pressed + κουκκίδα ρητής τιμής', () => {
  it('active+explicit ⇒ aria-pressed="true" ΚΑΙ κουκκίδα', () => {
    renderToolbar();
    const bold = screen.getByRole('button', { name: 'Έντονα' });
    expect(bold).toHaveAttribute('aria-pressed', 'true');
    expect(bold.querySelector('.explicitDot')).not.toBeNull();
  });

  it('mixed (όχι explicit) ⇒ aria-pressed="mixed" ΧΩΡΙΣ κουκκίδα', () => {
    renderToolbar();
    const italic = screen.getByRole('button', { name: 'Πλάγια' });
    expect(italic).toHaveAttribute('aria-pressed', 'mixed');
    expect(italic.querySelector('.explicitDot')).toBeNull();
  });

  it('ούτε active ούτε mixed ούτε explicit ⇒ aria-pressed="false" ΧΩΡΙΣ κουκκίδα', () => {
    renderToolbar();
    const underline = screen.getByRole('button', { name: 'Υπογράμμιση' });
    expect(underline).toHaveAttribute('aria-pressed', 'false');
    expect(underline.querySelector('.explicitDot')).toBeNull();
  });
});

describe('roving tabindex (WAI-ARIA APG toolbar)', () => {
  it('μόνο ΕΝΑ κουμπί έχει tabIndex 0 στην αρχή — το πρώτο', () => {
    renderToolbar();
    const buttons = getToolbarButtons();
    expect(buttons).toHaveLength(6);
    expect(buttons[0]).toHaveAttribute('tabindex', '0');
    for (const button of buttons.slice(1)) {
      expect(button).toHaveAttribute('tabindex', '-1');
    }
  });

  it('ArrowRight μετακινεί την εστίαση στο επόμενο ΚΑΙ αλλάζει το tabIndex', () => {
    renderToolbar();
    const buttons = getToolbarButtons();

    act(() => { buttons[0].focus(); });
    fireEvent.keyDown(buttons[0], { key: 'ArrowRight' });

    expect(document.activeElement).toBe(buttons[1]);
    expect(buttons[1]).toHaveAttribute('tabindex', '0');
    expect(buttons[0]).toHaveAttribute('tabindex', '-1');
  });

  it('ArrowRight στο ΤΕΛΕΥΤΑΙΟ κουμπί κυκλώνει στο ΠΡΩΤΟ', () => {
    renderToolbar();
    const buttons = getToolbarButtons();
    const last = buttons[buttons.length - 1];

    act(() => { last.focus(); });
    fireEvent.keyDown(last, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(buttons[0]);
    expect(buttons[0]).toHaveAttribute('tabindex', '0');
  });

  it('ArrowLeft στο ΠΡΩΤΟ κουμπί κυκλώνει στο ΤΕΛΕΥΤΑΙΟ', () => {
    renderToolbar();
    const buttons = getToolbarButtons();

    act(() => { buttons[0].focus(); });
    fireEvent.keyDown(buttons[0], { key: 'ArrowLeft' });

    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });

  it('Home πάει στο πρώτο, End πάει στο τελευταίο', () => {
    renderToolbar();
    const buttons = getToolbarButtons();

    act(() => { buttons[2].focus(); });
    fireEvent.keyDown(buttons[2], { key: 'End' });
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);

    fireEvent.keyDown(buttons[buttons.length - 1], { key: 'Home' });
    expect(document.activeElement).toBe(buttons[0]);
  });

  /**
   * 🔴 §28.10.4 — αν αυτό αποτύχει, το `→`/`←` περνά στις καθολικές συντομεύσεις της
   * εφαρμογής (`consumesDirectionalKeys`) και μετακινεί την ΕΠΙΛΕΓΜΕΝΗ ΟΝΤΟΤΗΤΑ στον καμβά
   * ενώ ο χρήστης απλώς πλοηγείται στα κουμπιά της γραμμής εργαλείων.
   */
  it('🔴 το keydown έχει defaultPrevented===true ΚΑΙ ΔΕΝ διαδίδεται έξω από το toolbar', () => {
    renderToolbar();
    const buttons = getToolbarButtons();

    const outsideListener = jest.fn();
    document.addEventListener('keydown', outsideListener);

    let captured: KeyboardEvent | null = null;
    const captureListener = (event: Event): void => { captured = event as KeyboardEvent; };
    buttons[0].addEventListener('keydown', captureListener);

    try {
      act(() => { buttons[0].focus(); });
      fireEvent.keyDown(buttons[0], { key: 'ArrowRight' });

      expect(captured).not.toBeNull();
      // Ελέγχεται ΜΕΤΑ την πλήρη αποστολή (συγχρονο dispatchEvent) — το ίδιο αντικείμενο
      // συμβάντος αντανακλά το τελικό defaultPrevented ανεξαρτήτως σειράς ακροατών.
      expect((captured as unknown as KeyboardEvent).defaultPrevented).toBe(true);
      expect(outsideListener).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', outsideListener);
      buttons[0].removeEventListener('keydown', captureListener);
    }
  });
});

describe('σημάδι συνεδρίας: ΚΑΘΕ κουμπί, όχι μόνο το δοχείο', () => {
  it('όλα τα κουμπιά περνούν το isTableCellSessionElement — όχι σύγκριση αλφαριθμητικού', () => {
    renderToolbar();
    const buttons = getToolbarButtons();
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(isTableCellSessionElement(button)).toBe(true);
    }
  });

  it('το ίδιο το δοχείο (role=toolbar) ΔΕΝ αρκεί ΜΟΝΟ του — κάθε κουμπί φέρει το γνώρισμα', () => {
    renderToolbar();
    const toolbar = screen.getByRole('toolbar');
    const markedButtons = toolbar.querySelectorAll('button[data-table-cell-cursor="true"]');
    const allButtons = within(toolbar).getAllByRole('button');
    expect(markedButtons.length).toBe(allButtons.length);
  });
});

describe('«Επαναφορά στο στυλ»', () => {
  it('canReset:false ⇒ aria-disabled="true" ΚΑΙ το κλικ είναι no-op', () => {
    const { onReset } = renderToolbar({ format: { ...SAMPLE_FORMAT, canReset: false } });
    const reset = screen.getByRole('button', { name: 'Επαναφορά στο στυλ' });
    expect(reset).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(reset);
    expect(onReset).not.toHaveBeenCalled();
  });

  it('canReset:true ⇒ ενεργό, χωρίς aria-disabled, και το κλικ καλεί onReset', () => {
    const { onReset } = renderToolbar({ format: { ...SAMPLE_FORMAT, canReset: true } });
    const reset = screen.getByRole('button', { name: 'Επαναφορά στο στυλ' });
    expect(reset).not.toHaveAttribute('aria-disabled');

    fireEvent.click(reset);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe('τοποθέτηση: πάνω από το σημείο κλικ, ποτέ εκτός οθόνης', () => {
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    // jsdom γυρίζει μηδενικά από προεπιλογή· το `useToolbarPlacement` χρειάζεται πραγματικό
    // ύψος για να αποδειχθεί το clamp στην κορυφή.
    HTMLElement.prototype.getBoundingClientRect = jest.fn(function (
      this: HTMLElement,
    ): DOMRect {
      const height = this.getAttribute('role') === 'toolbar' ? 40 : 0;
      const width = this.getAttribute('role') === 'toolbar' ? 160 : 0;
      return {
        width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });
  });

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  it('κάθεται ΠΑΝΩ από το σημείο κλικ: top < anchorY', () => {
    renderToolbar({ anchorY: 200 });
    const toolbar = screen.getByRole('toolbar');
    expect(Number.parseFloat(toolbar.style.top)).toBeLessThan(200);
  });

  it('ΠΟΤΕ αρνητικό top όταν το κλικ είναι κοντά στην κορυφή (anchorY=2 ⇒ top >= 4)', () => {
    renderToolbar({ anchorY: 2 });
    const toolbar = screen.getByRole('toolbar');
    expect(Number.parseFloat(toolbar.style.top)).toBeGreaterThanOrEqual(4);
  });
});

describe('role="toolbar" + aria-orientation + aria-label με την ετικέτα', () => {
  it('στήλη «A»: role, orientation, ΚΑΙ το aria-label περιέχει το «A»', () => {
    renderToolbar({ axis: 'column', label: 'A' });
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
    expect(toolbar.getAttribute('aria-label')).toContain('A');
  });

  it('γραμμή «3»: το aria-label περιέχει το «3»', () => {
    renderToolbar({ axis: 'row', label: '3' });
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar.getAttribute('aria-label')).toContain('3');
  });
});
