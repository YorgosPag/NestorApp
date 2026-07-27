/**
 * ADR-665 M2 — `TerrainCutCapPlan` (WORLD mm, επίπεδο) → `THREE.BufferGeometry` στη στάθμη τομής.
 *
 * Ο αδερφός του `tin-to-three` για την **επιφάνεια της τομής**: το μοναδικό σημείο όπου ο cap
 * περνά από το πεδίο της αποτύπωσης στη σκηνή. Καθαρό — κανένα store, καμία οντότητα, καμία σκηνή·
 * ο ακάθαρτος καλών (`TerrainCutCapLayer`) διαβάζει τον projector και τη στάθμη και τα περνά μέσα,
 * ακριβώς όπως ο `TerrainSceneLayer` το κάνει για το ανάγλυφο.
 *
 * ── Οι τρεις μετασχηματισμοί, μία φορά ο καθένας ─────────────────────────────────────────────
 *   1. **WORLD (ΕΓΣΑ) → DISPLAY** μέσω του `WorldToDisplayProjector` (ADR-650 §M10f). Υποχρεωτικό
 *      για ό,τι κάθεται στη σκηνή: χωρίς αυτό ο cap θα γραφόταν σε 4·10⁵ mm ενώ ο λόφος έχει ήδη
 *      μετακινηθεί κάτω από το κτίριο — δηλαδή θα εξαφανιζόταν σε άλλη ήπειρο.
 *   2. **plan-mm → three-world (m, Y-up)** μέσω του `writeDxfPlanToWorld`, η ίδια σύμβαση με το
 *      ανάγλυφο, τις λαβές και τα φαντάσματα. Ποτέ ξανα-inline εδώ.
 *   3. **World-space UV**: `uv = (x_m, z_m) / TILE_M`. ΟΧΙ `texture.repeat` (ADR-665 M2.4) — η
 *      διαγράμμιση είναι προβολή κατόψεως, δεν κολυμπά στο zoom, και δεν εξαρτάται από το μέγεθος
 *      του bounding box όπως κάθε screen-space poché.
 *
 * ⚠️ Η στάθμη μπαίνει ως **three-world Y σε μέτρα**, όχι ως υψόμετρο: ο cap κάθεται ΑΚΡΙΒΩΣ εκεί
 * που το clip plane κόβει το ανάγλυφο, και εκείνο είναι ορισμένο σε world-Y. Η μετατροπή προς την
 * άλλη κατεύθυνση (ποιο υψόμετρο κόβεται) ζει στο `vertical-datum.surfaceElevationAtWorldYMm` —
 * εκεί όπου ζουν και τα δύο μεγέθη που τη συνθέτουν (datum + display drop).
 *
 * @see ../../systems/topography/terrain-cut-cap-geometry.ts — ο παραγωγός των τριγώνων
 * @see ./tin-to-three.ts — ο αντίστοιχος converter της ίδιας επιφάνειας
 */

import * as THREE from 'three';
import type { TerrainCutCapPlan } from '../../systems/topography/terrain-cut-cap-geometry';
import type { WorldToDisplayProjector } from '../../systems/geo-referencing/geo-transform';
import { SECTION_HATCH_TILE_M } from '../systems/section/section-hatch-cap';
import { writeDxfPlanToWorld } from '../viewport/coordinate-transforms';

/** Οι per-build είσοδοι που ο converter δεν επιτρέπεται να διαβάσει μόνος του (μένει καθαρός). */
export interface TerrainCapBuildOptions {
  /** ADR-650 M10b/M10f — ο ενεργός WORLD (ΕΓΣΑ) → building-DISPLAY projector. `null`/identity ⇒ no-op. */
  readonly projector?: WorldToDisplayProjector | null;
  /** Three-world Y (μέτρα) του επιπέδου τομής — εκεί ακριβώς κάθεται κάθε κορυφή του cap. */
  readonly levelWorldYM: number;
}

/**
 * Η γεωμετρία του cap, ή `null` όταν δεν υπάρχει τίποτα να σχεδιαστεί (η στάθμη πάνω από όλον τον
 * λόφο, ή μη-πεπερασμένη στάθμη).
 *
 * Το `null` σε μη-πεπερασμένα **δεν** είναι αμυντικός θόρυβος: μία NaN κορυφή κάνει NaN το `Box3`
 * του mesh, και ένα NaN bounding box δηλητηριάζει frustum culling / camera-fit ώστε να **σβήσει
 * όλη** τη σκηνή (ADR-537). Η άρνηση κατασκευής είναι αυστηρά καλύτερη από το να μαυρίσει το μοντέλο.
 *
 * Επίπεδη γεωμετρία με σταθερή κάθετη +Y: το `computeVertexNormals` θα έδινε το ίδιο αποτέλεσμα με
 * ένα πέρασμα παραπάνω, και το υλικό είναι ούτως ή άλλως άφωτο — η κάθετη γράφεται ρητά για να
 * παραμείνει σωστή αν κάποιος αύριο βάλει φωτισμένη παραλλαγή.
 */
export function terrainCapToBufferGeometry(
  plan: TerrainCutCapPlan,
  options: TerrainCapBuildOptions,
): THREE.BufferGeometry | null {
  const { levelWorldYM } = options;
  if (plan.triangleCount === 0 || !Number.isFinite(levelWorldYM)) return null;

  const project = options.projector && !options.projector.isIdentity ? options.projector : null;
  const count = plan.points.length;
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const normals = new Float32Array(count * 3);
  // Το `writeDxfPlanToWorld` δέχεται υψόμετρο σε mm και το κατεβάζει σε μέτρα· η στάθμη μας είναι
  // ήδη σε μέτρα, οπότε ανεβαίνει μία φορά εδώ αντί να γραφτεί δεύτερη σύμβαση αξόνων.
  const levelElevForWriterMm = levelWorldYM * 1000;

  for (let i = 0; i < count; i++) {
    const point = plan.points[i]!;
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    const display = project ? project.project(point.x, point.y) : point;

    const offset = i * 3;
    writeDxfPlanToWorld(positions, offset, display.x, display.y, levelElevForWriterMm);
    // Η UV προβολή γίνεται από τις ΤΕΛΙΚΕΣ world συντεταγμένες (x, z), όχι από τις plan mm: έτσι ένα
    // πλακίδιο είναι `TILE_M` πραγματικά μέτρα στη σκηνή, ό,τι κι αν έκανε ο projector.
    uvs[i * 2] = positions[offset]! / SECTION_HATCH_TILE_M;
    uvs[i * 2 + 1] = positions[offset + 2]! / SECTION_HATCH_TILE_M;
    normals[offset] = 0;
    normals[offset + 1] = 1;
    normals[offset + 2] = 0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return geometry;
}
