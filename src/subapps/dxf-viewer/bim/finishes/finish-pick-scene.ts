/**
 * ADR-449 PART B Slice C (2D) — scene → `FinishPickElement[]` adapter.
 *
 * Γέφυρα ανάμεσα στα scene entities και τον pure `pickFinishFaceAtPoint`: μαζεύει τα
 * finish-active δομικά στοιχεία με το **stored footprint** τους (canvas units) — ΤΟ ΙΔΙΟ
 * που διαβάζει ο `SetFinishFaceOverrideCommand` (`geometry.footprint.vertices` κολόνα /
 * `geometry.outline.vertices` δοκάρι) ώστε ο `side:i` edge index του pick να δίνει τον
 * σωστό `finishFaceRef` στον writer. Τοίχοι = follow-up (ο command δεν λύνει ακόμη wall
 * footprint· χρειάζεται `wallFootprintPolygon` support).
 *
 * @see ./finish-face-pick-2d.ts — ο pure resolver (καταναλωτής)
 * @see core/commands/entity-commands/SetFinishFaceOverrideCommand.ts — ο κοινός writer (2D+3D)
 */

import { isColumnEntity, isBeamEntity } from '../../types/entities';
import { toPt2 } from './structural-finish-point';
import { isFinishActive } from './structural-finish-types';
import type { FinishPickElement } from './finish-face-pick-2d';

/** Ελάχιστη μορφή scene entity που χρειάζεται (guards + geometry). */
type SceneEntityLike = Parameters<typeof isColumnEntity>[0];

/**
 * Finish-active κολόνες + δοκάρια → `FinishPickElement[]` (canvas-unit footprints). Στοιχεία
 * χωρίς ενεργό σοβά ή έγκυρο footprint παραλείπονται. Τοίχοι εξαιρούνται (command TODO).
 */
export function collectFinishPickElements(entities: readonly SceneEntityLike[]): FinishPickElement[] {
  const out: FinishPickElement[] = [];
  for (const e of entities) {
    if (isColumnEntity(e)) {
      const verts = e.geometry?.footprint?.vertices;
      if (isFinishActive(e.params.finish) && verts && verts.length >= 3) {
        out.push({ id: e.id, footprint: verts.map(toPt2), finish: e.params.finish });
      }
    } else if (isBeamEntity(e)) {
      const verts = e.geometry?.outline?.vertices;
      if (isFinishActive(e.params.finish) && verts && verts.length >= 3) {
        out.push({ id: e.id, footprint: verts.map(toPt2), finish: e.params.finish });
      }
    }
  }
  return out;
}
