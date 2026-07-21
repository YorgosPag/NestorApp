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
 * ## Οι γωνιακές λαβές εκπέμπονται ΜΟΝΟ για `box`
 *
 * Μόνο το `box` σχήμα έχει authored ορθογώνιες διαστάσεις (`widthMm`/`depthMm`) που το corner-resize
 * μπορεί να επεξεργαστεί άμεσα — ίδια σημασιολογία με το `furniture`. Σφαίρα/κύλινδρος/κώνος/
 * κουλούρι/δίσκος/πρίσμα/πυραμίδα έχουν **διαφορετική** reshape σημασιολογία (ακτίνα/ύψος/πλευρές):
 * μια τετράγωνη λαβή γωνίας θα παραμόρφωνε το τετράγωνο ίχνος τους ασύμβατα με τις παραμέτρους τους.
 * Γι' αυτά εκπέμπονται **μόνο** move + rotation στη Φ2/Φ3 (οι per-shape λαβές ακτίνας είναι Φ4).
 *
 * Ο διαχωρισμός γίνεται με **runtime φιλτράρισμα** στο {@link getGenericSolidGrips}, όχι με δεύτερο
 * adapter: ο τύπος `GenericSolidGripKind` κρατά όλο το capability set (όπως το furniture).
 *
 * Μηδέν εξαρτήσεις React / DOM / Firestore / canvas.
 *
 * @see ../../grips/create-centred-box-grip-adapter — ο adapter factory (ADR-602)
 * @see ../../furniture/furniture-grips — ο αδελφός box consumer (πλήρες corner set)
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
 * Για κάθε άλλο σχήμα → **μόνο** move + rotation (το φιλτράρισμα εδώ, όχι δεύτερος adapter).
 */
export function getGenericSolidGrips(entity: Readonly<GenericSolidEntity>): GripInfo[] {
  const all = adapter.getGrips(entity);
  if (entity.params.shape.kind === 'box') return all;
  return all.filter((g) => {
    const kind = g.gripKind?.on === 'generic-solid' ? g.gripKind.kind : undefined;
    return kind === MOVE_KIND || kind === ROTATION_KIND;
  });
}

/**
 * Καθαρός μετασχηματισμός: είδος λαβής + drag → νέες `GenericSolidParams`. Μηδενικό delta / άγνωστο
 * είδος → επιστρέφει τις **ίδιες** παραμέτρους (short-circuit commit). Delegate 100% στον adapter.
 */
export const applyGenericSolidGripDrag: (
  kind: GenericSolidGripKind,
  input: Readonly<GenericSolidGripDragInput>,
) => GenericSolidParams = adapter.applyGripDrag;
