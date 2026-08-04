/**
 * ADR-739 §39 — η καλωδίωση του κουμπιού «Πίνακας» στην κορδέλα.
 *
 * Υπάρχει επειδή **δύο** από τους μηχανισμούς που χρησιμοποιεί αποτυγχάνουν **σιωπηλά**:
 * το `renderRibbonWidget` επιστρέφει `null` σε άγνωστο `widgetId` (ορθογραφικό λάθος =
 * αόρατο κουμπί, όχι σφάλμα), και το `rowSize()` γίνεται `'mixed'` αν σπάσει η ομοιομορφία
 * μεγέθους (αλλαγή διάταξης χωρίς κανένα μήνυμα).
 */

import { INSERT_TAB } from '../insert-tab';
import { TABLE_MENU_COMMAND } from '../table-menu-command';
import type { RibbonButton, RibbonRow } from '../../types/ribbon-types';

/**
 * Το μητρώο φορτώνεται **δυναμικά**, όχι με static import.
 *
 * Τραβά και τα ~90 widgets, και ένα από αυτά (`ZoomControlsWidget` → `useViewScale` → …
 * → `firestore-query.service`) φτάνει ως το `platform_node`, που καλεί `fetch` κατά την
 * αρχικοποίηση του module — και το `fetch` δεν υπάρχει στο node test environment.
 *
 * Η εναλλακτική θα ήταν χειρόγραφο `Set` με τα έγκυρα `widgetId` (το μοτίβο του
 * `topography-tab.test.ts`) — δηλαδή **δεύτερη αλήθεια** που παλιώνει σιωπηλά και ελέγχει
 * τον εαυτό της αντί για το πραγματικό μητρώο. Προτιμούμε να δώσουμε τα API περιβάλλοντος
 * που λείπουν και να ρωτήσουμε τον **πραγματικό** `renderRibbonWidget`.
 *
 * Τα stubs δεν καλούνται ποτέ: υπάρχουν μόνο για να μη σκάσει η **αρχικοποίηση** των modules.
 */
type GlobalWithWebApis = typeof globalThis & Record<string, unknown>;

function stubWebApis(): void {
  const g = globalThis as GlobalWithWebApis;
  const unavailable = () => {
    throw new Error('Web API δεν καλείται σε αυτό το test');
  };
  for (const name of ['fetch', 'Response', 'Request', 'Headers']) {
    if (typeof g[name] === 'undefined') g[name] = unavailable;
  }
}

async function loadRegistry(): Promise<(id: string | undefined) => React.ReactNode> {
  stubWebApis();
  const registry = await import('../../components/ribbon-widget-registry');
  return registry.renderRibbonWidget;
}

const allRows: RibbonRow[] = INSERT_TAB.panels.flatMap((panel) => panel.rows);
const allButtons: RibbonButton[] = allRows.flatMap((row) => row.buttons);

const tableButton = allButtons.find((b) => b.command.id === TABLE_MENU_COMMAND.id);

describe('insert-tab — το κουμπί «Πίνακας»', () => {
  it('υπάρχει στην καρτέλα Εισαγωγή', () => {
    expect(tableButton).toBeDefined();
  });

  it('είναι widget με το `table-menu` id — όχι πια απλό κουμπί εργαλείου', () => {
    expect(tableButton?.type).toBe('widget');
    expect(tableButton?.widgetId).toBe('table-menu');
  });

  it('παραμένει `large`, αλλιώς η σειρά του γίνεται `mixed` και αλλάζει η διάταξη', () => {
    expect(tableButton?.size).toBe('large');
    const row = allRows.find((r) => r.buttons.some((b) => b.command.id === TABLE_MENU_COMMAND.id));
    expect(row?.buttons.every((b) => b.size === 'large')).toBe(true);
  });

  it('χρησιμοποιεί την ΚΟΙΝΗ δήλωση εντολής — καμία δεύτερη αλήθεια για εικονίδιο/ετικέτα', () => {
    expect(tableButton?.command).toBe(TABLE_MENU_COMMAND);
  });

  it('το `widgetId` είναι πράγματι καταχωρημένο — το μητρώο σιωπά σε ορθογραφικό λάθος', async () => {
    const renderRibbonWidget = await loadRegistry();
    expect(renderRibbonWidget(tableButton?.widgetId)).not.toBeNull();
    expect(renderRibbonWidget('table-menu-typo')).toBeNull();
  });
});
