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
import { makeLine, makeText, makeSolidFill, type NeutralPen } from './neutral-primitive-factory';
// ADR-739 Φ.Ε/Φ1 — ο ΕΝΑΣ κατάλογος πενών ISO (το ratchet `lineweight-iso-catalog`
// απαγορεύει αριθμητικά ISO literals οπουδήποτε αλλού).
import { nearestIsoLineweight } from '../../config/lineweight-iso-catalog';
import type { SheetStroke } from '../../bim/structural/detail-sheet/detail-sheet-types';

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
 * 🔴 ADR-739 Φ.Ε/Φ1 — **σχεδιαστικό μολύβι φύλλου → μολύβι οντότητας.**
 *
 * ## Γιατί το `widthMm` ΔΕΝ κλιμακώνεται με το `mmToWorld`
 * Το `SheetStroke.widthMm` είναι πάχος **χαρτιού** (ISO πένα), όχι μήκος του μοντέλου — και
 * το DXF group 370 είναι κι αυτό πάχος χαρτιού. Άρα η αντιστοίχιση είναι 1:1. Ένα
 * `× mmToWorld` εδώ θα έκανε το εξωτερικό πλαίσιο ενός πίνακα σε κλίμακα 1:50 να ζητήσει
 * πένα 25mm — δηλαδή θα βρισκόταν εκτός καταλόγου και θα κόλλαγε στο 2,11mm, τυπώνοντας
 * μαύρη μπάρα. Είναι η ίδια διάκριση που ο ADR-462 πλήρωσε αλλού: **μήκη** κλιμακώνονται,
 * **πένες** όχι.
 *
 * ## Γιατί το `dashMm` κλιμακώνεται
 * Αντίθετα, ένα μοτίβο διακεκομμένης είναι **μήκος πάνω στο σχέδιο**: 2mm γραμμή / 1mm κενό
 * σε φύλλο 1:50 είναι 100/50 world units. Ίδια σύμβαση με κάθε άλλη συντεταγμένη εδώ.
 */
function penFor(stroke: SheetStroke, mmToWorld: number): NeutralPen {
  return {
    colorHex: stroke.colorHex,
    lineweightMm: nearestIsoLineweight(stroke.widthMm),
    ...(stroke.dashMm && stroke.dashMm.length > 0
      ? { dashMm: stroke.dashMm.map((d) => d * mmToWorld) }
      : {}),
  };
}

/**
 * Το `tableLayoutToPrimitives` παράγει **τρία** kinds: `polyline` (γεμίσματα κελιών, ADR-739
 * Φ.Ε/Φ1), `line` (περιγράμματα) και `text` (περιεχόμενο κελιών). Οι υπόλοιποι τύποι
 * `DetailPrimitive` δεν αγνοούνται σιωπηλά — απλώς δεν παράγονται· αν κάποτε παραχθούν, η
 * ρητή `default` επιστροφή κενού είναι το σημείο που θα φανεί η παράλειψη σε test, όχι στην
 * εξαγωγή του χρήστη.
 *
 * ⚠️ **Ό,τι κουβαλά το primitive, το κουβαλά και η οντότητα.** Μέχρι τη Φ1 αυτή η συνάρτηση
 * κρατούσε **μόνο γεωμετρία** και πετούσε `stroke` / `colorHex` / `bold` — δεδομένα που η
 * διάταξη παρήγαγε σωστά και κανείς δεν διάβαζε. Αποτέλεσμα: ο πίνακας έβγαινε σε PDF, DXF
 * **και** TEK με ενιαίο χρώμα, ενιαίο πάχος και χωρίς έντονα, ενώ στην οθόνη ήταν σωστός.
 * Κάθε νέο πεδίο του `DetailPrimitive` που μένει εκτός εδώ αναπαράγει το ίδιο ελάττωμα.
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
      return [makeLine(
        source, idFor(), toWorld(prim.a), toWorld(prim.b), penFor(prim.stroke, mmToWorld),
      )];
    case 'polyline':
      // Γέμισμα κελιού. Ο πίνακας παράγει **μόνο** γεμισμένα κλειστά polylines (δες
      // `fillPrimitive`), και το περίγραμμά τους είναι εξ ορισμού ομόχρωμο με το γέμισμα —
      // άρα ένα `makeSolidFill` αρκεί· ένα δεύτερο `makePolyline` θα πρόσθετε αόρατη
      // γεωμετρία σε κάθε βαμμένο κελί. (Ο χάρακας κλίμακας κάνει το αντίθετο, και σωστά:
      // εκεί το περίγραμμα του κελιού είναι ορατό και το θέλει ο Τέκτονας, ο οποίος δεν
      // ζωγραφίζει solid fills.)
      if (!prim.fillHex) return [];
      return [makeSolidFill(source, idFor(), prim.points.map(toWorld), prim.fillHex)];
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
          colorHex: prim.colorHex,
          // Πάντα δηλωμένο (ακόμα και `false`): ο πίνακας **κατέχει** την τυπογραφία των
          // κελιών του, οπότε ο κόμβος πρέπει να γεννηθεί και για τα κανονικά κείμενα —
          // αλλιώς η γραμμή δεδομένων και η γραμμή κεφαλίδας θα έβγαιναν με διαφορετικό
          // text style (group 7) για λόγο άσχετο με τον σχεδιαστή.
          bold: prim.bold ?? false,
        }),
      ];
    default:
      return [];
  }
}
