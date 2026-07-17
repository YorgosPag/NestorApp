/**
 * ADR-581 — SSoT για το κουμπί «σύριγγα / Αντιγραφή Ιδιοτήτων» του ribbon.
 *
 * Το ΙΔΙΟ κουμπί εμφανίζεται σε δύο σημεία: στο Home tab («Ιδιότητες» panel, Φ6) και —
 * ως δεύτερο κουμπί του leading panel — σε ΚΑΘΕ contextual tab. Ο ορισμός ζει εδώ μία
 * φορά ώστε τα δύο call sites να μην αποκλίνουν ποτέ (ήταν sibling clone waiting to
 * happen — N.0.2 / N.18).
 *
 * ΚΡΙΣΙΜΗ ΣΗΜΑΣΙΟΛΟΓΙΑ — η ΑΠΟΥΣΙΑ του `action`:
 * το `RibbonLargeButton` δίνει προτεραιότητα στο `action` (→ `onAction`) και μόνο αν
 * λείπει καλεί `onToolChange(commandKey)`. Ίδιος κανόνας στο `isCommandActive` (active
 * highlight). Άρα `commandKey:'match-properties'` ΧΩΡΙΣ `action` = persistent εργαλείο
 * (όπως Move/Copy/Rotate) + highlight όσο είναι ενεργό. Αν κάποιος προσθέσει `action`,
 * το κουμπί γίνεται immediate action και σβήνει το highlight — ΛΑΘΟΣ συμπεριφορά.
 *
 * ΔΕΝ είναι το ίδιο με το `match-properties.open` (contextual multi-selection tab): εκείνο
 * ΕΧΕΙ `action` και ανοίγει το dialog (checklist/AI mapping). Πινέλο vs dialog — δύο
 * διαφορετικές λειτουργίες, όχι διπλότυπο (Giorgio 2026-07-17).
 *
 * @see ./home-tab-match.ts (Home tab call site)
 * @see ./contextual-lead-panel.ts (contextual tabs call site)
 * @see ../components/buttons/RibbonButtonIcon.tsx (reactive εικονίδιο empty ⇄ full)
 */

import type { RibbonCommand } from '../types/ribbon-types';

/** Το persistent εργαλείο πίσω από τη σύριγγα (`systems/tools/tool-definitions.ts`). */
export const MATCH_PROPERTIES_TOOL_KEY = 'match-properties';

/**
 * Ο ΕΝΑΣ ορισμός του κουμπιού σύριγγας.
 * @param id το `command.id` — global unique, οπότε κάθε call site δίνει δικό του
 *           (`match.syringe` στο Home, `${tabId}.match` στα contextual tabs).
 */
export function buildMatchSyringeCommand(id: string): RibbonCommand {
  return {
    id,
    labelKey: 'ribbon.commands.matchSyringe',
    tooltipKey: 'ribbon.commands.matchSyringeTooltip',
    icon: 'match-syringe',
    commandKey: MATCH_PROPERTIES_TOOL_KEY,
    shortcut: 'MA',
  };
}

/**
 * True ΜΟΝΟ για το SSoT κουμπί σύριγγας (persistent tool). Η απαίτηση `!action` το
 * κρατά τυφλό στο legacy `match-properties.open` του multi-selection tab, που ΠΡΕΠΕΙ
 * να επιβιώνει — ανοίγει το dialog, δεν είναι το πινέλο.
 */
export function isMatchSyringeCommand(
  command: Pick<RibbonCommand, 'commandKey' | 'action'>,
): boolean {
  return !command.action && command.commandKey === MATCH_PROPERTIES_TOOL_KEY;
}
