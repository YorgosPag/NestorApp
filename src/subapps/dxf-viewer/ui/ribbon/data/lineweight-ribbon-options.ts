/**
 * Shared ribbon lineweight options (SSoT).
 *
 * ByLayer + το ISO subset (11 συνηθέστερες τιμές, AutoCAD `LWEIGHT` UI). Κοινό
 * για ΟΛΑ τα contextual tabs που εκθέτουν πάχος γραμμής (line tool, hatch, …) —
 * μία λίστα, μηδέν διπλότυπο (N.0.2 boy-scout extract από `contextual-line-tool-tab`).
 *
 * `value` = 'ByLayer' (sentinel) ή η τιμή σε mm ως string. `isLiteralLabel: true`
 * γιατί το label είναι ήδη μορφοποιημένο («0.50 mm») — δεν περνά από i18n.
 *
 * @see config/lineweight-iso-catalog.ts (LINEWEIGHT_ISO_VALUES — αριθμητικό SSoT)
 */

import type { RibbonComboboxOption } from '../types/ribbon-types';
import { LINEWEIGHT_CONCRETE_MM_VALUES } from '../../../config/lineweight-iso-catalog';

/** Τιμή sentinel για «κληρονομιά από layer» (DXF group 370 = -2). */
export const LINEWEIGHT_BYLAYER_VALUE = 'ByLayer';

/**
 * ByLayer + οι concrete ISO τιμές — **derived** από το `LINEWEIGHT_CONCRETE_MM_VALUES`
 * (root SSoT στο `lineweight-iso-catalog`). Μηδέν hardcoded αριθμοί (σέβεται τον
 * `lineweight-iso-catalog` ratchet) — value + label παράγονται από την ίδια πηγή.
 * Έτσι line-tool + hatch + BIM style panels δείχνουν ΤΗΝ ΙΔΙΑ λίστα παχών.
 */
export const LINEWEIGHT_RIBBON_OPTIONS: readonly RibbonComboboxOption[] = [
  { value: LINEWEIGHT_BYLAYER_VALUE, labelKey: 'ByLayer', isLiteralLabel: true },
  ...LINEWEIGHT_CONCRETE_MM_VALUES.map((mm) => {
    const v = mm.toFixed(2);
    return { value: v, labelKey: `${v} mm`, isLiteralLabel: true as const };
  }),
];
