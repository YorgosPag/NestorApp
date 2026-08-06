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
import { loadWidgetRenderer } from './ribbon-registry-test-loader';
import type { RibbonButton, RibbonRow } from '../../types/ribbon-types';

// Το μητρώο φορτώνεται **δυναμικά** μέσω του κοινού loader — δες την κεφαλίδα του για το γιατί
// (static import ⇒ πράσινο που εξαρτάται από το ποιο test έτρεξε πρώτο στον ίδιο worker).

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
    const renderRibbonWidget = await loadWidgetRenderer();
    expect(renderRibbonWidget(tableButton?.widgetId)).not.toBeNull();
    expect(renderRibbonWidget('table-menu-typo')).toBeNull();
  });
});
