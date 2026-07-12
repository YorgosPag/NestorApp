/**
 * DXF group 440 (entity transparency) codec SSoT — ADR-507 / ADR-636.
 *
 * AutoCAD αποθηκεύει τη διαφάνεια ως 32-bit ακέραιο στο group code 440:
 *   - byte MSB = flags: `0x02` = «by value» (BYALPHA)· `0x01` = by block.
 *   - byte LSB = alpha 0..255 (255 = αδιαφανές, 0 = πλήρως διάφανο).
 * Η εφαρμογή δουλεύει με το AutoCAD **transparency %** 0..90 (`BaseEntity.transparency`,
 * ίδια κλίμακα με το contextual panel). Αυτό το module είναι ο ΜΟΝΟΣ μετατροπέας
 * %↔440 — encode (export) + decode (import) μένουν ακριβώς αντίστροφα (roundtrip).
 *
 * ByLayer/ByBlock (χωρίς BYALPHA flag) → inherit → `undefined`, ίδια λογική με τα
 * inheritance sentinels του `extractEntityColor`/`extractEntityLineweight`.
 *
 * @see utils/dxf-entity-style-extract — extractEntityTransparency (ο import καταναλωτής)
 * @see export/core/dxf-ascii-primitive-emitters — emitEntityStyle (ο export καταναλωτής)
 */

/** BYALPHA flag (byte 3) — «η διαφάνεια ορίζεται ρητά κατ' απόλυτη τιμή». */
const BY_VALUE_FLAG = 0x02000000;
/** Πλήρως αδιαφανές alpha. */
const ALPHA_MAX = 255;
/** AutoCAD object transparency: 0 (αδιαφανές) .. 90 (90% διάφανο). */
export const TRANSPARENCY_MAX = 90;

/**
 * Transparency % (0..90) → DXF 440 raw int, ή `undefined` όταν είναι αδιαφανές (0) —
 * το αδιαφανές είναι το default, οπότε δεν γράφεται κωδικός (bare entity παραμένει
 * byte-identical, μηδέν regression). Το `undefined` input επίσης → `undefined`.
 */
export function encodeDxf440(pct: number | undefined): number | undefined {
  if (pct === undefined || !Number.isFinite(pct)) return undefined;
  const clamped = Math.max(0, Math.min(TRANSPARENCY_MAX, Math.round(pct)));
  if (clamped <= 0) return undefined; // αδιαφανές = default → όχι κωδικός
  const alpha = Math.round((ALPHA_MAX * (100 - clamped)) / 100);
  return BY_VALUE_FLAG | alpha;
}

/**
 * DXF 440 raw int → transparency % (0..90), ή `undefined` όταν αδιαφανές / ByLayer /
 * ByBlock (χωρίς BYALPHA flag → κληρονομείται). Ακριβώς αντίστροφο του {@link encodeDxf440}.
 */
export function decodeDxf440(raw: number): number | undefined {
  if (!Number.isFinite(raw)) return undefined;
  // Χωρίς BYALPHA flag → ByLayer/ByBlock inherit → undefined (mirror των color sentinels).
  if ((raw & BY_VALUE_FLAG) === 0) return undefined;
  const alpha = raw & 0xff;
  const pct = Math.round(100 - (alpha / ALPHA_MAX) * 100);
  const clamped = Math.max(0, Math.min(TRANSPARENCY_MAX, pct));
  return clamped > 0 ? clamped : undefined;
}
