/**
 * ADR-477 Slice 2 — Συνδετήρια δοκός → **γραμμικό μέλος** adapter (pure SSoT).
 *
 * Γεφυρώνει την `TieBeamParams` (foundation discipline) με το beam rebar pipeline
 * (`resolveBeamRebarLayout` → EC8 κρίσιμες ζώνες συνδετήρων + layered διαμήκεις).
 * Δύο καθαρές συναρτήσεις που χρησιμοποιούν οι footing renderers (2Δ/3Δ) + το PDF:
 *
 *   - {@link tieBeamRebarLayout} — `(params, footing-resolved reinforcement)` → η
 *     διάταξη οπλισμού σε beam-local mm. **REUSE** `buildFootingSectionContextFromParams`
 *     (το tie-beam ctx ΕΙΝΑΙ `BeamSectionContext`) + `resolveBeamRebarLayout` (μηδέν
 *     duplicate). Ο caller δίνει τον ΗΔΗ-resolved οπλισμό (μεγαλύτερο footing cover,
 *     EC2 §4.4.1) — ΠΟΤΕ ξανα-resolve μέσω beam suggester (cover divergence).
 *   - {@link tieBeamAxisPoints} — ο **justified** άξονας (canvas units) γύρω από τον
 *     οποίο σχεδιάζεται το σώμα (ίδιο SSoT `stripJustifiedAxis` με το footprint),
 *     ώστε ο οπλισμός (centered στο centroid διατομής) να κάθεται μέσα στο στερεό.
 *
 * Pure — zero store/Firestore/DOM (testable). geometry-is-SSoT.
 *
 * @see ../section-context.ts — buildFootingSectionContextFromParams (Slice 1)
 * @see ./beam-rebar-layout.ts — resolveBeamRebarLayout (EC8 ζώνες, ADR-471)
 * @see docs/centralized-systems/reference/adrs/ADR-477-tie-beam-reinforcement-unification.md §Slice 2
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { TieBeamParams } from '../../types/foundation-types';
import { stripJustifiedAxis } from '../../geometry/foundation-geometry';
import { buildFootingSectionContextFromParams } from '../section-context';
import { resolveBeamRebarLayout, type BeamRebarLayout } from './beam-rebar-layout';
import type { TieBeamReinforcement } from './footing-reinforcement-types';

/**
 * Διάταξη οπλισμού συνδετήριας δοκού σε beam-local mm, ή `null` σε εκφυλισμένη
 * διατομή/άνοιγμα. Ο `r` ΠΡΕΠΕΙ να είναι ο footing-resolved οπλισμός (Slice 1
 * `resolveActiveFootingReinforcementForParams`) — εδώ απλώς δρομολογείται στο SSoT.
 */
export function tieBeamRebarLayout(
  p: TieBeamParams,
  r: TieBeamReinforcement,
): BeamRebarLayout | null {
  const ctx = buildFootingSectionContextFromParams(p);
  // p.kind === 'tie-beam' ⇒ ctx.kind === 'tie-beam' (TieBeamSectionContext ⊂ BeamSectionContext).
  if (ctx.kind !== 'tie-beam') return null; // μη-προσβάσιμο — defensive narrow (μηδέν cast).
  return resolveBeamRebarLayout(ctx, r);
}

/**
 * Ο justified άξονας της συνδετήριας (canvas units) ως 2 σημεία `[start, end]` — το
 * ίδιο SSoT shift με το footprint, ώστε ο centered οπλισμός να ευθυγραμμίζεται με το
 * σώμα ακόμη και σε έκκεντρη Location Line. `center` justification → ωμός άξονας.
 */
export function tieBeamAxisPoints(p: TieBeamParams): Point2D[] {
  const { start, end } = stripJustifiedAxis(p);
  return [start, end];
}
