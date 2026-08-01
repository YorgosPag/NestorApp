/**
 * ADR-739 Φ.Δ βήμα 3 — **το συμβόλαιο ανάμεσα στο ζωντανό κουτί και το `<input>`**.
 *
 * Το `TextEditorAnchorLayer` ενημερώνει το κουτί **επιτακτικά** σε κάθε tick (ADR-040:
 * μηδέν re-render σε pan/zoom). Το παιδί όμως — το πεδίο κειμένου — πρέπει να μάθει
 * γραμματοσειρά, γεμίσεις και χρώματα που αλλάζουν στο **ίδιο** tick. Ο δρόμος είναι CSS
 * custom properties: ο γονιός τις γράφει, το παιδί τις καταναλώνει με `var()`.
 *
 * 🔴 Τα ονόματα ζουν **εδώ και μόνο εδώ**. Ένα αλφαριθμητικό `--tce-font` γραμμένο στο ένα
 * αρχείο και διαβασμένο στο άλλο είναι διπλότυπο που **κανένας** μεταγλωττιστής δεν
 * ελέγχει: μια ορθογραφική διαφορά δεν σπάει το build — απλώς αφήνει το πεδίο με τη
 * γραμματοσειρά του λειτουργικού, δηλαδή ξαναφέρνει ακριβώς το ελάττωμα που διορθώνουμε.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-cell-editor-vars
 */

import type React from 'react';
import type { TableCellEditorFrame } from './table-cell-editor-frame';

/** Τα ονόματα των custom properties — ο ΕΝΑΣ ορισμός τους. */
export const TABLE_CELL_EDITOR_VARS = {
  font: '--tce-font',
  lineHeight: '--tce-line-height',
  padTop: '--tce-pad-top',
  padRight: '--tce-pad-right',
  padBottom: '--tce-pad-bottom',
  padLeft: '--tce-pad-left',
  color: '--tce-color',
  background: '--tce-bg',
  textAlign: '--tce-text-align',
} as const;

/** Το κουτί ως τιμές custom properties — ό,τι γράφει ο γονιός σε κάθε tick. */
export function tableCellEditorCssVars(frame: TableCellEditorFrame): Record<string, string> {
  const V = TABLE_CELL_EDITOR_VARS;
  return {
    [V.font]: frame.font,
    [V.lineHeight]: `${frame.lineHeightPx}px`,
    [V.padTop]: `${frame.paddingTopPx}px`,
    [V.padRight]: `${frame.paddingRightPx}px`,
    [V.padBottom]: `${frame.paddingBottomPx}px`,
    [V.padLeft]: `${frame.paddingLeftPx}px`,
    [V.color]: frame.colorHex,
    [V.background]: frame.backgroundHex,
    [V.textAlign]: frame.textAlign,
  };
}

/**
 * Το style του `<input>` — **σταθερό αντικείμενο**, καμία τιμή μέσα του δεν αλλάζει ποτέ.
 *
 * Αυτό είναι το κέρδος: το πεδίο κειμένου δεν ξαναποδίδεται ΠΟΤΕ λόγω zoom. Οι τιμές
 * ζουν στις custom properties του γονιού και ενημερώνονται επιτακτικά.
 *
 * ⚠️ Η **σειρά** `font` → `lineHeight` είναι σημασιολογική, όχι αισθητική: το shorthand
 * `font` **μηδενίζει** το `line-height` σε `normal`. Αν το `lineHeight` έμπαινε πρώτο θα
 * σβηνόταν, και μαζί του η εγγύηση «κουτί γραμμής = content box» πάνω στην οποία στηρίζεται
 * ολόκληρος ο υπολογισμός της γραμμής βάσης (δες `table-cell-editor-frame.ts`).
 */
export const TABLE_CELL_EDITOR_INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  font: `var(${TABLE_CELL_EDITOR_VARS.font}, inherit)`,
  lineHeight: `var(${TABLE_CELL_EDITOR_VARS.lineHeight}, normal)`,
  paddingTop: `var(${TABLE_CELL_EDITOR_VARS.padTop}, 0)`,
  paddingRight: `var(${TABLE_CELL_EDITOR_VARS.padRight}, 0)`,
  paddingBottom: `var(${TABLE_CELL_EDITOR_VARS.padBottom}, 0)`,
  paddingLeft: `var(${TABLE_CELL_EDITOR_VARS.padLeft}, 0)`,
  textAlign: `var(${TABLE_CELL_EDITOR_VARS.textAlign}, left)` as React.CSSProperties['textAlign'],
};

/** Ό,τι φαίνεται **μόνο** σε κατάσταση γραφής: μελάνι + αδιαφανές φόντο του κελιού. */
export const TABLE_CELL_EDITOR_WRITING_STYLE: React.CSSProperties = {
  color: `var(${TABLE_CELL_EDITOR_VARS.color}, inherit)`,
  backgroundColor: `var(${TABLE_CELL_EDITOR_VARS.background}, transparent)`,
  caretColor: `var(${TABLE_CELL_EDITOR_VARS.color}, inherit)`,
};
