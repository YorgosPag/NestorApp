/**
 * Opening kind → stroke colour SSoT (ADR-376 §4.4).
 *
 * Extracted από `OpeningRenderer` (private const, formerly line 41) σε shared
 * module so that the `OpeningTagRenderer` (tag pills, ADR-376) reuses the
 * identical palette without re-declaring it (Boy Scout — N.0.2).
 *
 * Industry convention:
 *   - door / french-door → warm tones (timber)
 *   - sliding-door       → muted purple (rail)
 *   - window / fixed     → cool tones (glass)
 *
 * Consumers:
 *   - `OpeningRenderer`     — outline + overlay stroke
 *   - `OpeningTagRenderer`  — pill colour per opening kind
 */

import type { OpeningKind } from '../types/opening-types';

export const OPENING_KIND_STROKE: Readonly<Record<OpeningKind, string>> = {
  // ─── Doors — warm timber + purple rail tones ──────────────────────────────
  'door':                '#c97c2f', // burnt orange (timber door)
  'double-door':         '#a85b2a', // deep amber (double-leaf timber)
  'sliding-door':        '#7c5fa1', // muted purple (sliding rail)
  'double-sliding-door': '#6a4f96', // deep purple (double sliding rail)
  'pocket-door':         '#8a6fb0', // light purple (pocket rail)
  'bifold-door':         '#b07c3a', // tan (folding leaves)
  'overhead-door':       '#8a6d4a', // sienna-grey (sectional garage)
  'revolving-door':      '#9a5a7a', // mauve (revolving drum)
  'french-door':         '#b96b2c', // amber (double-leaf glazed timber)
  // ─── Windows — cool glass tones ───────────────────────────────────────────
  'window':              '#2d72b8', // cool blue (glazed)
  'fixed':               '#3d7a6f', // teal (fixed glazing)
  'double-hung-window':  '#2f8fb0', // cyan-blue (vertical sash)
  'sliding-window':      '#3a8fbf', // blue (horizontal sash)
  'awning-window':       '#2f9aa0', // teal-cyan (top hinge)
  'hopper-window':       '#3aa0a8', // teal (bottom hinge)
  'tilt-turn-window':    '#2f7fa8', // steel blue (dual mode)
  'bay-window':          '#2f7f9f', // steel blue (projecting)
};
