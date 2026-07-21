/**
 * rgb-unit-hex — ADR-678. ΕΝΑ SSoT για «RGB συνιστώσες 0..1 → CSS hex».
 *
 * Το ίδιο math χρειάζονται δύο import parsers: το OBJ `.mtl` `Kd` (γραμμικό 0..1, Φ1) και το COLLADA
 * `.dae` `<diffuse><color>` (sRGB 0..1, Φ4). Ίδιος υπολογισμός → **ένας** helper (μηδέν structural
 * clone, N.18). Ο χώρος χρώματος (linear vs sRGB) είναι ευθύνη του καλούντος — εδώ είναι καθαρά
 * αριθμητική μετατροπή μονάδας.
 */

/**
 * `[0.75, 0.22, 0.17]` → `#c0392b`. Clamp 0..1 → 0..255, 2-digit hex ανά κανάλι. Επιστρέφει `null`
 * αν δεν υπάρχουν τουλάχιστον 3 πεπερασμένα κανάλια (τα υπόλοιπα, π.χ. alpha, αγνοούνται).
 */
export function rgbUnitToHex(components: readonly (string | number)[]): string | null {
  const rgb = components.slice(0, 3).map(Number);
  if (rgb.length !== 3 || rgb.some((n) => !Number.isFinite(n))) return null;
  const hex = rgb
    .map((n) => Math.round(Math.min(1, Math.max(0, n)) * 255).toString(16).padStart(2, '0'))
    .join('');
  return `#${hex}`;
}
