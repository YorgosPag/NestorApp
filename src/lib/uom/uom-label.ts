/**
 * @fileoverview **Η ετικέτα μιας μονάδας μέτρησης** — ΕΝΑΣ μορφοποιητής για UI (`useUomLabel`) και server/PDF
 *   (`uomLabelIn`)· αλλάζει μόνο ο μεταφραστής (ADR-923 §5.11 «3γ» Α10 — το σχήμα του `floors`, ADR-903).
 * @module lib/uom/uom-label
 */

import { resolveUom } from './uom-registry';

/** `symbol` = στη γραμμή/στήλη («τ.μ.») · `name` = σε λίστα επιλογής («Τετραγωνικό μέτρο»). */
export type UomLabelForm = 'symbol' | 'name';

/** Ό,τι χρειάζεται ο μορφοποιητής από έναν μεταφραστή του namespace `uom`. */
export type UomTranslate = (key: string) => string;

/**
 * Η ετικέτα της αποθηκευμένης γραφής, όποιο από τα παλιά λεξιλόγια κι αν τη έγραψε (`'τεμ'` ≡ `'pcs'` ≡ `'H87'`).
 * Άγνωστη μονάδα ⇒ **αυτούσια** η γραφή (ορατή, ποτέ σιωπηλό κενό ή ψεύτικη αντιστοίχιση)· απούσα ⇒ `''`.
 */
export function formatUom(raw: string | null | undefined, t: UomTranslate, form: UomLabelForm = 'symbol'): string {
  const code = resolveUom(raw);
  if (code !== null) return t(`${form}.${code}`);
  return raw?.trim() ?? '';
}
