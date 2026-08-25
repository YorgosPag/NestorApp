/**
 * 🔴 ADR-739 §60 — **οι δύο νέες καρτέλες** του «Μορφοποίηση κελιών»: Αριθμός και Στοίχιση.
 *
 * ## Γιατί render ΤΟΥ ΔΙΑΛΟΓΟΥ και όχι από υποδοχή
 * Ο διάλογος περιγραμμάτων δοκιμάζεται από το σημείο εισόδου του χρήστη, και σωστά: έχει
 * **μία** υποδοχή (το dropdown). Αυτές οι καρτέλες έχουν **τρεις** (δύο βελάκια κορδέλας + το
 * στοιχείο του dropdown), οπότε δεν υπάρχει «το» σημείο εισόδου να δοκιμάσεις — η καλωδίωση
 * κάθε υποδοχής είναι δική της ερώτηση και την κρατά το `table-border-dialog.test.tsx`
 * (άνοιγμα, κλείσιμο πάνελ, `moreBorders` απόν).
 *
 * 🔑 Το πιο σημαντικό test του αρχείου είναι το «**Άκυρο ⇒ τίποτα**» και το «**ένα ΟΚ, ένα
 * μοντέλο**»: ολόκληρη η δικαιολογία του προσχεδίου είναι ότι το ζωντανό μοντέλο δεν αγγίζεται
 * πριν το ΟΚ, και ότι είκοσι κλικ μέσα στον διάλογο είναι **ένα** βήμα αναίρεσης.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import elDxfViewer from '@/i18n/locales/el/dxf-viewer.json';
import {
  TableFormatCellsDialog,
  type TableFormatCellsDialogProps,
} from '../format-cells-dialog/TableFormatCellsDialog';
import { TABLE_FORMAT_COMMIT_REFUSAL_KEY } from '../format-cells-dialog/table-format-cells-labels';
import type { TableFormatCommitPlan } from '@/subapps/dxf-viewer/bim/table/table-format-commit-plan';
import {
  TABLE_ALIGN_CODES,
  type TableFormatCellsTabId,
} from '../format-cells-dialog/table-format-cells-labels';
import {
  TABLE_DECIMAL_STEPS,
  TABLE_NUMBER_FORMAT_KINDS,
} from '@/subapps/dxf-viewer/bim/table/table-number-format-facets';
import { MAX_TABLE_INDENT_LEVEL } from '@/subapps/dxf-viewer/bim/table/table-indent-ops';
import { resolveTableFormatState } from '@/subapps/dxf-viewer/bim/table/table-format-scope';
import { resolveTableNumberFormatState } from '@/subapps/dxf-viewer/ui/table-cell-editor/table-format-snapshot';
import { getCurrencyOptions } from '@/config/vocabulary/options/individual';
import {
  BUILTIN_TABLE_STYLES,
  BUILTIN_TABLE_STYLE_IDS,
} from '@/subapps/dxf-viewer/bim/table/table-style-presets';
import type { FormatTarget } from '@/subapps/dxf-viewer/ui/table-cell-editor/table-format-snapshot';
import type { TableStyle } from '@/subapps/dxf-viewer/bim/table/table-style';
import type { PersistedTableModel, TableColumn, TableRow } from '@/subapps/dxf-viewer/types/table';

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
  i18nInstance.addResourceBundle('el', 'dxf-viewer', elDxfViewer, true, true);
});

function I18nWrapper({ children }: { children: React.ReactNode }): React.ReactElement {
  return <I18nextProvider i18n={i18nInstance}>{children}</I18nextProvider>;
}

const wrapper = { wrapper: I18nWrapper };

const STANDARD: TableStyle = (() => {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD);
  if (!style) throw new Error('missing preset: standard');
  return style;
})();

function persisted(): PersistedTableModel {
  const columns: TableColumn[] = [
    { id: 'c1', sizing: { kind: 'fixed', widthMm: 10 }, valueType: 'text', align: 'left' },
  ];
  const rows: TableRow[] = [{ id: 'r1', rowClass: 'data', heightMm: 6 }];
  return { columns, rows, cells: [], merges: [] };
}

const SCOPE = { kind: 'range' as const, bounds: { firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 } };

function target(): FormatTarget {
  // §63 — ο στόχος κουβαλά **ποιος** πίνακας, όχι μόνο τι μοντέλο.
  return { entityId: 'entity-1', model: persisted(), style: STANDARD, scope: SCOPE, layerColors: [] };
}

/**
 * 🔴 ADR-739 §61 — ο διάλογος έγινε **ελεγχόμενος** ως προς την καρτέλα (ήταν `initialTab` +
 * `useState`), γιατί το «άνοιξε στην τελευταία καρτέλα» του Excel δεν μπορεί να είναι γνωστό σε
 * κανέναν αν ζει μέσα σε component που ξεμοντάρει. Εδώ ο δοκιμαστικός κάτοχος κρατά αυτή την
 * κατάσταση — ώστε τα tests να ασκούν τον **ίδιο** βρόχο με τον πραγματικό ξενιστή, όχι μια
 * παράκαμψη που θα έμενε πράσινη ακόμη κι αν το `onTabSelect` δεν καλωδιωνόταν πουθενά.
 */
function DialogHarness(props: {
  readonly startTab: TableFormatCellsTabId;
  readonly onCommit: TableFormatCellsDialogProps['onCommit'];
  readonly onClose: () => void;
}): React.ReactElement {
  const [tab, setTab] = React.useState<TableFormatCellsTabId>(props.startTab);
  // 🔴 §63 — ο στόχος είναι **σταθερός** ανά mount, όπως στην παραγωγή (`key={request.id}`): ένα
  // `target()` ανά render θα έδινε νέο `model` by-reference σε κάθε πάτημα καρτέλας, δηλαδή θα
  // κατέστρεφε ακριβώς τη βάση σύγκρισης που κρίνει το πλάνο δέσμευσης.
  const [fixedTarget] = React.useState(target);
  return (
    <TableFormatCellsDialog
      target={fixedTarget}
      tab={tab}
      onTabSelect={setTab}
      onCommit={props.onCommit}
      onClose={props.onClose}
    />
  );
}

/**
 * @param plan τι απαντά η θύρα στο «ΟΚ». Προεπιλογή: **δέχεται** — ό,τι έκανε πάντα η θύρα πριν
 *   το §63 της δώσει τη δυνατότητα να αρνηθεί.
 */
function renderDialog(
  startTab: TableFormatCellsTabId = 'number',
  plan: TableFormatCommitPlan | null = null,
) {
  const onCommit = jest.fn(
    (_t: FormatTarget, model: PersistedTableModel): TableFormatCommitPlan =>
      plan ?? { status: 'accepted', model },
  );
  const onClose = jest.fn();
  render(
    <DialogHarness startTab={startTab} onCommit={onCommit} onClose={onClose} />,
    wrapper,
  );
  return { onCommit, onClose };
}

/**
 * Το μοντέλο που παραδόθηκε στο ΟΚ — και **μόνο** αυτό (η άγκυρα «ένα commit»).
 *
 * §63 — **δεύτερο** όρισμα: το πρώτο είναι ο στόχος, ώστε η θύρα να μη μαντεύει πού γράφει.
 */
function committed(onCommit: ReturnType<typeof renderDialog>['onCommit']): PersistedTableModel {
  expect(onCommit).toHaveBeenCalledTimes(1);
  return onCommit.mock.calls[0][1];
}

function clickOk(): void {
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
}

// ── 1. 🔴 Η ΝΑΡΚΗ ΤΟΥ §59.6.3, ΩΣ ΚΛΑΣΗ ────────────────────────────────────

/**
 * 🔴 **ΚΑΜΙΑ ΕΠΙΛΟΓΗ ΜΕ ΚΕΝΗ ΤΙΜΗ.**
 *
 * Το Radix Select **δεσμεύει** το `''` ως «καμία επιλογή»: ένα `<SelectItem value="">` πετά σε
 * dev και **ολόκληρη η επιφάνεια δεν αποδίδεται**. Το §59 το πλήρωσε στην καρτέλα
 * «Μορφοποίηση», και το βρήκε **άνθρωπος ανοίγοντάς την** — ο μεταγλωττιστής δέχεται κάθε
 * `string`, το κλειδί i18n υπήρχε, και τα tests **κλείδωναν το λάθος** (`toBe('')`).
 *
 * ⚠️ Η άγκυρα ελέγχει τους **καταλόγους**, όχι το αποδοσμένο DOM, και είναι απόφαση: τα
 * `SelectItem` υπάρχουν μόνο με ανοιχτό πτυσσόμενο, οπότε ένας έλεγχος DOM θα εξέταζε τρία από
 * τα έξι και θα άφηνε τα υπόλοιπα **αδοκίμαστα ενώ θα φαινόταν πλήρης**. Οι κατάλογοι είναι η
 * μοναδική πηγή κάθε `value` του διαλόγου — αν κάποιος τους παρακάμψει, το test δεν το βλέπει,
 * αλλά τότε ο κατάλογος δεν είναι πια SSoT και το πρόβλημα είναι άλλο.
 */
describe('§60 — καμία επιλογή δεν έχει ΚΕΝΗ τιμή', () => {
  const catalogs: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['κατηγορίες αριθμού', TABLE_NUMBER_FORMAT_KINDS],
    ['δεκαδικά ψηφία', TABLE_DECIMAL_STEPS.map(String)],
    ['νομίσματα', getCurrencyOptions().map((option) => option.value)],
    ['θέσεις στοίχισης', TABLE_ALIGN_CODES],
    [
      'σκαλιά εσοχής',
      Array.from({ length: MAX_TABLE_INDENT_LEVEL + 1 }, (_unused, level) => String(level)),
    ],
  ];

  it.each(catalogs)('🔴 %s: κάθε τιμή είναι μη κενή', (_name, values) => {
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(value).not.toBe('');
      expect(value.trim()).not.toBe('');
    }
  });
});

// ── 2. Καρτέλα «Αριθμός» ────────────────────────────────────────────────────

describe('§60 — η καρτέλα «Αριθμός»', () => {
  it('η λίστα κατηγοριών δείχνει ΟΛΑ τα είδη του μοντέλου', () => {
    renderDialog();
    const list = screen.getByRole('listbox', { name: 'Κατηγορία' });
    expect(list.querySelectorAll('[role="option"]')).toHaveLength(TABLE_NUMBER_FORMAT_KINDS.length);
  });

  it('🔴 η επιλογή κατηγορίας γράφει στο ΠΡΟΣΧΕΔΙΟ και δεσμεύεται με ΕΝΑ commit', () => {
    const { onCommit } = renderDialog();
    fireEvent.click(screen.getByRole('option', { name: 'Ποσοστό' }));
    clickOk();

    const model = committed(onCommit);
    const state = resolveTableNumberFormatState({
      entityId: 'entity-1', model, style: STANDARD, scope: SCOPE, layerColors: [],
    });
    expect(state.current?.kind).toBe('percent');
    expect(state.explicit).toBe(true);
  });

  it('🔑 ΠΟΛΛΑ κλικ = ΕΝΑ βήμα αναίρεσης — ο λόγος ύπαρξης του προσχεδίου', () => {
    const { onCommit } = renderDialog();
    fireEvent.click(screen.getByRole('option', { name: 'Ποσοστό' }));
    fireEvent.click(screen.getByRole('option', { name: 'Νόμισμα' }));
    fireEvent.click(screen.getByRole('option', { name: 'Δεκαδικός' }));
    clickOk();

    const model = committed(onCommit);
    const state = resolveTableNumberFormatState({
      entityId: 'entity-1', model, style: STANDARD, scope: SCOPE, layerColors: [],
    });
    expect(state.current?.kind).toBe('decimal');
  });

  it('🔴 «Άκυρο» ⇒ ΤΙΠΟΤΑ — το ζωντανό μοντέλο δεν αγγίζεται ποτέ πριν το ΟΚ', () => {
    const { onCommit, onClose } = renderDialog();
    fireEvent.click(screen.getByRole('option', { name: 'Νόμισμα' }));
    fireEvent.click(screen.getByRole('button', { name: 'Άκυρο' }));

    expect(onCommit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── §63. ΤΟ «ΟΚ» ΕΝΟΣ ΑΙΩΡΟΥΜΕΝΟΥ ΔΙΑΛΟΓΟΥ ──────────────────────────────────
  //
  // 🔴 Το ελάττωμα που κλείνουν αυτές οι τρεις άγκυρες: ο διάλογος έκλεινε **άνευ όρων** μετά το
  // «ΟΚ», ενώ η θύρα ρωτούσε τον **δρομέα** για το πού γράφει. Με `Escape` έξω από την παλέτα η
  // συνεδρία πέθαινε, το `commitModel` έπεφτε σε `if (!live) return`, και ο χρήστης έβλεπε τον
  // διάλογο να κλείνει — δηλαδή **σιωπηλή απώλεια εργασίας που έμοιαζε με επιτυχία**.

  it('🔴 §63 ο ΣΤΟΧΟΣ ταξιδεύει με το «ΟΚ» — η θύρα δεν μαντεύει ποτέ πού γράφει', () => {
    const { onCommit } = renderDialog();
    fireEvent.click(screen.getByRole('option', { name: 'Ποσοστό' }));
    clickOk();

    // Πρώτο όρισμα = ο στόχος, **με ταυτότητα οντότητας**. Χωρίς αυτό, το «ποιος πίνακας»
    // ξαναμαντεύεται τη στιγμή της γραφής από κατάσταση που ο διάλογος δεν ελέγχει.
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0].entityId).toBe('entity-1');
  });

  it('🔴 §63 ΑΡΝΗΣΗ ⇒ ο διάλογος ΜΕΝΕΙ ανοιχτός και ΛΕΕΙ γιατί — ποτέ σιωπηλό κλείσιμο', () => {
    const { onCommit, onClose } = renderDialog('number', {
      status: 'refused',
      reason: 'target-changed',
    });
    fireEvent.click(screen.getByRole('option', { name: 'Ποσοστό' }));
    clickOk();

    expect(onCommit).toHaveBeenCalledTimes(1);
    // 🔴 Η ουσία: **δεν** έκλεισε. Ο χρήστης κρατά τις ρυθμίσεις του.
    expect(onClose).not.toHaveBeenCalled();
    // Και μαθαίνει τον λόγο, ανακοινώσιμα.
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(
      elDxfViewer.table.formatCells.refusal.targetChanged,
    );
    // Η ταυτότητα του κλειδιού ελέγχεται ρητά: ένα λάθος κλειδί θα έβαφε ωμό κείμενο και το
    // παραπάνω `toBe` θα το έλεγε, αλλά αυτό εδώ δείχνει **ποιο** κλειδί οφείλει να είναι.
    expect(TABLE_FORMAT_COMMIT_REFUSAL_KEY['target-changed'])
      .toBe('table.formatCells.refusal.targetChanged');
  });

  it('🔴 §63 «τίποτα δεν άλλαξε» ΔΕΝ είναι άρνηση — κλείνει κανονικά, χωρίς μήνυμα', () => {
    // Η διάκριση δεν είναι λεπτολογία: «άνοιξα, πείραξα, το ξαναέφερα όπως ήταν, ΟΚ» είναι
    // **επιτυχία που δεν έχει τι να γράψει** (§60). Μήνυμα εκεί θα ήταν ψεύτικος συναγερμός.
    const { onClose } = renderDialog('number', { status: 'unchanged' });
    clickOk();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('🏆 το «Δείγμα» ονομάζεται ΠΑΡΑΔΕΙΓΜΑ όταν το κελί είναι κενό', () => {
    // Εδώ το Excel σιωπά. Δες `bim/table/table-format-sample.ts` για το γιατί η διάκριση δεν
    // είναι καλλωπισμός: χωρίς αυτήν, ένα `1.234,50` διαβάζεται ως περιεχόμενο του κελιού.
    renderDialog();
    expect(screen.getByText(/Παράδειγμα/)).toBeInTheDocument();
  });

  it('🏆 δείχνει ΠΟΙΟ ΕΠΙΠΕΔΟ αποφασίζει — και η επαναφορά είναι σβηστή στην κληρονομιά', () => {
    renderDialog();
    expect(screen.getByText('Το ορίζει ο τύπος δεδομένων της στήλης')).toBeInTheDocument();
    const reset = screen.getAllByRole('button', { name: /Επαναφορά/ })[0];
    expect(reset).toHaveAttribute('aria-disabled', 'true');
  });

  it('🏆 μόλις η μορφή γίνει ΡΗΤΗ, η επαναφορά ζωντανεύει και το επίπεδο αλλάζει', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('option', { name: 'Ποσοστό' }));
    expect(screen.getByText('Ορισμένο σε αυτά τα κελιά')).toBeInTheDocument();
    const reset = screen.getAllByRole('button', { name: /Επαναφορά/ })[0];
    expect(reset).not.toHaveAttribute('aria-disabled');

    fireEvent.click(reset);
    expect(screen.getByText('Το ορίζει ο τύπος δεδομένων της στήλης')).toBeInTheDocument();
  });
});

// ── 3. Καρτέλα «Στοίχιση» — η ΕΛΕΥΘΕΡΗ ΓΩΝΙΑ ───────────────────────────────

describe('§60 — η καρτέλα «Στοίχιση»', () => {
  it('🔴 Η ΕΛΕΥΘΕΡΗ ΓΩΝΙΑ: κάθε τιμή στο −90..+90, όχι μόνο τα δύο preset της κορδέλας', () => {
    const { onCommit } = renderDialog('alignment');
    fireEvent.change(screen.getByLabelText('Μοίρες'), { target: { value: '37' } });
    clickOk();

    const model = committed(onCommit);
    expect(resolveTableFormatState(model, STANDARD, SCOPE, 'textRotationDeg')?.value).toBe(37);
  });

  it('🔴 το κόψιμο είναι του ΜΟΝΤΕΛΟΥ — 400° δεν φτάνει ποτέ στο μοντέλο', () => {
    const { onCommit } = renderDialog('alignment');
    fireEvent.change(screen.getByLabelText('Μοίρες'), { target: { value: '400' } });
    clickOk();

    const model = committed(onCommit);
    expect(resolveTableFormatState(model, STANDARD, SCOPE, 'textRotationDeg')?.value).toBe(90);
  });

  it('🔑 το ΚΕΝΟ πεδίο δεν γράφει — ο χρήστης περνά αναγκαστικά από εκεί για να γράψει «−45»', () => {
    const { onCommit } = renderDialog('alignment');
    const input = screen.getByLabelText('Μοίρες');
    fireEvent.change(input, { target: { value: '45' } });
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.change(input, { target: { value: '-45' } });
    clickOk();

    const model = committed(onCommit);
    expect(resolveTableFormatState(model, STANDARD, SCOPE, 'textRotationDeg')?.value).toBe(-45);
  });

  it('🔴 το μηδέν ΣΒΗΝΕΙ το πεδίο αντί να γράψει ρητό `0` — αλλιώς νικά την κληρονομιά', () => {
    const { onCommit } = renderDialog('alignment');
    const input = screen.getByLabelText('Μοίρες');
    fireEvent.change(input, { target: { value: '45' } });
    fireEvent.change(input, { target: { value: '0' } });
    clickOk();

    const model = committed(onCommit);
    // Καμία παράκαμψη σε κανένα επίπεδο: το κελί επέστρεψε στην κληρονομιά.
    expect(resolveTableFormatState(model, STANDARD, SCOPE, 'textRotationDeg')?.overridden).toBe(false);
  });

  it('ο δείκτης του ημικυκλίου ανακοινώνεται ως slider με τα σωστά όρια', () => {
    renderDialog('alignment');
    const dial = screen.getByRole('slider', { name: 'Προσανατολισμός' });
    expect(dial).toHaveAttribute('aria-valuemin', '-90');
    expect(dial).toHaveAttribute('aria-valuemax', '90');
  });

  it('🔴 τα βέλη κινούν τη γωνία — η ελεύθερη γωνία υπάρχει και ΧΩΡΙΣ ποντίκι', () => {
    const { onCommit } = renderDialog('alignment');
    const dial = screen.getByRole('slider', { name: 'Προσανατολισμός' });
    fireEvent.keyDown(dial, { key: 'PageUp' });
    clickOk();

    const model = committed(onCommit);
    expect(resolveTableFormatState(model, STANDARD, SCOPE, 'textRotationDeg')?.value).toBe(15);
  });
});

/**
 * 🔴 ADR-739 §62 — **ΤΟ ΤΙΜΗΜΑ ΤΟΥ PORTAL, ΓΙΑ ΔΕΥΤΕΡΗ ΦΟΡΑ ΚΑΙ ΣΕ ΕΠΤΑ ΑΝΤΙΤΥΠΑ.**
 *
 * Το ADR-750 Φ6β το πλήρωσε ήδη μία φορά, για την παλέτα χρωμάτων, και άφησε άγκυρα
 * («το portal φέρει το σημάδι», `table-border-dialog.test.tsx`). Τα **επτά** πτυσσόμενα του
 * ίδιου διαλόγου είναι Radix `Select`, και το `SelectContent` αποδίδεται μέσα σε
 * `SelectPrimitive.Portal` — δηλαδή **έξω** από τον περιτυλιγμένο `<div>` που φέρει το
 * `TABLE_CELL_SESSION_MARKER`. Ίδιο σχήμα, ίδιο τίμημα, καμία άγκυρα.
 *
 * ## Τι σπάει, με σειρά συμβάντων
 * Το `FloatingPanel` **δεν** αυτο-εστιάζει (επαληθεύτηκε: κανένα `focus()` στο component), άρα
 * με τον διάλογο ανοιχτό το `<textarea>` του κελιού **κρατά** το πληκτρολόγιο. Το Radix Select
 * ανοίγει στο `pointerdown` και μεταφέρει την εστίαση **μέσα στο portal**:
 *
 * ```
 *   textarea.blur → relatedTarget = στοιχείο ΤΟΥ PORTAL → χωρίς σημάδι
 *     ⇒ isInsideTableCellSession(relatedTarget) = false  ⇒ onCommit() + rAF
 *     ⇒ activeElement στο portal, καμία δήλωση pointer, κανένα keepalive
 *     ⇒ onClose()  — Ο ΔΡΟΜΕΑΣ ΚΕΛΙΟΥ ΠΕΘΑΙΝΕΙ ΜΕ ΤΟ ΠΡΩΤΟ ΠΤΥΣΣΟΜΕΝΟ
 * ```
 *
 * ⚠️ Η άγκυρα ρωτά **τη δομή**, όχι τον χρονισμό: «βρίσκεται το ανοιγμένο portal μέσα σε ζώνη
 * που φέρει το σημάδι;». Είναι η ίδια ερώτηση που κάνει το `closest()` του φύλακα, στο ίδιο
 * DOM — άρα η απάντηση εδώ **είναι** η απάντησή του, χωρίς να χρειάζεται να στηθεί συνεδρία.
 */
describe('ADR-739 §62 — τα επτά πτυσσόμενα σε portal ΦΕΡΟΥΝ το σημάδι συνεδρίας', () => {
  /** Άνοιγμα με **πληκτρολόγιο**: το `pointerdown` του Radix Select θέλει pointer capture, που το jsdom δεν έχει. */
  function openSelect(name: string): HTMLElement {
    const trigger = screen.getByRole('combobox', { name });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    return trigger;
  }

  /**
   * 🔑 Ο **παρονομαστής**: αν το πτυσσόμενο πάψει κάποτε να είναι portal, η επόμενη άγκυρα θα
   * γινόταν πράσινη **δωρεάν** και θα σταματούσε να φυλάει οτιδήποτε — χωρίς κανείς να το μάθει.
   * Ρωτιέται με το **όνομα παραγωγής** της ρίζας (`FORMAT_CELLS_PANEL_DOM_ID`), το ίδιο που
   * ρωτά ο φύλακας του `Escape`, όχι με `data-testid`.
   */
  it('🔴 το πτυσσόμενο «Οριζόντια» βγαίνει ΟΝΤΩΣ σε portal — ο παρονομαστής της επόμενης άγκυρας', () => {
    renderDialog('alignment');
    openSelect('Οριζόντια');

    const option = screen.getByRole('option', { name: 'Κέντρο' });
    const panel = document.getElementById('dxf-table-format-cells-panel');
    expect(panel).not.toBeNull();
    expect(panel?.contains(option)).toBe(false);
  });

  /**
   * 🔴 Η άγκυρα του ελαττώματος. **Μετρήθηκε κόκκινη** πριν τη διόρθωση (2026-08-08): το
   * `closest()` επέστρεφε `null` για **κάθε** επιλογή, δηλαδή ο φύλακας συνεδρίας θα διάβαζε
   * το πρώτο πτυσσόμενο ως «ο χρήστης έφυγε από τον πίνακα».
   *
   * Και τα **τρία** πτυσσόμενα της καρτέλας, όχι ένα: το σημάδι μπαίνει στο **ένα** σώμα
   * (`TableFormatCellsSelect`), και μια άγκυρα σε ένα μόνο πεδίο θα έμενε πράσινη αν κάποιος
   * αύριο έγραφε όγδοο πτυσσόμενο με δικό του `Select` — ακριβώς ο λόγος που το σώμα είναι ένα.
   */
  it('🔴 ΚΑΘΕ πτυσσόμενο σε portal φέρει το σημάδι — αλλιώς σκοτώνει τον δρομέα με το πρώτο κλικ', () => {
    renderDialog('alignment');

    for (const name of ['Οριζόντια', 'Κατακόρυφα', 'Εσοχή']) {
      const trigger = openSelect(name);
      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(0);
      for (const option of options) {
        expect(option.closest('[data-table-cell-cursor="true"]')).not.toBeNull();
      }
      fireEvent.keyDown(trigger, { key: 'Escape' });
    }
  });
});
