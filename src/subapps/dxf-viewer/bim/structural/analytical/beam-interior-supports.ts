/**
 * Beam interior supports — pure SSoT για FEM subdivision (ADR-504 Φ2 S5 / ADR-480).
 *
 * Όταν μια στηρίζουσα κολώνα προβάλλεται στο **εσωτερικό** (όχι στα άκρα) του δοκού,
 * ο αναλυτικός builder πρέπει να εισάγει ενδιάμεσο κόμβο εκεί και να σπάσει το beam
 * member σε υπο-μέλη → πραγματικός **συνεχής** δοκός (sagging στα ανοίγματα + hogging
 * πάνω από την εσωτερική στήριξη). Αυτό το module εντοπίζει αυτές τις εσωτερικές
 * στηρίξεις ως **κλάσμα t∈(0,1)** κατά μήκος του άξονα start→end.
 *
 * **Ίδιο SSoT προβολής** με το `deriveBeamSpanModel` (S2): `projectColumnFootprintOnAxis`
 * + `beamSupportColumnIds`. Μια κολώνα είναι **end** στήριξη (όχι interior) όταν το
 * footprint της **καλύπτει** ένα άκρο του δοκού (alongMin ≤ 0 ή alongMax ≥ len) —
 * αλλιώς είναι interior. Το κλάσμα είναι unit-invariant (λόγος) → εφαρμόζεται απευθείας
 * στους κόμβους του analytical model (μέτρα).
 *
 * Pure — zero React/DOM/Firestore. Μονάδες εισόδου: scene units (mm).
 *
 * @see ../organism/derive-beam-span-model.ts — ίδια προβολή, closed-form υπο-άνοιγμα (S2)
 * @see ../../columns/column-face-trim.ts — projectColumnFootprintOnAxis (reuse)
 * @see ./analytical-model-builder.ts — ο καταναλωτής (appendBeam subdivision)
 * @see docs/centralized-systems/reference/adrs/ADR-504-practical-span-intermediate-columns.md §5.1
 */

import { isColumnEntity } from '../../../types/entities';
import type { Entity } from '../../../types/entities';
import type { BeamEntity } from '../../types/beam-types';
import type { ColumnEntity } from '../../types/column-types';
import { projectColumnFootprintOnAxis } from '../../columns/column-face-trim';
import { beamAxisSceneFrame } from '../../beams/beam-axis-scene-frame';
import { beamSupportColumnIds } from '../loads/load-path-walk';
import type { StructuralGraph } from '../organism/structural-organism-types';
import { clamp01 } from '../../../rendering/entities/shared/geometry-utils';

/** Float-noise ανοχή (scene units) για το «καλύπτει το άκρο» τεστ. */
const EDGE_TOL = 1;

/** Μια εσωτερική στήριξη δοκού: η στηρίζουσα κολώνα + το κλάσμα της στον άξονα (0,1). */
export interface BeamInteriorSupport {
  readonly columnId: string;
  /** Κλάσμα κατά μήκος start→end, αυστηρά εσωτερικό (0 < t < 1). */
  readonly t: number;
}

/**
 * Οι εσωτερικές στηρίξεις ενός δοκού, ταξινομημένες κατά `t`. Κάθε στηρίζουσα κολώνα
 * προβάλλεται στον άξονα· όσες **καλύπτουν** άκρο (alongMin ≤ tol ή alongMax ≥ len−tol)
 * είναι end-supports → αγνοούνται. Οι υπόλοιπες δίνουν ενδιάμεσο κόμβο στο μέσο της
 * προβολής τους. Κενό όταν ο δοκός είναι αμφιέρειστος/πρόβολος (μηδέν subdivision).
 */
export function beamInteriorSupports(
  beam: BeamEntity,
  graph: StructuralGraph,
  entities: readonly Entity[],
): BeamInteriorSupport[] {
  const frame = beamAxisSceneFrame(beam); // ADR-506 — ΕΝΑ SSoT για το axis-frame (πρώην inline)
  if (!frame) return [];

  const supportIds = new Set(beamSupportColumnIds(graph, beam.id));
  const columns = entities.filter(
    (ent): ent is ColumnEntity => isColumnEntity(ent) && supportIds.has(ent.id),
  );

  const out: BeamInteriorSupport[] = [];
  for (const col of columns) {
    const { alongMin, alongMax } = projectColumnFootprintOnAxis(col, frame.ax, frame.ay, frame.ux, frame.uy);
    // καλύπτει άκρο → end support (όχι interior)
    if (alongMin <= EDGE_TOL || alongMax >= frame.lenScene - EDGE_TOL) continue;
    out.push({ columnId: col.id, t: clamp01((alongMin + alongMax) / 2 / frame.lenScene) });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}
