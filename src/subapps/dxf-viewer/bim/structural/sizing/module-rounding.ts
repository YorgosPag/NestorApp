/**
 * module-rounding — SSoT για στρογγυλοποίηση διάστασης σε module βήμα (mm).
 *
 * 🏢 ENTERPRISE (ADR-459 v16): ΕΝΑ pure scalar leaf αντικαθιστά **4 ταυτόσημα** inline
 * `Math.ceil(value / module) * module` (slab-sizing / member-sizing / column-sizing /
 * suggest-pad-dimensions) + το μοναδικό `roundDownToModule` (member-sizing). Πριν ήταν
 * copy-paste σε κάθε sizing path → drift risk + ο dust-bug χρειαζόταν fix σε N σημεία.
 *
 * Το `roundUpToModule` ενσωματώνει **tolerant-ceil**: αφαιρεί {@link MODULE_CEIL_EPSILON}
 * από το πηλίκο ώστε sub-ULP float dust (π.χ. `1300.0000000000146` από rotation un-rotate
 * στο `effectiveFaces`) να ΜΗΝ προκαλεί άσκοπη αναβάθμιση ολόκληρου module (50 mm oversize).
 * Η τιμή (1e-9 του πηλίκου) είναι τάξεις μεγέθους πάνω από το dust (~1e-13) και κάτω από
 * κάθε πραγματική διάσταση → invisible σε νόμιμες τιμές.
 *
 * Pure, zero-deps (μόνο `Math`) → safe import από κάθε sizing/footing path χωρίς cycles.
 */

/** Σχετικό epsilon για tolerant-ceil (πηλίκο). ≫ float dust (~1e-13), ≪ νόμιμες τιμές. */
export const MODULE_CEIL_EPSILON = 1e-9;

/**
 * Στρογγυλοποίηση **προς τα πάνω** σε πολλαπλάσιο του `module`, με tolerant-ceil: τιμές
 * ελάχιστα πάνω από ακέραιο πολλαπλάσιο (float dust) ΔΕΝ πηδούν ολόκληρο module. Ο caller
 * εγγυάται `module > 0`.
 */
export function roundUpToModule(value: number, module: number): number {
  return Math.ceil(value / module - MODULE_CEIL_EPSILON) * module;
}

/**
 * Στρογγυλοποίηση **προς τα κάτω** σε πολλαπλάσιο του `module` (π.χ. depth cap). Ο caller
 * εγγυάται `module > 0`.
 */
export function roundDownToModule(value: number, module: number): number {
  return Math.floor(value / module) * module;
}
