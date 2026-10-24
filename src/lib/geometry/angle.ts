/**
 * =============================================================================
 * ANGLE MATH (SSoT) — καθαρή, ΧΩΡΙΣ καμία εισαγωγή
 * =============================================================================
 *
 * Η **μία** πηγή για μετατροπή και περιτύλιξη γωνιών (ADR-067 · ADR-068 · ADR-077 · ADR-134,
 * `.ssot-registry.json` → `normalize-angle-deg`).
 *
 * 🔑 **Γιατί ζει εδώ και όχι στο `dxf-viewer`** (ADR-884 §4.8): ζούσε στο
 * `rendering/entities/shared/geometry-angle-utils.ts`, που εισάγει `geometry-rendering-utils`
 * ⇒ `color-config`, `useTextPreviewStyle`, `types/entities`. Ο θεατής περιήγησης τρέχει στη
 * **δημόσια** αγγελία (ADR-884 Α2) και χρειάζεται **μόνο** την αριθμητική — όχι τον κόσμο
 * της απόδοσης DXF. Τα αρχεία του subapp **επανεξάγουν** από εδώ, ώστε οι 41 εισαγωγείς τους
 * να μένουν αμετάβλητοι και η δήλωση να είναι **μία**.
 *
 * ⚠️ **ΜΗΝ προσθέσεις εισαγωγή εδώ.** Η αξία του αρχείου είναι ότι δεν σέρνει τίποτα.
 *
 * @module lib/geometry/angle
 */

/** Πλήρης κύκλος σε ακτίνια (2π) — ADR-077. */
export const TAU = Math.PI * 2;

/** Μοίρες → ακτίνια: `rad = deg * DEGREES_TO_RADIANS` — ADR-067. */
export const DEGREES_TO_RADIANS = Math.PI / 180;

/** Ακτίνια → μοίρες: `deg = rad * RADIANS_TO_DEGREES` — ADR-067. */
export const RADIANS_TO_DEGREES = 180 / Math.PI;

/** Ορθή γωνία σε ακτίνια (π/2) — ADR-103. */
export const RIGHT_ANGLE = Math.PI / 2;

/** Μοίρες → ακτίνια — ADR-067. */
export function degToRad(degrees: number): number {
  return degrees * DEGREES_TO_RADIANS;
}

/** Ακτίνια → μοίρες — ADR-067. */
export function radToDeg(radians: number): number {
  return radians * RADIANS_TO_DEGREES;
}

/**
 * Διαφορά γωνίας στο `(-π, π]` — η **σύντομη** φορά από τη μία γωνία στην άλλη (ADR-134).
 * `> 0` αριστερόστροφα, `< 0` δεξιόστροφα· το `-π` απεικονίζεται στο `π`.
 *
 * @example normalizeAngleDiff(3 * Math.PI) // → π
 */
export function normalizeAngleDiff(angleDiff: number): number {
  let diff = angleDiff;
  while (diff > Math.PI) diff -= TAU;
  while (diff <= -Math.PI) diff += TAU;
  return diff;
}

/** Γωνία σε ακτίνια στο `[0, 2π)`, για οποιαδήποτε είσοδο (ADR-068). */
export function normalizeAngleRad(radians: number): number {
  let normalized = radians % TAU;
  if (normalized < 0) normalized += TAU;
  return normalized;
}

/**
 * Γωνία σε μοίρες στο `[0, 360)`, για οποιαδήποτε είσοδο (ADR-068).
 *
 * @example normalizeAngleDeg(-90) // → 270 · normalizeAngleDeg(450) // → 90
 */
export function normalizeAngleDeg(degrees: number): number {
  let normalized = degrees % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

/**
 * Γωνία κειμένου που **δεν διαβάζεται ποτέ ανάποδα** (ADR-112 — AutoCAD/Revit/MicroStation): πάνω από 90° κατά μέτρο
 * στρίβει κατά π. Είσοδος από `atan2`, δηλαδή στο `(-π, π]`.
 *
 * 🔑 Μετακόμισε από το `dxf-viewer/.../geometry-angle-utils.ts` (ADR-920 Β4.8): οι ετικέτες ισοϋψών του χάρτη εδάφους
 * της αγγελίας κάνουν την ίδια ερώτηση και δεν επιτρέπεται να εισάγουν από το subapp (CHECK 3.62).
 *
 * Ακριβώς ±90° **δεν** στρίβει (κατακόρυφο κείμενο μένει ως έχει).
 *
 * @example normalizeTextAngle(Math.PI) // → 2π (≡ 0) · normalizeTextAngle(-3 * Math.PI / 4) // → π/4
 */
export function normalizeTextAngle(angle: number): number {
  if (Math.abs(angle) > RIGHT_ANGLE) {
    return angle + Math.PI;
  }
  return angle;
}

/** Ο κυκλικός μέσος όρος γωνιών — η κατεύθυνση **και** πόσο συμφωνούν. */
export interface CircularMean {
  /** Η μέση κατεύθυνση, `[0, 2π)`. */
  readonly meanRad: number;
  /**
   * Το μήκος του μέσου διανύσματος, `[0, 1]`: `1` = όλες ίδιες, `0` = καμία προτίμηση. Η κυκλική τυπική
   * απόκλιση είναι `√(−2·ln R)` — δες {@link circularSpreadRad}.
   */
  readonly resultant: number;
}

/**
 * **Ο κυκλικός μέσος** (ADR-897 Φ5.2) — μέσος όρος **μοναδιαίων διανυσμάτων**, ποτέ των αριθμών: ο αριθμητικός
 * μέσος των 350° και 10° είναι 180°, δηλαδή η **αντίθετη** κατεύθυνση. `null` για κενή είσοδο ή όταν οι γωνίες
 * αλληλοαναιρούνται (ο μέσος δεν ορίζεται — ποτέ επινοημένη κατεύθυνση).
 */
export function circularMeanRad(angles: readonly number[]): CircularMean | null {
  if (angles.length === 0) return null;
  let sin = 0;
  let cos = 0;
  for (const angle of angles) { sin += Math.sin(angle); cos += Math.cos(angle); }
  const resultant = Math.hypot(sin, cos) / angles.length;
  if (resultant < 1e-9) return null;
  return { meanRad: normalizeAngleRad(Math.atan2(sin, cos)), resultant };
}

/** Η κυκλική τυπική απόκλιση από το μήκος του μέσου διανύσματος (Mardia & Jupp) — σε ακτίνια. */
export function circularSpreadRad(resultant: number): number {
  return Math.sqrt(-2 * Math.log(Math.min(1, Math.max(resultant, 1e-12))));
}
