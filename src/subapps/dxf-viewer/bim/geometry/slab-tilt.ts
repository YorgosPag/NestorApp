/**
 * Slab tilt SSoT (ADR-404 — κεκλιμένη πλάκα / drainage-slope, ADR-369 §9 Q7).
 *
 * Καθιερώνει την **κανονική ερμηνεία** του «κεκλιμένη πλάκα»: `geometryType === 'tilted'`
 * ΜΕ ορισμένο `slope` descriptor (single-plane, π.χ. 2% απορροή ή ράμπα). Το `slope`
 * είναι **required όταν** `geometryType==='tilted'` και **forbidden αλλιώς** (βλ.
 * `slab-types.ts`) — ο διπλός έλεγχος εδώ είναι αμυντικός (μια ημιτελής/legacy εγγραφή
 * με `geometryType:'tilted'` αλλά χωρίς `slope` δεν μετράει ως κεκλιμένη).
 *
 * N.0.2 boy-scout (2026-07-17): πρώην **inline διπλό** στο `wall-host-plan-builder.ts`
 * (`geometryType === 'tilted' && slope !== undefined`). Κεντρικοποιήθηκε εδώ ώστε ο
 * σοβάς (ADR-534 Φ5c: τα κεκλιμένα slabs εξαιρούνται από το flat merged union, mirror
 * columns/beams/walls) και ο host-plan builder να ρωτούν **ΕΝΑ** σημείο.
 *
 * @see wall-tilt.ts — αδελφό SSoT (battered wall)
 * @see column-tilt.ts — αδελφό SSoT (raking column)
 * @see docs/centralized-systems/reference/adrs/ADR-404-3d-bim-element-tilt.md
 */

import type { SlabParams } from '../types/slab-types';

/** `true` όταν η πλάκα είναι **κεκλιμένη** (`geometryType:'tilted'` με ορισμένο `slope`). */
export function isSlabTilted(params: Pick<SlabParams, 'geometryType' | 'slope'>): boolean {
  return params.geometryType === 'tilted' && params.slope !== undefined;
}
