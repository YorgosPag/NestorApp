/**
 * ADR-713 — «σε ποιο σημείο κάτοψης ρωτάω το έδαφος για αυτό το στοιχείο;» (SSoT).
 *
 * Δύο ανεξάρτητοι καταναλωτές χρειάζονται την ΙΔΙΑ απάντηση:
 *   · `bim-3d/scene/column-exposure-grade` — ο χάρτης στάθμης του **render**,
 *   · `hooks/data/column-grade-boq-source` — ο χάρτης στάθμης της **επιμέτρησης**.
 *
 * Αν έδιναν διαφορετικό σημείο δειγματοληψίας, σε επικλινές οικόπεδο η όψη θα κοβόταν σε
 * άλλο ύψος από αυτό που τιμολογείται. Ένα σημείο, μία απάντηση.
 *
 * Δύο βήματα, το καθένα delegate σε υπάρχον SSoT — μηδέν νέα μαθηματικά:
 *   1. **κέντρο** — `polygon2DCentroid` (vertex-mean). Το area-centroid δεν χρειάζεται: το
 *      ζητούμενο είναι «κάπου κάτω από το στοιχείο», όχι κέντρο μάζας, και για κοίλα
 *      αποτυπώματα (Γ/Τ) και τα δύο πέφτουν μέσα στο ίδιο τρίγωνο του τοπογραφικού.
 *   2. **μονάδες** — canvas units → canonical mm μέσω `mmToSceneUnits` (ADR-462): ο TIN
 *      sampler δουλεύει σε canonical mm, τα footprints σε canvas units.
 *
 * @see ./shared/polygon-utils — polygon2DCentroid
 * @see ../../systems/topography/grade-at-plan-point — ο τελικός καταναλωτής
 */

import type { Point2D } from '../../rendering/types/Types';
import { polygon2DCentroid } from './shared/polygon-utils';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

/**
 * Το σημείο δειγματοληψίας εδάφους ενός footprint, σε **canonical mm**.
 * `null` για εκφυλισμένο footprint ή μη-πεπερασμένη κλίμακα (αμυντικό — ο caller παραλείπει
 * το tier τοπογραφικού αντί να ρωτήσει σε λάθος σημείο).
 */
export function footprintGradeSamplePointMm(
  vertices: readonly Point2D[],
  sceneUnits: SceneUnits | undefined,
): Point2D | null {
  if (vertices.length < 3) return null;
  const perMm = mmToSceneUnits(sceneUnits ?? 'mm');
  if (!Number.isFinite(perMm) || perMm === 0) return null;
  const c = polygon2DCentroid(vertices);
  const x = c.x / perMm;
  const y = c.y / perMm;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}
