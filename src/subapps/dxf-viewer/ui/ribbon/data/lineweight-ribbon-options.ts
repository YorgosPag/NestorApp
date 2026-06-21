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

/** Τιμή sentinel για «κληρονομιά από layer» (DXF group 370 = -2). */
export const LINEWEIGHT_BYLAYER_VALUE = 'ByLayer';

export const LINEWEIGHT_RIBBON_OPTIONS: readonly RibbonComboboxOption[] = [
  { value: LINEWEIGHT_BYLAYER_VALUE, labelKey: 'ByLayer', isLiteralLabel: true },
  { value: '0.05', labelKey: '0.05 mm', isLiteralLabel: true },
  { value: '0.09', labelKey: '0.09 mm', isLiteralLabel: true },
  { value: '0.13', labelKey: '0.13 mm', isLiteralLabel: true },
  { value: '0.18', labelKey: '0.18 mm', isLiteralLabel: true },
  { value: '0.25', labelKey: '0.25 mm', isLiteralLabel: true },
  { value: '0.35', labelKey: '0.35 mm', isLiteralLabel: true },
  { value: '0.50', labelKey: '0.50 mm', isLiteralLabel: true },
  { value: '0.70', labelKey: '0.70 mm', isLiteralLabel: true },
  { value: '1.00', labelKey: '1.00 mm', isLiteralLabel: true },
  { value: '1.40', labelKey: '1.40 mm', isLiteralLabel: true },
  { value: '2.00', labelKey: '2.00 mm', isLiteralLabel: true },
] as const;
