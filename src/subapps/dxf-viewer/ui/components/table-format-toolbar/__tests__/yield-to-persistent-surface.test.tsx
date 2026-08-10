/**
 * 🔴 ADR-739 §64 — **η εφήμερη επιφάνεια υποχωρεί στη μόνιμη**: η μηχανή και η καλωδίωση.
 *
 * ## Τι φυλάει, με μία πρόταση
 * Το mini toolbar ζωγραφιζόταν πάνω στον διάλογο «Μορφοποίηση κελιών» που ανοίγει το **δικό
 * του** μενού. Μετρημένο ζωντανά (2026-08-08): επικάλυψη **456×63 px = 12,8%** της επιφάνειας
 * του διαλόγου, και `elementFromPoint` στο κέντρο της ⇒ **κουμπί του toolbar** — απάτητο
 * περιεχόμενο, όχι απλώς κρυμμένο.
 *
 * ## 🔴 ΓΙΑΤΙ Η ΟΜΑΔΑ Β ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΗ, ΠΑΡΟΤΙ Η Α ΔΟΚΙΜΑΖΕΙ ΤΗ ΜΗΧΑΝΗ
 * Το §63 μέτρησε ότι **μηδέν** άγκυρα υπήρχε για τον εκδότη της θύρας — «γι' αυτό οι τρεις
 * σιωπές μπορούσαν να ζουν εκεί». Μια σουίτα που δοκιμάζει **μόνο** το hook θα ήταν πράσινη
 * ακόμη κι αν κανένα από τα δύο μενού δεν το καλούσε ποτέ: κάλυψη σε **νεκρό δίδυμο** δεν
 * είναι κάλυψη. Η ομάδα Β μοντάρει το **πραγματικό** μενού και ρωτά την **οθόνη**.
 *
 * ## 🔴 ΤΟ Β2 ΕΙΝΑΙ ΤΟ ΜΙΣΟ ΤΗΣ ΑΓΚΥΡΑΣ — μη-παλινδρόμηση της απόφασης §28.13
 * Η γραμμή **οφείλει** να επιβιώνει του μενού για την επόμενη εντολή (απόφαση ιδιοκτήτη). Μια
 * διόρθωση που τη σβήνει *πάντα* θα ήταν εξίσου λάθος, και θα περνούσε κάθε test της ομάδας Α.
 * Το ζεύγος Β1+Β2 είναι που ορίζει τη συμπεριφορά: **φεύγει μόνο μπροστά σε μόνιμη επιφάνεια.**
 *
 * @see ../use-yield-to-persistent-surface.ts — η μηχανή
 * @see ../../TableHeaderContextMenu.tsx · ../../TableRangeContextMenu.tsx — οι δύο ξενιστές
 */

import React, { useCallback } from 'react';
import fs from 'fs';
import path from 'path';
import { act, render, renderHook, screen } from '@testing-library/react';
import {
  __resetTableFormatCellsDialogForTests,
  closeTableFormatCellsDialog,
  openTableFormatCellsDialog,
  setTableFormatCellsTab,
} from '../../../../state/table-format-cells-dialog-store';
import { useYieldToPersistentSurface } from '../use-yield-to-persistent-surface';
import {
  TableHeaderContextMenu,
  type TableHeaderContextMenuHandle,
} from '../../TableHeaderContextMenu';
import { headerMenuProps } from './table-header-menu-props.fixture';
import type { FormatTarget } from '../../../table-cell-editor/table-format-snapshot';
import type { PersistedTableModel } from '../../../../types/table';

// Ίδιο μοτίβο με το αδελφό `table-format-toolbar.test.tsx`: ο πραγματικός `loadNamespace`
// κάνει δυναμικό import αρχείων που δεν χρειάζονται εδώ. Καμία σουίτα εδώ δεν εξετάζει
// κείμενο — μόνο **παρουσία επιφάνειας** — οπότε το ωμό κλειδί είναι αρκετό.
jest.mock('@/i18n/lazy-config', () => ({
  loadNamespace: jest.fn(() => Promise.resolve()),
  CRITICAL_NAMESPACES: [],
}));

// Module-level store ⇒ **υποχρεωτικό** reset ανάμεσα στα tests (παγίδα #7 του handoff).
beforeEach(() => {
  __resetTableFormatCellsDialogForTests();
});

/** Ίδιο σχήμα με το `table-format-cells-dialog-store.test.ts` — σταθερή ταυτότητα, τίποτα άλλο. */
function target(tag: string): FormatTarget {
  return {
    entityId: `entity-${tag}`,
    model: { tag } as unknown as PersistedTableModel,
    style: {} as FormatTarget['style'],
    scope: { kind: 'range', bounds: { firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 } },
    layerColors: [],
  };
}

// ============================================================================
// ΟΜΑΔΑ Α — η μηχανή
// ============================================================================

describe('Α — η μηχανή: πότε υποχωρεί η εφήμερη επιφάνεια', () => {
  /** Το hook με **σταθερό** `dismiss`, όπως το απαιτεί η κεφαλίδα του module. */
  function mount() {
    const dismiss = jest.fn();
    renderHook(() => {
      const stable = useCallback(() => { dismiss(); }, []);
      useYieldToPersistentSurface(stable);
    });
    return { dismiss };
  }

  it('Α1 — χωρίς μόνιμη επιφάνεια, καμία αποχώρηση', () => {
    const { dismiss } = mount();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('🔴 Α2 — μόλις ανοίξει ο διάλογος, η γραμμή υποχωρεί ΑΚΡΙΒΩΣ μία φορά', () => {
    const { dismiss } = mount();
    act(() => { openTableFormatCellsDialog({ target: target('a'), tab: 'number' }); });
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('Α3 — αλλαγή καρτέλας ενόσω ζει ο διάλογος ΔΕΝ ξαναρωτά (η εξάρτηση είναι boolean)', () => {
    const { dismiss } = mount();
    act(() => { openTableFormatCellsDialog({ target: target('a'), tab: 'number' }); });
    act(() => { setTableFormatCellsTab('alignment'); });
    act(() => { setTableFormatCellsTab('border'); });
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('Α4 — κλείσιμο και ΝΕΟ άνοιγμα ⇒ δεύτερη αποχώρηση (η επόμενη γραμμή δεν είναι η ίδια)', () => {
    const { dismiss } = mount();
    act(() => { openTableFormatCellsDialog({ target: target('a'), tab: 'number' }); });
    act(() => { closeTableFormatCellsDialog(); });
    act(() => { openTableFormatCellsDialog({ target: target('b'), tab: 'number' }); });
    expect(dismiss).toHaveBeenCalledTimes(2);
  });

  it('Α5 — στόχος `null` ⇒ ο διάλογος ΔΕΝ ανοίγει, άρα η γραμμή ΔΕΝ υποχωρεί', () => {
    const { dismiss } = mount();
    act(() => { openTableFormatCellsDialog({ target: null, tab: 'number' }); });
    expect(dismiss).not.toHaveBeenCalled();
  });
});

// ============================================================================
// ΟΜΑΔΑ Β — η καλωδίωση: ρωτάμε την ΟΘΟΝΗ, όχι τη μηχανή
// ============================================================================

describe('Β — η καλωδίωση: το πραγματικό μενού, η πραγματική γραμμή', () => {
  const hit = { axis: 'column', colId: 'c1', index: 1 } as const;

  async function openHeaderMenu() {
    const ref = React.createRef<TableHeaderContextMenuHandle>();
    render(<TableHeaderContextMenu ref={ref} {...headerMenuProps} onToggleFormat={() => {}} onClosed={() => {}} />);
    await act(async () => { ref.current?.open(10, 10, hit); });
    return ref;
  }

  it('🔴 Β1 — ο διάλογος ανοίγει ⇒ η γραμμή ΦΕΥΓΕΙ από το DOM', async () => {
    await openHeaderMenu();
    expect(screen.getByRole('toolbar')).toBeInTheDocument();

    await act(async () => { openTableFormatCellsDialog({ target: target('a'), tab: 'number' }); });

    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  /**
   * 🔴 Το ζητούμενο είναι «φεύγει **μπροστά σε μόνιμη επιφάνεια**», όχι «φεύγει σε κάθε κίνηση
   * του store». Το αίτημα με `target: null` **δεν ανοίγει** διάλογο (§61) — άρα είναι ακριβώς
   * η κίνηση που ξεχωρίζει τα δύο. Μια υλοποίηση που άκουγε το *συμβάν* αντί για την
   * *κατάσταση* θα έσβηνε τη γραμμή εδώ, και θα ακύρωνε την απόφαση του ιδιοκτήτη σιωπηλά.
   */
  it('🔴 Β2 — αίτημα που ΔΕΝ ανοίγει διάλογο ⇒ η γραμμή ΜΕΝΕΙ (η απόφαση §28.13 ακέραιη)', async () => {
    await openHeaderMenu();
    expect(screen.getByRole('toolbar')).toBeInTheDocument();

    await act(async () => { openTableFormatCellsDialog({ target: null, tab: 'number' }); });

    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });
});

// ============================================================================
// ΟΜΑΔΑ Γ — και οι ΔΥΟ ξενιστές, όχι μόνο αυτός που μοντάρεται εδώ
// ============================================================================

describe('Γ — καμία επιφάνεια με mini toolbar δεν μένει έξω από τον κανόνα', () => {
  /**
   * 🔴 ADR-739 §67.10 — **ΤΡΕΙΣ** ξενιστές πλέον. Ο τρίτος είναι η μόνη επιφάνεια που δείχνει τη
   * γραμμή **χωρίς μενού** από κάτω (δεξί κλικ μέσα σε πεδίο κειμένου, Excel parity).
   */
  const HOSTS = [
    'TableHeaderContextMenu.tsx',
    'TableRangeContextMenu.tsx',
    'TableTextMiniToolbar.tsx',
  ] as const;

  /**
   * 🔴 Στατική άγκυρα **επίτηδες**, και ο λόγος είναι μετρημένος: η ομάδα Β μοντάρει το
   * `TableHeaderContextMenu`. Ο `TableRangeContextMenu` έχει **άλλο** συμβόλαιο props και θα
   * ζητούσε δεύτερο σκελετό — δηλαδή θα γεννούσε ακριβώς τον sibling clone που το §64 μόλις
   * κατάργησε. Το ερώτημα εδώ δεν είναι «τι κάνει», είναι «**ρωτήθηκε καθόλου;**» — και αυτό
   * απαντιέται από την πηγή.
   *
   * ⚠️ Ο κατάλογος **δεν** είναι χειρόγραφος πίνακας που μπορεί να αποκλίνει: παράγεται από
   * το «ποιος αποδίδει τη γραμμή». Νέος ξενιστής ⇒ πέφτει εδώ **μόνος του**.
   *
   * 🔴 **ΤΟ ΚΡΙΤΗΡΙΟ ΕΓΙΝΕ ΤΥΦΛΟ ΚΑΙ ΤΟ ΕΠΙΑΣΕ ΑΥΤΟ ΤΟ TEST** (§67.10, 2026-08-10). Ρωτούσε
   * μόνο `<TableFormatToolbar`. Όταν η κοινή **αγκύρωση** εξήχθη σε `AnchoredFormatToolbar`
   * (CHECK 3.28, τέταρτος κλώνος), δύο από τους τρεις ξενιστές έπαψαν να γράφουν το όνομα που
   * ψάχνει ο φρουρός — και ο κατάλογος έπεσε σε **έναν**. Δηλαδή ο μηχανισμός «νέος ξενιστής
   * πέφτει μέσα μόνος του» θα ήταν **σιωπηλά νεκρός**, με το test πράσινο αν κάποιος είχε απλώς
   * ενημερώσει το `HOSTS`.
   *
   * ⇒ Το κριτήριο ρωτά πλέον **και τα δύο** ονόματα: την ίδια τη γραμμή **και** την αγκύρωσή της.
   * Ένας τρίτος έμμεσος δρόμος αύριο θα ξαναγεννούσε το ίδιο κενό — γι' αυτό το όνομα μπαίνει
   * εδώ και όχι σε regex σκορπισμένο αλλού.
   */
  const dir = path.join(__dirname, '..', '..');

  /** Τα δύο ονόματα που σημαίνουν «αυτό το αρχείο βάζει mini toolbar στην οθόνη». */
  const RENDERS_TOOLBAR = /<(TableFormatToolbar|AnchoredFormatToolbar)\b/;

  it('Γ1 — ο κατάλογος ξενιστών είναι ΑΚΡΙΒΩΣ όσοι αποδίδουν τη γραμμή', () => {
    const rendersToolbar = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.tsx'))
      .filter((f) => RENDERS_TOOLBAR.test(fs.readFileSync(path.join(dir, f), 'utf8')));
    expect(rendersToolbar.sort()).toEqual([...HOSTS].sort());
  });

  it.each(HOSTS)('🔴 Γ2 — το %s καλεί το useYieldToPersistentSurface', (host) => {
    const src = fs.readFileSync(path.join(dir, host), 'utf8');
    expect(src).toContain('useYieldToPersistentSurface(');
  });
});
