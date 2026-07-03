/**
 * SSoT — LARGE ribbon-button factory helpers (Revit-grade flat buttons).
 *
 * Οι helpers ζούσαν local στο `structural-tab.ts`. Από ADR-443 §wall-entry-split
 * τα εργαλεία τοίχου μεταφέρονται στο contextual «Ιδιότητες τοίχου»
 * (`contextual-wall-tab.ts`) ως LARGE buttons — άρα οι ίδιοι helpers χρειάζονται
 * σε >1 ribbon data file. Εξαγωγή εδώ (N.0.2 boy-scout / N.12 SSoT) ώστε να μην
 * αντιγραφεί ο ορισμός. Byte-identical semantics με τους πρώην local ορισμούς.
 *
 * @see ./structural-tab.ts (permanent «Δομικά» tab — first consumer)
 * @see ./contextual-wall-tab.ts (contextual wall tools panel)
 */

import type { RibbonButton, RibbonCommand } from '../types/ribbon-types';

/** Helper: a LARGE tool button (commandKey → onToolChange, optional shortcut). */
export function toolBtn(
  id: string, labelKey: string, icon: string, commandKey: string, shortcut?: string,
): RibbonButton {
  return { type: 'simple', size: 'large', command: { id, labelKey, icon, commandKey, ...(shortcut ? { shortcut } : {}) } };
}

/** Helper: a LARGE action button (action → onAction, e.g. «Εσχάρα από κάναβο»). */
export function actionBtn(
  id: string, labelKey: string, icon: string, commandKey: string, action: string,
): RibbonButton {
  return { type: 'simple', size: 'large', command: { id, labelKey, icon, commandKey, action } };
}

/** Helper: ONE split-button variant that fires `onAction(action)` (no tool). */
export function actionVariant(id: string, labelKey: string, icon: string, action: string): RibbonCommand {
  return { id, labelKey, icon, commandKey: action, action };
}

/**
 * Helper: a LARGE split-action button — main click fires `mainAction`, the dropdown
 * lists `variants` (ADR-441 «Εσχάρα από κάναβο» + 3 περιμετρικά modes).
 */
export function splitActionBtn(
  id: string, labelKey: string, icon: string, mainAction: string, variants: RibbonCommand[],
): RibbonButton {
  return {
    type: 'split', size: 'large',
    command: { id, labelKey, icon, commandKey: mainAction, action: mainAction },
    variants,
  };
}
