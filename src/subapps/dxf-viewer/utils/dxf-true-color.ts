/**
 * DXF True-Color ↔ hex SSoT.
 *
 * Το DXF κωδικοποιεί 24-bit RGB ως ακέραιο (group codes 420/421/431…): bits
 * `0xRRGGBB`. Η μετατροπή int↔hex ζούσε private+μονόδρομη (`hex()` στο
 * `dxf-layer-table-parser`). Κεντρικοποιείται εδώ ως **αμφίδρομο** ζεύγος ώστε ΚΑΙ
 * ο reader (421 → hex) ΚΑΙ ο writer (hex → 421) να μοιράζονται την ΙΔΙΑ μετατροπή
 * (N.12 — gradient colors, layer true-color, μελλοντικά per-entity 420).
 *
 * @see AutoCAD DXF Reference: true color (24-bit) encoding
 */

/** 24-bit RGB ακέραιος (`0xRRGGBB`) → `#RRGGBB` (uppercase). */
export function trueColorToHex(rgb: number): string {
  return `#${(rgb & 0xffffff).toString(16).padStart(6, '0').toUpperCase()}`;
}

/**
 * `#RRGGBB` / `#RGB` → 24-bit RGB ακέραιος (`0xRRGGBB`). Μη-έγκυρο/άγνωστο → `0`
 * (μαύρο· ασφαλές fallback, δεν ρίχνει).
 */
export function hexToTrueColor(hex: string): number {
  const m = /^#?([0-9a-fA-F]{6})$|^#?([0-9a-fA-F]{3})$/.exec(hex.trim());
  if (!m) return 0;
  const full = m[1] ?? (m[2] ? m[2].split('').map((c) => c + c).join('') : '');
  return parseInt(full, 16) & 0xffffff;
}
