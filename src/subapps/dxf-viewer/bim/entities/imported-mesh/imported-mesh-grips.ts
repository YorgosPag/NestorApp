/**
 * ADR-683 Φ3 — λαβές εισαγόμενου πλέγματος: **MOVE + ROTATION, τίποτε άλλο**.
 *
 * ## Γιατί ΔΕΝ επαναχρησιμοποιεί τον centred-box adapter του `furniture`
 *
 * Ο πρώτος πειρασμός είναι να καλέσουμε τον `createCentredBoxGripAdapter` όπως κάνει το
 * `furniture-grips.ts` — ίδιο σχήμα κουτιού, έτοιμη υποδομή. **Θα ήταν λάθος:** ο adapter εκπέμπει
 * ΚΑΙ τις τέσσερις γωνιακές λαβές resize. Το `furniture` τις δικαιούται (παραμετρικό κουτί με
 * authored διαστάσεις καταλόγου)· το εισαγόμενο πλέγμα **όχι** — το «πλάτος» του δεν είναι
 * παράμετρος αλλά *μέτρηση* των τριγώνων που έστειλε ο συνεργάτης. Resize εδώ = παραμόρφωση ξένου
 * σχεδίου, ρητά απαγορευμένη (ADR-683 §3, §10.1).
 *
 * Άρα ακολουθεί το **hatch** πρότυπο (ADR-627), όχι το furniture: δύο whole-entity λαβές, μηδέν
 * λαβές σχήματος. Η **τοποθέτηση** δεν ξανα-υπολογίζεται — delegate στο κοινό
 * `resolveMoveRotateHandleWorld` (το ίδιο SSoT που χρησιμοποιούν polyline/area/hatch), ώστε η
 * αίσθηση να είναι πανομοιότυπη παντού και να μην υπάρχει δεύτερη φόρμουλα να αποκλίνει (N.18).
 *
 * Μηδέν εξαρτήσεις React / DOM / Firestore / canvas.
 *
 * @see ../../hatch/hatch-move-rotate-grips — ο αδελφός με το ίδιο σχήμα (ADR-627)
 * @see ../../../systems/polyline/polyline-grips — `resolveMoveRotateHandleWorld` (placement SSoT)
 * @see ../../../hooks/grip-kinds-placeable — `ImportedMeshGripKind` (γιατί λείπουν οι γωνίες)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { GripInfo } from '../../../hooks/grip-types';
import type { ImportedMeshGripKind } from '../../../hooks/grip-kinds-placeable';
import { resolveMoveRotateHandleWorld } from '../../../systems/polyline/polyline-grips';
import { applyCentredBoxGripDrag } from '../../grips/centred-box-grips';
import type { ImportedMeshEntity, ImportedMeshParams } from './imported-mesh-types';

/** Το κλειδί λαβής μετακίνησης (glyph MOVE, 4 βέλη). */
export const IMPORTED_MESH_MOVE_KIND = 'imported-mesh-move' as const;
/** Το κλειδί λαβής περιστροφής (καμπύλο glyph). */
export const IMPORTED_MESH_ROTATION_KIND = 'imported-mesh-rotation' as const;

/**
 * Οι **δύο** λαβές ενός εισαγόμενου πλέγματος, τοποθετημένες πάνω στο ίχνος του μέσω του κοινού
 * placement SSoT. Εκφυλισμένο ίχνος (<2 κορυφές) → καμία λαβή.
 *
 * Το ίχνος είναι το ορθογώνιο του μετρημένου bbox, άρα οι λαβές εμφανίζονται **αμέσως** μετά το
 * reload — δεν περιμένουν να κατέβει το `.glb`.
 */
export function getImportedMeshGrips(entity: Readonly<ImportedMeshEntity>): GripInfo[] {
  const ring = entity.geometry?.footprint?.vertices;
  if (!ring || ring.length < 2) return [];

  const pos = resolveMoveRotateHandleWorld(ring, true);
  if (!pos) return [];

  return [
    {
      entityId: entity.id, gripIndex: 0, type: 'center',
      position: pos.move, movesEntity: true,
      gripKind: { on: 'imported-mesh', kind: IMPORTED_MESH_MOVE_KIND },
    },
    {
      entityId: entity.id, gripIndex: 1, type: 'vertex',
      position: pos.rotation, movesEntity: false,
      gripKind: { on: 'imported-mesh', kind: IMPORTED_MESH_ROTATION_KIND },
    },
  ];
}

/** Είσοδος drag — το κοινό 4πλό σχήμα των centred-box καταναλωτών. */
export interface ImportedMeshGripDragInput {
  readonly originalParams: ImportedMeshParams;
  readonly delta: Point2D;
  /** Θέση κέρσορα (= άγκυρα λαβής + `delta`). Χρειάζεται μόνο για τη διαδρομή pivot-rotate. */
  readonly currentPos?: Point2D;
  /** Κέντρο περιστροφής (ADR-397 6-click ROTATE→Reference hot-grip). */
  readonly pivot?: Point2D;
}

/**
 * Καθαρός μετασχηματισμός: είδος λαβής + drag → νέες `ImportedMeshParams`.
 * Μηδενικό delta / άγνωστο είδος → επιστρέφει τις **ίδιες** παραμέτρους (short-circuit commit).
 *
 * Delegate στο `applyCentredBoxGripDrag` — μηδέν νέα μαθηματικά περιστροφής (συμπεριλαμβανομένης
 * της διαδρομής pivot του ADR-397). Καλείται **μόνο** με ρόλους `move`/`rotation`: οι γωνιακοί
 * ρόλοι δεν εκπέμπονται ποτέ από το {@link getImportedMeshGrips}, άρα δεν φτάνουν ποτέ εδώ.
 *
 * ⚠️ Το patch επιστρέφει και `width`/`length`, αλλά **τα αγνοούμε σκόπιμα**: οι μετρημένες
 * διαστάσεις είναι ιδιότητα του πλέγματος, όχι επεξεργάσιμη παράμετρος (§3). Ακόμη κι αν κάποιος
 * καλέσει με γωνιακό ρόλο, το σχήμα **δεν** μπορεί να αλλάξει από εδώ.
 */
export function applyImportedMeshGripDrag(
  kind: ImportedMeshGripKind,
  input: Readonly<ImportedMeshGripDragInput>,
): ImportedMeshParams {
  const { originalParams } = input;
  const role = kind === IMPORTED_MESH_MOVE_KIND ? 'move' : 'rotation';

  const patch = applyCentredBoxGripDrag(role, {
    originalParams: {
      position: originalParams.position,
      rotation: originalParams.rotationDeg,
      width: originalParams.measuredWidthMm,
      length: originalParams.measuredDepthMm,
      sceneUnits: originalParams.sceneUnits,
    },
    delta: input.delta,
    currentPos: input.currentPos,
    pivot: input.pivot,
  });
  if (!patch) return originalParams;

  return {
    ...originalParams,
    position: { x: patch.position.x, y: patch.position.y, z: patch.position.z },
    rotationDeg: patch.rotation,
  };
}
