/**
 * ADR-608 / ADR-667 — το **συμβόλαιο εισόδου** του vector PDF emitter.
 *
 * **Γιατί ξεχωριστό αρχείο:** το `SceneVectorEmitParams` το χρειάζονται **και** ο
 * `scene-vector-emitter` **και** ο `scene-hatch-emitter` (τον οποίο ο πρώτος καλεί) ⇒ αν ζούσε
 * στον emitter θα είχαμε **κύκλο** import. Καθαροί τύποι, μηδέν runtime κώδικας.
 *
 * @module subapps/dxf-viewer/print/vector/scene-vector-types
 * @see docs/centralized-systems/reference/adrs/ADR-608-vector-pdf-export.md
 */

import type { Entity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import type { PrintColorPolicy } from '../../config/print-color-policy';
import type { SceneImageResolution } from './scene-image-resolver';
import type { SceneHatchLineResolution } from './scene-hatch-line-resolver';

/** World→paper projection: `toPaper` maps a world point to placed jsPDF mm (Y-down). */
export interface SceneVectorEmitParams {
  /** Flattened + colour-stamped primitives (output of `flattenSceneEntitiesForDxf`). */
  readonly entities: readonly Entity[];
  /** Pure world→paper-mm mapper (Y-down, already offset into the printable rect). */
  readonly toPaper: (p: Point2D) => Point2D;
  /** Uniform mm-per-world-unit factor (radii + text height). */
  readonly worldToPaperScale: number;
  /** Active plot-style policy (white-safe / mono / grayscale) — same SSoT as raster. */
  readonly colorPolicy: PrintColorPolicy;
  /**
   * ADR-608 hybrid — προ-resolved raster εικόνες (image-fill hatch κελιά + `ImageEntity`),
   * κλειδωμένες ανά entity id από το async `scene-image-resolver`. Ο emitter τις συνθέτει
   * inline (array-order → σωστό z-order με τις γραμμές). Κενό map → μόνο vector (ως πριν).
   */
  readonly images: SceneImageResolution;
  /**
   * ADR-667 Φ3 — προ-resolved γραμμές μοτίβου (exploded segments + ριγέ κελιά), από το sibling
   * pre-pass `scene-hatch-line-resolver`. Ο **budget guard** ζει εκεί: ο υπολογισμός τους μέσα σε
   * αυτό το **σύγχρονο** closure θα πάγωνε τον browser (μετρημένο: 164s / OOM 4GB) **και** η
   * υποβάθμιση δεν θα μπορούσε ποτέ να αναφερθεί (το `capture.fidelity` διαβάζεται ΠΡΙΝ το `draw`).
   */
  readonly hatchLines: SceneHatchLineResolution;
}
