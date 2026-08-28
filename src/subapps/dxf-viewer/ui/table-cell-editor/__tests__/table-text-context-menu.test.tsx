/**
 * 🔴 ADR-739 §67 — **Η ΑΠΟΔΕΙΞΗ ΟΤΙ ΤΟ ΔΕΞΙ ΚΛΙΚ ΜΕΣΑ ΣΕ ΚΕΛΙ ΔΕΝ ΑΝΗΚΕΙ ΣΤΟΝ BROWSER.**
 *
 * ## Το ελάττωμα, και γιατί καμία υπάρχουσα άγκυρα δεν το έπιανε
 * Σε λειτουργία **γραφής** το δεξί κλικ έδειχνε το native μενού του Chrome («Emoji», «Αναίρεση»,
 * «Ορθογραφικός έλεγχος»). Η αιτία είναι **δομική**: ο δρομολογητής δεξιού κλικ ζει σε capture
 * πάνω στον `containerRef` του καμβά, ενώ τα δύο πεδία κειμένου ζουν στο `CanvasSectionOverlays`
 * — **αδελφό** του `CanvasLayerStack`, δηλαδή εκτός εκείνου του δοχείου. Το συμβάν δεν περνούσε
 * ποτέ από εκεί που θα το σταματούσε κάποιος.
 *
 * ⚠️ **Και τα 569 υπάρχοντα tests του φακέλου ήταν πράσινα πάνω στο ελάττωμα**, γιατί κανένα δεν
 * ρωτούσε «ποιος ζητά την επιφάνεια;» — το ίδιο σχήμα με τη Φ.1 του CHECK 3.41 («πύλη χωρίς
 * άγκυρα δεν είναι πύλη»). Η ομάδα **Α** είναι ακριβώς αυτή η άγκυρα: εκτελεί πραγματικό
 * `contextmenu` πάνω στα **πραγματικά** components και απαιτεί να καταναλωθεί.
 *
 * ## 🔴 §67.10 — ΤΙ ΑΛΛΑΞΕ ΜΕΤΑ ΤΗ ΔΕΥΤΕΡΗ ΜΕΤΡΗΣΗ ΤΟΥ ΙΔΙΟΚΤΗΤΗ
 * Η πρώτη γραφή άνοιγε **μενού πέντε εντολών + γραμμή**. Στιγμιότυπο Excel (10/08, κελί `K15` σε
 * Επεξεργασία): **μόνο η γραμμή**. Το μενού διαγράφηκε — μαζί του έφυγε και η ομάδα **Π** αυτού
 * του αρχείου, που κλείδωνε τη διάταξή του. Ένα test που επικυρώνει μητρώο το οποίο δεν
 * αποδίδεται πουθενά είναι πράσινο πάνω σε νεκρό κώδικα.
 *
 * ## Τι ΔΕΝ αποδεικνύει
 * Ότι η γραμμή **ζωγραφίζεται** σωστά (αυτό είναι το `TableFormatToolbar`, με δικές του άγκυρες)
 * και ότι το native του browser όντως καταστέλλεται από το `preventDefault` (προδιαγραφή DOM, όχι
 * δικός μας κώδικας). Εδώ ελέγχεται **ποιος ρωτά και πότε καταναλώνει** — ό,τι είναι δικό μας.
 *
 * @see ui/table-cell-editor/table-text-menu-port.ts — γιατί θύρα και όχι νέα προτεραιότητα
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §67
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  // Το κλειδί **είναι** η απόδοση: έτσι κάθε ετικέτα που λείπει από τα locales φαίνεται ως
  // κλειδί στο assertion αντί να πέσει σε σιωπηλό κενό.
  useTranslation: () => ({ t: (key: string) => key }),
}));

import {
  __resetTableTextMenuPortForTests,
  getTableTextMenuPort,
  setTableTextMenuPort,
} from '../table-text-menu-port';
import { TableCellEditorOverlay } from '../TableCellEditorOverlay';
import { TableFormulaBar } from '../TableFormulaBar';
import type { TextEditorAnchor } from '../../text-toolbar/TextEditorAnchorLayer';
// 🔴 ADR-753 §28 — το στυλ του κελιού είναι πλέον **είσοδος** του επεξεργαστή: είναι η βάση
// από την οποία κληρονομεί κάθε βαμμένο τμήμα. Χτίζεται από τον ΕΝΑ κατασκευαστή του έργου —
// ένα χειρόγραφο αντικείμενο εδώ θα ήταν τρίτη έκφραση της προεπιλογής.
import { baseCellStyle } from '../../../bim/table/table-style';
import { createTableModel } from '../../../bim/table/table-model-helpers';
import { hierarchicalTableStyle } from '../../../bim/table/__tests__/hierarchical-table-style-fixture';

// ──────────────────────────────────────────────────────────────────────────────
// ΟΜΑΔΑ Α — Η ΑΓΚΥΡΑ: τα δύο πεδία ΖΗΤΟΥΝ τη γραμμή, με πραγματικό `contextmenu`
// ──────────────────────────────────────────────────────────────────────────────

const ANCHOR: TextEditorAnchor = {
  project: () => ({ x: 0, y: 0 }),
  subscribe: () => () => {},
  size: { width: 120, height: 24 },
};

const NOOP = (): void => {};

const CELL_STYLE = baseCellStyle(hierarchicalTableStyle().rowClasses.data);

/** 🔴 §69 — μοντέλο για το πλαίσιο ονόματος. Άδειο επίτηδες: εδώ δεν σέρνεται τίποτα. */
const EMPTY_MODEL = createTableModel({ columns: [], rows: [] });

function renderCellEditor(): HTMLElement {
  render(
    <TableCellEditorOverlay
      entityId="tbl-1"
      rowId="r1"
      colId="c1"
      mode="edit"
      draft="ΣΚΥΡΟΔΕΜΑ"
      initialText="ΣΚΥΡΟΔΕΜΑ"
      cellStyle={CELL_STYLE}
      caretRevision={0}
      anchor={ANCHOR}
      readOnly={false}
      onCommit={NOOP}
      onMove={NOOP}
      onClear={NOOP}
      onHistory={NOOP}
      onExtend={NOOP}
      onSelectAll={NOOP}
      onToggleAbsoluteRef={NOOP}
      onCopy={NOOP}
      onCut={NOOP}
      onPaste={NOOP}
      onOpenLink={NOOP}
    />,
  );
  // ADR-753 §28 — ο επεξεργαστής κελιού δεν είναι πια στοιχείο φόρμας· ζητιέται από το
  // **γνώρισμα ρόλου** του, που είναι και ο τρόπος με τον οποίο τον αναγνωρίζει ο κώδικας.
  const field = document.querySelector<HTMLElement>('[data-table-rich-text="true"]');
  if (!field) throw new Error('ο επεξεργαστής κελιού δεν αποδόθηκε');
  return field;
}

function renderFormulaBar(): HTMLInputElement {
  render(
    <TableFormulaBar
      reference={{ a1: 'B2', columnHeader: 'ΠΕΡΙΓΡΑΦΗ', rowIndex: 1, colIndex: 1 }}
      // 🔴 ADR-739 §69 — η γραμμή τύπων φιλοξενεί πλέον και το **πλαίσιο ονόματος**, που
      // χρειάζεται μοντέλο (μέτρηση σύρσης) και μετάβαση. Δεν αφορούν αυτό το αρχείο.
      model={EMPTY_MODEL}
      onGoTo={() => false}
      mode="edit"
      draft="ΣΚΥΡΟΔΕΜΑ"
      initialText="ΣΚΥΡΟΔΕΜΑ"
      cellStyle={CELL_STYLE}
      caretRevision={0}
      anchor={ANCHOR}
      onCommit={NOOP}
      onMove={NOOP}
      onClear={NOOP}
      onHistory={NOOP}
      onExtend={NOOP}
      onSelectAll={NOOP}
      onToggleAbsoluteRef={NOOP}
    />,
  );
  // 🔴 ADR-739 §69 — στοχευμένα το πεδίο **τιμής**, όχι «to πρώτο input»: από το §69 η
  // γραμμή έχει **δύο** πεδία κειμένου, και το πρώτο στο DOM είναι το πλαίσιο ονόματος — πεδίο
  // **πλοήγησης**, που δεν έχει πρόχειρο να αποκόψει ή να επικολλήσει κανείς. Το κλειδί
  // είναι η **απόδοση του mock** (κλειδί = κείμενο), άρα σταθερό και αυτο-τεκμηριωμένο.
  const field = document.querySelector('input[aria-label="table.formulaBar.valueAriaLabel"]');
  if (!(field instanceof HTMLInputElement)) throw new Error('η γραμμή τύπων δεν αποδόθηκε');
  return field;
}

/** Στέλνει πραγματικό `contextmenu` και λέει **αν καταναλώθηκε**. */
function rightClick(field: HTMLElement): boolean {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 60 });
  fireEvent(field, event);
  return event.defaultPrevented;
}

describe('Α — ΤΟ ΔΕΞΙ ΚΛΙΚ ΦΤΑΝΕΙ ΣΤΗ ΘΥΡΑ, ΑΠΟ ΚΑΙ ΤΑ ΔΥΟ ΠΕΔΙΑ', () => {
  afterEach(() => { __resetTableTextMenuPortForTests(); });

  it.each([
    ['ο επεξεργαστής κελιού', renderCellEditor],
    ['η γραμμή τύπων', renderFormulaBar],
  ])('🔴 Α1 — %s ζητά τη γραμμή και ΚΑΤΑΝΑΛΩΝΕΙ το συμβάν', (_name, mount) => {
    const opened: Array<{ x: number; y: number; tag: string }> = [];
    setTableTextMenuPort({
      open: (x, y, field) => { opened.push({ x, y, tag: field.tagName }); return true; },
    });

    const field = mount();
    expect(rightClick(field)).toBe(true);

    // Η θύρα παίρνει **το ίδιο το πεδίο**: εκεί πρέπει να γυρίσει η εστίαση όταν φύγει η γραμμή,
    // και το «ποιο από τα δύο» δεν μπορεί να απαντηθεί αλλιώς.
    expect(opened).toEqual([{ x: 40, y: 60, tag: field.tagName }]);
  });

  it.each([
    ['ο επεξεργαστής κελιού', renderCellEditor],
    ['η γραμμή τύπων', renderFormulaBar],
  ])('🔴 Α2 — %s ΔΕΝ καταναλώνει όταν η θύρα αρνήθηκε να ανοίξει', (_name, mount) => {
    // Ένα σιωπηλό `preventDefault` πάνω σε επιφάνεια που δεν άνοιξε θα ήταν δεξί κλικ που **δεν
    // κάνει τίποτα** — χειρότερο και από το native, γιατί ο χρήστης δεν μαθαίνει γιατί.
    setTableTextMenuPort({ open: () => false });
    expect(rightClick(mount())).toBe(false);
  });

  it.each([
    ['ο επεξεργαστής κελιού', renderCellEditor],
    ['η γραμμή τύπων', renderFormulaBar],
  ])('Α3 — %s δεν σκάει όταν καμία θύρα δεν είναι δηλωμένη', (_name, mount) => {
    expect(getTableTextMenuPort()).toBeNull();
    expect(rightClick(mount())).toBe(false);
  });
});

describe('Α4 — η θύρα αποσύρεται καθαρά', () => {
  afterEach(() => { __resetTableTextMenuPortForTests(); });

  it('ο δεύτερος κάτοχος δεν σβήνεται από το cleanup του πρώτου (διπλό mount)', () => {
    const first = { open: () => true };
    const second = { open: () => true };
    setTableTextMenuPort(first);
    setTableTextMenuPort(second);
    // Το cleanup του πρώτου ελέγχει **ταυτότητα** πριν σβήσει — δες το effect του ιδιοκτήτη.
    if (getTableTextMenuPort() === first) setTableTextMenuPort(null);
    expect(getTableTextMenuPort()).toBe(second);
  });
});
