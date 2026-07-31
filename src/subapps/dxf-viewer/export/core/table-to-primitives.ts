/**
 * ADR-739 Φάση Γ — `TableEntity` → ουδέτερα primitives (η διαδρομή εξαγωγής).
 *
 * Αδελφός του `decomposeScaleBar` (`annotation-to-primitives.ts`), αλλά με **μηδέν** νέα
 * γεωμετρία: η αλυσίδα είναι ήδη ολόκληρη γραμμένη και εδώ απλώς συνδέεται.
 *
 * ```
 *   layoutTable            (Φ.Α — η ΜΙΑ μηχανή διάταξης)
 *     → tableLayoutToPrimitives  (Φ.Β — DetailPrimitive[] σε sheet-mm, y-κάτω)
 *       → tableFrameToWorld      (Φ.Γ — η ΜΙΑ αναστροφή y + περιστροφή + κλίμακα)
 *         → makeLine / makeText  (ουδέτερο εργοστάσιο, κοινό με τις άλλες σημειώσεις)
 * ```
 *
 * Άρα **ό,τι βλέπει η οθόνη είναι ό,τι βγαίνει σε PDF/DXF/TEK κατά κατασκευή**, όχι κατά
 * σύμπτωση: και ο ζωγράφος και ο αποδομητής διαβάζουν το ίδιο `TableLayout` και την ίδια
 * συνάρτηση πλαισίου. Δεν υπάρχει σημείο όπου να μπορούν να αποκλίνουν.
 *
 * ## Γιατί `decompose` και όχι `native` στη Φ.Γ
 * Το §10 ορίζει `ACAD_TABLE` για DXF — αλλά ο writer του είναι ρητά **Φάση Ε**. Ένα
 * δηλωμένο `native` χωρίς writer θα σήμαινε ότι ο πίνακας **χάνεται σιωπηλά** στην
 * εξαγωγή, δηλαδή ακριβώς το σφάλμα που το `ENTITY_EXPORT_COVERAGE` υπάρχει για να
 * αποτρέπει. Το `decompose` δεν είναι προσωρινό μπάλωμα: το ίδιο το §10 το απαιτεί
 * ούτως ή άλλως ως **fallback για στόχους πριν την R2004**, οπότε αυτός ο κώδικας
 * επιβιώνει αυτούσιος μετά τη Φ.Ε.
 *
 * @module subapps/dxf-viewer/export/core/table-to-primitives
 * @see export/core/annotation-to-primitives.ts — ο καλών (`decomposeAnnotationEntity`)
 * @see bim/table/table-layout-to-primitives.ts — η γέφυρα της Φ.Β
 */

import type { Entity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import type { TableEntity } from '../../types/table-entity';
import type { DetailPrimitive } from '../../bim/structural/detail-sheet/detail-sheet-types';
import { tableLayoutToPrimitives } from '../../bim/table/table-layout-to-primitives';
import {
  computeTableEntityGeometry,
  tableFrameToWorld,
} from '../../bim/table/table-entity-geometry';
import { makeLine, makeText } from './neutral-primitive-factory';

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Αποδομεί έναν πίνακα σε ουδέτερες γραμμές + κείμενα, σε **μονάδες σκηνής**.
 *
 * Το κείμενο κληρονομεί τη γωνία του πίνακα (`rotationDeg`): σε αντίθεση με τα σύμβολα
 * σημείωσης, όπου η ετικέτα μένει όρθια για αναγνωσιμότητα, ένα κελί πίνακα **πρέπει**
 * να γέρνει μαζί με το πλέγμα του — αλλιώς το κείμενο βγαίνει έξω από το κελί του.
 */
export function decomposeTable(
  entity: TableEntity,
  drawingScale: number,
  sceneUnits: SceneUnits,
): Entity[] {
  const geometry = computeTableEntityGeometry(entity, drawingScale, sceneUnits);
  const primitives = tableLayoutToPrimitives(geometry.layout);
  const rotationDeg = entity.angleRad * RAD_TO_DEG;

  const toWorld = (p: Point2D): Point2D =>
    tableFrameToWorld(entity, p.x, p.y, geometry.mmToWorld);

  let n = 0;
  const idFor = (): string => `${entity.id}__tbl_${n++}`;

  const out: Entity[] = [];
  for (const prim of primitives) {
    out.push(...mapTablePrimitive(prim, entity, toWorld, geometry.mmToWorld, rotationDeg, idFor));
  }
  return out;
}

/**
 * Το `tableLayoutToPrimitives` παράγει **μόνο** `line` και `text` (η μηχανή δεν βγάζει
 * γεμίσματα σε αυτή τη φάση). Οι υπόλοιποι τύποι `DetailPrimitive` δεν αγνοούνται
 * σιωπηλά — απλώς δεν παράγονται· αν κάποτε παραχθούν, η ρητή `default` επιστροφή
 * κενού είναι το σημείο που θα φανεί η παράλειψη σε test, όχι στην εξαγωγή του χρήστη.
 */
function mapTablePrimitive(
  prim: DetailPrimitive,
  source: Entity,
  toWorld: (p: Point2D) => Point2D,
  mmToWorld: number,
  rotationDeg: number,
  idFor: () => string,
): Entity[] {
  switch (prim.kind) {
    case 'line':
      return [makeLine(source, idFor(), toWorld(prim.a), toWorld(prim.b))];
    case 'text':
      return [
        makeText(source, idFor(), {
          position: toWorld(prim.position),
          text: prim.text,
          height: prim.heightMm * mmToWorld,
          alignment: prim.align,
          rotationDeg,
          // Το `y` ενός `TableTextRun` ΕΙΝΑΙ η γραμμή βάσης (σύμβαση `TextPrimitive`),
          // δηλαδή η προεπιλογή `alphabetic` — αυτό ακριβώς ήταν το σφάλμα των 1,5mm
          // της Φ.Β: γραμμή περιεχομένου ≠ ακμή γραμμής.
          vBaseline: 'alphabetic',
        }),
      ];
    default:
      return [];
  }
}
