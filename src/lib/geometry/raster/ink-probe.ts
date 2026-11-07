/**
 * =============================================================================
 * ΑΝΙΧΝΕΥΣΗ ΜΕΛΑΝΙΟΥ ΣΕ ΣΥΝΕΧΗ ΧΩΡΟ (SSoT)
 * =============================================================================
 *
 * Ερωτήσεις σε δυαδική μάσκα (`1` = μελάνι) σε **συνεχείς** συντεταγμένες px (το κελί `i` καλύπτει το `[i, i + 1)`):
 * υπάρχει μελάνι εδώ, τι ποσοστό μιας ακτίνας είναι μελάνι, πόσο γεμάτος είναι ένας δίσκος ή ένας κύκλος. Δειγματοληψία με βήμα μισού px: αρκετά πυκνό για πινελιές 1 px, χωρίς παρεμβολή (η μάσκα είναι
 * ήδη απόφαση). Οι ανιχνευτές συμβόλων (απολήξεις διαστάσεων, ADR-929 §6.7) ρωτούν **μόνο** εδώ.
 *
 * @module lib/geometry/raster/ink-probe
 */

export interface InkMask {
  readonly mask: Uint8Array;
  readonly cols: number;
  readonly rows: number;
}

export interface ProbePoint {
  readonly x: number;
  readonly y: number;
}

/** Βήμα δειγματοληψίας σε px. */
const STEP_PX = 0.5;

/** Μελάνι στο κελί που περιέχει το σημείο· έξω από την εικόνα ⇒ χαρτί. */
export function inkAt(m: InkMask, x: number, y: number): boolean {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  return cx >= 0 && cy >= 0 && cx < m.cols && cy < m.rows && m.mask[cy * m.cols + cx] === 1;
}

/** Το ποσοστό μελανιού στα σημεία `from + t·dir`, `t ∈ [t0, t1]` (`dir` μοναδιαίο). Κενό διάστημα ⇒ 0. */
export function inkFractionAlong(m: InkMask, from: ProbePoint, dir: ProbePoint, t0: number, t1: number): number {
  if (!(t1 > t0)) return 0;
  let hit = 0;
  let total = 0;
  for (let t = t0; t <= t1 + 1e-9; t += STEP_PX) {
    total++;
    if (inkAt(m, from.x + dir.x * t, from.y + dir.y * t)) hit++;
  }
  return total === 0 ? 0 : hit / total;
}

/**
 * Το πάχος του συνεχούς μελανιού που περνά από το `p`, κατά τη διεύθυνση `dir` και την αντίθετή της (`dir` μοναδιαίο),
 * έως `maxPx` προς κάθε μεριά. `0` όταν στο `p` δεν υπάρχει μελάνι. Μετρά την πινελιά **όπως είναι στην εικόνα**, και όχι
 * όπως τη μοίρασαν οι ζώνες (σε στραβή σάρωση ένα μέρος της πάει σε κρόσσι).
 */
export function inkThicknessAcross(m: InkMask, p: ProbePoint, dir: ProbePoint, maxPx: number): number {
  if (!inkAt(m, p.x, p.y)) return 0;
  const run = (sign: 1 | -1): number => {
    let t = 0;
    while (t + STEP_PX <= maxPx && inkAt(m, p.x + sign * dir.x * (t + STEP_PX), p.y + sign * dir.y * (t + STEP_PX))) t += STEP_PX;
    return t;
  };
  return run(1) + run(-1) + STEP_PX;
}

/** Το ποσοστό μελανιού στα κέντρα κελιών μέσα στον δίσκο `(c, r)`. */
export function inkFractionInDisk(m: InkMask, c: ProbePoint, r: number): number {
  let hit = 0;
  let total = 0;
  for (let y = Math.floor(c.y - r); y <= Math.ceil(c.y + r); y++) {
    for (let x = Math.floor(c.x - r); x <= Math.ceil(c.x + r); x++) {
      if (Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) > r) continue;
      total++;
      if (inkAt(m, x + 0.5, y + 0.5)) hit++;
    }
  }
  return total === 0 ? 0 : hit / total;
}

/** Το ποσοστό μελανιού πάνω στον κύκλο `(c, r)`, σε `samples` ισαπέχοντα σημεία. */
export function inkFractionOnCircle(m: InkMask, c: ProbePoint, r: number, samples = 48): number {
  let hit = 0;
  for (let i = 0; i < samples; i++) {
    const a = (2 * Math.PI * i) / samples;
    if (inkAt(m, c.x + r * Math.cos(a), c.y + r * Math.sin(a))) hit++;
  }
  return hit / samples;
}
