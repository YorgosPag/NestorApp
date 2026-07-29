/**
 * 🏢 ENTERPRISE — `DxfColor` (run-level) → CSS hex, SSoT (ADR-635 Φ C.20).
 *
 * ONE answer to «τι χρώμα βάφω αυτό το run;», shared by every consumer of the text AST:
 *   - `hooks/canvas/dxf-text-style-extractor.ts` — το στυλ του ΠΡΩΤΟΥ run (flat `DxfTextStyle`)
 *   - `bim/text/text-layout.ts` — το χρώμα ΚΑΘΕ span (πολύχρωμο MTEXT)
 *
 * Χωρίς αυτό οι δύο θα ήταν δίδυμα (N.18): η ίδια τριάδα TrueColor/ACI/κληρονομιά γραμμένη
 * δύο φορές, με εγγυημένη απόκλιση την πρώτη φορά που θα άλλαζε η μία.
 */

import type { DxfColor } from '../types/text-toolbar.types';
import { getAciColor } from '../../settings/standards/aci';

/**
 * Έγκυρο εύρος ACI ως ΧΡΩΜΑ. Το `0` (ByBlock) και το `256` (ByLayer) είναι **κληρονομιά**,
 * όχι χρώμα — δεν περνούν στον πίνακα ACI (θα γύριζε λευκό + console warning).
 */
const ACI_MIN_INDEX = 1;
const ACI_MAX_INDEX = 255;

/**
 * Το CSS χρώμα ενός run, ή `undefined` όταν το run **κληρονομεί** (ByLayer / ByBlock) —
 * οπότε ο caller πέφτει στο χρώμα της οντότητας / του layer.
 *
 * 🐛 Η ΑΙΤΙΑ ΠΟΥ ΥΠΑΡΧΕΙ: ο μοναδικός προηγούμενος αναγνώστης κάλυπτε **μόνο** TrueColor.
 * Το AutoCAD όμως γράφει το inline χρώμα ως `\C<aci>;` — ACI είναι ο **κανόνας**, το `\c`
 * (TrueColor) η εξαίρεση. Έτσι κάθε `\C7;` αγνοούνταν, νικούσε το group-62 της οντότητας,
 * και ένα υπόμνημα με `62 = 1` έβγαινε **ολόκληρο κόκκινο** ενώ στο AutoCAD ελάχιστα
 * κομμάτια του είναι κόκκινα.
 */
export function resolveRunColorHex(color: DxfColor | undefined): string | undefined {
  if (!color) return undefined;
  if (color.kind === 'TrueColor') {
    const hex = (n: number): string => (n & 0xff).toString(16).padStart(2, '0');
    return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`;
  }
  if (color.kind === 'ACI' && color.index >= ACI_MIN_INDEX && color.index <= ACI_MAX_INDEX) {
    return getAciColor(color.index);
  }
  return undefined; // ByLayer / ByBlock → κληρονομιά
}
