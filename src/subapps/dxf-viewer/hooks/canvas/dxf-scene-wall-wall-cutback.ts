/**
 * ADR-458 (wall↔wall cross extension) — Wall-to-wall **cross-junction cutback** scene post-pass
 * (2Δ κάτοψη). Αδελφό του `dxf-scene-wall-cutback.ts` (wall↔column) — ίδιο pattern, ίδιο generic
 * SSoT (`member-column-cutback`), με **priority winner** αντί «η κολόνα πάντα νικάει».
 *
 * Για κάθε ζευγάρι τοίχων που **διασταυρώνονται γνήσια** (Χ, interior-interior — `wall-cross-cutback`),
 * ο υψηλότερης προτεραιότητας ΝΙΚΑΕΙ (μένει ακέραιος)· ο χαμηλότερος κόβεται στην κοινή περιοχή:
 * το DERIVED `geometry.displayFootprint` του loser γίνεται ο footprint ring μείον το footprint του
 * νικητή. Ο `WallRenderer` διαβάζει `displayFootprint ?? outer+inner ring` → ίδια γεωμετρία σε
 * bitmap ΚΑΙ interactive overlay (ένα entity, μία αλήθεια).
 *
 * Τρέχει **ΜΕΤΑ** το `applyWallColumnCutback2D`: αν ο loser έχει ήδη `displayFootprint` (κομμένος
 * από κολόνα), κόβουμε ΚΑΘΕ υπάρχον κομμάτι περαιτέρω με τους wall cutters (σύνθεση χωρίς
 * διπλότυπη boolean geometry). Zero-cost fast path: <2 τοίχοι ή καμία διασταύρωση → input αυτούσιο.
 *
 * @see bim/walls/wall-cross-cutback.ts — priority + cross detection (pure SSoT)
 * @see bim/geometry/member-column-cutback.ts — generic boolean-difference SSoT
 * @see hooks/canvas/dxf-scene-wall-cutback.ts — sibling (wall↔column)
 */

import type { DxfEntityUnion, DxfWall } from '../../canvas-v2/dxf-canvas/dxf-types';
// ADR-911 Φ3α-4 — οι κόπτες και το κόψιμο ζουν στο ΕΝΑ SSoT του ζωγραφισμένου σώματος (κοινό με
// την προεπισκόπηση πλήρωσης)· εδώ μένει μόνο η εφαρμογή τους πάνω στη σκηνή.
import { collectWallCrossCutters, cutWallBodyByCross } from '../../bim/walls/wall-painted-body';

/**
 * Εφαρμόζει το wall-to-wall cross cutback. Επιστρέφει το ίδιο array (by-reference) όταν καμία
 * διασταύρωση δεν κόβει τοίχο· αλλιώς νέο array με τους κομμένους (losers) ανανεωμένους.
 */
export function applyWallWallCrossCutback2D(entities: DxfEntityUnion[]): DxfEntityUnion[] {
  const walls = entities.filter((e): e is DxfWall => e.type === 'wall');
  if (walls.length < 2) return entities;

  const cutterMap = collectWallCrossCutters(walls);
  if (cutterMap.size === 0) return entities;

  return entities.map((e) => {
    if (e.type !== 'wall') return e;
    const cutters = cutterMap.get(e.id);
    if (!cutters || cutters.length === 0) return e;
    const wall = e as DxfWall;

    // Βάση = τα ήδη-κομμένα κομμάτια από το column pass, αλλιώς ο άκοπος δακτύλιος.
    // ADR-789 — το column pass αφήνει ήδη 2Δ δακτυλίους· μηδέν cast, μηδέν επαναπροβολή.
    const displayFootprint = cutWallBodyByCross(wall, wall.geometry.displayFootprint, cutters);
    if (displayFootprint === null) return e; // οι κόπτες δεν τεμαχίζουν → ό,τι έδωσε το column pass

    return { ...wall, geometry: { ...wall.geometry, displayFootprint } } as DxfEntityUnion;
  });
}
