/**
 * ADR-407 Φ9 — Railing param read/patch SSoT (pure, deep-immutable).
 *
 * The ONE place that maps a `commandKey` → the current railing param value
 * (`readRailingField`) and applies a combobox change back into a fresh
 * `RailingParams` (`patchRailingField`). Shared by the ribbon bridge AND the
 * Properties-palette dispatcher, so read/write can never drift (the ADR-449
 * bug class the stair keys file warns about).
 *
 * `patchRailingField` returns a NEW params object; the caller feeds it to
 * `UpdateRailingParamsCommand`, which atomically recomputes geometry +
 * validation. No mutation, no geometry call here.
 *
 * @see ./railing-param-keys.ts
 */

import type {
  RailingParams,
  RailProfile,
  BalusterPlacement,
  ContinuousRail,
} from '../types/railing-types';
import {
  RAILING_STRING_KEYS,
  RAILING_NUMBER_KEYS,
  isRailingRibbonKey,
} from './railing-param-keys';

const K = { ...RAILING_STRING_KEYS, ...RAILING_NUMBER_KEYS };

/** boolean → on/off combobox value. */
function boolToValue(on: boolean): string {
  return on ? 'on' : 'off';
}

// ─── READ: commandKey → current value string (`null` = unknown key) ─────────────

export function readRailingField(key: string, p: RailingParams): string | null {
  const pattern = p.type.balusterPlacement.pattern;
  const posts = p.type.balusterPlacement.posts;
  switch (key) {
    case K.totalHeight: return String(p.totalHeightMm);
    case K.baseElevation: return String(p.baseElevationMm);
    case K.predefinedType: return p.type.predefinedType;
    case K.balusterShape: return pattern.profile.shape;
    case K.balusterWidth: return String(pattern.profile.widthMm);
    case K.balusterSpacing: return String(pattern.spacingMm);
    case K.balusterJustification: return pattern.justification;
    case K.postsEnabled: return boolToValue(posts.enabled);
    case K.postsWidth: return String(posts.profile.widthMm);
    case K.postsAtStart: return boolToValue(posts.atStart);
    case K.postsAtCorners: return boolToValue(posts.atCorners);
    case K.postsAtEnd: return boolToValue(posts.atEnd);
    case K.topRailEnabled: return boolToValue(p.type.topRail.enabled);
    case K.topRailWidth: return String(p.type.topRail.profile.widthMm);
    case K.topRailHeight: return String(p.type.topRail.heightMm);
    case K.handrailEnabled: return boolToValue(p.type.handrail.enabled);
    case K.handrailHeight: return String(p.type.handrail.heightMm);
    case K.infillKind: return p.type.infill.kind;
    default: return null;
  }
}

// ─── Immutable sub-object helpers (each < 40 lines, single responsibility) ──────

/** Round profiles keep height synced to the diameter (width). */
function withProfileWidth(profile: RailProfile, widthMm: number): RailProfile {
  return { ...profile, widthMm, heightMm: profile.shape === 'round' ? widthMm : profile.heightMm };
}

function withProfileShape(profile: RailProfile, shape: RailProfile['shape']): RailProfile {
  return { ...profile, shape, heightMm: shape === 'round' ? profile.widthMm : profile.heightMm };
}

function withPattern(p: RailingParams, patch: Partial<BalusterPlacement['pattern']>): RailingParams {
  const bp = p.type.balusterPlacement;
  return { ...p, type: { ...p.type, balusterPlacement: { ...bp, pattern: { ...bp.pattern, ...patch } } } };
}

function withPosts(p: RailingParams, patch: Partial<BalusterPlacement['posts']>): RailingParams {
  const bp = p.type.balusterPlacement;
  return { ...p, type: { ...p.type, balusterPlacement: { ...bp, posts: { ...bp.posts, ...patch } } } };
}

function withTopRail(p: RailingParams, patch: Partial<ContinuousRail>): RailingParams {
  return { ...p, type: { ...p.type, topRail: { ...p.type.topRail, ...patch } } };
}

function withHandrail(p: RailingParams, patch: Partial<ContinuousRail>): RailingParams {
  return { ...p, type: { ...p.type, handrail: { ...p.type.handrail, ...patch } } };
}

// ─── WRITE: commandKey + combobox value → fresh RailingParams ────────────────────

/** String/enum/boolean field writes. */
function patchStringField(key: string, p: RailingParams, value: string): RailingParams {
  const on = value === 'on';
  switch (key) {
    case K.predefinedType:
      return { ...p, type: { ...p.type, predefinedType: value as RailingParams['type']['predefinedType'] } };
    case K.balusterShape:
      return withPattern(p, { profile: withProfileShape(p.type.balusterPlacement.pattern.profile, value as RailProfile['shape']) });
    case K.balusterJustification:
      return withPattern(p, { justification: value as BalusterPlacement['pattern']['justification'] });
    case K.postsEnabled: return withPosts(p, { enabled: on });
    case K.postsAtStart: return withPosts(p, { atStart: on });
    case K.postsAtCorners: return withPosts(p, { atCorners: on });
    case K.postsAtEnd: return withPosts(p, { atEnd: on });
    case K.topRailEnabled: return withTopRail(p, { enabled: on });
    case K.handrailEnabled: return withHandrail(p, { enabled: on });
    case K.infillKind:
      return { ...p, type: { ...p.type, infill: { ...p.type.infill, kind: value as RailingParams['type']['infill']['kind'] } } };
    default: return p;
  }
}

/** Numeric (mm) field writes. Non-finite input is ignored (returns prev). */
function patchNumberField(key: string, p: RailingParams, mm: number): RailingParams {
  if (!Number.isFinite(mm)) return p;
  const pattern = p.type.balusterPlacement.pattern;
  switch (key) {
    case K.totalHeight: return { ...p, totalHeightMm: mm };
    case K.baseElevation: return { ...p, baseElevationMm: mm };
    case K.balusterWidth: return withPattern(p, { profile: withProfileWidth(pattern.profile, mm) });
    case K.balusterSpacing: return withPattern(p, { spacingMm: mm });
    case K.postsWidth: return withPosts(p, { profile: withProfileWidth(p.type.balusterPlacement.posts.profile, mm) });
    case K.topRailWidth: return withTopRail(p, { profile: withProfileWidth(p.type.topRail.profile, mm) });
    case K.topRailHeight: return withTopRail(p, { heightMm: mm });
    case K.handrailHeight: return withHandrail(p, { heightMm: mm });
    default: return p;
  }
}

/**
 * Apply a single combobox change to the railing params. Returns a fresh params
 * object (or the same reference for an unknown key / non-finite numeric input).
 */
export function patchRailingField(key: string, p: RailingParams, value: string): RailingParams {
  if (isRailingRibbonKey(key)) return patchNumberField(key, p, Number.parseFloat(value));
  return patchStringField(key, p, value);
}
