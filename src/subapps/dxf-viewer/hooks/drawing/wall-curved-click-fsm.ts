/**
 * ADR-565 §12 / Φ1.x — Curved-wall click FSM transition (pure, per arc draw-variant).
 *
 * Ο καμπύλος τοίχος έχει 4 draw-variants (Revit Draw gallery) με ΔΙΑΦΟΡΕΤΙΚΗ ροή κλικ. Αυτή η
 * καθαρή συνάρτηση επιστρέφει την επόμενη μετάβαση για ΕΝΑ κλικ, ώστε το `useWallTool.onCanvasClick`
 * να μείνει μικρό (N.7.1) και η ροή testable χωρίς React:
 *   - '3-point' / 'start-end-radius': αρχή → τέλος → σημείο-στο-τόξο (3 κλικ).
 *   - 'center-ends':                  κέντρο → αρχή(ακτίνα) → τέλος(γωνία) (3 κλικ, διαφορετική σειρά).
 *   - 'tangent':                      αρχή → τέλος (2 κλικ· η εφαπτομένη προκύπτει αυτόματα).
 *
 * `'commit'` → ο caller καλεί `commitCurvedFromState(s, point)` (το `point` είναι το τελικό σημείο).
 * `'advance'` → ο caller κάνει `setState(next)`. `'none'` → το κλικ δεν προχώρησε το FSM.
 *
 * @see ../../bim/walls/wall-curved-draw.ts — η arc geometry του commit (ίδια resolver)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallToolState } from './wall-tool-types';

export type CurvedClickResult =
  | { readonly kind: 'advance'; readonly next: WallToolState }
  | { readonly kind: 'commit' }
  | { readonly kind: 'none' };

export function resolveCurvedClickTransition(
  s: WallToolState,
  point: Readonly<Point2D>,
): CurvedClickResult {
  const p: Point2D = { x: point.x, y: point.y };

  if (s.arcVariant === 'center-ends') {
    if (s.phase === 'awaitingStart') {
      return { kind: 'advance', next: { ...s, phase: 'awaitingEnd', arcCenter: p, startPoint: null, endPoint: null, error: null } };
    }
    if (s.phase === 'awaitingEnd') {
      // 2ο κλικ = αρχή πάνω στον κύκλο (ορίζει ακτίνα |center−start|).
      return { kind: 'advance', next: { ...s, phase: 'awaitingArcRadiusPoint', startPoint: p, error: null } };
    }
    if (s.phase === 'awaitingArcRadiusPoint') return { kind: 'commit' };
    return { kind: 'none' };
  }

  if (s.arcVariant === 'tangent') {
    if (s.phase === 'awaitingStart') {
      return { kind: 'advance', next: { ...s, phase: 'awaitingEnd', startPoint: p, endPoint: null, error: null } };
    }
    if (s.phase === 'awaitingEnd') return { kind: 'commit' }; // 2-click: το κλικ = τέλος
    return { kind: 'none' };
  }

  // '3-point' + 'start-end-radius' — ΙΔΙΑ 3-click ροή (αρχή → τέλος → σημείο-στο-τόξο).
  if (s.phase === 'awaitingStart') {
    return { kind: 'advance', next: { ...s, phase: 'awaitingEnd', startPoint: p, endPoint: null, error: null } };
  }
  if (s.phase === 'awaitingEnd') {
    return { kind: 'advance', next: { ...s, phase: 'awaitingCurveControl', endPoint: p, error: null } };
  }
  if (s.phase === 'awaitingCurveControl') return { kind: 'commit' };
  return { kind: 'none' };
}
