/**
 * 🔴 ADR-828 Φ4β — **ΤΟ ΥΠΟΜΕΝΟΥ «ΤΑΞΙΝΟΜΗΣΗ ▶» ΑΠΕΚΤΗΣΕ ΠΡΑΞΗ.**
 *
 * ## Τι κλειδώνεται εδώ που δεν κλειδώνει καμία άλλη σουίτα
 * Η μηχανή ταξινόμησης έχει τη δική της (`table-sort.test.ts`). Το store έχει τη δική του.
 * Αυτό που **μόνο** η ένωσή τους μπορεί να σπάσει είναι το καλώδιο:
 *
 *  1. ο πυροδότης **δεν είναι πια γκρίζος** όταν υπάρχει χειριστής — ήταν `disabled` καρφωτό
 *     από τη μέρα που γράφτηκε, με σχόλιο που έλεγε «η ημέρα που θα υπάρξει ταξινόμηση θα
 *     είναι **αφαίρεση** ενός `disabled`». Αυτή η σουίτα είναι η απόδειξη ότι αφαιρέθηκε·
 *  2. **παραμένει** γκρίζος χωρίς χειριστή — δηλαδή ο κανόνας δεν απέκτησε τρύπα·
 *  3. τα δύο παιδιά **χωρίς** διάταξη (κατά χρώμα) μένουν γκρίζα ενώ τα τρία με πράξη ανοίγουν.
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
import type { TableRangeMenuActions } from '../table-range-menu/TableRangeMenuItems';
import type { TableRangeMenuSortChildId } from '../table-range-menu/table-range-menu-commands';

void i18next.use(ICU).use(initReactI18next).init({
  lng: 'el',
  fallbackLng: 'el',
  resources: { el: { 'dxf-viewer': elDxfViewer } },
  ns: ['dxf-viewer'],
  defaultNS: 'dxf-viewer',
  interpolation: { escapeValue: false },
});

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

const BASE: Omit<TableRangeMenuActions, 'onSort'> = {
  onCut: () => {}, onCopy: () => {}, onPaste: () => {},
  onInsert: () => {}, onDelete: () => {}, onClearContents: () => {},
  onFormatCells: () => {},
};

const SORT_LABEL = 'Ταξινόμηση';
const FILTER_LABEL = 'Φίλτρο';

function trigger(name: string): HTMLElement {
  return screen.getByRole('menuitem', { name: new RegExp(name) });
}

// ════════════════════════════════════════════════════════════════════════════════
describe('🔴 ο πυροδότης «Ταξινόμηση ▶»', () => {
  it('🔴 ΔΕΝ είναι πια γκρίζος όταν υπάρχει χειριστής', () => {
    render(<TableRangeMenuItems actions={{ ...BASE, onSort: () => {} }} enabled={{}} />, wrapper);
    expect(trigger(SORT_LABEL)).not.toHaveAttribute('data-disabled');
  });

  /**
   * ⚠️ Ο κανόνας δεν απέκτησε τρύπα: **χειριστής και μη-`false`**. Ο καλών δεν δίνει `onSort`
   * όταν η περιοχή έχει μία γραμμή, και τότε το item οφείλει να μένει γκρίζο — αλλιώς ο
   * άνθρωπος θα πατούσε «Α→Ω» και δεν θα γινόταν τίποτα.
   */
  it('🔑 ΠΑΡΑΜΕΝΕΙ γκρίζος χωρίς χειριστή — η απουσία ΕΙΝΑΙ ο μηχανισμός', () => {
    render(<TableRangeMenuItems actions={{ ...BASE, onSort: undefined }} enabled={{}} />, wrapper);
    expect(trigger(SORT_LABEL)).toHaveAttribute('data-disabled');
  });

  it('⚠️ το «Φιλτράρισμα ▶» μένει γκρίζο — δεν το άνοιξε κατά λάθος η ταξινόμηση', () => {
    render(<TableRangeMenuItems actions={{ ...BASE, onSort: () => {} }} enabled={{}} />, wrapper);
    expect(trigger(FILTER_LABEL)).toHaveAttribute('data-disabled');
  });
});

// ════════════════════════════════════════════════════════════════════════════════
describe('τα παιδιά της ταξινόμησης', () => {
  function openSortSubmenu(onSort: (child: TableRangeMenuSortChildId) => void): void {
    render(<TableRangeMenuItems actions={{ ...BASE, onSort }} enabled={{}} />, wrapper);
    fireEvent.pointerDown(trigger(SORT_LABEL));
    fireEvent.click(trigger(SORT_LABEL));
  }

  it('🎯 «Ταξινόμηση από το μικρότερο στο μεγαλύτερο» καλεί τον χειριστή με ascending', () => {
    const picked: TableRangeMenuSortChildId[] = [];
    openSortSubmenu((child) => picked.push(child));
    fireEvent.click(screen.getByRole('menuitem', { name: /μικρότερο στο μεγαλύτερο/u }));
    expect(picked).toEqual(['ascending']);
  });

  it('🎯 «Προσαρμοσμένη ταξινόμηση...» καλεί τον χειριστή με custom', () => {
    const picked: TableRangeMenuSortChildId[] = [];
    openSortSubmenu((child) => picked.push(child));
    fireEvent.click(screen.getByRole('menuitem', { name: /Προσαρμοσμένη/u }));
    expect(picked).toEqual(['custom']);
  });

  /**
   * ⚠️ Ποιο πράσινο έρχεται πριν από ποιο κόκκινο **δεν είναι ερώτηση με απάντηση** — είναι
   * ερώτηση που ο άνθρωπος πρέπει να δηλώσει. Μια σιωπηλή υποχώρηση σε αλφαβητική θα ήταν
   * ψέμα στο όνομα του item.
   */
  it('🔑 τα δύο «κατά χρώμα» ΜΕΝΟΥΝ γκρίζα — δεν υπάρχει διάταξη χρωμάτων', () => {
    openSortSubmenu(() => {});
    expect(screen.getByRole('menuitem', { name: /χρώματος επιλεγμένου κελιού/u }))
      .toHaveAttribute('data-disabled');
  });
});
