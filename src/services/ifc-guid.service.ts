/**
 * IFC4 GlobalId Generator (ADR-369 §9 Q8) — Phase A1
 *
 * Παράγει 22-char compressed UUID per IFC4 (ISO 16739-1) specification.
 * Χρησιμοποιείται για το `ifcGuid` field του {@link IfcEntityMixin} σε όλες
 * τις BIM entities (Wall / Slab / Beam / Column / Opening).
 *
 * Encoding:
 *   - Input  : 128-bit UUID v4 (cryptographically secure)
 *   - Output : 22 chars από alphabet "0..9 A..Z a..z _ $"
 *   - Layout : char[0] = top 2 bits, chars[1..21] = 21 × 6 bits = 126 bits
 *              Σύνολο: 2 + 126 = 128 bits ✓
 *
 * Stability rule: Generate ONCE on entity create — NEVER regenerate.
 * Lookup via `enterprise-id-convenience.generateIfcGuid()` re-export.
 *
 * Reference encoding (IFC4 GlobalId 22-char base64-variant):
 *   - Canonical alphabet per buildingSMART:
 *     "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$"
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q8
 */

/** IFC4 GlobalId canonical 64-char alphabet. */
export const IFC_GUID_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';

/** Bytes per IFC4 GlobalId (128 bits = 16 bytes). */
const IFC_GUID_BYTES = 16;

/** Char count per IFC4 GlobalId. */
const IFC_GUID_CHAR_COUNT = 22;

/**
 * Συμπιέζει 16 bytes (128-bit UUID) σε 22-char IFC GlobalId.
 * Pure function — exposed για testing + advanced consumers.
 */
export function encodeIfcGuidFromBytes(bytes: Uint8Array): string {
  if (bytes.length !== IFC_GUID_BYTES) {
    throw new Error(`encodeIfcGuidFromBytes: expected ${IFC_GUID_BYTES} bytes, got ${bytes.length}`);
  }

  // Pack 16 bytes σε BigInt (avoids JS 53-bit precision limit).
  // BigInt() factory used instead of literal (target ES2017).
  const SHIFT_8 = BigInt(8);
  const SHIFT_6 = BigInt(6);
  const MASK_6 = BigInt(0x3f);
  const MASK_2 = BigInt(0x3);
  let value = BigInt(0);
  for (let i = 0; i < IFC_GUID_BYTES; i++) {
    value = (value << SHIFT_8) | BigInt(bytes[i]);
  }

  const chars: string[] = new Array(IFC_GUID_CHAR_COUNT);

  // Chars 21 → 1: 6 bits each (21 chars × 6 bits = 126 bits).
  for (let i = IFC_GUID_CHAR_COUNT - 1; i >= 1; i--) {
    const digit = Number(value & MASK_6);
    chars[i] = IFC_GUID_ALPHABET[digit];
    value >>= SHIFT_6;
  }
  // Char 0: top 2 bits.
  chars[0] = IFC_GUID_ALPHABET[Number(value & MASK_2)];

  return chars.join('');
}

/**
 * Παράγει νέο IFC4 GlobalId 22 χαρακτήρων.
 *
 * Χρησιμοποιεί `crypto.getRandomValues` για cryptographically secure entropy
 * και θέτει RFC 4122 v4 markers (πεδίο version + variant) στα bytes πριν
 * το compression — έτσι ώστε αν το GUID αντιστραφεί σε standard UUID να
 * διατηρεί το v4 shape.
 */
export function generateIfcGuid(): string {
  const bytes = new Uint8Array(IFC_GUID_BYTES);
  crypto.getRandomValues(bytes);
  // RFC 4122 v4 markers (version 4 + variant 10xx).
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return encodeIfcGuidFromBytes(bytes);
}
