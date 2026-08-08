/**
 * 🔴 ADR-739 §61 — **ΟΙ ΔΥΟ ΥΠΟΔΟΧΕΣ ΔΕΞΙΟΥ ΚΛΙΚ ΑΝΟΙΓΟΥΝ ΤΟΝ ΙΔΙΟ ΔΙΑΛΟΓΟ.**
 *
 * ## Τι κλειδώνεται εδώ που δεν κλειδώνει καμία άλλη σουίτα
 * Η διάταξη των δεκαπέντε items έχει τη δική της (καθαρό μητρώο). Ο διάλογος έχει τη δική του.
 * Το store έχει τη δική του. Αυτό που **μόνο** η ένωσή τους μπορεί να σπάσει είναι το καλώδιο:
 *
 *  1. το item **δεν είναι πια γκρίζο** — ήταν από το §43, και ένα ξεχασμένο `formatCells: true`
 *     θα το άφηνε αόρατα ανενεργό (ο κανόνας ενεργοποίησης απαιτεί χειριστή **και** μη-`false`)·
 *  2. το πάτημα γράφει **αίτημα με τον σωστό στόχο** — τον κανόνα Α22, όχι την επιλογή·
 *  3. το ίδιο ισχύει στη λωρίδα δείκτη, όπου ο στόχος είναι **άξονας** και όχι περιοχή: χωρίς
 *     το `scope` ο διάλογος θα ισοπέδωνε μια μαρκαρισμένη στήλη σε κελιά.
 *
 * ⚠️ Καμία από τις τρεις δεν είναι ορατή στον μεταγλωττιστή: όλες είναι **τιμές** που περνούν
 * σωστούς τύπους.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import elDxfViewer from '@/i18n/locales/el/dxf-viewer.json';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DxfMenuContent,
} from '../dxf-context-menu/DxfContextMenu';
import { TableRangeMenuItems } from '../table-range-menu/TableRangeMenuItems';
import { TableHeaderMenuItems } from '../TableHeaderMenuItems';
import {
  __resetTableFormatCellsDialogForTests,
  getTableFormatCellsRequest,
  openTableFormatCellsDialog,
} from '@/subapps/dxf-viewer/state/table-format-cells-dialog-store';
import type { FormatTarget } from '@/subapps/dxf-viewer/ui/table-cell-editor/table-format-snapshot';
import type { PersistedTableModel } from '@/subapps/dxf-viewer/types/table';
import type { TableRangeMenuActions } from '../table-range-menu/TableRangeMenuItems';

void i18next.use(ICU).use(initReactI18next).init({
  lng: 'el',
  fallbackLng: 'el',
  resources: { el: { 'dxf-viewer': elDxfViewer } },
  ns: ['dxf-viewer'],
  defaultNS: 'dxf-viewer',
  interpolation: { escapeValue: false },
});

/**
 * Τα items ζουν **μέσα** σε Radix `DropdownMenu` (ο `DxfMenuItem` απαιτεί το context του). Ο
 * περιτυλιγμένος είναι ο **πραγματικός** — όχι stub: ένα ψεύτικο context θα έκρυβε ακριβώς τα
 * γνωρίσματα (`data-disabled`, `role`) που αυτή η σουίτα υπάρχει για να μετρήσει.
 */
const wrapper = {
  wrapper: ({ children }: { children: React.ReactNode }) => (
    <I18nextProvider i18n={i18next}>
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger asChild><button type="button" /></DropdownMenuTrigger>
        <DxfMenuContent>{children}</DxfMenuContent>
      </DropdownMenu>
    </I18nextProvider>
  ),
};

beforeEach(() => {
  __resetTableFormatCellsDialogForTests();
});

function target(kind: 'range' | 'column'): FormatTarget {
  return {
    model: {} as PersistedTableModel,
    style: {} as FormatTarget['style'],
    scope: kind === 'range'
      ? { kind: 'range', bounds: { firstRow: 1, lastRow: 3, firstCol: 1, lastCol: 3 } }
      : { kind: 'column', colIds: ['c1'] },
    layerColors: [],
  };
}

const NOOP_RANGE_ACTIONS: TableRangeMenuActions = {
  onCut: () => {}, onCopy: () => {}, onPaste: () => {},
  onInsert: () => {}, onDelete: () => {}, onClearContents: () => {},
  onFormatCells: () => openTableFormatCellsDialog({ target: target('range') }),
};

// ── Α. ΤΟ ΜΕΝΟΥ ΚΕΛΙΩΝ ──────────────────────────────────────────────────────

describe('§61 — δεξί κλικ σε ΚΕΛΙΑ ▸ «Μορφοποίηση κελιών…»', () => {
  function item(): HTMLElement {
    return screen.getByRole('menuitem', { name: 'Μορφοποίηση κελιών...' });
  }

  it('Α1 — 🔴 ΔΕΝ είναι πια γκρίζο: το `formatCells: true` έφτασε στον κανόνα ενεργοποίησης', () => {
    render(
      <TableRangeMenuItems actions={NOOP_RANGE_ACTIONS} enabled={{ formatCells: true }} />,
      wrapper,
    );
    expect(item()).not.toHaveAttribute('aria-disabled', 'true');
    expect(item()).not.toBeDisabled();
  });

  it('Α2 — ο ΕΝΑΣ κανόνας ισχύει και εδώ: `enabled.formatCells === false` ⇒ γκρίζο', () => {
    render(
      <TableRangeMenuItems actions={NOOP_RANGE_ACTIONS} enabled={{ formatCells: false }} />,
      wrapper,
    );
    // Ο κανόνας «χειριστής **και** μη-`false`» δεν έχει εξαίρεση για το νέο item — αλλιώς θα
    // ήταν το μοναδικό που δεν μπορεί να γκριζάρει, δηλαδή ένας κανόνας με τρύπα.
    expect(item()).toHaveAttribute('data-disabled');
  });

  it('Α3 — 🔴 το πάτημα γράφει αίτημα με τον στόχο του κανόνα Α22', () => {
    render(
      <TableRangeMenuItems actions={NOOP_RANGE_ACTIONS} enabled={{ formatCells: true }} />,
      wrapper,
    );
    fireEvent.click(item());
    expect(getTableFormatCellsRequest()?.target.scope).toEqual({
      kind: 'range',
      bounds: { firstRow: 1, lastRow: 3, firstCol: 1, lastCol: 3 },
    });
  });

  it('Α4 — 🔑 δεν δηλώνει καρτέλα: ανοίγει στην ΤΕΛΕΥΤΑΙΑ που είδε ο χρήστης (Excel)', () => {
    openTableFormatCellsDialog({ target: target('range'), tab: 'alignment' });
    render(
      <TableRangeMenuItems actions={NOOP_RANGE_ACTIONS} enabled={{ formatCells: true }} />,
      wrapper,
    );
    fireEvent.click(item());
    expect(getTableFormatCellsRequest()?.tab).toBe('alignment');
  });
});

// ── Β. Η ΛΩΡΙΔΑ ΔΕΙΚΤΗ ──────────────────────────────────────────────────────

describe('§61 — δεξί κλικ σε ΖΩΝΗ ΔΕΙΚΤΗ ▸ «Μορφοποίηση κελιών…»', () => {
  function renderHeader(onFormatCells: () => void) {
    render(
      <TableHeaderMenuItems
        isColumn
        state={{ label: 'B', axisLabel: 'B', count: 1, canInsert: true, canDelete: true }}
        onInsertBefore={() => {}}
        onInsertAfter={() => {}}
        onDelete={() => {}}
        onFormatCells={onFormatCells}
      />,
      wrapper,
    );
  }

  it('Β1 — 🔴 το item ζει ΜΕΤΑ τη διαγραφή — η μετρημένη σειρά του Excel', () => {
    renderHeader(() => {});
    const labels = screen.getAllByRole('menuitem').map((el) => el.textContent);
    const del = labels.findIndex((l) => l?.includes('Διαγραφή'));
    const format = labels.findIndex((l) => l?.includes('Μορφοποίηση κελιών'));
    expect(del).toBeGreaterThan(-1);
    // Η τοπική σύμβαση («η καταστροφική τελευταία») λέει το αντίθετο· ο ιδιοκτήτης παρήγγειλε
    // 1:1 με το Excel, όπου η σειρά είναι `… Διαγραφή · Μορφοποίηση κελιών… · Ύψος γραμμής…`.
    expect(format).toBeGreaterThan(del);
  });

  it('Β2 — ποτέ γκρίζο: η μορφοποίηση δεν έχει το φράγμα «όλα ή τίποτα» της διαγραφής', () => {
    render(
      <TableHeaderMenuItems
        isColumn={false}
        state={{ label: '3', axisLabel: '3', count: 1, canInsert: false, canDelete: false }}
        onInsertBefore={() => {}}
        onInsertAfter={() => {}}
        onDelete={() => {}}
        onFormatCells={() => {}}
      />,
      wrapper,
    );
    const format = screen.getByRole('menuitem', { name: /Μορφοποίηση κελιών/ });
    expect(format).not.toHaveAttribute('data-disabled');
  });

  it('Β3 — 🔴 ο στόχος κουβαλά το `scope` του ΑΞΟΝΑ, όχι περιοχή κελιών', () => {
    renderHeader(() => openTableFormatCellsDialog({ target: target('column') }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Μορφοποίηση κελιών/ }));
    // Χωρίς αυτό, ο διάλογος πάνω σε μαρκαρισμένη στήλη θα έγραφε στα **κελιά** της — δηλαδή θα
    // ισοπέδωνε την κληρονομιά της στήλης σε παρακάμψεις κελιού, σιωπηλά.
    expect(getTableFormatCellsRequest()?.target.scope).toEqual({ kind: 'column', colIds: ['c1'] });
  });
});
