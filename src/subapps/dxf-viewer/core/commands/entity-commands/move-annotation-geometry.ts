/**
 * ADR-736 — μετατόπιση για τους τύπους που το {@link ./move-entity-geometry} **δεν ήξερε**:
 * `dimension`, `leader`, `xline`, `ray`, `spline`.
 *
 * ── Γιατί υπάρχει αυτό το αρχείο ────────────────────────────────────────────────────────────
 * Το `calculateMovedGeometry` επέστρεφε `{}` γι' αυτούς τους πέντε — δηλαδή **σιωπηλό no-op**.
 * Όσο ο μόνος καταναλωτής ήταν το εργαλείο ΜΕΤΑΚΙΝΗΣΗ, το κόστος ήταν «δεν κουνιέται». Από τη
 * στιγμή όμως που η **εισαγωγή DXF** χρησιμοποιεί το ίδιο SSoT για να φέρει το σχέδιο στην αρχή
 * των αξόνων (`normalizeEntityPositions`), το ίδιο `{}` σημαίνει «η οντότητα μένει στις ωμές
 * γεωαναφερμένες συντεταγμένες ενώ όλες οι άλλες μετακινούνται» — δηλαδή **αόρατη**, εκατοντάδες
 * χιλιόμετρα μακριά από το σχέδιο. Ακριβώς αυτό συνέβη στο πραγματικό τοπογραφικό: 10 εικόνες
 * και 9 διαστάσεις ήταν στη σκηνή, περνούσαν από τον renderer, και δεν φαινόταν καμία.
 *
 * Είναι το **τρίτο** καταγεγραμμένο περιστατικό της ίδιας κλάσης στην ίδια οικογένεια περασμάτων:
 *   · ADR-635 Φ C.23 — `normalizeEntityPositions` χωρίς `case 'hatch'`·
 *   · ADR-716 Φ7 — η κλίμακα μετέφερε μόνο τους @deprecated καθρέφτες της διάστασης·
 *   · ADR-646 Φ2 — `xline`/`ray`/annotations ήταν σιωπηλά `default: {}` στην **κλίμακα**.
 * Αυτό το αρχείο είναι η μετατόπιση που κλείνει το ίδιο κενό, με το ΙΔΙΟ σύνολο τύπων.
 *
 * ── Ο κανόνας, σε μία γραμμή ────────────────────────────────────────────────────────────────
 * **Στη μετατόπιση κινούνται ΜΟΝΟ τα σημεία.** Μήκη (`hookLineLength`, `leaderLength`, μέγεθος
 * βέλους), γωνίες, και **μοναδιαία διανύσματα κατεύθυνσης** (`direction` του xline/ray) μένουν
 * αναλλοίωτα — ένα διάνυσμα δεν έχει θέση για να μετακινηθεί. Αυτή είναι και η μόνη διαφορά από
 * την αντίστοιχη λίστα της κλίμακας.
 *
 * @see ./move-entity-geometry.ts — ο καλών (BIM πρώτα, μετά εδώ, μετά τα primitives)
 * @see ../../../systems/scale/scale-dimension.ts — `mapDimensionPoints`, το κοινό SSoT σημείων
 * @see ../../../systems/scale/scale-entity-transform.ts — η αδελφή λίστα τύπων (κλίμακα)
 */

import type { SceneEntity } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import type { Point3D } from '../../../bim/types/bim-base';
import type { Entity } from '../../../types/entities';
// SSoT — canonical point translation (ADR-577 consolidation).
import { translatePoint } from '../../../rendering/entities/shared/geometry-vector-utils';
// ADR-736 — ΤΟ SSoT «ποια πεδία διάστασης είναι σημεία κόσμου» (κοινό με την κλίμακα).
import { mapDimensionPoints } from '../../../systems/scale/scale-dimension';

/** Οι πέντε τύποι που καλύπτει αυτό το module — διαβάζεται από το coverage test. */
export const ANNOTATION_MOVABLE_TYPES: ReadonlySet<string> = new Set([
  'dimension', 'leader', 'xline', 'ray', 'spline',
]);

/**
 * Μετατόπιση για τους τύπους του {@link ANNOTATION_MOVABLE_TYPES}, ή `null` όταν η οντότητα
 * δεν είναι κανένας από αυτούς (ο καλών συνεχίζει με τους δικούς του κλάδους).
 */
export function calculateAnnotationMovedGeometry(
  entity: SceneEntity,
  delta: Point3D,
): Partial<SceneEntity> | null {
  const e = entity as unknown as Entity;
  const at = (p: Point2D): Point2D => translatePoint(p, delta);

  switch (e.type) {
    case 'dimension':
      // Μηδέν πεδία μήκους/τιμής εδώ: μια μετατόπιση δεν αλλάζει ούτε τη μέτρηση ούτε το
      // `leaderLength` — γι' αυτό ο κοινός mapper δίνει ΟΛΟ το αποτέλεσμα.
      return mapDimensionPoints(e, at) as Partial<SceneEntity>;

    case 'leader':
      return moveLeader(e, at) as Partial<SceneEntity>;

    // Οι δύο κατασκευαστικές γραμμές μοιράζονται σχήμα: σημείο βάσης + μοναδιαίο διάνυσμα.
    // 🔴 Το `direction` ΔΕΝ μετατοπίζεται — είναι κατεύθυνση, όχι θέση. Μετατόπισή του θα
    // περιέστρεφε τη γραμμή κατά τυχαία γωνία (και θα κατέστρεφε το μοναδιαίο μήκος).
    case 'xline':
    case 'ray': {
      const c = e as unknown as { basePoint?: Point2D };
      return c.basePoint ? ({ basePoint: at(c.basePoint) } as Partial<SceneEntity>) : {};
    }

    case 'spline': {
      const s = e as unknown as { controlPoints?: readonly Point2D[]; fitPoints?: readonly Point2D[] };
      return {
        ...(s.controlPoints && { controlPoints: s.controlPoints.map(at) }),
        // Τα `fitPoints` είναι επίσης σημεία κόσμου· η κλίμακα τα αγνοεί, αλλά μια καμπύλη που
        // αφήνει πίσω τα σημεία προσαρμογής της είναι μισή καμπύλη.
        ...(s.fitPoints && { fitPoints: s.fitPoints.map(at) }),
      } as Partial<SceneEntity>;
    }

    default:
      return null;
  }
}

/**
 * Το leader κουβαλά **δύο** ανεξάρτητα σύνολα σημείων: τη διαδρομή του και —όταν έχει σχόλιο—
 * τη θέση του κειμένου. Το `hookLineLength` και το μέγεθος του βέλους είναι **μήκη**: μένουν.
 */
function moveLeader(e: Entity, at: (p: Point2D) => Point2D) {
  const l = e as unknown as { vertices?: readonly Point2D[]; annotationPosition?: Point2D };
  return {
    ...(l.vertices && { vertices: l.vertices.map(at) }),
    ...(l.annotationPosition && { annotationPosition: at(l.annotationPosition) }),
  };
}
