/**
 * ADR-422 L1 — Αντιστοίχιση ορίου θερμικού χώρου → τοίχους (PURE geometry).
 *
 * Το footprint ενός θερμικού χώρου (κλειστό πολύγωνο, scene units) παράγεται από
 * τις όψεις των τοίχων (`perimeter-from-faces`, ADR-419), άρα κάθε ακμή του
 * «τρέχει» κατά μήκος της εσωτερικής όψης ενός τοίχου. Αυτό το module βρίσκει,
 * για κάθε ακμή, τον τοίχο που την οριοθετεί και αθροίζει το μήκος ανά τοίχο —
 * το `length × height` δίνει την επιφάνεια του τοίχου που ανήκει στον χώρο
 * (κρίσιμο για κοινούς τοίχους: κάθε δωμάτιο παίρνει το δικό του τμήμα).
 *
 * Μηδέν entity knowledge: ο caller (`space-boundary-resolver`) δίνει τις όψεις
 * (`WallFaceSegments`) από `wall.geometry.innerEdge`/`outerEdge`. Επιστρέφει
 * μήκη σε **scene units** (ο caller μετατρέπει σε m με `sceneUnitsToMeters`).
 *
 * @see ./space-boundary-resolver (consumer)
 * @see ../../walls/perimeter-from-faces (η πηγή του footprint)
 */

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** Όλα τα ευθύγραμμα τμήματα όψης ενός τοίχου (inner + outer edge segments). */
export interface WallFaceSegments {
  readonly wallId: string;
  /** Ζεύγη άκρων τμημάτων όψης (scene units). */
  readonly segments: readonly (readonly [Vec2, Vec2])[];
}

/** Απόσταση σημείου από ευθ. τμήμα (clamped) — scene units. */
function pointToSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Ελάχιστη απόσταση σημείου από οποιοδήποτε τμήμα ενός τοίχου. */
function minDistanceToWall(p: Vec2, wall: WallFaceSegments): number {
  let min = Infinity;
  for (const [a, b] of wall.segments) {
    const d = pointToSegmentDistance(p, a, b);
    if (d < min) min = d;
  }
  return min;
}

/**
 * Αντιστοιχεί κάθε ακμή του footprint στον πλησιέστερο τοίχο (εντός `tol`) και
 * αθροίζει το μήκος της ακμής σε αυτόν. Επιστρέφει `Map<wallId, μήκος σε scene
 * units>`. Ακμές χωρίς τοίχο εντός ανοχής αγνοούνται (π.χ. νοητά όρια).
 */
export function matchWallsToFootprint(
  footprint: readonly Vec2[],
  walls: readonly WallFaceSegments[],
  tol: number,
): Map<string, number> {
  const result = new Map<string, number>();
  const n = footprint.length;
  if (n < 3 || walls.length === 0) return result;

  for (let i = 0; i < n; i++) {
    const a = footprint[i];
    const b = footprint[(i + 1) % n];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const edgeLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (edgeLen <= 1e-9) continue;

    let bestWall: string | null = null;
    let bestDist = tol;
    for (const wall of walls) {
      const d = minDistanceToWall(mid, wall);
      if (d < bestDist) {
        bestDist = d;
        bestWall = wall.wallId;
      }
    }
    if (bestWall !== null) {
      result.set(bestWall, (result.get(bestWall) ?? 0) + edgeLen);
    }
  }
  return result;
}

/** Ελάχιστη απόσταση σημείου από το όριο (ακμές) ενός κλειστού πολυγώνου. */
export function pointToPolygonEdgeDistance(p: Vec2, polygon: readonly Vec2[]): number {
  const n = polygon.length;
  if (n < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < n; i++) {
    const d = pointToSegmentDistance(p, polygon[i], polygon[(i + 1) % n]);
    if (d < min) min = d;
  }
  return min;
}
