/**
 * build-imported-mesh-entity — ADR-683 Φ3: unmatched κόμβος `.glb` → `ImportedMeshEntity`.
 *
 * Η γέφυρα ανάμεσα στην **κατάσταση D** (§5: «δεν ταιριάζει σε καμία ζωντανή οντότητα») και στο
 * μοντέλο. Καθαρός builder: καμία παρενέργεια, κανένα Firestore, καμία σκηνή — ώστε να ελέγχεται
 * και να καλείται από οποιοδήποτε μονοπάτι εισαγωγής.
 *
 * **Μηδέν νέα γεωμετρική εργασία:** οι διαστάσεις προκύπτουν από το `GeometrySignature.sizeM` που
 * υπολογίζει **ήδη** ο `computeGeometryFingerprint` της Φ2. Ξανα-μετρώντας το bbox εδώ θα ήταν
 * διπλότυπο — και, χειρότερα, δεύτερη πηγή αλήθειας που θα απέκλινε.
 *
 * **Άξονες:** το glTF είναι Y-up, η κάτοψη του Νέστορα X/Y. Άρα `width ← sizeM.x`,
 * `depth ← sizeM.z`, `height ← sizeM.y`. Λάθος εδώ = ξαπλωμένα κάγκελα στην κάτοψη.
 *
 * @see ./imported-mesh-types — γιατί οι διαστάσεις είναι measured, όχι authored
 * @see ../../../io/mesh3d-roundtrip/geometry-hash — η πηγή του `sizeM`
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §5, §10.1
 */

import { generateImportedMeshId } from '@/services/enterprise-id.service';
import type { GeometrySignature } from '../../../io/mesh3d-roundtrip/geometry-hash';
import type { Point3D } from '../../types/bim-base';
import type { SceneUnits } from '../../../utils/scene-units';
import type { ImportedMeshEntity, ImportedMeshParams } from './imported-mesh-types';
import {
  DEFAULT_IMPORTED_MESH_MOUNTING_ELEVATION_MM,
  MIN_IMPORTED_MESH_DIMENSION_MM,
} from './imported-mesh-types';
import { computeImportedMeshGeometry, validateImportedMeshParams } from './imported-mesh-geometry';

const M_TO_MM = 1000;

/** Ό,τι χρειάζεται ένας unmatched κόμβος για να γίνει οντότητα. */
export interface ImportedMeshSource {
  /** Το enterprise id του ανεβασμένου αρχείου — κοινό για όλους τους κόμβους της εισαγωγής. */
  readonly uploadId: string;
  /** Πλήρες project-scoped Storage path του `.glb`. */
  readonly storagePath: string;
  /** Το όνομα αρχείου που έστειλε ο συνεργάτης (ιχνηλασιμότητα). */
  readonly sourceFileName: string;
  /** Όνομα κόμβου μέσα στο αρχείο (π.χ. `Rail_01`). */
  readonly nodeName: string;
  /** Ο περιγραφέας γεωμετρίας της Φ2 — από εδώ βγαίνουν οι διαστάσεις. */
  readonly signature: GeometrySignature;
  /** Θέση εισαγωγής σε canvas units. */
  readonly position: Point3D;
  /** Μονάδα καμβά της σκηνής υποδοχής. */
  readonly sceneUnits: SceneUnits;
  /** Ο όροφος υποδοχής. */
  readonly layerId: string;
  readonly floorId?: string;
  readonly storeyId?: string;
}

/**
 * Χτίζει τις παραμέτρους από έναν unmatched κόμβο. Εξαγωγή ξεχωριστά από την οντότητα ώστε να
 * ελέγχεται η αντιστοίχιση αξόνων/μονάδων χωρίς να παράγονται ids.
 */
export function buildImportedMeshParams(source: ImportedMeshSource): ImportedMeshParams {
  const { sizeM } = source.signature;
  return {
    kind: 'imported',
    uploadId: source.uploadId,
    nodeName: source.nodeName,
    storagePath: source.storagePath,
    sourceFileName: source.sourceFileName,
    position: source.position,
    // Ο συνεργάτης έδωσε τον προσανατολισμό μέσα στη γεωμετρία· δεν «διορθώνουμε» γωνία.
    rotationDeg: 0,
    measuredWidthMm: sizeM.x * M_TO_MM,
    measuredDepthMm: sizeM.z * M_TO_MM,
    measuredHeightMm: sizeM.y * M_TO_MM,
    mountingElevationMm: DEFAULT_IMPORTED_MESH_MOUNTING_ELEVATION_MM,
    sceneUnits: source.sceneUnits,
    storeyId: source.storeyId,
  };
}

/**
 * Χτίζει πλήρη `ImportedMeshEntity` (params + geometry + validation + enterprise id).
 *
 * Επιστρέφει **`null`** για εκφυλισμένο κόμβο (κενό/επίπεδο πλέγμα): ένα αντικείμενο μηδενικών
 * διαστάσεων δεν είναι επιλέξιμο, δεν είναι ορατό και θα ήταν σκουπίδι στο δέντρο του έργου.
 * Ο καλών το αναφέρει ως παραλειφθέν — **δεν** το εισάγει σιωπηλά.
 */
export function buildImportedMeshEntity(source: ImportedMeshSource): ImportedMeshEntity | null {
  const params = buildImportedMeshParams(source);

  const dims = [params.measuredWidthMm, params.measuredDepthMm, params.measuredHeightMm];
  if (dims.some((d) => !Number.isFinite(d) || d < MIN_IMPORTED_MESH_DIMENSION_MM)) return null;

  const validation = validateImportedMeshParams(params);
  if (validation.hardErrors.length > 0) return null;

  return {
    id: generateImportedMeshId(),
    type: 'imported-mesh',
    kind: 'imported',
    // Το όνομα του κόμβου ΕΙΝΑΙ το όνομα που είδε ο χρήστης στο toast των unmatched — η γέφυρα
    // ανάμεσα σε «Rail_01 χωρίς αντιστοίχιση» και στο αντικείμενο που τώρα βλέπει στην κάτοψη.
    name: source.nodeName,
    layerId: source.layerId,
    floorId: source.floorId,
    params,
    geometry: computeImportedMeshGeometry(params),
    validation: validation.bimValidation,
    ifcType: 'IfcBuildingElementProxy',
  } as ImportedMeshEntity;
}

/**
 * Χτίζει οντότητες για **όλους** τους unmatched κόμβους μιας εισαγωγής, μαζί με τα ονόματα όσων
 * παραλείφθηκαν ως εκφυλισμένα — ώστε ο καλών να μπορεί να το πει στον χρήστη αντί να τα εξαφανίσει.
 */
export function buildImportedMeshEntities(
  sources: readonly ImportedMeshSource[],
): { readonly entities: readonly ImportedMeshEntity[]; readonly skipped: readonly string[] } {
  const entities: ImportedMeshEntity[] = [];
  const skipped: string[] = [];

  for (const source of sources) {
    const entity = buildImportedMeshEntity(source);
    if (entity) entities.push(entity);
    else skipped.push(source.nodeName);
  }

  return { entities, skipped };
}
