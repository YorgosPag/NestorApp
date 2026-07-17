/**
 * SSoT — το leading panel που εισάγεται σε ΚΑΘΕ contextual ribbon tab
 * (ADR-363 / ADR-510 Φ4j / ADR-581). Revit-grade: κάθε contextual tab («Modify | …»)
 * ανοίγει στα ΑΡΙΣΤΕΡΑ με δύο σταθερά affordances, με την ΙΔΙΑ σειρά παντού:
 *
 *   [ Κλείσιμο ] [ 💉 Αντιγραφή Ιδιοτήτων ]
 *
 * 1. «Κλείσιμο» — κλείνει το tab και επιστρέφει στο «Αρχική». Πυροδοτεί το γενικό
 *    `contextual.actions.close`, που το `routeRibbonAction` πιάνει μέσω του
 *    `isContextualTabCloseAction` (`/\.actions?\.close$/`) → `closeContextualTab()` →
 *    clear selection + reset στο `select` tool → ο contextual trigger αδειάζει → το
 *    `RibbonRoot` γυρνά στο `home`. ΜΗΔΕΝ νέο wiring — το ADR-363 pipeline υπάρχει.
 * 2. Σύριγγα «Αντιγραφή Ιδιοτήτων» (Giorgio 2026-07-17) — το persistent εργαλείο
 *    `match-properties`, ΙΔΙΟ row, κολλητά δεξιά από το Κλείσιμο. Έχεις επιλογή =
 *    ακριβώς η στιγμή που θες να αντιγράψεις ιδιότητες· πριν, η σύριγγα υπήρχε μόνο
 *    στο Home και εξαφανιζόταν μόλις άνοιγε το contextual tab.
 *
 * Σημείωση: το `panel.labelKey` ΔΕΝ αποδίδεται πουθενά (το `RibbonPanel` ρεντάρει μόνο
 * rows) — ο ρόλος αυτού του panel είναι η ΘΕΣΗ (πρώτο, αριστερά), όχι μια ετικέτα.
 *
 * @see ./match-syringe-command.ts (SSoT ορισμός + predicate της σύριγγας)
 * @see ../hooks/bridge/contextual-tab-close.ts (το close predicate SSoT)
 * @see ../../../app/useDxfViewerRibbon.ts (closeContextualTab primitive)
 * @see ../../../app/ribbon-contextual-config.ts (κεντρική εισαγωγή στο RIBBON_CONTEXTUAL_TABS)
 */

import type { RibbonButton, RibbonPanelDef, RibbonTab } from '../types/ribbon-types';
import { isContextualTabCloseAction } from '../hooks/bridge/contextual-tab-close';
import { buildMatchSyringeCommand, isMatchSyringeCommand } from './match-syringe-command';

/** The single generic close action — matches the ADR-363 `/\.actions?\.close$/` route. */
export const CONTEXTUAL_CLOSE_ACTION = 'contextual.actions.close';

/**
 * Το leading panel ενός contextual tab: «Κλείσιμο» + σύριγγα, με αυτή τη σειρά.
 * @param tabId κρατά τα button ids μοναδικά (τα ids είναι global).
 */
export function buildContextualLeadPanel(tabId: string): RibbonPanelDef {
  return {
    id: `${tabId}-lead`,
    labelKey: 'ribbon.panels.close',
    rows: [
      {
        isInFlyout: false,
        buttons: [
          {
            type: 'simple',
            size: 'large',
            command: {
              id: `${tabId}.close`,
              labelKey: 'ribbon.commands.close',
              icon: 'select',
              commandKey: CONTEXTUAL_CLOSE_ACTION,
              action: CONTEXTUAL_CLOSE_ACTION,
            },
          },
          {
            type: 'simple',
            size: 'large',
            command: buildMatchSyringeCommand(`${tabId}.match`),
          },
        ],
      },
    ],
  };
}

/** True if a button is any contextual-tab close button (legacy per-tab or the SSoT one). */
function isCloseButton(button: RibbonButton): boolean {
  return isContextualTabCloseAction(button.command.action ?? button.command.commandKey ?? '');
}

/**
 * True για τα κουμπιά που ΑΝΗΚΟΥΝ στο leading panel — άρα δεν επιτρέπεται να υπάρχουν
 * αλλού μέσα στο tab. Το `isMatchSyringeCommand` απαιτεί απουσία `action`, οπότε το
 * legacy `match-properties.open` του multi-selection tab (dialog) ΕΠΙΒΙΩΝΕΙ: πινέλο vs
 * dialog = διαφορετικές λειτουργίες, όχι διπλότυπο.
 */
function isLeadPanelButton(button: RibbonButton): boolean {
  return isCloseButton(button) || isMatchSyringeCommand(button.command);
}

/**
 * Normalise a contextual tab so it opens with the single SSoT leading panel: strip any
 * button that belongs to that panel (legacy per-tab close, or a stray syringe — avoids a
 * duplicate), drop rows/panels emptied by that removal, then prepend the leading panel.
 * Idempotent.
 */
export function withStandardLeadPanel(tab: RibbonTab): RibbonTab {
  const panels = tab.panels
    .map((panel) => ({
      ...panel,
      rows: panel.rows
        .map((row) => ({ ...row, buttons: row.buttons.filter((button) => !isLeadPanelButton(button)) }))
        .filter((row) => row.buttons.length > 0),
    }))
    .filter((panel) => panel.rows.length > 0);
  return { ...tab, panels: [buildContextualLeadPanel(tab.id), ...panels] };
}
