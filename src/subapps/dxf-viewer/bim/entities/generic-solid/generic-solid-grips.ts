/**
 * ADR-684 Φ2/Φ3 — λαβές παραμετρικού στερεού.
 *
 * ## Γιατί centred-box adapter (και όχι δεύτερος μηχανισμός)
 *
 * Το ίχνος κάθε σχήματος είναι το **ορθογώνιο του bbox** (`computeGenericSolidGeometry` πάνω στο
 * `computeCentredBoxFootprint`), άρα οι λαβές move/rotation/corner ζουν στην ίδια κεντρική
 * γεωμετρία με έπιπλο / MEP box. Επαναχρησιμοποιούμε τον `createCentredBoxGripAdapter` (ADR-602) —
 * μηδέν νέα μαθηματικά, μηδέν clone (N.18).
 *
 * ## Δύο οικογένειες λαβών reshape ανά σχήμα
 *
 * - **box** → 4 γωνιακές λαβές (`generic-solid-corner-*`): authored ορθογώνιες διαστάσεις
 *   (`widthMm`/`depthMm`), ίδια σημασιολογία με το `furniture` (centred-box adapter, ADR-602).
 * - **στρογγυλά** (σφαίρα/κύλινδρος/δίσκος/κώνος/πρίσμα/κουλούρι) → radial λαβές ακτίνας (Φ4-A),
 *   που ζουν στο αδελφό module {@link ./generic-solid-shape-grips} (mirror `column-circular-adapter`).
 * - **pyramid** → μόνο move + rotation (ορθογώνιο ίχνος αλλά χωρίς corner grips εδώ· οι διαστάσεις
 *   βάσης επεξεργάζονται από το editor tab, Φ4-B).
 *
 * Το ύψος/πάχος/πλευρές/άνω-ακτίνα **δεν** έχουν plan λαβή (καμία οπτική ανάδραση σε κάτοψη· βλ.
 * shape-grips module) — επεξεργάζονται από το per-selection editor tab (Φ4-B).
 *
 * Ο διαχωρισμός γίνεται με **runtime φιλτράρισμα** στο {@link getGenericSolidGrips}, όχι με δεύτερο
 * adapter: ο τύπος `GenericSolidGripKind` κρατά όλο το capability set (όπως το furniture).
 *
 * Μηδέν εξαρτήσεις React / DOM / Firestore / canvas.
 *
 * @see ../../grips/create-centred-box-grip-adapter — ο adapter factory (ADR-602)
 * @see ./generic-solid-shape-grips — οι per-shape radial λαβές (Φ4-A)
 * @see ./generic-solid-geometry — shapeBoundingBoxMm (πηγή των bbox διαστάσεων)
 */

import type { GripInfo } from '../../../hooks/grip-types';
import type { GenericSolidGripKind } from '../../../hooks/grip-kinds-placeable';
import {
  createCentredBoxGripAdapter,
  buildCentredBoxKindMaps,
  type CentredBoxAdapterDragInput,
} from '../../grips/create-centred-box-grip-adapter';
import type { CentredBoxParams, CentredBoxPatch } from '../../grips/centred-box-grips';
import type { GenericSolidEntity, GenericSolidParams } from './generic-solid-types';
import { MIN_GENERIC_SOLID_DIMENSION_MM } from './generic-solid-types';
import { shapeBoundingBoxMm } from './generic-solid-geometry';
import {
  getGenericSolidShapeReshapeGrips,
  applyGenericSolidShapeReshape,
} from './generic-solid-shape-grips';

// ─── Param bridge: shape-nested dims ↔ centred-box SSoT ────────────────────────

/**
 * Οι διαστάσεις του κουτιού ζουν στο `params.shape` (nested), όχι top-level, άρα δεν ταιριάζει ο
 * κοινός `mmSuffixedBoxBridge`. Το `width`/`length` προκύπτουν πάντα από το bbox του τρέχοντος
 * σχήματος (SSoT `shapeBoundingBoxMm`) ώστε οι λαβές να τοποθετούνται σωστά και για μη-box σχήματα.
 */
function toBoxParams(params: GenericSolidParams): CentredBoxParams {
  const box = shapeBoundingBoxMm(params.shape);
  return {
    position: { x: params.position.x, y: params.position.y, z: params.position.z },
    rotation: params.rotationDeg,
    width: box.widthMm,
    length: box.depthMm,
    sceneUnits: params.sceneUnits,
  };
}

/**
 * Αναδιπλώνει ένα centred-box patch στις `GenericSolidParams`. Το `position`/`rotationDeg` πάντα
 * ενημερώνονται. Οι διαστάσεις (`width`/`length`) γράφονται πίσω **ΜΟΝΟ** για `box` (η μόνη μορφή με
 * επεξεργάσιμα `widthMm`/`depthMm`)· move/rotation δεν αλλάζουν διαστάσεις, άρα το write είναι no-op.
 * Για μη-box σχήματα το `shape` μένει άθικτο (δεν εκπέμπονται γωνιακές λαβές — βλ. getGrips).
 */
function fromBoxPatch(original: GenericSolidParams, patch: CentredBoxPatch): GenericSolidParams {
  const base: GenericSolidParams = {
    ...original,
    position: { x: patch.position.x, y: patch.position.y, z: patch.position.z },
    rotationDeg: patch.rotation,
  };
  if (original.shape.kind === 'box') {
    return {
      ...base,
      shape: { ...original.shape, widthMm: patch.width, depthMm: patch.length },
    };
  }
  return base;
}

const adapter = createCentredBoxGripAdapter<
  GenericSolidEntity,
  GenericSolidParams,
  GenericSolidGripKind
>({
  ...buildCentredBoxKindMaps('generic-solid'),
  minDimensionMm: MIN_GENERIC_SOLID_DIMENSION_MM,
  toBoxParams,
  fromBoxPatch,
  toGripInfo: (base, kind) => ({ ...base, gripKind: { on: 'generic-solid', kind } }),
});

/** Είσοδος drag — το κοινό centred-box 5πλό σχήμα. */
export type GenericSolidGripDragInput = CentredBoxAdapterDragInput<GenericSolidParams>;

/** Τα δύο whole-entity kinds — πάντα εκπέμπονται (κάθε σχήμα μετακινείται + περιστρέφεται). */
const MOVE_KIND: GenericSolidGripKind = 'generic-solid-move';
const ROTATION_KIND: GenericSolidGripKind = 'generic-solid-rotation';

/**
 * Λαβές ενός `GenericSolidEntity`. Για `box` → move + rotation + 4 γωνίες (πλήρες centred-box set).
 * Για κάθε άλλο σχήμα → move + rotation (centred-box) **+** οι per-shape radial reshape λαβές (Φ4-A:
 * ακτίνα για στρογγυλά, major+tube για κουλούρι· pyramid = μόνο move/rotation, βλ. shape-grips module).
 */
export function getGenericSolidGrips(entity: Readonly<GenericSolidEntity>): GripInfo[] {
  const all = adapter.getGrips(entity);
  if (entity.params.shape.kind === 'box') return all;
  const moveRotate = all.filter((g) => {
    const kind = g.gripKind?.on === 'generic-solid' ? g.gripKind.kind : undefined;
    return kind === MOVE_KIND || kind === ROTATION_KIND;
  });
  return [...moveRotate, ...getGenericSolidShapeReshapeGrips(entity)];
}

/**
 * Καθαρός μετασχηματισμός: είδος λαβής + drag → νέες `GenericSolidParams`. Μηδενικό delta / άγνωστο
 * είδος → επιστρέφει τις **ίδιες** παραμέτρους (short-circuit commit).
 *
 * Φ4-A — δοκιμάζει ΠΡΩΤΑ τις radial reshape λαβές (ακτίνα/major/tube)· `null` → fall back στον
 * centred-box adapter (move/rotation/box-corner). Mirror του `applyColumnGripDrag` (rect→circular→base).
 */
export function applyGenericSolidGripDrag(
  kind: GenericSolidGripKind,
  input: Readonly<GenericSolidGripDragInput>,
): GenericSolidParams {
  const reshaped = applyGenericSolidShapeReshape(kind, input.originalParams, input.delta);
  if (reshaped) return reshaped;
  return adapter.applyGripDrag(kind, input);
}
