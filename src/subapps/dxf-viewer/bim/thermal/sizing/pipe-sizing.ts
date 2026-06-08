/**
 * ADR-422 L3 — Pipe-sizing engine (D5 «velocity + friction») — PURE SSoT.
 *
 * Από το θερμικό φορτίο που διέρχεται ενός τμήματος σωλήνα στην **παροχή** και από
 * εκεί στην **ταχύτητα** + **τριβή** για μια δεδομένη εσωτερική διάμετρο:
 *
 *   ṁ  = Φ / (c · ΔΤ)            παροχή μάζας (kg/s) — c=ειδ. θερμότητα, ΔΤ=regime
 *   Q  = ṁ / ρ                   παροχή όγκου (m³/s)
 *   v  = Q / A,  A = π·(d/2)²     ταχύτητα (m/s) — d = ΕΣΩΤΕΡΙΚΗ διάμετρος
 *   R  = f · (ρ·v²) / (2·d)      ειδική τριβή (Pa/m) — Darcy–Weisbach
 *       f = 64/Re (laminar) ή 0.316/Re^0.25 (Blasius, turbulent)
 *
 * ΚΑΜΙΑ γεωμετρία / state / persistence — μόνο αριθμητική. Idempotent, full
 * unit-testable. ΜΟΝΑΔΕΣ: Φ σε W, ΔΤ σε K, διάμετροι σε **mm** (→ m εσωτερικά).
 *
 * @see ./pipe-sizing-config (c / ρ / μ / κλίμακα DN / όρια)
 * @see ./velocity-friction-standard (επιλογή DN με βάση τα v/R που υπολογίζει εδώ)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L3)
 */

import {
  WATER_SPECIFIC_HEAT_J_KGK,
  WATER_DENSITY_KG_M3,
  WATER_DYNAMIC_VISCOSITY_PA_S,
} from './pipe-sizing-config';

/** Είσοδος υπολογισμού παροχής μάζας (resolved — καμία γνώση scene). */
export interface PipeMassFlowInput {
  /** W — θερμικό φορτίο που διέρχεται του τμήματος (αθροιστικό κατάντη). */
  readonly loadW: number;
  /** K — θερμοκρασιακή πτώση δικτύου (supplyC − returnC). */
  readonly deltaTK: number;
}

/**
 * Παροχή μάζας νερού (kg/s) για δεδομένο φορτίο + ΔΤ. Pure/idempotent.
 *
 * Guard εκφυλισμού: μη-θετικό ΔΤ ή μη-πεπερασμένο φορτίο → 0 kg/s (δεν πετά· ο
 * consumer το ερμηνεύει ως «μη διαστασιολογήσιμο» → ελάχιστο DN).
 */
export function computePipeMassFlow(input: PipeMassFlowInput): number {
  const load = Number.isFinite(input.loadW) ? input.loadW : 0;
  if (!(input.deltaTK > 0) || load <= 0) return 0;
  return load / (WATER_SPECIFIC_HEAT_J_KGK * input.deltaTK);
}

/** Παροχή όγκου (m³/s) από παροχή μάζας (kg/s). */
export function computePipeVolumeFlow(massFlowKgS: number): number {
  const m = Number.isFinite(massFlowKgS) && massFlowKgS > 0 ? massFlowKgS : 0;
  return m / WATER_DENSITY_KG_M3;
}

/** Εμβαδόν εσωτερικής διατομής (m²) από εσωτερική διάμετρο (mm). */
function innerAreaM2(innerMm: number): number {
  const rM = innerMm / 1000 / 2;
  return Math.PI * rM * rM;
}

/** Ταχύτητα ροής (m/s) για παροχή όγκου (m³/s) + εσωτερική διάμετρο (mm). */
export function pipeVelocity(volumeFlowM3s: number, innerMm: number): number {
  const area = innerAreaM2(innerMm);
  if (!(area > 0)) return 0;
  const q = Number.isFinite(volumeFlowM3s) && volumeFlowM3s > 0 ? volumeFlowM3s : 0;
  return q / area;
}

/** Αριθμός Reynolds (αδιάστατος) για ταχύτητα (m/s) + εσωτερική διάμετρο (mm). */
function reynolds(velocityMS: number, innerMm: number): number {
  const dM = innerMm / 1000;
  return (WATER_DENSITY_KG_M3 * velocityMS * dM) / WATER_DYNAMIC_VISCOSITY_PA_S;
}

/**
 * Ειδική απώλεια τριβής (Pa/m) κατά Darcy–Weisbach. Συντελεστής τριβής `f`:
 * laminar `64/Re` (Re<2300), αλλιώς Blasius `0.316/Re^0.25` (λεία σωλήνωση). Μηδενική
 * ταχύτητα/διάμετρος → 0.
 */
export function pipeFriction(velocityMS: number, innerMm: number): number {
  if (!(velocityMS > 0) || !(innerMm > 0)) return 0;
  const re = reynolds(velocityMS, innerMm);
  if (!(re > 0)) return 0;
  const f = re < 2300 ? 64 / re : 0.316 / Math.pow(re, 0.25);
  const dM = innerMm / 1000;
  return (f * WATER_DENSITY_KG_M3 * velocityMS * velocityMS) / (2 * dM);
}
