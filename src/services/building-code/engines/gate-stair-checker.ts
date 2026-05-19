/**
 * @related ADR-358 §5.9 §3.5 §3.7 §9.2 Q25 Q27 — Stair code-profile validator
 *   (Phase 6 = 4 code profiles + hard errors; Phase 6.5 = +egress G20).
 *
 * Pure functions. Zero React / DOM / Firestore deps. Runs the 4 active code
 * profiles (NOK / IBC / Eurocode / ADA), a universal hard-error baseline, and
 * a universal egress capacity check (IBC §1011.5 formula: width_mm / 7.62 =
 * persons_max). Egress runs for every profile except 'none' — it is universal
 * life-safety, not profile-specific.
 *
 * Hard errors → block stair creation.
 * Code violations → non-blocking warnings (red badge in property panel).
 * Egress violations → non-blocking warnings (separate bucket for UI grouping).
 *
 * NBC / NFPA / AS1657 / DIN profiles are placeholders Phase 9 (Q25).
 * Headroom validator lives in `stair-validator.ts` (cheap 2D Phase 6).
 * ADA handrail render lives in StairRenderer Phase 7a (deferred from Phase 6.5
 * — Q26 visual coherent pacchetto landed alongside red badge UI surfacing).
 */

import type {
  StairCodeProfile,
  StairNokSubType,
  StairParams,
} from '@/subapps/dxf-viewer/bim/types/stair-types';

// ─── Public input / output shapes ────────────────────────────────────────────

export interface GateStairCheckerInput {
  readonly params: Readonly<StairParams>;
  readonly codeProfile: StairCodeProfile;
  readonly nokSubType?: StairNokSubType;
  /**
   * Project-default occupancy load (Q27, ADR-358 §3.7). Caller passes the
   * resolved value (`projectDefault ?? params.occupancyLoad`); when absent or
   * 0 egress check is skipped. Universal across profiles except 'none'.
   */
  readonly occupancyLoad?: number;
}

export interface GateStairCheckerResult {
  /** Universal hard errors — block creation regardless of profile. */
  readonly hardErrors: readonly string[];
  /** Code-profile violations — non-blocking warnings (i18n keys). */
  readonly codeViolations: readonly string[];
  /** ADA-specific violations split out for UI grouping. */
  readonly adaViolations: readonly string[];
  /** Egress capacity violations (Phase 6.5, G20). Universal except 'none'. */
  readonly egressViolations: readonly string[];
  /**
   * ADR-358 Phase 3g — soft comfort warnings (yellow band). Disjoint from
   * `codeViolations` — comfort warnings fire when width ≥ legal minimum but
   * below industry-practice comfort threshold for the declared NOK scope.
   */
  readonly comfortViolations: readonly string[];
}

// ─── Hard-error baseline (profile-independent) ───────────────────────────────

function checkHardErrors(params: Readonly<StairParams>): readonly string[] {
  const errors: string[] = [];
  if (params.stepCount < 2) errors.push('tools.stair.validator.hardError.stepCount');
  if (params.width <= 0) errors.push('tools.stair.validator.hardError.width');
  if (params.rise <= 0) errors.push('tools.stair.validator.hardError.rise');
  if (params.tread <= 0) errors.push('tools.stair.validator.hardError.tread');
  if (params.totalRise <= 0) errors.push('tools.stair.validator.hardError.totalRise');
  return errors;
}

// ─── NOK (Ν.4067/2012 + PD 3046/304/89 Άρθρο 13, §3.5) ───────────────────────

/**
 * ADR-358 Phase 3g — legal minimum stair width (mm) per NOK scope. Source:
 * Κτιριοδομικός Κανονισμός Άρθρο 13 παρ. 2 + 4.5. Below = red code violation.
 */
const NOK_WIDTH_LEGAL_MIN_MM: Readonly<Record<StairNokSubType, number>> = {
  main: 1200,           // παρ. 2 base rule — κεντρικό κλιμακοστάσιο
  'low-rise': 900,      // παρ. 2 exception α — κτίριο κατοικίας ≤3 ορόφων
  internal: 600,        // παρ. 2 exception β — εσωτερική ενιαίας κατοικίας
  auxiliary: 600,       // παρ. 4.5 — βοηθητική (industria/αποθήκη)
  secondary: 900,       // legacy alias for 'low-rise' (back-compat)
};

/**
 * ADR-358 Phase 3g — industry comfort minimum stair width (mm) per scope.
 * Above legal min but below comfort = yellow soft warning. Source: industry
 * practice (Revit/ArchiCAD comfort guidance, Pasisis dimensionamento guide).
 */
const NOK_WIDTH_COMFORT_MIN_MM: Readonly<Record<StairNokSubType, number>> = {
  main: 1200,           // legal == comfort (no warning gap)
  'low-rise': 1000,     // 900 legal → 1000 comfort
  internal: 800,        // 600 legal → 800 comfort (practical apartment min)
  auxiliary: 600,       // auxiliary stairs are scomode by design — no comfort warning
  secondary: 1000,      // legacy alias for 'low-rise'
};

/**
 * `main` keeps the strict NOK rise/tread + 2R+G ergonomic envelope; the other
 * scopes share the relaxed band (NOK does not subdivide rise/tread per scope,
 * only width).
 */
function isMainScope(subType: StairNokSubType): boolean {
  return subType === 'main';
}

function checkNOK(
  params: Readonly<StairParams>,
  subType: StairNokSubType,
): readonly string[] {
  const isMain = isMainScope(subType);
  const widthMin = NOK_WIDTH_LEGAL_MIN_MM[subType];
  const riseMin = isMain ? 130 : 140;
  const riseMax = isMain ? 180 : 200;
  const treadMin = isMain ? 260 : 230;
  const treadMax = isMain ? 320 : 280;
  const twoRG = 2 * params.rise + params.tread;
  const out: string[] = [];
  if (params.width < widthMin) out.push('tools.stair.validator.nok.widthMin');
  if (params.rise < riseMin || params.rise > riseMax) out.push('tools.stair.validator.nok.riseRange');
  if (params.tread < treadMin || params.tread > treadMax) out.push('tools.stair.validator.nok.treadRange');
  if (isMain && (twoRG < 600 || twoRG > 640)) out.push('tools.stair.validator.nok.twoRPlusG');
  return out;
}

/**
 * ADR-358 Phase 3g — soft comfort warning when width is between legal min and
 * comfort min. Yellow band — does NOT count as code violation.
 */
function checkNOKComfort(
  params: Readonly<StairParams>,
  subType: StairNokSubType,
): readonly string[] {
  const legalMin = NOK_WIDTH_LEGAL_MIN_MM[subType];
  const comfortMin = NOK_WIDTH_COMFORT_MIN_MM[subType];
  if (comfortMin <= legalMin) return [];
  if (params.width >= legalMin && params.width < comfortMin) {
    return ['tools.stair.validator.nok.widthBelowComfort'];
  }
  return [];
}

// ─── IBC commercial §1011 ────────────────────────────────────────────────────

function checkIBC(params: Readonly<StairParams>): readonly string[] {
  const out: string[] = [];
  if (params.width < 1117) out.push('tools.stair.validator.ibc.widthMin');
  if (params.rise > 177.8) out.push('tools.stair.validator.ibc.riseMax');
  if (params.tread < 279.4) out.push('tools.stair.validator.ibc.treadMin');
  return out;
}

// ─── Eurocode + Blondel ──────────────────────────────────────────────────────

function checkEurocode(params: Readonly<StairParams>): readonly string[] {
  const twoRG = 2 * params.rise + params.tread;
  const out: string[] = [];
  if (params.width < 1000) out.push('tools.stair.validator.eurocode.widthMin');
  if (params.rise < 170 || params.rise > 200) out.push('tools.stair.validator.eurocode.riseRange');
  if (params.tread < 230 || params.tread > 300) out.push('tools.stair.validator.eurocode.treadRange');
  if (twoRG < 600 || twoRG > 650) out.push('tools.stair.validator.eurocode.twoRPlusG');
  return out;
}

// ─── ADA (ICC A117.1 §504-505 + ADA 2010, §3.6 + Q26) ────────────────────────

function checkADA(params: Readonly<StairParams>): readonly string[] {
  const out: string[] = [];
  if (params.rise > 177.8) out.push('tools.stair.validator.ada.riseMax');
  if (params.tread < 279.4) out.push('tools.stair.validator.ada.treadMin');
  // Parametric stair: all risers uniform by construction. Per-tread custom rise
  // not yet supported in `StairPerTreadOverride`, so uniformity is trivially
  // satisfied — no emission. Phase 9 will revisit when per-tread rise exposed.
  const h = params.handrails.height;
  if (h < 864 || h > 965) out.push('tools.stair.validator.ada.handrailHeight');
  const topExt = params.handrails.topExtension ?? 0;
  if (topExt < 305) out.push('tools.stair.validator.ada.topExtension');
  if (params.handrails.bottomExtension !== 'one-tread') out.push('tools.stair.validator.ada.bottomExtension');
  if (!params.adaContrastStrip) out.push('tools.stair.validator.ada.contrastStrip');
  return out;
}

// ─── Egress capacity (G20, IBC §1011.5 — universal life-safety, Phase 6.5) ──

/** Required width per occupant on stairs: 0.3 in / person = 7.62 mm / person. */
const EGRESS_MM_PER_PERSON = 7.62;

function checkEgress(
  params: Readonly<StairParams>,
  occupancyLoad: number | undefined,
): readonly string[] {
  if (!occupancyLoad || occupancyLoad <= 0) return [];
  const required = occupancyLoad * EGRESS_MM_PER_PERSON;
  return params.width < required
    ? ['tools.stair.validator.egress.widthBelowOccupancy']
    : [];
}

// ─── Public dispatcher ───────────────────────────────────────────────────────

function dispatchProfile(input: GateStairCheckerInput): {
  readonly codeViolations: readonly string[];
  readonly adaViolations: readonly string[];
  readonly comfortViolations: readonly string[];
} {
  const { params, codeProfile } = input;
  switch (codeProfile) {
    case 'nok': {
      const subType = input.nokSubType ?? 'main';
      return {
        codeViolations: checkNOK(params, subType),
        adaViolations: [],
        comfortViolations: checkNOKComfort(params, subType),
      };
    }
    case 'ibc':
      return { codeViolations: checkIBC(params), adaViolations: [], comfortViolations: [] };
    case 'eurocode':
      return { codeViolations: checkEurocode(params), adaViolations: [], comfortViolations: [] };
    case 'ada':
      return { codeViolations: [], adaViolations: checkADA(params), comfortViolations: [] };
    case 'nbc':
    case 'nfpa':
    case 'as1657':
    case 'din':
    case 'none':
      return { codeViolations: [], adaViolations: [], comfortViolations: [] };
    default: {
      const _exhaustive: never = codeProfile;
      void _exhaustive;
      return { codeViolations: [], adaViolations: [], comfortViolations: [] };
    }
  }
}

/**
 * Entry point for the stair validator gate (ADR-358 Phase 6 + 6.5). Returns
 * hard errors (block creation), code violations, ADA violations, and egress
 * violations as i18n keys. Egress runs universally except when `codeProfile`
 * is 'none' or `occupancyLoad` is absent/0.
 */
export function gateStairChecker(input: GateStairCheckerInput): GateStairCheckerResult {
  const hardErrors = checkHardErrors(input.params);
  const { codeViolations, adaViolations, comfortViolations } = dispatchProfile(input);
  const egressViolations =
    input.codeProfile === 'none' ? [] : checkEgress(input.params, input.occupancyLoad);
  return { hardErrors, codeViolations, adaViolations, egressViolations, comfortViolations };
}
