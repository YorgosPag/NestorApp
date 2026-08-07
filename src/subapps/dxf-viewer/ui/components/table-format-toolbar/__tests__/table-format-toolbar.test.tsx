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
  type TableFormatSnapshot,
  type TableFormatToolbarProps,
  type TableToggleFormatState,
} from '../TableFormatToolbar';
import type { TableAxisColorState } from '../table-color-menu-selection';
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

/** ADR-739 Φ.Ε/Φ4 — άξονας χωρίς ρητό χρώμα: ενεργό είναι το «Αυτόματο». */
const INHERITED_TEXT_COLOR: TableAxisColorState = {
  current: '#111111',
  mixed: false,
  explicit: false,
  inheritedColor: '#111111', inheritedMixed: false,
  drawingColors: ['#111111', '#0000ff'],
};

/**
 * ADR-739 Φ.Ε/Φ4β — ο **προεπιλεγμένος** άξονας γεμίσματος: κληρονομεί, και κληρονομεί **κενό**.
 *
 * Δεν είναι εξεζητημένη περίπτωση — είναι η πιο συνηθισμένη: το στυλ `standard` βάφει μόνο την
 * κεφαλίδα, οπότε μια στήλη δεδομένων ξεκινά ακριβώς από εδώ. Και είναι η κατάσταση που
 * ζωγραφίζει **ολόιδια** με το «Κανένα γέμισμα».
 */
const INHERITED_NO_FILL: TableAxisColorState = {
  current: undefined,
  mixed: false,
  explicit: false,
  inheritedColor: undefined, inheritedMixed: false,
  drawingColors: ['#ededed'],
};

/** bold: ενεργό+ρητό· italic: μεικτό (όχι ρητό)· underline: τίποτα. */
const SAMPLE_FORMAT: TableFormatSnapshot = {
  bold: fmt(true, false, true),
  italic: fmt(false, true, false),
  underline: fmt(false, false, false),
  textColor: INHERITED_TEXT_COLOR,
  fillColor: INHERITED_NO_FILL,
  canReset: true,
};

/**
 * ADR-755 / §52 — τα οκτώ props μορφοποίησης ταξιδεύουν ως **ένα** αντικείμενο (`format` του
 * component· `formatSection` εδώ, για να μη συγκρούεται με τη συντόμευση του στιγμιότυπου),
 * ώστε το τμήμα να μπορεί να λείπει ολόκληρο όταν δεν υπάρχει στόχος.
 *
 * Ο helper δέχεται και τις **παλιές** συντομεύσεις (`format`, `axis`) και τις μεταφράζει: οι
 * είκοσι υπάρχουσες δοκιμές ρωτούν «τι κάνει αυτό το κουμπί», όχι «πώς συσκευάζονται τα props»,
 * και μια μαζική επανεγγραφή τους θα άλλαζε είκοσι σημεία για μηδέν επιπλέον απόδειξη.
 */
type ToolbarOverrides = Omit<Partial<TableFormatToolbarProps>, 'format'> & {
  /** Συντόμευση: μόνο το **στιγμιότυπο**, με αδρανείς χειριστές γύρω του. */
  readonly format?: TableFormatSnapshot;
  /**
   * Ολόκληρο το τμήμα, όταν το test θέλει δικούς του χειριστές.
   *
   * ⚠️ `null` = **«λείπει»** (το prop δεν περνιέται καθόλου). Δεν χρησιμοποιείται `undefined`
   * γιατί εκείνο είναι η **απουσία override**, δηλαδή «δώσε το προεπιλεγμένο τμήμα» — και η
   * σύγχυση των δύο θα έκανε το test «λείπει ολόκληρο» να ελέγχει τα αντίθετα από όσα λέει.
   */
  readonly formatSection?: TableFormatToolbarProps['format'] | null;
  readonly axis?: TableFormatToolbarProps['scope'];
};

function renderToolbar(overrides: ToolbarOverrides = {}) {
  const surfaceRef = React.createRef<HTMLDivElement>();
  const onToggle = jest.fn();
  const onStepSize = jest.fn();
  const onReset = jest.fn();
  const onSetTextColor = jest.fn();
  const onSetFillColor = jest.fn();

  const { format, axis, formatSection, ...rest } = overrides;

  const utils = render(
    <TableFormatToolbar
      anchorX={100}
      anchorY={200}
      scope={axis ?? 'column'}
      label="A"
      surfaceRef={surfaceRef}
      format={formatSection === null ? undefined : formatSection ?? {
        format: format ?? SAMPLE_FORMAT,
        onToggle,
        onStepSize,
        onReset,
        onSetTextColor,
        onSetFillColor,
      }}
      {...rest}
    />,
    wrapper,
  );

  return {
    ...utils, surfaceRef, onToggle, onStepSize, onReset, onSetTextColor, onSetFillColor,
  };
}

/**
 * Τα ΕΝΤΕΚΑ κουμπιά που δίνει **μόνο** το τμήμα μορφοποίησης, με τη σειρά του DOM:
 * ```
 *   σειρά 1:  Α↑  Α↓
 *   σειρά 2:  Β  Π │ **🪣 (γέμισμα), ▾**  **Α (κείμενο), ▾**  πινέλο ‖ Υ  ↺
 * ```
 * ⚠️ **Ήταν δέκα σε μία σειρά μέχρι το §55** (Β, Π, Υ, Α▾, 🪣▾, Α↑, Α↓, ↺). Άλλαξαν τρία
 * πράγματα, όλα με ρητή εντολή του ιδιοκτήτη για διάταξη **1:1 με το Excel**: δύο σειρές· το
 * γέμισμα **πριν** το χρώμα κειμένου· και δύο νέες θέσεις χωρίς πράξη (αναδίπλωση, πινέλο) που
 * κρατούν τη θέση τους στη σειρά του Excel μέχρι να αποκτήσουν λειτουργία.
 *
 * 🔴 **ΕΓΙΝΑΝ ΔΩΔΕΚΑ ΚΑΙ ΞΑΝΑΕΓΙΝΑΝ ΕΝΤΕΚΑ (§58 Γ2)** — και η μείωση **δεν** είναι αφαίρεση
 * λειτουργίας, είναι το αντίθετο: η αναδίπλωση απέκτησε μηχανή, βγήκε από το
 * `TableFormatSection` (δεν διάβαζε ποτέ τίποτα από το `format`) και ζει πλέον σε **δικό της**
 * προαιρετικό τμήμα του δοχείου, μαζί με τη σμίκρυνση. Αυτός εδώ ο ξενιστής δίνει **μόνο**
 * `format`, οπότε το τμήμα του ξεχειλίσματος δεν αποδίδεται καθόλου — ακριβώς ο κανόνας «απόν
 * διαμέρισμα ⇒ μηδέν κουμπιά, μηδέν θέσεις roving». Η πλήρης διάταξη ελέγχεται στο
 * `table-format-toolbar-rows.test.tsx`.
 *
 * ⚠️ Κάθε χρώμα είναι **δύο** κουμπιά, όχι ένα: split button — το κύριο μισό εφαρμόζει το
 * τελευταίο χρώμα χωρίς μενού, το βελάκι ανοίγει την παλέτα (πρότυπο Excel).
 */
function getToolbarButtons(): HTMLButtonElement[] {
  const toolbar = screen.getByRole('toolbar');
  return within(toolbar).getAllByRole('button') as HTMLButtonElement[];
}

/**
 * 🔴 ΑΝΑΤΡΟΠΗ ΙΔΙΟΚΤΗΤΗ (2026-08-03): πάτημα ⇒ ΕΚΤΕΛΕΙ, φεύγει **ΜΟΝΟ το μενού**, η γραμμή ΜΕΝΕΙ.
 *
 * Αυτό το describe έλεγε «πάτημα «Β» ΔΕΝ κλείνει το μενού» και κλείδωνε το ρίσκο 1 του §28.7.
 * Ο ιδιοκτήτης το ανέτρεψε σε **δύο** βήματα, μέσα στην ίδια συνεδρία:
 *   1. «να κλείνει το κάτω μενού, όπως στο Excel»
 *   2. «**δεν** θέλω να εξαφανίζονται και τα δύο — **μόνον το μενού**»
 * Το (2) είναι το τελικό συμβόλαιο και είναι πιστότερο στο Excel: μία εντολή διώχνει το
 * context menu, η γραμμή μορφοποίησης μένει για την επόμενη.
 *
 * ⚠️ **Ο έλεγχος ΔΕΝ έγινε ευκολότερος — έγινε τριπλός.** Κάθε test εδώ απαιτεί, μαζί:
 * η πράξη **κλήθηκε** · το μενού **έφυγε** · η γραμμή **έμεινε**. Καθένα μόνο του περνάει και
 * με σπασμένη υλοποίηση — π.χ. αν σβήσει ο φύλακας `keepOpenOnToolbar`, το Radix κλείνει ήδη
 * στο `pointerdown` και το μενού «σωστά» εξαφανίζεται, αλλά το `onClick` δεν τρέχει ποτέ και
 * η εντολή χάνεται σιωπηλά.
 */
describe('🔴 ΤΟ ΚΡΙΣΙΜΟΤΕΡΟ: πάτημα «Β» ⇒ εκτελεί, φεύγει ΜΟΝΟ το μενού, η γραμμή ΜΕΝΕΙ', () => {
  const noop = (): void => {};
  const NO_FORMAT: TableToggleFormatState = { active: false, mixed: false, explicit: false };
  /** Ό,τι χρειάζεται το `TableHeaderContextMenu` με αδρανείς χειριστές — βλ. sibling test. */
  const menuProps = {
    onInsertBefore: noop,
    onInsertAfter: noop,
    onDelete: noop,
    resolveState: () => ({ label: 'B', axisLabel: 'B', count: 1, canInsert: true, canDelete: true }),
    resolveFormat: (): TableFormatSnapshot => ({
      bold: NO_FORMAT,
      italic: NO_FORMAT,
      underline: NO_FORMAT,
      textColor: {
        current: '#111111', mixed: false, explicit: false, inheritedColor: '#111111', inheritedMixed: false,
        drawingColors: [],
      },
      fillColor: {
        current: undefined, mixed: false, explicit: false, inheritedColor: undefined, inheritedMixed: false,
        drawingColors: [],
      },
      canReset: false,
    }),
    onStepTextHeight: noop,
    onResetFormat: noop,
    // ADR-739 Φ.Ε/Φ4 + Φ4β — δες το σχόλιο στο sibling test.
    onSetTextColor: noop,
    onSetFillColor: noop,
    // ADR-739 §55 — τα τρία νέα τμήματα της γραμμής· αδρανή εδώ, δοκιμάζονται στο
    // `table-toolbar-extras.test.ts` και στο `table-format-snapshot-readers.test.ts`.
    resolveToolbar: () => ({
      fonts: { family: { current: undefined, mixed: false }, size: { current: undefined, mixed: false } },
      fontNames: [],
      numberFormat: { current: null, explicit: false },
      align: null,
    }),
    onSetFormatField: noop,
    // ADR-750 Φ3 — δες το σχόλιο στο sibling test.
    /**
     * ADR-750 Φ5 — το dropdown περιγραμμάτων ως **μία** απάντηση (Φ3/Φ5 refactor).
     *
     * `resolvePencil: () => null` ⇒ η ζώνη σχεδίασης δεν αποδίδεται καθόλου: αυτές οι σουίτες
     * δοκιμάζουν τη γραμμή μορφοποίησης, όχι το μολύβι, και μια ζώνη με εφευρημένο μολύβι θα
     * ήταν θόρυβος σε κάθε `getByRole` τους. Το μολύβι έχει δική του σουίτα.
     */
    resolveBorderMenu: () => ({
      canReset: false,
      canClearDiagonals: false,
      onApply: noop,
      onReset: noop,
      onApplyDiagonal: noop,
      resolvePencil: () => null,
    }),
    // ADR-755 — το split button συγχώνευσης· ίδιο σχήμα «μία απάντηση» με τα περιγράμματα.
    resolveMergeMenu: () => ({
      state: { merged: false, canMerge: true },
      onApply: noop,
    }),
  };

  it('🔴 «Β»: onToggleFormat(hit,"bold") κλήθηκε ΚΑΙ ΜΕΤΑ onClosed — το μενού φεύγει από το DOM', async () => {
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

    // 🔴 ΧΩΡΙΣ `{ hidden: true }` — και αυτό ΕΙΝΑΙ ο έλεγχος (ζωντανή μέτρηση 2026-08-03).
    //
    // Το `DropdownMenu` του Radix είναι `modal` από προεπιλογή και καλεί `hideOthers()`
    // (πακέτο `aria-hidden`) στο mount: σημαδεύει `aria-hidden="true"` ΚΑΘΕ sibling κάτω από
    // το `document.body` που δεν ανήκει στο δικό του δέντρο. Το toolbar ζει σε ΔΙΚΟ ΤΟΥ portal
    // (απόφαση Α7), άρα το τρώει κι αυτό.
    //
    // Μέχρι τις 2026-08-03 αυτή η γραμμή έγραφε `{ hidden: true }` και το σχόλιό της
    // χαρακτήριζε το κενό «εκτός σκοπού». Δηλαδή το test **επικύρωνε το ελάττωμα** — ενώ ο
    // κώδικας δίπλα του (`removeAttribute` στο effect της θέσης) **προσπαθούσε** να το
    // διορθώσει και αποτύγχανε σιωπηλά, γιατί το `hideOthers()` τρέχει ΜΕΤΑ. Πράσινο test +
    // καλοπροαίρετος κώδικας + σπασμένη παραγωγή, ταυτόχρονα.
    //
    // Τώρα ο φύλακας είναι `MutationObserver` ({@link useAriaHiddenGuard}) και η απουσία του
    // `hidden: true` είναι η απόδειξη: αν ο φύλακας πεθάνει, το `getByRole` δεν βρίσκει
    // τίποτα και το test κοκκινίζει.
    const boldButton = screen.getByRole('button', { name: 'Έντονα' });

    // Πραγματική χειρονομία ποντικιού: `pointerdown` (αυτό ενεργοποιεί τον φύλακα Radix) →
    // `pointerup` → `click` (αυτό καλεί το `onActivate` του κουμπιού).
    await act(async () => {
      fireEvent.pointerDown(boldButton, { pointerId: 1, isPrimary: true, button: 0 });
      fireEvent.pointerUp(boldButton, { pointerId: 1, isPrimary: true, button: 0 });
      fireEvent.click(boldButton);
    });

    // 🔴 Και τα τρία, ΜΕ ΣΕΙΡΑ. Το «έκλεισε» μόνο του δεν αποδεικνύει τίποτα: αν λείψει ο
    // φύλακας `keepOpenOnToolbar`, το Radix κλείνει ήδη στο `pointerdown` και το μενού
    // εξαφανίζεται — αλλά η εντολή ΔΕΝ έχει εκτελεστεί. Η μόνη διάκριση είναι η σειρά.
    expect(onToggleFormat).toHaveBeenCalledWith(hit, 'bold');
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(onToggleFormat.mock.invocationCallOrder[0])
      .toBeLessThan(onClosed.mock.invocationCallOrder[0]);

    // Το μενού φεύγει…
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
    // …η γραμμή ΜΕΝΕΙ. Αυτή η γραμμή είναι η δεύτερη διόρθωση του ιδιοκτήτη.
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Έντονα' })).toBeInTheDocument();
  });

  /**
   * 🔴 Η γραμμή δέχεται **ΔΕΥΤΕΡΗ** εντολή αφού το μενού έχει ήδη φύγει.
   *
   * Είναι ο λόγος ύπαρξης της απόφασης: «η μορφοποίηση είναι κατεξοχήν επαναλαμβανόμενη
   * πράξη». Ένα test που σταματά στο πρώτο πάτημα δεν αποδεικνύει ότι η γραμμή είναι
   * **λειτουργική** μετά — μόνο ότι είναι **ορατή**.
   *
   * Ελέγχει επίσης ότι το `onClosed` **δεν** ξανακαλείται: ο φρουρός `if (!isOpen) return` του
   * `closeMenuKeepToolbar` υπάρχει ακριβώς γι' αυτό — χωρίς αυτόν κάθε επόμενο κλικ θα
   * ξανα-εκκινούσε τη συνεδρία δρομέα.
   */
  it('🔴 ΔΕΥΤΕΡΗ εντολή με το μενού ήδη κλειστό: εκτελείται, και το onClosed ΔΕΝ ξανακαλείται', async () => {
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
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    const press = async (name: string): Promise<void> => {
      const button = screen.getByRole('button', { name });
      await act(async () => {
        fireEvent.pointerDown(button, { pointerId: 1, isPrimary: true, button: 0 });
        fireEvent.pointerUp(button, { pointerId: 1, isPrimary: true, button: 0 });
        fireEvent.click(button);
      });
    };

    await press('Έντονα');   // διώχνει το μενού, κρατά τη γραμμή
    await press('Πλάγια');   // 🔴 πάνω σε γραμμή που ζει ΜΟΝΗ της

    expect(onToggleFormat).toHaveBeenNthCalledWith(1, hit, 'bold');
    expect(onToggleFormat).toHaveBeenNthCalledWith(2, hit, 'italic');
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  /**
   * 🔴 Ο ΦΥΛΑΚΑΣ ΠΑΡΑΜΕΝΕΙ ΑΠΑΡΑΙΤΗΤΟΣ — ονομαστικά, ώστε να μη «σβηστεί ως περιττός».
   *
   * Μετά την ανατροπή, η προφανής σκέψη είναι «αφού θέλουμε να κλείνει, βγάλε τον
   * `keepOpenOnToolbar` και άσε το Radix». Αυτό σπάει την **εντολή**: το `DismissableLayer`
   * κλείνει στο `pointerdown`, το toolbar ξεμοντάρει, και το `click` δεν φτάνει ποτέ.
   *
   * Εδώ στέλνεται **μόνο** `pointerdown` — καμία ολοκληρωμένη χειρονομία. Αν ο φύλακας ζει,
   * τίποτα δεν έχει συμβεί ακόμα. Αν λείπει, το μενού έχει ήδη κλείσει **χωρίς πράξη**.
   */
  it('🔴 σκέτο pointerdown στο κουμπί ΔΕΝ κλείνει τίποτα — το κλείσιμο ανήκει στο click', async () => {
    const onToggleFormat = jest.fn();
    const onClosed = jest.fn();
    const ref = React.createRef<TableHeaderContextMenuHandle>();

    render(
      <TableHeaderContextMenu
        ref={ref}
        {...menuProps}
        onToggleFormat={onToggleFormat}
        onClosed={onClosed}
      />,
      wrapper,
    );
    await act(async () => { ref.current?.open(10, 10, { axis: 'column', colId: 'c1', index: 1 }); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    const boldButton = screen.getByRole('button', { name: 'Έντονα' });
    await act(async () => {
      fireEvent.pointerDown(boldButton, { pointerId: 1, isPrimary: true, button: 0 });
    });

    expect(onClosed).not.toHaveBeenCalled();
    expect(onToggleFormat).not.toHaveBeenCalled();
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  /**
   * 🔴 Ο φύλακας πρέπει να επιβιώνει εγγραφής που έρχεται **ΜΕΤΑ** το mount.
   *
   * Το προηγούμενο test αποδεικνύει ότι το toolbar είναι ορατό στον a11y tree μετά το
   * `hideOthers()` του Radix. Αυτό εδώ κλείνει την **κατηγορία**: ένα σκέτο `removeAttribute`
   * στο mount θα περνούσε το προηγούμενο μόνο κατά τύχη (αν η σειρά των effects άλλαζε), ενώ
   * εδώ η εγγραφή είναι ρητά μεταγενέστερη και **καμία** στιγμιαία διόρθωση δεν τη νικά.
   *
   * Είναι ακριβώς η μετάλλαξη που η ζωντανή οθόνη βρήκε και τα 830 πράσινα tests δεν είδαν.
   */
  it('🔴 aria-hidden γραμμένο ΜΕΤΑ το mount αφαιρείται κι αυτό (ο φύλακας δεν είναι one-shot)', async () => {
    const ref = React.createRef<TableHeaderContextMenuHandle>();
    render(<TableHeaderContextMenu ref={ref} {...menuProps} />, wrapper);
    await act(async () => { ref.current?.open(10, 10, { axis: 'column', colId: 'c1', index: 1 }); });

    const toolbar = screen.getByRole('toolbar');

    // Ό,τι ακριβώς κάνει το `hideOthers()`, αλλά με βεβαιωμένα ύστερο χρονισμό.
    await act(async () => {
      toolbar.setAttribute('aria-hidden', 'true');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(toolbar).not.toHaveAttribute('aria-hidden');
    expect(screen.getByRole('button', { name: 'Έντονα' })).toBeInTheDocument();
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
    // §55/§58: Α↑, Α↓, Β, Π, **🪣, ▾**, **Α, ▾**, πινέλο, Υ, ↺ — δες `getToolbarButtons`.
    // Κάθε χρώμα είναι split button, δύο θέσεις roving. Η αναδίπλωση **δεν** είναι εδώ: έχει
    // δικό της τμήμα από το §58 Γ2, και αυτός ο ξενιστής δεν το δίνει.
    expect(buttons).toHaveLength(11);
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

describe('«Επαναφορά μορφοποίησης» (ADR-750 Α19 — η ετικέτα ονομάζει το αντικείμενό της)', () => {
  it('canReset:false ⇒ aria-disabled="true" ΚΑΙ το κλικ είναι no-op', () => {
    const { onReset } = renderToolbar({ format: { ...SAMPLE_FORMAT, canReset: false } });
    const reset = screen.getByRole('button', { name: 'Επαναφορά μορφοποίησης' });
    expect(reset).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(reset);
    expect(onReset).not.toHaveBeenCalled();
  });

  it('canReset:true ⇒ ενεργό, χωρίς aria-disabled, και το κλικ καλεί onReset', () => {
    const { onReset } = renderToolbar({ format: { ...SAMPLE_FORMAT, canReset: true } });
    const reset = screen.getByRole('button', { name: 'Επαναφορά μορφοποίησης' });
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

// ─── ADR-739 Φ.Ε/Φ4 — χρώμα κειμένου ──────────────────────────────────────────

/**
 * Το split button: **δύο** χειρονομίες με διαφορετικό κόστος.
 *
 * Το κύριο μισό είναι ολόκληρος ο λόγος ύπαρξης του μοτίβου — «ξαναβάψε με το ίδιο» χωρίς να
 * ανοίξει τίποτα. Αν το πάτημά του άνοιγε μενού, το χειριστήριο θα ήταν απλώς ένα dropdown με
 * περίεργο εικονίδιο.
 */
describe('split button χρώματος: το «Α» εφαρμόζει, το βελάκι ανοίγει', () => {
  it('κλικ στο «Α» εφαρμόζει χρώμα ΧΩΡΙΣ να ανοίξει μενού', () => {
    const { onSetTextColor } = renderToolbar();

    fireEvent.click(screen.getByRole('button', { name: 'Χρώμα κειμένου' }));

    expect(onSetTextColor).toHaveBeenCalledTimes(1);
    expect(onSetTextColor.mock.calls[0][0]).toMatch(/^#[0-9a-f]{6}$/);
    expect(screen.queryByRole('menu', { name: 'Χρώμα κειμένου' })).toBeNull();
  });

  it('κλικ στο βελάκι ανοίγει το μενού ΧΩΡΙΣ να εφαρμόσει τίποτα', () => {
    const { onSetTextColor } = renderToolbar();

    fireEvent.click(screen.getByRole('button', { name: 'Παλέτα χρωμάτων κειμένου' }));

    expect(onSetTextColor).not.toHaveBeenCalled();
    expect(screen.getByRole('menu', { name: 'Χρώμα κειμένου' })).toBeInTheDocument();
  });

  it('το βελάκι δηλώνει την κατάστασή του με aria-expanded', () => {
    renderToolbar();
    const arrow = screen.getByRole('button', { name: 'Παλέτα χρωμάτων κειμένου' });

    expect(arrow).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(arrow);
    expect(arrow).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('οι τέσσερις ζώνες του μενού χρώματος', () => {
  function openColorMenu(overrides: Partial<TableFormatToolbarProps> = {}) {
    const utils = renderToolbar(overrides);
    fireEvent.click(screen.getByRole('button', { name: 'Παλέτα χρωμάτων κειμένου' }));
    return utils;
  }

  it('«Αυτόματο» γράφει ΑΚΡΙΒΩΣ `undefined`, ΠΟΤΕ το χρώμα του στυλ ως ρητή τιμή', () => {
    // 🔴 Η διάκριση είναι όλη η δουλειά: «Αυτόματο» = **αφαίρεση** του πεδίου. Αν έγραφε το
    // κληρονομημένο χρώμα ως ρητή τιμή, ο άξονας θα φαινόταν καθαρός ενώ θα ήταν καρφωμένος —
    // και μια αλλαγή στυλ δεν θα τον άγγιζε ποτέ ξανά.
    //
    // Το `toHaveBeenCalledWith(undefined)` **δεν** αρκεί μόνο του (θα περνούσε και με μηδέν
    // ορίσματα): ελέγχεται και το πλήθος των ορισμάτων.
    const { onSetTextColor } = openColorMenu();

    fireEvent.click(screen.getByRole('menuitemradio', { name: /Από το στυλ/ }));

    expect(onSetTextColor).toHaveBeenCalledTimes(1);
    expect(onSetTextColor.mock.calls[0]).toEqual([undefined]);
  });

  it('«Αυτόματο» είναι το ενεργό όταν ο άξονας ΔΕΝ δηλώνει ρητό χρώμα', () => {
    openColorMenu();
    expect(screen.getByRole('menuitemradio', { name: /Από το στυλ/ }))
      .toHaveAttribute('aria-checked', 'true');
  });

  it('«Αυτόματο» ΔΕΝ είναι ενεργό όταν ο άξονας δηλώνει ρητό χρώμα', () => {
    openColorMenu({
      format: {
        ...SAMPLE_FORMAT,
        textColor: { ...INHERITED_TEXT_COLOR, current: '#ff0000', explicit: true },
      },
    });
    expect(screen.getByRole('menuitemradio', { name: /Από το στυλ/ }))
      .toHaveAttribute('aria-checked', 'false');
  });

  it('η ζώνη «Χρώματα του σχεδίου» δείχνει ό,τι της δόθηκε', () => {
    openColorMenu();
    expect(screen.getByRole('button', { name: /#0000ff/ })).toBeInTheDocument();
  });

  it('🔴 κενή λίστα ⇒ η ζώνη ΔΕΝ εμφανίζεται καθόλου — ποτέ επικεφαλίδα πάνω από τίποτα', () => {
    openColorMenu({
      format: { ...SAMPLE_FORMAT, textColor: { ...INHERITED_TEXT_COLOR, drawingColors: [] } },
    });
    expect(screen.queryByText('Χρώματα του σχεδίου')).toBeNull();
  });

  it('το πλέγμα «Βασικά χρώματα» είναι grid με 13×6 δείγματα', () => {
    openColorMenu();
    const grid = screen.getByRole('grid', { name: 'Βασικά χρώματα' });
    expect(within(grid).getAllByRole('row')).toHaveLength(6);
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(78);
  });

  it('κλικ σε δείγμα του πλέγματος εφαρμόζει ΑΚΡΙΒΩΣ το χρώμα του και κλείνει το μενού', () => {
    const { onSetTextColor } = openColorMenu();
    const grid = screen.getByRole('grid', { name: 'Βασικά χρώματα' });

    // Δεύτερη σειρά, δεύτερη στήλη = η **βάση** του κόκκινου, ACI 10.
    const cells = within(grid).getAllByRole('gridcell');
    fireEvent.click(cells[13 + 1]);

    expect(onSetTextColor).toHaveBeenCalledWith('#ff0000');
    expect(screen.queryByRole('menu', { name: 'Χρώμα κειμένου' })).toBeNull();
  });

  it('το τρέχον χρώμα είναι σημαδεμένο στο πλέγμα με aria-selected', () => {
    openColorMenu({
      format: {
        ...SAMPLE_FORMAT,
        textColor: { ...INHERITED_TEXT_COLOR, current: '#ff0000', explicit: true },
      },
    });
    const grid = screen.getByRole('grid', { name: 'Βασικά χρώματα' });
    const selected = within(grid).getAllByRole('gridcell')
      .filter((cell) => cell.getAttribute('aria-selected') === 'true');

    expect(selected).toHaveLength(1);
    expect(selected[0].getAttribute('aria-label')).toContain('ACI 10');
  });

  it('🔴 μεικτή σειρά ⇒ ΚΑΝΕΝΑ δείγμα σημαδεμένο — δεν διαλέγουμε εμείς ποιο «κέρδισε»', () => {
    openColorMenu({
      format: {
        ...SAMPLE_FORMAT,
        textColor: { ...INHERITED_TEXT_COLOR, current: undefined, explicit: true },
      },
    });
    const grid = screen.getByRole('grid', { name: 'Βασικά χρώματα' });
    expect(within(grid).getAllByRole('gridcell')
      .filter((cell) => cell.getAttribute('aria-selected') === 'true')).toHaveLength(0);
  });

  it('υπάρχει διέξοδος «Περισσότερα χρώματα…» προς τον πλήρη διάλογο', () => {
    openColorMenu();
    expect(screen.getByRole('menuitem', { name: /Περισσότερα χρώματα/ })).toBeInTheDocument();
  });
});

/**
 * Η πλοήγηση **δύο αξόνων** μέσα στο πλέγμα.
 *
 * Χωρίς αυτήν, το `↓` δεν κάνει τίποτα και μια σειρά κάτω απέχει δεκατρία `→`. Το `↑/↓`
 * κυκλώνει **μέσα στη στήλη** επίτηδες: η στήλη είναι η ίδια απόχρωση σε έξι φωτεινότητες, και
 * ένα ξεχείλισμα στη διπλανή απόχρωση θα έσπαγε ακριβώς τη σχέση που η στήλη δείχνει.
 */
describe('πλοήγηση στο πλέγμα χρωμάτων (WAI-ARIA grid)', () => {
  function gridCells(): HTMLElement[] {
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Παλέτα χρωμάτων κειμένου' }));
    return within(screen.getByRole('grid', { name: 'Βασικά χρώματα' })).getAllByRole('gridcell');
  }

  it('ArrowDown κατεβαίνει ΜΙΑ σειρά στην ίδια στήλη', () => {
    const cells = gridCells();
    act(() => { cells[0].focus(); });
    fireEvent.keyDown(cells[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(cells[13]);
  });

  it('ArrowUp στην ΠΡΩΤΗ σειρά κυκλώνει στην τελευταία της ΙΔΙΑΣ στήλης', () => {
    const cells = gridCells();
    act(() => { cells[2].focus(); });
    fireEvent.keyDown(cells[2], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(cells[5 * 13 + 2]);
  });

  it('ArrowRight στο τέλος μιας σειράς συνεχίζει στην ΑΡΧΗ της επόμενης', () => {
    const cells = gridCells();
    act(() => { cells[12].focus(); });
    fireEvent.keyDown(cells[12], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(cells[13]);
  });

  it('Home/End πάνε στα άκρα ΤΗΣ ΣΕΙΡΑΣ, όχι όλου του πλέγματος', () => {
    const cells = gridCells();
    act(() => { cells[20].focus(); });
    fireEvent.keyDown(cells[20], { key: 'Home' });
    expect(document.activeElement).toBe(cells[13]);

    fireEvent.keyDown(cells[13], { key: 'End' });
    expect(document.activeElement).toBe(cells[25]);
  });
});

/**
 * ADR-739 Φ.Ε/Φ4β — **το χρώμα γεμίσματος**: το ίδιο component, δεύτερος ρόλος.
 *
 * 🔴 Δύο πράγματα εδώ δεν είναι διακοσμητικά:
 *  1. το «Κανένα γέμισμα» γράφει **ακριβώς `null`** — αν κάπου γινόταν `?? undefined`, η εντολή
 *     θα μεταφραζόταν σιωπηλά σε «Αυτόματο» και μια βαμμένη κεφαλίδα δεν θα καθάριζε ποτέ·
 *  2. το χρώμα **κειμένου** ΔΕΝ προσφέρει «Κανένα» — το μοντέλο δεν το δέχεται, και μια
 *     διεπαφή που το πρόσφερε θα υποσχόταν κατάσταση που δεν μπορεί να αποδοθεί.
 */
describe('ADR-739 Φ.Ε/Φ4β — χρώμα γεμίσματος, ο δεύτερος ρόλος του ίδιου μενού', () => {
  function openFillMenu(overrides: Partial<TableFormatToolbarProps> = {}) {
    const utils = renderToolbar(overrides);
    fireEvent.click(screen.getByRole('button', { name: 'Παλέτα χρωμάτων γεμίσματος' }));
    return utils;
  }

  it('η γραμμή έχει ΔΙΚΟ ΤΗΣ split button για το γέμισμα, δίπλα σε εκείνο του κειμένου', () => {
    renderToolbar();
    expect(screen.getByRole('button', { name: 'Χρώμα γεμίσματος' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Παλέτα χρωμάτων γεμίσματος' })).toBeInTheDocument();
  });

  it('🔴 «Κανένα γέμισμα» γράφει ΑΚΡΙΒΩΣ `null` — ποτέ `undefined`', () => {
    // Αυτό είναι ΤΟ test της τρίτης κατάστασης. `null` = ρητά διαφανές (σταματά τον κατήφορο
    // στο `clearable`)· `undefined` = κληρονομιά. Ένα `??` οπουδήποτε στη διαδρομή τα ισοπεδώνει.
    const { onSetFillColor } = openFillMenu();

    fireEvent.click(screen.getByRole('menuitemradio', { name: /Κανένα γέμισμα/ }));

    expect(onSetFillColor).toHaveBeenCalledTimes(1);
    expect(onSetFillColor.mock.calls[0]).toEqual([null]);
  });

  it('🔴 το μενού ΚΕΙΜΕΝΟΥ δεν προσφέρει «Κανένα» — το μοντέλο δεν το δέχεται', () => {
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Παλέτα χρωμάτων κειμένου' }));
    expect(screen.queryByRole('menuitemradio', { name: /Κανένα/ })).toBeNull();
  });

  it('«Αυτόματο» του γεμίσματος γράφει `undefined`, ΟΧΙ `null` — δύο διαφορετικές εντολές', () => {
    const { onSetFillColor } = openFillMenu();

    fireEvent.click(screen.getByRole('menuitemradio', { name: /Από το στυλ/ }));

    expect(onSetFillColor.mock.calls[0]).toEqual([undefined]);
  });

  it('🔴 ρητά «κανένα» ⇒ ενεργό το «Κανένα γέμισμα»· κληρονομιά ⇒ ενεργό το «Αυτόματο»', () => {
    // Οι δύο γραμμές ζωγραφίζουν ολόιδιο δείγμα (και οι δύο «τίποτα»). Η διάκριση ζει στο
    // `aria-checked`, δηλαδή εκεί όπου τη διαβάζει και ο αναγνώστης οθόνης.
    openFillMenu({
      format: { ...SAMPLE_FORMAT, fillColor: { ...INHERITED_NO_FILL, explicit: true } },
    });
    expect(screen.getByRole('menuitemradio', { name: /Κανένα γέμισμα/ }))
      .toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: /Από το στυλ/ }))
      .toHaveAttribute('aria-checked', 'false');
  });

  it('🔴 μεικτός άξονας ⇒ ΚΑΜΙΑ από τις δύο γραμμές ενεργή', () => {
    openFillMenu({
      format: { ...SAMPLE_FORMAT, fillColor: { ...INHERITED_NO_FILL, mixed: true, explicit: true } },
    });
    for (const name of [/Κανένα γέμισμα/, /Από το στυλ/]) {
      expect(screen.getByRole('menuitemradio', { name })).toHaveAttribute('aria-checked', 'false');
    }
  });

  it('🔴 το πλέγμα του γεμίσματος ΕΧΕΙ λευκό — αυτό που το πλέγμα κειμένου κόβει', () => {
    openFillMenu();
    const grid = screen.getByRole('grid', { name: 'Βασικά χρώματα' });
    const cells = within(grid).getAllByRole('gridcell');
    // Πρώτη σειρά, πρώτη στήλη = η κορυφή της ουδέτερης στήλης.
    expect(cells[0].getAttribute('aria-label')).toContain('ACI 255');
  });

  it('το πλέγμα ΚΕΙΜΕΝΟΥ στην ίδια θέση δεν έχει λευκό — η ασυμμετρία, στην οθόνη', () => {
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Παλέτα χρωμάτων κειμένου' }));
    const grid = screen.getByRole('grid', { name: 'Βασικά χρώματα' });
    const cells = within(grid).getAllByRole('gridcell');
    expect(cells[0].getAttribute('aria-label')).toContain('ACI 254');
  });

  it('κλικ σε δείγμα του πλέγματος γεμίσματος γράφει το hex και κλείνει το μενού', () => {
    const { onSetFillColor } = openFillMenu();
    const grid = screen.getByRole('grid', { name: 'Βασικά χρώματα' });

    fireEvent.click(within(grid).getAllByRole('gridcell')[13 + 1]);

    expect(onSetFillColor).toHaveBeenCalledWith('#ff0000');
    expect(screen.queryByRole('menu', { name: 'Χρώμα γεμίσματος' })).toBeNull();
  });

  it('🔴 το κύριο μισό εφαρμόζει το τελευταίο χρώμα ΧΩΡΙΣ μενού — και ποτέ `null`', () => {
    const { onSetFillColor } = renderToolbar();

    fireEvent.click(screen.getByRole('button', { name: 'Χρώμα γεμίσματος' }));

    expect(onSetFillColor).toHaveBeenCalledTimes(1);
    expect(onSetFillColor.mock.calls[0][0]).toMatch(/^#[0-9a-f]{6}$/);
    expect(screen.queryByRole('menu', { name: 'Χρώμα γεμίσματος' })).toBeNull();
  });

  it('τα δύο μενού είναι ανεξάρτητα — το ένα δεν ανοίγει το άλλο', () => {
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Παλέτα χρωμάτων γεμίσματος' }));

    expect(screen.getByRole('menu', { name: 'Χρώμα γεμίσματος' })).toBeInTheDocument();
    expect(screen.queryByRole('menu', { name: 'Χρώμα κειμένου' })).toBeNull();
  });
});

/**
 * 🔴 ADR-739 Φ.Ε/Φ4β — **ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΒΡΗΚΕ Η ΟΘΟΝΗ, ΟΧΙ ΤΑ TESTS** (ζωντανή επαλήθευση).
 *
 * Όλα τα fixtures παραπάνω έχουν **μη μεικτή** κληρονομιά, άρα κανένα δεν περνούσε από τη
 * γραμμή που έσπαγε. Στην πραγματική οθόνη: **κεφαλίδα** (`#EDEDED` από το στυλ) που περνά
 * πάνω από στήλη με ρητό ματζέντα ⇒ η κληρονομιά είναι **δύο πράγματα**, το `inherited.value`
 * βγαίνει `undefined`, και το παλιό `?? style.rowClasses.data[key]` έπεφτε στην κλάση `data`
 * — που δεν βάφει. Αποτέλεσμα: «Κληρονομεί **«κανένα γέμισμα»** από το στυλ», **ψέμα**.
 *
 * Δεν ήταν λογικό σφάλμα· ήταν **θετικός ισχυρισμός βγαλμένος από fallback**. Το Revit απαντά
 * την ίδια ερώτηση με `<varies>` — μη-δήλωση, όχι λάθος δήλωση.
 */
describe('🔴 μεικτή ΚΛΗΡΟΝΟΜΙΑ: το «Αυτόματο» δεν ισχυρίζεται ό,τι δεν ξέρει', () => {
  const MIXED_INHERITANCE: TableAxisColorState = {
    ...INHERITED_NO_FILL,
    inheritedColor: undefined,
    inheritedMixed: true,
  };

  function openFill(fillColor: TableAxisColorState) {
    renderToolbar({ format: { ...SAMPLE_FORMAT, fillColor } });
    fireEvent.click(screen.getByRole('button', { name: 'Παλέτα χρωμάτων γεμίσματος' }));
  }

  it('🔴 ΔΕΝ λέει «κληρονομεί κανένα γέμισμα» όταν η κληρονομιά είναι μεικτή', () => {
    openFill(MIXED_INHERITANCE);
    const automatic = screen.getByRole('menuitemradio', { name: /Από το στυλ/ });
    expect(automatic.textContent).not.toContain('κανένα γέμισμα');
    expect(automatic.textContent).toContain('διαφέρει ανά κελί');
  });

  it('εξακολουθεί να το λέει όταν όντως κληρονομεί κενό — η διάκριση, όχι η σιωπή', () => {
    // Το test από πάνω μόνο του θα περνούσε και με «ποτέ μη λες τίποτα». Η αξία είναι ότι η
    // αληθινή δήλωση **παραμένει** εκεί που είναι αληθινή.
    openFill(INHERITED_NO_FILL);
    expect(screen.getByRole('menuitemradio', { name: /Από το στυλ/ }).textContent)
      .toContain('κανένα γέμισμα');
  });

  it('και δηλώνει το χρώμα όταν κληρονομεί ένα και μόνο ένα', () => {
    openFill({ ...INHERITED_NO_FILL, inheritedColor: '#ededed' });
    const text = screen.getByRole('menuitemradio', { name: /Από το στυλ/ }).textContent ?? '';
    expect(text).not.toContain('κανένα γέμισμα');
    expect(text).not.toContain('διαφέρει ανά κελί');
  });

  it('🔴 το δείγμα ΔΕΝ φοράει το γλυφό «κανένα» σε μεικτή κληρονομιά', () => {
    // Το γλυφό λευκό+κόκκινη-διαγώνιος **είναι** ισχυρισμός («δεν θα βαφτεί τίποτα»). Σε
    // μεικτή κληρονομιά ο ισχυρισμός είναι ψευδής — άρα άλλο γλυφό, όχι απλώς άλλο κείμενο.
    openFill(MIXED_INHERITANCE);
    const swatch = screen.getByRole('menuitemradio', { name: /Από το στυλ/ })
      .querySelector('span');
    const none = screen.getByRole('menuitemradio', { name: /Κανένα γέμισμα/ })
      .querySelector('span');
    expect(swatch?.className).not.toBe(none?.className);
  });
});

/**
 * 🔴 ADR-739 §52 — **η υποδοχή της ΠΕΡΙΟΧΗΣ δείχνει πλέον μορφοποίηση.**
 *
 * Μέχρι το §52 το τμήμα έλειπε ολόκληρο από το δεξί κλικ σε κελιά, και ο λόγος ήταν γραμμένος
 * στην κεφαλίδα του component: «τα εννιά χειριστήρια γράφουν `styleOverride` γραμμής/στήλης,
 * και πάνω σε επιλογή κελιών δεν υπάρχει άξονας να γράψουν». Η αιτία ήταν **πραγματική** —
 * και έπαψε να ισχύει τη στιγμή που γράφτηκε ο γραφέας κελιών.
 *
 * Το test κλειδώνει και τις **δύο** πλευρές: ότι εμφανίζεται όταν δίνεται, και ότι εξακολουθεί
 * να λείπει ολόκληρο όταν δεν δίνεται (στόχος που δεν επιβίωσε ⇒ ποτέ εννιά γκρίζα κουμπιά).
 */
describe('🔴 §52 — scope="range" με τμήμα μορφοποίησης', () => {
  it('δείχνει τα Β/Ι/Υ και την «Επαναφορά» πάνω σε επιλογή κελιών', () => {
    renderToolbar({ axis: 'range' });
    expect(screen.getByRole('button', { name: /Έντονα/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Πλάγια/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Υπογράμμιση/ })).toBeInTheDocument();
  });

  it('το πάτημα φτάνει στον χειριστή της υποδοχής — ο στόχος είναι τα ΚΕΛΙΑ', () => {
    const { onToggle } = renderToolbar({ axis: 'range' });
    fireEvent.click(screen.getByRole('button', { name: /Έντονα/ }));
    expect(onToggle).toHaveBeenCalledWith('bold');
  });

  it('🔴 ΧΩΡΙΣ τμήμα (στόχος που δεν επιβίωσε) ⇒ ΛΕΙΠΕΙ ολόκληρο, ποτέ γκρίζο', () => {
    renderToolbar({
      axis: 'range',
      formatSection: null,
      merge: { state: { merged: false, canMerge: true }, onApply: () => {} },
    });
    expect(screen.queryByRole('button', { name: /Έντονα/ })).not.toBeInTheDocument();
  });
});
