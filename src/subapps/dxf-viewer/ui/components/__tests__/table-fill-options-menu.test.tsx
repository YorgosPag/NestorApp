/**
 * 🔴 ADR-828 §7.2 — **ΤΟ ΜΕΝΟΥ ΤΟΥ ΔΕΞΙΟΥ ΣΥΡΣΙΜΑΤΟΣ**, από τη θύρα ως την πράξη.
 *
 * ## Τι κλειδώνεται εδώ που δεν κλειδώνει καμία άλλη σουίτα
 * Η μηχανή σειράς έχει τη δική της (καθαρό `detect`/`generate`). Η χειρονομία έχει τη δική της
 * (`table-fill-handle-drag.test.tsx`: ανοίγει, δεν γράφει, γράφει ό,τι ζητήθηκε). Ό,τι **μόνο**
 * η ένωσή τους μπορεί να σπάσει είναι τρία καλώδια, και κανένα δεν το βλέπει ο μεταγλωττιστής:
 *
 *  1. **Η θύρα δηλώνεται στο mount και αποσύρεται στο unmount.** Ξεχασμένη απόσυρση σημαίνει
 *     μενού-φάντασμα που δέχεται ανοίγματα ενώ δεν υπάρχει στην οθόνη.
 *  2. **Η ενεργοποίηση.** Οι τέσσερις εντολές ημερολογίου είναι γκρίζες όταν η πηγή δεν είναι
 *     ημερομηνία — και **ανοιχτές** όταν είναι. Ένα ξεχασμένο κλειδί στο `enabledFrom` περνά
 *     κάθε τύπο και φαίνεται μόνο με το μάτι.
 *  3. **Η μετάφραση ταυτότητας → κατάσταση.** Επτά στις οκτώ συμπίπτουν ονομαστικά· η όγδοη
 *     (`withoutFormat` → `'noFormat'`) όχι. Ακριβώς εκεί ζει το λάθος που η σύμπτωση κρύβει.
 *
 * 🔑 Οι ετικέτες διαβάζονται από το **πραγματικό** `locales/el/dxf-viewer.json`: αν λείψει
 * κλειδί, το μενού δείχνει ωμό `table.fillMenu.items.…` και αυτή η σουίτα κοκκινίζει — δηλαδή
 * καλύπτει runtime ό,τι το CHECK 3.8 καλύπτει στατικά.
 *
 * @see ui/components/TableFillOptionsMenu.tsx — ο κώδικας που ελέγχεται
 * @see docs/centralized-systems/reference/adrs/ADR-828-table-autofill-series.md §7.2
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import elDxfViewer from '@/i18n/locales/el/dxf-viewer.json';
import { TableFillOptionsMenu } from '../TableFillOptionsMenu';
import {
  getTableFillMenuPort,
  setTableFillMenuPort,
  type TableFillMenuTarget,
} from '@/subapps/dxf-viewer/ui/table-cell-editor/table-fill-menu-port';
import type { TableFillMode } from '@/subapps/dxf-viewer/bim/table/table-fill-plan';

void i18next.use(ICU).use(initReactI18next).init({
  lng: 'el',
  fallbackLng: 'el',
  resources: { el: { 'dxf-viewer': elDxfViewer } },
  ns: ['dxf-viewer'],
  defaultNS: 'dxf-viewer',
  interpolation: { escapeValue: false },
});

const LABELS = elDxfViewer.table.fillMenu.items;

function renderMenu() {
  return render(
    <I18nextProvider i18n={i18next}>
      <TableFillOptionsMenu />
    </I18nextProvider>,
  );
}

/** Άνοιξε το μενού **μέσω της θύρας**, όπως ακριβώς κάνει η χειρονομία. */
function openWith(offer: TableFillMenuTarget['offer'], apply: (mode: TableFillMode) => void): void {
  const port = getTableFillMenuPort();
  if (port === null) throw new Error('Η θύρα δεν δηλώθηκε — το μενού δεν είναι προσπελάσιμο');
  act(() => port.open(120, 80, { offer, apply }));
}

/** Το item ως στοιχείο του Radix — `data-disabled` είναι ο ένας ορατός δείκτης του «γκρίζο». */
const item = (label: string): HTMLElement => screen.getByRole('menuitem', { name: label });
const isDisabled = (label: string): boolean => item(label).hasAttribute('data-disabled');

afterEach(() => setTableFillMenuPort(null));

// ════════════════════════════════════════════════════════════════════════════════
describe('🔴 §7.2 — η θύρα ζει όσο το μενού', () => {
  it('δηλώνεται στο mount και αποσύρεται στο unmount', () => {
    expect(getTableFillMenuPort()).toBeNull();
    const view = renderMenu();
    expect(getTableFillMenuPort()).not.toBeNull();
    view.unmount();
    expect(getTableFillMenuPort()).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
describe('🔴 §7.2 — ο ΕΝΑΣ κανόνας ενεργοποίησης', () => {
  it('πηγή ΧΩΡΙΣ ημερολόγιο ⇒ οι τέσσερις μονάδες γκρίζες, οι τρεις πάντοτε-εντολές ανοιχτές', () => {
    renderMenu();
    openWith({ series: false, date: false }, () => undefined);

    expect(isDisabled(LABELS.fillDays)).toBe(true);
    expect(isDisabled(LABELS.fillWeekdays)).toBe(true);
    expect(isDisabled(LABELS.fillMonths)).toBe(true);
    expect(isDisabled(LABELS.fillYears)).toBe(true);
    expect(isDisabled(LABELS.fillSeries)).toBe(true);

    // Αυτές δεν εξαρτώνται από το περιεχόμενο — δες `enabledFrom`.
    expect(isDisabled(LABELS.copyCells)).toBe(false);
    expect(isDisabled(LABELS.formatOnly)).toBe(false);
    expect(isDisabled(LABELS.withoutFormat)).toBe(false);
  });

  it('🔑 πηγή ΗΜΕΡΟΛΟΓΙΟ ⇒ και οι τέσσερις ανοίγουν — η προσφορά είναι πραγματική', () => {
    // Ο έλεγχος που κάνει τον προηγούμενο μέτρηση: ένα «πάντα γκρίζα» θα περνούσε εκείνον.
    renderMenu();
    openWith({ series: true, date: true }, () => undefined);

    expect(isDisabled(LABELS.fillDays)).toBe(false);
    expect(isDisabled(LABELS.fillWeekdays)).toBe(false);
    expect(isDisabled(LABELS.fillMonths)).toBe(false);
    expect(isDisabled(LABELS.fillYears)).toBe(false);
    expect(isDisabled(LABELS.fillSeries)).toBe(false);
  });

  it('🔴 οι τρεις ΧΩΡΙΣ ΠΡΑΞΗ μένουν γκρίζες ακόμη κι όταν όλα προσφέρονται (όψη τώρα, πράξη μετά)', () => {
    renderMenu();
    openWith({ series: true, date: true }, () => undefined);

    expect(isDisabled(LABELS.linearTrend)).toBe(true);
    expect(isDisabled(LABELS.growthTrend)).toBe(true);
    expect(isDisabled(LABELS.series)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
describe('🔴 §7.2 — ταυτότητα μενού → κατάσταση μηχανής', () => {
  it.each<readonly [string, TableFillMode]>([
    [LABELS.copyCells, 'copy'],
    [LABELS.fillSeries, 'series'],
    [LABELS.formatOnly, 'formatOnly'],
    // 🔑 Η μοναδική που ΔΕΝ συμπίπτει ονομαστικά — και γι' αυτό η μόνη που αποδεικνύει ότι η
    // μετάφραση υπάρχει αντί να τυχαίνει.
    [LABELS.withoutFormat, 'noFormat'],
    [LABELS.fillDays, 'days'],
    [LABELS.fillWeekdays, 'weekdays'],
    [LABELS.fillMonths, 'months'],
    [LABELS.fillYears, 'years'],
  ])('«%s» ⇒ %s', (label, mode) => {
    const apply = jest.fn();
    renderMenu();
    openWith({ series: true, date: true }, apply);

    fireEvent.click(item(label));

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(mode);
  });

  it('🔴 γκρίζο item ΔΕΝ εκτελεί — ο χρήστης δεν πατά ποτέ κάτι που δεν κάνει τίποτα', () => {
    const apply = jest.fn();
    renderMenu();
    openWith({ series: false, date: false }, apply);

    fireEvent.click(item(LABELS.fillMonths));
    fireEvent.click(item(LABELS.linearTrend));

    expect(apply).not.toHaveBeenCalled();
  });
});
