/**
 * BIM Opening — Frame Profile Catalog (SSoT data) — ADR-611 Foundation.
 *
 * Seed catalog of Greek-market aluminium κούφωμα frame + sash profiles. Values
 * are **plausible seed dimensions** (mm) for the frame `faceWidth × depth` cross
 * section — realistic for the named series but NOT authoritative manufacturer
 * spec sheets. They are safe defaults the user edits per opening; refine against
 * official profile catalogues when a project needs exact sightlines.
 *
 * Cross-section semantics (see `opening-frame-profile.ts`):
 *   - faceWidth = visible κάσα width across the FACE (elevation).
 *   - depth     = through-the-wall dimension, INDEPENDENT of wall.thickness.
 *
 * This is a DATA/config file: manufacturer / series / label values are literal
 * facts (brand + system codes + dims) — NOT translatable, no i18n required.
 * Mirrors the beam/column `section-catalog.ts` pattern (id-keyed lookup +
 * list helpers). New series → append a row; never hand-maintain a parallel list.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-611-opening-frame-profile.md
 * @see bim/columns/section-catalog.ts — sibling catalog pattern
 */

import type { OpeningFrameProfile } from '../types/opening-frame-profile';

/**
 * Seed frame-profile catalog. `faceWidth × depth` in mm.
 *
 * PROVENANCE: generic sizes + plausible per-series seed values; manufacturer
 * names and system codes are public brand identifiers. Numeric dimensions here
 * are seed defaults, not copied from a proprietary compilation.
 */
export const FRAME_PROFILE_CATALOG: readonly OpeningFrameProfile[] = [
  // ─── Generic (manufacturer-agnostic defaults) ──────────────────────────────
  { id: 'GENERIC-50x50-frame', manufacturer: 'Generic', series: '50×50', role: 'frame', faceWidth: 50, depth: 50, label: 'Generic 50×50' },
  { id: 'GENERIC-70x70-frame', manufacturer: 'Generic', series: '70×70', role: 'frame', faceWidth: 70, depth: 70, label: 'Generic 70×70' },
  // ADR-676 ΒΗΜΑ 2 — realistic swept cross-section demo: an L-shaped rebate (πατούρα)
  // on the interior corner where the φύλλο seats. `section` outline is mm, origin at
  // the member centerline (x = across FACE, y = through DEPTH). bbox == faceWidth×depth.
  {
    id: 'GENERIC-70x70-rebate-frame', manufacturer: 'Generic', series: '70×70 πατούρα', role: 'frame', faceWidth: 70, depth: 70,
    section: [
      { x: -35, y: -35 }, { x: 35, y: -35 }, { x: 35, y: 15 },
      { x: 15, y: 15 }, { x: 15, y: 35 }, { x: -35, y: 35 },
    ],
    label: 'Generic 70×70 με πατούρα',
  },

  // ─── Alumil ────────────────────────────────────────────────────────────────
  { id: 'ALUMIL-M9660-frame', manufacturer: 'Alumil', series: 'M9660',   role: 'frame', faceWidth: 72,  depth: 60,  label: 'Alumil M9660 κάσα' },
  { id: 'ALUMIL-M9660-sash',  manufacturer: 'Alumil', series: 'M9660',   role: 'sash',  faceWidth: 78,  depth: 60,  label: 'Alumil M9660 φύλλο' },
  { id: 'ALUMIL-S350-frame',  manufacturer: 'Alumil', series: 'Supreme S350', role: 'frame', faceWidth: 84, depth: 75, label: 'Alumil Supreme S350 κάσα' },

  // ─── Europa ────────────────────────────────────────────────────────────────
  { id: 'EUROPA-A5500-frame', manufacturer: 'Europa', series: 'A5500',   role: 'frame', faceWidth: 68,  depth: 55,  label: 'Europa A5500 κάσα' },
  { id: 'EUROPA-A5500-sash',  manufacturer: 'Europa', series: 'A5500',   role: 'sash',  faceWidth: 74,  depth: 55,  label: 'Europa A5500 φύλλο' },

  // ─── Elvial ────────────────────────────────────────────────────────────────
  { id: 'ELVIAL-4400-frame',  manufacturer: 'Elvial', series: '4400',    role: 'frame', faceWidth: 70,  depth: 62,  label: 'Elvial 4400 κάσα' },
  { id: 'ELVIAL-4400-sash',   manufacturer: 'Elvial', series: '4400',    role: 'sash',  faceWidth: 76,  depth: 62,  label: 'Elvial 4400 φύλλο' },

  // ─── Exalco ────────────────────────────────────────────────────────────────
  { id: 'EXALCO-ALBIO-165-frame', manufacturer: 'Exalco', series: 'Albio 165', role: 'frame', faceWidth: 65, depth: 58, label: 'Exalco Albio 165 κάσα' },
  { id: 'EXALCO-ALBIO-165-sash',  manufacturer: 'Exalco', series: 'Albio 165', role: 'sash',  faceWidth: 71, depth: 58, label: 'Exalco Albio 165 φύλλο' },
] as const;

/** Default frame profile ID (generic 70×70 aluminium). */
export const DEFAULT_FRAME_PROFILE_ID = 'GENERIC-70x70-frame';

/**
 * Look up a frame profile by catalog ID.
 * @returns the profile, or `undefined` when the ID is unknown / custom sentinel.
 */
export function getFrameProfileById(id: string): OpeningFrameProfile | undefined {
  return FRAME_PROFILE_CATALOG.find((p) => p.id === id);
}

/**
 * List frame profiles, optionally filtered by manufacturer.
 * @param manufacturer when provided, returns only that brand's profiles.
 */
export function listFrameProfiles(manufacturer?: string): OpeningFrameProfile[] {
  if (manufacturer === undefined) return [...FRAME_PROFILE_CATALOG];
  return FRAME_PROFILE_CATALOG.filter((p) => p.manufacturer === manufacturer);
}

/**
 * Distinct manufacturer brands present in the catalog, in first-seen order
 * (drives the manufacturer Radix Select in the ribbon UI).
 */
export function listFrameProfileManufacturers(): string[] {
  const seen: string[] = [];
  for (const p of FRAME_PROFILE_CATALOG) {
    if (!seen.includes(p.manufacturer)) seen.push(p.manufacturer);
  }
  return seen;
}
