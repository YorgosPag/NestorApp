/**
 * ADR-581 — Semantic Role Ontology (SSoT).
 *
 * Ο σημασιολογικός ρόλος είναι το cross-type join key: δύο descriptors διαφορετικών
 * τύπων που μοιράζονται ρόλο θεωρούνται «η ίδια ιδιότητα» (π.χ. `geometry.width`
 * κολόνας ↔ δοκού). Το family (πρόθεμα πριν την πρώτη τελεία) χρησιμεύει ως fallback
 * όταν δεν υπάρχει exact-role αντιστοίχιση.
 *
 * Καθαρά data — zero deps πλην των τύπων.
 */

import type { SemanticRole } from './match-types';

/** Cast ενός literal σε `SemanticRole` (branding helper — μόνο εδώ). */
export function asRole(value: string): SemanticRole {
  return value as SemanticRole;
}

/** Family = πρόθεμα πριν την πρώτη τελεία (π.χ. `geometry.width` → `geometry`). */
export function roleFamily(role: SemanticRole): string {
  const dot = role.indexOf('.');
  return dot === -1 ? role : role.slice(0, dot);
}

// ─── Style roles (καθολικά — ισχύουν και για raw DXF και για BIM) ──────────────
export const ROLE_STYLE_COLOR = asRole('style.color');
export const ROLE_STYLE_LINETYPE = asRole('style.linetype');
export const ROLE_STYLE_LINEWEIGHT = asRole('style.lineweight');
export const ROLE_STYLE_TRANSPARENCY = asRole('style.transparency');
export const ROLE_STYLE_LINE_STYLE = asRole('style.lineStyle');
export const ROLE_STYLE_LTSCALE = asRole('style.ltscale');
export const ROLE_STYLE_LINE_CAP = asRole('style.lineCap');
export const ROLE_STYLE_LINE_JOIN = asRole('style.lineJoin');

// ─── Style roles ειδικά ανά τύπο (text / hatch) ───────────────────────────────
export const ROLE_TEXT_WIDTH_FACTOR = asRole('style.text.widthFactor');
export const ROLE_TEXT_FONT_FAMILY = asRole('style.text.fontFamily');
export const ROLE_TEXT_FONT_SIZE = asRole('style.text.fontSize');
export const ROLE_HATCH_PATTERN = asRole('style.hatch.pattern');
export const ROLE_HATCH_SCALE = asRole('style.hatch.scale');
export const ROLE_HATCH_ANGLE = asRole('style.hatch.angle');

// ─── Geometry roles (BIM params — 1:1 με COMMON_PROPERTIES_BY_KIND) ────────────
export const ROLE_GEOM_HEIGHT = asRole('geometry.height');
export const ROLE_GEOM_WIDTH = asRole('geometry.width');
export const ROLE_GEOM_DEPTH = asRole('geometry.depth');
export const ROLE_GEOM_THICKNESS = asRole('geometry.thickness');
export const ROLE_GEOM_ELEVATION = asRole('geometry.elevation');
export const ROLE_GEOM_SILL_HEIGHT = asRole('geometry.sillHeight');

// ─── Material role ─────────────────────────────────────────────────────────────
export const ROLE_MATERIAL_PRIMARY = asRole('material.primary');

// ─── Identity roles ────────────────────────────────────────────────────────────
export const ROLE_IDENTITY_LAYER = asRole('identity.layer');
export const ROLE_IDENTITY_DISCIPLINE = asRole('identity.discipline');

/** Χάρτης geometry key (COMMON_PROPERTIES) → semantic role. */
export const GEOMETRY_KEY_ROLE: Readonly<Record<string, SemanticRole>> = {
  height: ROLE_GEOM_HEIGHT,
  width: ROLE_GEOM_WIDTH,
  depth: ROLE_GEOM_DEPTH,
  thickness: ROLE_GEOM_THICKNESS,
  elevation: ROLE_GEOM_ELEVATION,
  sillHeight: ROLE_GEOM_SILL_HEIGHT,
};
