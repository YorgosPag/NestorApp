/**
 * ADR-608 Φ-texts — canonical Tekton text alignment encoding (SSoT for export ↔ import).
 *
 * Ο Τέκτων αγκυρώνει το type-3 `<text>` στο σημείο του `<xmatrix>` (x20,x21) και κεντράρει
 * το glyph box γύρω του σύμφωνα με τους ακέραιους `<hallign>`/`<vallign>` — big-player
 * "declare alignment + anchor, ο target κεντράρει" (καθρέφτης του `scene-vector-emitter`
 * που θεωρεί το `position` = alignment anchor). Το encoding ζούσε διπλό (export `H_ALIGN`
 * + import `alignmentOf`)· εδώ ενοποιείται ώστε οι δύο κατευθύνσεις να μένουν συμμετρικές.
 *
 * Αν ο Τέκτων ερμηνεύει διαφορετικά τους ακέραιους (browser-verify), αλλάζει **μόνο** εδώ.
 */

/** Οριζόντια στοίχιση κειμένου (== `TextEntity['alignment']`). */
export type TekHAlignKey = 'left' | 'center' | 'right';
/** Κατακόρυφη στοίχιση κειμένου (baseline hint του decomposed label). */
export type TekVAlignKey = 'top' | 'middle' | 'bottom' | 'alphabetic';

/** `<hallign>` ακέραιος ανά στοίχιση — 0=αριστερά, 1=κέντρο, 2=δεξιά. */
export const TEK_HALLIGN: Record<TekHAlignKey, number> = { left: 0, center: 1, right: 2 };

/**
 * `<vallign>` ακέραιος ανά baseline — 0=πάνω, 1=μέση, 2=κάτω/baseline.
 * Το `'alphabetic'` (scene text χωρίς hint) πέφτει στο baseline (2), όπως ο vector emitter.
 */
export const TEK_VALLIGN: Record<TekVAlignKey, number> = {
  top: 0, middle: 1, bottom: 2, alphabetic: 2,
};

/** Αντίστροφη κατεύθυνση (import): `<hallign>` ακέραιος → στοίχιση. */
export function tekHAlignToKey(hAlign: number): TekHAlignKey {
  return hAlign === 1 ? 'center' : hAlign === 2 ? 'right' : 'left';
}
