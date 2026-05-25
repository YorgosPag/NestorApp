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
  'door':         '#c97c2f', // burnt orange (timber door)
  'window':       '#2d72b8', // cool blue (glazed)
  'sliding-door': '#7c5fa1', // muted purple (sliding rail)
  'french-door':  '#b96b2c', // amber (double-leaf timber)
  'fixed':        '#3d7a6f', // teal (fixed glazing)
};
