/**
 * @related ADR-358 §5.9 §3.5 §9.2 Q25 — Stair code-profile validator (Phase 6).
 *
 * Pure functions. Zero React / DOM / Firestore deps. Runs the 4 active code
 * profiles (NOK / IBC / Eurocode / ADA) plus a universal hard-error baseline.
 *
 * Hard errors → block stair creation.
 * Code violations → non-blocking warnings (red badge in property panel).
 *
 * NBC / NFPA / AS1657 / DIN profiles are placeholders Phase 9 (Q25).
 * Headroom + egress validators live in `stair-validator.ts` (cheap 2D Phase 6
 * and Phase 6.5 respectively); ADA handrail render lives in StairRenderer
 * Phase 6.5 (Q26).
 */

import type {
  StairCodeProfile,
  StairNokSubType,
  StairParams,
} from '@/subapps/dxf-viewer/types/stair';

// ─── Public input / output shapes ────────────────────────────────────────────

export interface GateStairCheckerInput {
  readonly params: Readonly<StairParams>;
  readonly codeProfile: StairCodeProfile;
  readonly nokSubType?: StairNokSubType;
}

export interface GateStairCheckerResult {
  /** Universal hard errors — block creation regardless of profile. */
  readonly hardErrors: readonly string[];
  /** Code-profile violations — non-blocking warnings (i18n keys). */
  readonly codeViolations: readonly string[];
  /** ADA-specific violations split out for UI grouping. */
  readonly adaViolations: readonly string[];
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

// ─── NOK (Ν.4067/2012, §3.5) ─────────────────────────────────────────────────

function checkNOK(
  params: Readonly<StairParams>,
  subType: StairNokSubType,
): readonly string[] {
  const isMain = subType === 'main';
  const widthMin = isMain ? 1200 : 900;
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

// ─── Public dispatcher ───────────────────────────────────────────────────────

function dispatchProfile(input: GateStairCheckerInput): {
  readonly codeViolations: readonly string[];
  readonly adaViolations: readonly string[];
} {
  const { params, codeProfile } = input;
  switch (codeProfile) {
    case 'nok':
      return { codeViolations: checkNOK(params, input.nokSubType ?? 'main'), adaViolations: [] };
    case 'ibc':
      return { codeViolations: checkIBC(params), adaViolations: [] };
    case 'eurocode':
      return { codeViolations: checkEurocode(params), adaViolations: [] };
    case 'ada':
      return { codeViolations: [], adaViolations: checkADA(params) };
    case 'nbc':
    case 'nfpa':
    case 'as1657':
    case 'din':
    case 'none':
      return { codeViolations: [], adaViolations: [] };
    default: {
      const _exhaustive: never = codeProfile;
      void _exhaustive;
      return { codeViolations: [], adaViolations: [] };
    }
  }
}

/**
 * Entry point for the stair validator gate (ADR-358 Phase 6). Returns hard
 * errors (block creation), code violations and ADA violations as i18n keys.
 */
export function gateStairChecker(input: GateStairCheckerInput): GateStairCheckerResult {
  const hardErrors = checkHardErrors(input.params);
  const { codeViolations, adaViolations } = dispatchProfile(input);
  return { hardErrors, codeViolations, adaViolations };
}
