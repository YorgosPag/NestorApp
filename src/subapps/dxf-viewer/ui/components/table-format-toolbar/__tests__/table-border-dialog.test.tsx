/**
 * ADR-750 Φ6 — **ο διάλογος «Περισσότερα περιγράμματα…»**: parity, a11y και σημασιολογία.
 *
 * Δοκιμάζεται από **το σημείο εισόδου του χρήστη** (η γραμμή εργαλείων → το dropdown → το
 * στοιχείο), όχι με απομονωμένο render του διαλόγου: ο διάλογος ζει σκόπιμα **έξω** από το
 * πάνελ (το στοιχείο κλείνει το πάνελ πριν τον ανοίξει), και ένα test που τον μοντάριζε μόνο
 * του θα επαλήθευε τοπολογία που δεν τρέχει ποτέ.
 *
 * 🔑 Το πιο σημαντικό test του αρχείου είναι το «**Άκυρο ⇒ τίποτα**»: ολόκληρη η δικαιολογία
 * του προσχεδίου-μοντέλου είναι ότι το ζωντανό μοντέλο **δεν** αγγίζεται πριν το ΟΚ.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import elDxfViewer from '@/i18n/locales/el/dxf-viewer.json';
import { TableFormatToolbar } from '../TableFormatToolbar';
import {
  TABLE_BORDER_STYLES,
  TABLE_BORDER_STYLE_GRID,
} from '@/subapps/dxf-viewer/bim/table/table-border-style-catalog';
import {
  ACI_COLOR_GRID,
  ACI_GRID_HUE_KEYS,
} from '@/subapps/dxf-viewer/ui/color/aci-color-grid';
import { setTableBorderDialogPositions } from '@/subapps/dxf-viewer/bim/table/table-border-dialog-draft';
import { buildTableEdgeIndex } from '@/subapps/dxf-viewer/bim/table/table-edge-model';
import { tableRangeSideEdges } from '@/subapps/dxf-viewer/bim/table/table-range-border-ops';
import { resolveTableBorderPencil } from '@/subapps/dxf-viewer/bim/table/table-border-pencil';
import { tableBorderPencilChoice } from '@/subapps/dxf-viewer/state/table-border-pencil-store';
// 🔴 ADR-739 §61 — ο ΕΝΑΣ ξενιστής + η θύρα που παίρνει το «ΟΚ». Δες το σχόλιο στο `renderToolbar`.
import { TableFormatCellsDialogHost } from '../format-cells-dialog/TableFormatCellsDialogHost';
import {
  __resetTableFormatPortForTests,
  setTableFormatPort,
} from '@/subapps/dxf-viewer/ui/table-cell-editor/table-format-port';
import { fakeTableFormatPort } from '@/subapps/dxf-viewer/ui/table-cell-editor/__tests__/fake-table-format-port';
import { __resetTableFormatCellsDialogForTests } from '@/subapps/dxf-viewer/state/table-format-cells-dialog-store';
import {
  BUILTIN_TABLE_STYLES,
  BUILTIN_TABLE_STYLE_IDS,
} from '@/subapps/dxf-viewer/bim/table/table-style-presets';
import type { TableFormatPort } from '@/subapps/dxf-viewer/ui/table-cell-editor/table-format-port';
import type { TableFormatSnapshot, TableToggleFormatState } from '../TableFormatToolbar';
import type { TableCellRangeBounds } from '@/subapps/dxf-viewer/bim/table/table-cell-range';
import type { TableStyle } from '@/subapps/dxf-viewer/bim/table/table-style';
import type { PersistedTableModel, TableColumn, TableRow } from '@/subapps/dxf-viewer/types/table';
import type { TableBorderSpec } from '@/subapps/dxf-viewer/types/table-edges';

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

// ── Στήσιμο μοντέλου ────────────────────────────────────────────────────────

const STANDARD: TableStyle = (() => {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD);
  if (!style) throw new Error('missing preset: standard');
  return style;
})();

function persisted(rowCount: number, colCount: number): PersistedTableModel {
  const columns: TableColumn[] = Array.from({ length: colCount }, (_, c) => ({
    id: `c${c + 1}`,
    sizing: { kind: 'fixed', widthMm: 10 },
    valueType: 'text',
    align: 'left',
  }));
  const rows: TableRow[] = Array.from({ length: rowCount }, (_, r) => ({
    id: `r${r + 1}`,
    rowClass: 'data',
    heightMm: 6,
  }));
  return { columns, rows, cells: [], merges: [] };
}

function bounds(
  firstRow: number, lastRow: number, firstCol: number, lastCol: number,
): TableCellRangeBounds {
  return { firstRow, lastRow, firstCol, lastCol };
}

const SINGLE_CELL = bounds(0, 0, 0, 0);
const PEN: TableBorderSpec = { visible: true, colorHex: '#ff00ff', widthMm: 0.25 };

const NO_FORMAT: TableToggleFormatState = { active: false, mixed: false, explicit: false };
const NO_COLOR = {
  current: undefined, mixed: false, explicit: false,
  inheritedColor: undefined, inheritedMixed: false, drawingColors: [],
} as const;
const FORMAT: TableFormatSnapshot = {
  bold: NO_FORMAT,
  italic: NO_FORMAT,
  underline: NO_FORMAT,
  textColor: { ...NO_COLOR, current: '#111111', inheritedColor: '#111111' },
  fillColor: NO_COLOR,
  canReset: false,
};

interface Scenario {
  readonly model?: PersistedTableModel;
  readonly target?: TableCellRangeBounds;
}

/**
 * 🔴 Module-level stores ⇒ **υποχρεωτικός** μηδενισμός (η παγίδα #8 του handoff): χωρίς αυτόν
 * ένας διάλογος που έμεινε ανοιχτός από προηγούμενο test θα «άνοιγε» μόνος του στο επόμενο.
 */
beforeEach(() => {
  __resetTableFormatCellsDialogForTests();
  __resetTableFormatPortForTests();
});

function renderToolbar(scenario: Scenario = {}) {
  const model = scenario.model ?? persisted(1, 1);
  const target = scenario.target ?? SINGLE_CELL;
  const onCommit = jest.fn();
  const surfaceRef = React.createRef<HTMLDivElement>();
  const noop = (): void => {};

  /*
    🔴 ADR-739 §61 — Ο ΔΙΑΛΟΓΟΣ ΔΕΝ ΖΩΓΡΑΦΙΖΕΤΑΙ ΠΙΑ ΑΠΟ ΤΗΝ ΥΠΟΔΟΧΗ.
    Το «ΟΚ» περνά από **έναν** δρόμο — τη θύρα — και το test τον ασκεί ολόκληρο: υποδοχή →
    store → ξενιστής → `commitModel`. Ένα prop `onCommit` στην υποδοχή, όπως πριν, θα έμενε
    πράσινο ακόμη κι αν κανείς δεν είχε μοντάρει ποτέ τον ξενιστή.
  */
  setTableFormatPort(fakeTableFormatPort({
    commitModel: onCommit,
    // Το «Πινέλο Μορφοποίησης» (ADR-768) ζει **μέσα** στην ίδια γραμμή και ρωτά τη θύρα σε κάθε
    // απόδοση. Δηλώνεται ρητά «δεν οπλίζεται», όχι σιωπηλά: το πινέλο δεν είναι το αντικείμενο
    // αυτής της σουίτας, και μια σιωπηλή προεπιλογή θα έκρυβε τη μέρα που θα γίνει.
    painter: {
      state: () => 'idle',
      canArm: () => false,
      arm: () => {},
      disarm: () => {},
    } as TableFormatPort['painter'],
  }));

  render(
    <TableFormatToolbar
      anchorX={10}
      anchorY={10}
      scope="range"
      label="A1"
      surfaceRef={surfaceRef}
      format={{
        format: FORMAT,
        onToggle: noop,
        onStepSize: noop,
        onReset: noop,
        onSetTextColor: noop,
        onSetFillColor: noop,
      }}
      borders={{
        canReset: true,
        onApply: noop,
        onReset: noop,
        onApplyDiagonal: noop,
        canClearDiagonals: true,
        resolvePencil: () => resolveTableBorderPencil(STANDARD, tableBorderPencilChoice()),
        moreBorders: {
          // 🔴 ADR-739 §60 — ο στόχος είναι πλέον ο **υπάρχων** `FormatTarget`: κουβαλά και το
          // `scope`, δηλαδή τη διαφορά «γράψε στα κελιά» / «γράψε στη στήλη». Το παλιό
          // `{bounds, model, style}` το έχανε — και ο διάλογος δεν είναι πια μόνο περιγράμματα.
          resolveTarget: () => ({
            model,
            style: STANDARD,
            scope: { kind: 'range' as const, bounds: target },
            layerColors: [],
          }),
        },
      }}
    />,
    wrapper,
  );
  // Ο ξενιστής μοντάρεται **χωριστά**, όπως ακριβώς στην παραγωγή (`DxfViewerDialogs`): δεν
  // είναι παιδί καμίας υποδοχής, και αυτό είναι όλη η αλλαγή του §61.
  render(<TableFormatCellsDialogHost />, wrapper);
  return { onCommit };
}

/** Ανοίγει τη γραμμή → το dropdown → τον διάλογο. Η διαδρομή του χρήστη, ολόκληρη. */
function openDialog(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Περιγράμματα' }));
  act(() => {
    fireEvent.click(screen.getByRole('menuitem', { name: 'Περισσότερα περιγράμματα…' }));
  });
}

// ── Τα tests ────────────────────────────────────────────────────────────────

describe('ADR-750 Φ6 — το σημείο εισόδου', () => {
  it('το στοιχείο ζει στο ΤΕΛΟΣ του dropdown, σε δική του ομάδα', () => {
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Περιγράμματα' }));
    const panel = screen.getByRole('menu', { name: 'Περιγράμματα κελιών' });
    const items = Array.from(panel.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    expect(items[items.length - 1]).toHaveTextContent('Περισσότερα περιγράμματα…');
  });

  it('🔑 χωρίς `moreBorders` το στοιχείο ΔΕΝ υπάρχει — καμία πόρτα προς κενό προσχέδιο', () => {
    const surfaceRef = React.createRef<HTMLDivElement>();
    const noop = (): void => {};
    render(
      <TableFormatToolbar
        anchorX={10} anchorY={10} scope="range" label="A1" surfaceRef={surfaceRef}
        borders={{
          canReset: true, onApply: noop, onReset: noop, onApplyDiagonal: noop,
          canClearDiagonals: true,
          resolvePencil: () => resolveTableBorderPencil(STANDARD, tableBorderPencilChoice()),
        }}
      />,
      wrapper,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Περιγράμματα' }));
    expect(screen.queryByRole('menuitem', { name: 'Περισσότερα περιγράμματα…' })).toBeNull();
  });

  it('το κλικ ανοίγει τον διάλογο ΚΑΙ κλείνει το dropdown', () => {
    renderToolbar();
    openDialog();
    expect(screen.getByRole('dialog', { name: /Μορφοποίηση κελιών/ })).toBeInTheDocument();
    expect(screen.queryByRole('menu', { name: 'Περιγράμματα κελιών' })).toBeNull();
  });
});

describe('ADR-750 Φ6β — ΑΙΩΡΟΥΜΕΝΟ κέλυφος, όχι modal', () => {
  /** `true` αν το στοιχείο ή κάποιος πρόγονός του φέρει `aria-hidden="true"`. */
  function hasAriaHiddenAncestor(element: HTMLElement): boolean {
    for (let node: HTMLElement | null = element; node; node = node.parentElement) {
      if (node.getAttribute('aria-hidden') === 'true') return true;
    }
    return false;
  }

  it('🔴 `aria-modal="false"` — η δήλωση που κάνει την παλέτα παλέτα', () => {
    renderToolbar();
    openDialog();
    expect(screen.getByRole('dialog', { name: /Μορφοποίηση κελιών/ }))
      .toHaveAttribute('aria-modal', 'false');
  });

  it('🔑 ό,τι είναι ΑΠΕΞΩ μένει ανακοινώσιμο — ο Radix το έκρυβε με `aria-hidden`', () => {
    renderToolbar();
    openDialog();
    // Αυτό είναι ΟΛΟ το ζητούμενο της Φ6β: ο πίνακας (και η γραμμή εργαλείων του) συνυπάρχει με
    // την ανοιχτή παλέτα. Με modal κέλυφος το κουμπί κληρονομούσε `aria-hidden` από τον αδελφό
    // του overlay — δηλαδή ο αναγνώστης οθόνης δεν έβλεπε τίποτα έξω από τον διάλογο.
    expect(hasAriaHiddenAncestor(screen.getByRole('button', { name: 'Περιγράμματα' })))
      .toBe(false);
  });

  it('η επικεφαλίδα φέρει τη λαβή συρσίματος — αλλιώς «floating» θα ήταν μόνο όνομα', () => {
    renderToolbar();
    openDialog();
    const panel = screen.getByRole('dialog', { name: /Μορφοποίηση κελιών/ });
    expect(panel.querySelector('[data-drag-handle="true"]')).not.toBeNull();
  });

  /**
   * 🔴 ADR-750 §21.10 — Η ΑΓΚΥΡΑ ΠΟΥ ΘΑ ΕΙΧΕ ΠΙΑΣΕΙ ΤΟ ΣΦΑΛΜΑ ΤΩΝ ΔΥΟ ΑΠΟΠΕΙΡΩΝ.
   *
   * Εδώ υπήρχε έλεγχος ότι η **ρίζα** φέρει `overflow-visible`. Ήταν πράσινος, και το κουμπί
   * ήταν νεκρό στην οθόνη: ο πραγματικός ψαλιδιστής ήταν το ενδιάμεσο `<section>` του ίδιου
   * του διαλόγου (`globals.css:1105` κάνει **κάθε** `<section>` δοχείο κύλισης). Δηλαδή η
   * άγκυρα ρωτούσε για **έναν** πρόγονο, ενώ το ερώτημα είναι για **όλους**.
   *
   * Το jsdom δεν υπολογίζει ψαλίδισμα και **ποτέ δεν θα το κάνει** — άρα καμία άγκυρα δεν
   * μπορεί να μετρήσει «κόπηκε». Μπορεί όμως να μετρήσει το **μόνο πράγμα που το καθιστά
   * αδύνατο**: ότι το popup δεν είναι απόγονος του διαλόγου. Ό,τι ζει εκτός του υποδέντρου
   * δεν μπορεί να ψαλιδιστεί από κανέναν πρόγονό του, σήμερα ή σε πέντε refactor.
   */
  it('🔴 η παλέτα χρωμάτων ΔΕΝ είναι απόγονος του διαλόγου — αλλιώς κάποιος πρόγονος θα την κόψει', () => {
    renderToolbar();
    openDialog();

    const panel = screen.getByRole('dialog', { name: /Μορφοποίηση κελιών/ });
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Χρώμα:' })); });

    const grid = screen.getByRole('grid', { name: 'Βασικά χρώματα' });
    expect(panel.contains(grid)).toBe(false);
    // Και ρητά: ούτε μέσα στο `<section role="tabpanel">`, που ήταν ο μετρημένος ψαλιδιστής.
    expect(screen.getByRole('tabpanel').contains(grid)).toBe(false);
  });

  /**
   * 🔑 Το τίμημα του portal, και γιατί ΔΕΝ είναι προαιρετικό.
   *
   * Βγάζοντας το popup από το δέντρο της γραμμής εργαλείων, το βγάζουμε και από τη ζώνη που
   * φέρει το `TABLE_CELL_SESSION_MARKER`. Χωρίς το σημάδι πάνω του, το πρώτο `mousedown` σε
   * δείγμα διαβάζεται ως «ο χρήστης έφυγε από τον πίνακα»: η συνεδρία κλείνει **ανάμεσα στο
   * `mousedown` και το `click`**, η γραμμή ξεμοντάρει, και το `click` δεν εκδίδεται ποτέ —
   * ακριβώς το σφάλμα «ορατό αλλά νεκρό» του §21.9, ξαναγεννημένο από τη διόρθωση.
   */
  it('🔴 το portal φέρει το σημάδι συνεδρίας — αλλιώς το κλικ σε δείγμα σκοτώνει τη συνεδρία', () => {
    renderToolbar();
    openDialog();
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Χρώμα:' })); });

    const grid = screen.getByRole('grid', { name: 'Βασικά χρώματα' });
    expect(grid.closest('[data-table-cell-cursor="true"]')).not.toBeNull();
  });

  /**
   * 🔴 ADR-739 §60 — η περιγραφή **μετακόμισε από τη ρίζα στο `<fieldset>`** των θέσεων.
   *
   * Όσο ο διάλογος ήταν μία καρτέλα, «πρώτα στυλ, μετά πού» περιέγραφε ολόκληρη την παλέτα. Με
   * τρεις ζωντανές, μια περιγραφή στη ρίζα θα ανακοινωνόταν και ανοίγοντας τον «Αριθμό» —
   * δηλαδή θα έλεγε ψέματα στα δύο τρίτα των περιπτώσεων. Η άγκυρα κρατά την **ουσία** (η
   * οδηγία υπάρχει και είναι συνδεδεμένη), όχι τη θέση της.
   */
  it('🔑 η περιγραφή ΔΕΝ χάθηκε — ζει στην ομάδα που περιγράφει', () => {
    renderToolbar();
    openDialog();
    const group = screen.getByRole('group', { name: 'Περίγραμμα' });
    const describedBy = group.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? '')?.textContent ?? '').toContain('υποδείγματα');
  });
});

describe('ADR-739 §60 — οι έξι καρτέλες, ΤΡΕΙΣ ζωντανές', () => {
  it('🔴 τρεις ανενεργές αλλά ΑΝΑΚΟΙΝΩΣΙΜΕΣ, μόνο η «Περίγραμμα» επιλεγμένη στο άνοιγμα', () => {
    renderToolbar();
    openDialog();

    const border = screen.getByRole('tab', { name: 'Περίγραμμα' });
    expect(border).toHaveAttribute('aria-selected', 'true');
    expect(border).not.toHaveAttribute('aria-disabled');

    // ✅ §60 — ζωντάνεψαν **στη θέση τους**: ο χρήστης δεν χρειάστηκε να ξαναμάθει πού είναι
    // τίποτα. Είναι ακριβώς ο λόγος που η Φ6 δήλωσε και τις έξι από την πρώτη μέρα.
    for (const name of ['Αριθμός', 'Στοίχιση']) {
      const tab = screen.getByRole('tab', { name });
      expect(tab).not.toHaveAttribute('aria-disabled');
      expect(tab).toHaveAttribute('aria-selected', 'false');
    }

    for (const name of ['Γραμματοσειρά', 'Γέμισμα', 'Προστασία']) {
      const tab = screen.getByRole('tab', { name });
      expect(tab).toHaveAttribute('aria-disabled', 'true');
      // `aria-disabled`, ΠΟΤΕ `disabled`: αλλιώς ο αναγνώστης δεν μαθαίνει ποτέ ότι υπάρχει.
      expect(tab).not.toHaveAttribute('disabled');
      expect(tab).toHaveAttribute('aria-selected', 'false');
    }
  });

  it('ο λόγος της απενεργοποίησης ταξιδεύει με `aria-describedby`', () => {
    renderToolbar();
    openDialog();
    const hintId = screen.getByRole('tab', { name: 'Γραμματοσειρά' }).getAttribute('aria-describedby');
    expect(hintId).toBeTruthy();
    expect(document.getElementById(hintId ?? '')).toHaveTextContent('Διαθέσιμο σε επόμενη φάση');
  });

  /**
   * 🔴 Η **εναλλαγή** είναι η νέα λειτουργία, άρα χρειάζεται τη δική της άγκυρα: μέχρι το §60 η
   * λέξη «καρτέλα» ήταν διακοσμητική (μία ζωντανή, καμία μετάβαση).
   */
  it('το κλικ σε ζωντανή καρτέλα αλλάζει περιεχόμενο· σε ανενεργή ΔΕΝ κάνει τίποτα', () => {
    renderToolbar();
    openDialog();

    fireEvent.click(screen.getByRole('tab', { name: 'Αριθμός' }));
    expect(screen.getByRole('tab', { name: 'Αριθμός' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('listbox', { name: 'Κατηγορία' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Προστασία' }));
    expect(screen.getByRole('tab', { name: 'Αριθμός' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('ADR-750 Φ6 — το listbox των 14 στυλ', () => {
  it('🔑 και τα 14 αποδίδονται, με ΜΕΤΑΦΡΑΣΜΕΝΗ ετικέτα — καμία ωμή', () => {
    renderToolbar();
    openDialog();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(TABLE_BORDER_STYLES.length);
    for (const option of options) {
      expect(option.textContent ?? '').not.toContain('lineStyles.');
      expect((option.textContent ?? '').trim().length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('option', { name: 'Συνεχής, λεπτό πάχος' })).toBeInTheDocument();
  });

  it('η αρχική επιλογή είναι μία και μόνο μία', () => {
    renderToolbar();
    openDialog();
    const selected = screen.getAllByRole('option').filter(
      (option) => option.getAttribute('aria-selected') === 'true',
    );
    expect(selected).toHaveLength(1);
  });

  it('🔴 ΑΓΚΥΡΑ — το σχήμα 2×7 ζει στα δεδομένα· το CSS το αντιγράφει', () => {
    // Το `.styleGrid` γράφει `repeat(7, …)`. Αν ο κατάλογος πάψει να είναι 2×7, αυτό το test
    // σπάει **πριν** η οθόνη δείξει λάθος πλέγμα — δες την κεφαλίδα του module CSS.
    expect(TABLE_BORDER_STYLE_GRID).toEqual({ columns: 2, rows: 7 });
    expect(TABLE_BORDER_STYLES).toHaveLength(
      TABLE_BORDER_STYLE_GRID.columns * TABLE_BORDER_STYLE_GRID.rows,
    );
  });
});

describe('ADR-750 Φ6 — ΕΝΑ κελί: ό,τι δεν έχει νόημα, γκριζάρει', () => {
  it('🔴 τα μεσαία κουμπιά και το «Πλέγμα» είναι ανενεργά', () => {
    renderToolbar();
    openDialog();

    for (const name of ['Οριζόντιο περίγραμμα στο μέσο', 'Κάθετο περίγραμμα στο μέσο']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-disabled', 'true');
    }
    expect(screen.getByRole('button', { name: 'Πλέγμα' })).toHaveAttribute('aria-disabled', 'true');

    // Και ό,τι ΕΧΕΙ νόημα μένει ενεργό — αλλιώς το test θα ήταν πράσινο με τα πάντα γκρίζα.
    expect(screen.getByRole('button', { name: 'Πάνω περίγραμμα' }))
      .not.toHaveAttribute('aria-disabled');
    expect(screen.getByRole('button', { name: 'Πλαίσιο' })).not.toHaveAttribute('aria-disabled');
  });

  it('σε περιοχή 2×2 τα ίδια χειριστήρια ΕΙΝΑΙ ενεργά', () => {
    renderToolbar({ model: persisted(2, 2), target: bounds(0, 1, 0, 1) });
    openDialog();
    expect(screen.getByRole('button', { name: 'Οριζόντιο περίγραμμα στο μέσο' }))
      .not.toHaveAttribute('aria-disabled');
    expect(screen.getByRole('button', { name: 'Πλέγμα' })).not.toHaveAttribute('aria-disabled');
  });
});

describe('ADR-750 Φ6 — η ροή «πρώτα στυλ, μετά πού»', () => {
  it('🔑 κλικ σε ακμή μετά από επιλογή στυλ: η θέση γίνεται πατημένη', () => {
    renderToolbar();
    openDialog();

    const top = screen.getByRole('button', { name: 'Πάνω περίγραμμα' });
    expect(top).toHaveAttribute('aria-pressed', 'false');

    act(() => { fireEvent.click(screen.getByRole('option', { name: 'Συνεχής, λεπτό πάχος' })); });
    act(() => { fireEvent.click(top); });

    expect(screen.getByRole('button', { name: 'Πάνω περίγραμμα' }))
      .toHaveAttribute('aria-pressed', 'true');
  });

  it('δεύτερο πάτημα του ίδιου = αναίρεση (εναλλαγή)', () => {
    renderToolbar();
    openDialog();
    act(() => { fireEvent.click(screen.getByRole('option', { name: 'Συνεχής, λεπτό πάχος' })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Πάνω περίγραμμα' })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Πάνω περίγραμμα' })); });

    expect(screen.getByRole('button', { name: 'Πάνω περίγραμμα' }))
      .toHaveAttribute('aria-pressed', 'false');
  });

  it('🔴 «Καμία» + κλικ σε υπάρχουσα ακμή τη ΣΒΗΝΕΙ — η Α14 από τη μεριά του χρήστη', () => {
    const model = setTableBorderDialogPositions(persisted(1, 1), SINGLE_CELL, ['top'], PEN);
    renderToolbar({ model });
    openDialog();

    expect(screen.getByRole('button', { name: 'Πάνω περίγραμμα' }))
      .toHaveAttribute('aria-pressed', 'true');
    // Η αρχική επιλογή είναι ήδη «Καμία» — δεν διαλέγουμε τίποτα, όπως και ο χρήστης.
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Πάνω περίγραμμα' })); });
    expect(screen.getByRole('button', { name: 'Πάνω περίγραμμα' }))
      .toHaveAttribute('aria-pressed', 'false');
  });

  it('το υπόδειγμα «Πλαίσιο» ανάβει και τις τέσσερις περιμετρικές', () => {
    renderToolbar();
    openDialog();
    act(() => { fireEvent.click(screen.getByRole('option', { name: 'Συνεχής, λεπτό πάχος' })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Πλαίσιο' })); });

    for (const name of [
      'Πάνω περίγραμμα', 'Κάτω περίγραμμα', 'Αριστερό περίγραμμα', 'Δεξί περίγραμμα',
    ]) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
    }
  });
});

describe('ADR-750 Φ6 — «Χρώμα:»: το κενό που ΚΑΝΕΝΑ test δεν είχε ανοίξει', () => {
  /**
   * 🔴 Ο ίδιος ο `TableBorderDialogColor` γράφει στην κεφαλίδα του ότι ένα ζωντανό `TypeError`
   * πέρασε από **145 πράσινα tests** επειδή «κανένα δεν άνοιξε τη γραμμή χρώματος». Έμεινε έτσι
   * και μετά τη Φ6: το χρώμα ήταν το **μόνο** χειριστήριο του διαλόγου χωρίς άγκυρα.
   */
  it('🔑 το «Χρώμα:» ΕΙΝΑΙ κουμπί και ανοίγει παλέτα — όχι ετικέτα ανάγνωσης', () => {
    renderToolbar();
    openDialog();

    const trigger = screen.getByRole('button', { name: 'Χρώμα:' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    act(() => { fireEvent.click(trigger); });

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('grid', { name: 'Βασικά χρώματα' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Περισσότερα χρώματα…' })).toBeInTheDocument();
  });

  it('🔴 το επιλεγμένο χρώμα φτάνει ΣΤΗΝ ΑΚΜΗ — όχι μόνο στο δείγμα του κουμπιού', () => {
    const { onCommit } = renderToolbar();
    openDialog();

    act(() => { fireEvent.click(screen.getByRole('option', { name: 'Συνεχής, λεπτό πάχος' })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Χρώμα:' })); });

    // Το πλέγμα γράφεται κατά ΣΕΙΡΑ (απόχρωση ανά στήλη, τόνος ανά σειρά): «κόκκινο, βασικός».
    const hues = ACI_GRID_HUE_KEYS.length;
    const redBase = ACI_COLOR_GRID[1][1].hex;
    act(() => { fireEvent.click(screen.getAllByRole('gridcell')[1 * hues + 1]); });

    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Πάνω περίγραμμα' })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'OK' })); });

    const committed = onCommit.mock.calls[0][0] as PersistedTableModel;
    const index = buildTableEdgeIndex(committed.edges);
    const [key] = tableRangeSideEdges(committed, SINGLE_CELL, 'top');
    expect(index.get(key)?.colorHex).toBe(redBase);
  });
});

describe('ADR-750 Φ6 — η μεικτή κατάσταση', () => {
  it('🔴 μερικές ακμές ⇒ `aria-pressed="mixed"` ΚΑΙ ονομασμένη ένδειξη', () => {
    // 1×2: περίγραμμα πάνω **μόνο** στο πρώτο κελί, διάλογος για ολόκληρη τη γραμμή.
    const model = setTableBorderDialogPositions(persisted(1, 2), bounds(0, 0, 0, 0), ['top'], PEN);
    renderToolbar({ model, target: bounds(0, 0, 0, 1) });
    openDialog();

    const top = screen.getByRole('button', { name: /Πάνω περίγραμμα/ });
    expect(top).toHaveAttribute('aria-pressed', 'mixed');
    expect(top).toHaveTextContent('Μικτό περίγραμμα');
  });
});

describe('ADR-750 Φ6 — ΟΚ / Άκυρο: το προσχέδιο δεν διαρρέει', () => {
  it('🔴 Άκυρο ⇒ ΤΙΠΟΤΑ δεν φτάνει στο ζωντανό μοντέλο', () => {
    const { onCommit } = renderToolbar();
    openDialog();
    act(() => { fireEvent.click(screen.getByRole('option', { name: 'Συνεχής, λεπτό πάχος' })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Πάνω περίγραμμα' })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Άκυρο' })); });

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('🔑 ΟΚ ⇒ ΕΝΑ commit, με το μοντέλο που έχτισε ο χρήστης', () => {
    const { onCommit } = renderToolbar();
    openDialog();
    act(() => { fireEvent.click(screen.getByRole('option', { name: 'Συνεχής, λεπτό πάχος' })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Πάνω περίγραμμα' })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'OK' })); });

    expect(onCommit).toHaveBeenCalledTimes(1);

    // Και η ακμή είναι όντως εκεί — όχι απλώς «κλήθηκε κάτι».
    const committed = onCommit.mock.calls[0][0] as PersistedTableModel;
    const index = buildTableEdgeIndex(committed.edges);
    const keys = tableRangeSideEdges(committed, SINGLE_CELL, 'top');
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(index.get(key)?.visible).toBe(true);
  });

  it('πολλά κλικ ⇒ ΕΝΑ και μόνο ένα commit (ένα `Ctrl+Z`)', () => {
    const { onCommit } = renderToolbar();
    openDialog();
    act(() => { fireEvent.click(screen.getByRole('option', { name: 'Συνεχής, λεπτό πάχος' })); });
    for (const name of ['Πάνω περίγραμμα', 'Κάτω περίγραμμα', 'Αριστερό περίγραμμα']) {
      act(() => { fireEvent.click(screen.getByRole('button', { name })); });
    }
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'OK' })); });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
