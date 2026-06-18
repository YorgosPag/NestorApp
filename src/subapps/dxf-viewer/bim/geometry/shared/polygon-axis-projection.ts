/**
 * Polygon ↔ axis projection helpers (pure SSoT, N.0.2 / N.12).
 *
 * Extracted from `polygon-utils.ts` (N.7.1 500-line cap). Re-exported από εκεί
 * ώστε όλοι οι υπάρχοντες importers να δουλεύουν αμετάβλητοι.
 *
 * Point-level (`projectPointOnAxis`) + polygon-level (`projectPolygonOnAxis`)
 * προβολή σε άξονα. Καταναλώνεται από column-face-trim (`projectColumnCenterOnAxis`
 * / `projectColumnFootprintOnAxis`) και beam-column cutback framing (ADR-493).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5
 */

/** Διαμήκης (`along`) + κάθετη απόλυτη (`perp`) προβολή σημείου σε άξονα — pure SSoT. */
export interface AxisProjection {
  readonly along: number;
  readonly perp: number;
}

/**
 * Προβολή σημείου `(px,py)` πάνω σε άξονα με αρχή `(ax,ay)` και ΜΟΝΑΔΙΑΙΑ διεύθυνση
 * `(ux,uy)`: `along` = `(p−a)·u` (signed διαμήκης θέση)· `perp` = `|(p−a)×u|` (κάθετη
 * απόσταση από την ευθεία). Pure SSoT (N.0.2) — το `projectColumnCenterOnAxis`
 * (column-face-trim) είναι ο entity wrapper γύρω από αυτό· το χρησιμοποιεί επίσης το
 * beam-column cutback framing (ADR-493). Ο caller δίνει το μοναδιαίο `(ux,uy)`.
 */
export function projectPointOnAxis(
  px: number,
  py: number,
  ax: number,
  ay: number,
  ux: number,
  uy: number,
): AxisProjection {
  const rx = px - ax;
  const ry = py - ay;
  return { along: rx * ux + ry * uy, perp: Math.abs(rx * uy - ry * ux) };
}

/** Διαμήκης + **προσημασμένη** κάθετη έκταση ενός πολυγώνου σε άξονα (pure SSoT). */
export interface PolygonAxisProjection {
  /** Ελάχιστη/μέγιστη διαμήκης προβολή κορυφής `(v−a)·u` (scene units). */
  readonly alongMin: number;
  readonly alongMax: number;
  /** Ελάχιστη/μέγιστη **προσημασμένη** κάθετη απόσταση `(v−a)×u`. Πρόσημα εκατέρωθεν
   *  (`perpMin < 0 < perpMax`) ⇒ το πολύγωνο **τέμνει** την ευθεία του άξονα. */
  readonly perpMin: number;
  readonly perpMax: number;
}

/**
 * Προβολή ΟΛΩΝ των κορυφών ενός πολυγώνου πάνω σε άξονα με αρχή `(ax,ay)` + ΜΟΝΑΔΙΑΙΑ
 * διεύθυνση `(ux,uy)`: επιστρέφει τη διαμήκη έκταση `[alongMin, alongMax]` (= οι παρειές
 * κατά μήκος) και την **προσημασμένη** κάθετη έκταση `[perpMin, perpMax]`. Pure SSoT (N.0.2)
 * για κάθε «πολύγωνο εναντίον άξονα» ερώτημα — entity wrappers (`projectColumnFootprintOnAxis`),
 * beam-column cutback (`outlineHalfWidth` = max|perp|, framing near-face = alongMin) και
 * framing detection (straddle = `perpMin<0<perpMax`) χτίζονται ΕΠΑΝΩ του, μηδέν per-call
 * vertex loop. Reuse `projectPointOnAxis` (point-level) για το `along`. Άδειο polygon → όλα 0.
 */
export function projectPolygonOnAxis(
  vertices: readonly { readonly x: number; readonly y: number }[],
  ax: number,
  ay: number,
  ux: number,
  uy: number,
): PolygonAxisProjection {
  if (vertices.length === 0) return { alongMin: 0, alongMax: 0, perpMin: 0, perpMax: 0 };
  let alongMin = Infinity;
  let alongMax = -Infinity;
  let perpMin = Infinity;
  let perpMax = -Infinity;
  for (const v of vertices) {
    const along = projectPointOnAxis(v.x, v.y, ax, ay, ux, uy).along;
    const signedPerp = (v.x - ax) * uy - (v.y - ay) * ux;
    if (along < alongMin) alongMin = along;
    if (along > alongMax) alongMax = along;
    if (signedPerp < perpMin) perpMin = signedPerp;
    if (signedPerp > perpMax) perpMax = signedPerp;
  }
  return { alongMin, alongMax, perpMin, perpMax };
}
