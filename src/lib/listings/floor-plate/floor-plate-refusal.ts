/**
 * @fileoverview **Η ΑΡΝΗΣΗ ΤΗΣ ΔΗΛΩΣΗΣ ΟΡΟΦΟΥ, ΑΠΟ ΤΟ ΣΥΡΜΑ ΩΣ ΤΟΝ ΑΝΘΡΩΠΟ** (ADR-907 §11.10).
 * @related ./floor-plate-declaration (`FloorPlateRefusal`) · app/api/floors/[floorId]/floor-plate/route (ο αποστολέας)
 * @module lib/listings/floor-plate/floor-plate-refusal
 *
 * Δύο ερωτήσεις, ένας τόπος:
 * - **«τι λέμε στον άνθρωπο;»** — κάθε άρνηση αντιστοιχεί σε **μία πρόταση με διόρθωση**. Εξαντλητικός πίνακας: νέα
 *   άρνηση χωρίς πρόταση δεν μεταγλωττίζεται. Πολλές αρνήσεις, μία πρόταση — ο άνθρωπος δεν διορθώνει «not-finite»,
 *   διορθώνει «ένα περίγραμμα».
 * - **«είναι αυτό το σώμα άρνηση της πόρτας;»** — ο ίδιος πίνακας είναι και το **κλειστό σύνολο** που δέχεται η ανάγνωση·
 *   άγνωστο `why` δεν γίνεται ποτέ πρόταση.
 *
 * ⚠️ **Καθαρό module** — καμία I/O, κανένα κείμενο: εδώ ζουν **ταυτότητες προτάσεων**, οι λέξεις ζουν στα locales.
 */

import { isPlainRecord } from '@/lib/type-guards';

import { FLOOR_PLATE_REFUSED_CODE, type FloorPlateRefusal } from './floor-plate-declaration';

/** Οι προτάσεις που μπορεί να ακούσει όποιος υπογράφει — κάθε μία λέει **τι να διορθώσει**. */
export type FloorPlateRefusalMessage =
  | 'imageMissing'
  | 'imageNotPublic'
  | 'imageNotDeliverable'
  | 'imageNotReady'
  | 'backgroundMissing'
  | 'backgroundTransformed'
  | 'frameMismatch'
  | 'outlineGeometry'
  | 'outlineTooComplex'
  | 'outlineOutside'
  | 'outlineUnsupported'
  | 'outlineUnlinked'
  | 'unitForeign'
  | 'unitDuplicate'
  | 'outlinesCoincident'
  | 'noLinkedUnit'
  | 'floorMissing'
  | 'tooManyUnits';

export const FLOOR_PLATE_REFUSAL_MESSAGE: Readonly<Record<FloorPlateRefusal, FloorPlateRefusalMessage>> = {
  'image-missing': 'imageMissing',
  'image-not-public': 'imageNotPublic',
  'image-not-deliverable': 'imageNotDeliverable',
  'image-undated': 'imageNotReady',
  'image-unmeasured': 'imageNotReady',
  'no-frame': 'imageNotReady',
  'background-missing': 'backgroundMissing',
  'background-transformed': 'backgroundTransformed',
  'frame-mismatch': 'frameMismatch',
  'too-few-vertices': 'outlineGeometry',
  'not-finite': 'outlineGeometry',
  degenerate: 'outlineGeometry',
  'too-many-vertices': 'outlineTooComplex',
  'outside-frame': 'outlineOutside',
  'unknown-role': 'outlineUnsupported',
  'not-a-polygon': 'outlineUnsupported',
  'unlinked-outline': 'outlineUnlinked',
  'foreign-unit': 'unitForeign',
  'duplicate-unit': 'unitDuplicate',
  'coincident-outlines': 'outlinesCoincident',
  'self-missing': 'noLinkedUnit',
  'floor-missing': 'floorMissing',
  'not-declared': 'floorMissing',
  'too-many-units': 'tooManyUnits',
};

/** Η άρνηση όπως τη χρειάζεται η οθόνη: **γιατί**, και — όταν φταίει ένα — **ποιο περίγραμμα**. */
export interface FloorPlateRefusalNotice {
  readonly why: FloorPlateRefusal;
  readonly overlayId: string | null;
}

/** Το σώμα της άρνησης στο σύρμα — ο διακριτής είναι το `errorCode`, τα δύο πεδία ζουν **στη ρίζα**. */
export interface FloorPlateRefusalBody extends FloorPlateRefusalNotice {
  readonly success: false;
  readonly error: string;
  readonly errorCode: typeof FLOOR_PLATE_REFUSED_CODE;
}

/** Ο ΕΝΑΣ τόπος που **γράφει** το σώμα — ώστε γραφή και ανάγνωση να μην αποκλίνουν ποτέ. */
export function floorPlateRefusalBody({ why, overlayId }: FloorPlateRefusalNotice): FloorPlateRefusalBody {
  return { success: false, error: `Floor plate refused: ${why}`, errorCode: FLOOR_PLATE_REFUSED_CODE, why, overlayId };
}

function isFloorPlateRefusal(value: unknown): value is FloorPlateRefusal {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FLOOR_PLATE_REFUSAL_MESSAGE, value);
}

/**
 * **Είναι αυτό το σώμα άρνηση της πόρτας της δήλωσης;** — `null` για κάθε άλλη απάντηση.
 *
 * 🔑 Ο διακριτής ρωτιέται **πρώτος**: ένα ξένο σφάλμα που τυχαίνει να φέρει πεδίο `why` δεν γίνεται πρόταση προς τον
 * άνθρωπο. Και το `why` πρέπει να είναι **γνωστό** — παλιός πελάτης απέναντι σε νεότερο διακομιστή λέει «απέτυχε»,
 * όχι μια πρόταση που δεν έχει.
 */
export function readFloorPlateRefusal(body: unknown): FloorPlateRefusalNotice | null {
  if (!isPlainRecord(body) || body.errorCode !== FLOOR_PLATE_REFUSED_CODE) return null;
  if (!isFloorPlateRefusal(body.why)) return null;

  const overlayId = typeof body.overlayId === 'string' && body.overlayId.trim() !== '' ? body.overlayId : null;
  return { why: body.why, overlayId };
}
