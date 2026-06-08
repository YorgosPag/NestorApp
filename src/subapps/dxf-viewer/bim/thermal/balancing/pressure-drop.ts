/**
 * ADR-422 L4 — Pressure-drop math (Darcy + local losses) — PURE SSoT.
 *
 * Η πτώση πίεσης ενός τμήματος σωλήνα είναι τριβή κατά μήκος + τοπικές αντιστάσεις:
 *
 *   ΔP_friction = R · L                 R = ειδική τριβή (Pa/m, από L3), L = μήκος (m)
 *   ΔP_local    = Σζ · (ρ·v²/2)         ζ = αδιάστατος, v = ταχύτητα (m/s, από L3)
 *   ΔP_seg      = ΔP_friction + ΔP_local
 *
 * Το `R` και το `v` έρχονται **έτοιμα** από τον L3 sizing engine (επιλεγμένη DN).
 * Το μήκος `L` είναι το `MepSegmentGeometry.length` (m). ΚΑΜΙΑ γεωμετρία/state εδώ —
 * μόνο αριθμητική. Idempotent, full unit-testable.
 *
 * ΜΟΝΑΔΕΣ: πιέσεις σε **Pa** (ΟΧΙ kPa/bar). R=Pa/m, L=m, v=m/s, ρ=kg/m³, ζ αδιάστατο.
 *
 * @see ./balancing-config (ρ / ζ) · ./circuit-balancing (άθροισμα κατά μήκος κυκλώματος)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L4)
 */

/** Δυναμική πίεση `ρ·v²/2` (Pa) για ταχύτητα (m/s) + πυκνότητα (kg/m³). */
export function dynamicPressurePa(velocityMS: number, densityKgM3: number): number {
  const v = Number.isFinite(velocityMS) && velocityMS > 0 ? velocityMS : 0;
  if (!(densityKgM3 > 0)) return 0;
  return (densityKgM3 * v * v) / 2;
}

/** Απώλεια τριβής κατά μήκος `R·L` (Pa). R=Pa/m, L=m. */
export function frictionDropPa(frictionPaM: number, lengthM: number): number {
  const r = Number.isFinite(frictionPaM) && frictionPaM > 0 ? frictionPaM : 0;
  const l = Number.isFinite(lengthM) && lengthM > 0 ? lengthM : 0;
  return r * l;
}

/** Τοπική απώλεια `Σζ · (ρ·v²/2)` (Pa). */
export function localDropPa(
  zetaSum: number,
  velocityMS: number,
  densityKgM3: number,
): number {
  const z = Number.isFinite(zetaSum) && zetaSum > 0 ? zetaSum : 0;
  return z * dynamicPressurePa(velocityMS, densityKgM3);
}

/** Όρισμα της συνολικής πτώσης ενός τμήματος. */
export interface SegmentPressureDropInput {
  /** Pa/m — ειδική τριβή στην επιλεγμένη DN (από L3). */
  readonly frictionPaM: number;
  /** m — αξονικό μήκος τμήματος (`geometry.length`). */
  readonly lengthM: number;
  /** Αδιάστατο — άθροισμα ζ τοπικών αντιστάσεων του τμήματος. */
  readonly localZetaSum: number;
  /** m/s — ταχύτητα ροής στην επιλεγμένη DN (από L3). */
  readonly velocityMS: number;
  /** kg/m³ — πυκνότητα νερού. */
  readonly densityKgM3: number;
}

/** Συνολική πτώση πίεσης ενός τμήματος (Pa) = τριβή + τοπικές. Pure. */
export function segmentPressureDropPa(input: SegmentPressureDropInput): number {
  return (
    frictionDropPa(input.frictionPaM, input.lengthM) +
    localDropPa(input.localZetaSum, input.velocityMS, input.densityKgM3)
  );
}

/** Όρισμα υπολογισμού kv balancing valve. */
export interface RequiredKvInput {
  /** m³/s — παροχή όγκου του κυκλώματος. */
  readonly volumeFlowM3s: number;
  /** Pa — υπερβάλλουσα πίεση προς στραγγαλισμό. */
  readonly surplusPa: number;
  readonly paPerBar: number;
  readonly secondsPerHour: number;
}

/**
 * Απαιτούμενο kv balancing valve: `kv = Q[m³/h] / √(ΔP[bar])`. Μηδενική/αρνητική
 * υπερβάλλουσα ή μηδενική παροχή → `null` («πλήρως ανοιχτή», δεν στραγγαλίζεται).
 */
export function requiredKv(input: RequiredKvInput): number | null {
  if (!(input.surplusPa > 0) || !(input.volumeFlowM3s > 0)) return null;
  const qM3h = input.volumeFlowM3s * input.secondsPerHour;
  const dpBar = input.surplusPa / input.paPerBar;
  if (!(dpBar > 0)) return null;
  return qM3h / Math.sqrt(dpBar);
}
