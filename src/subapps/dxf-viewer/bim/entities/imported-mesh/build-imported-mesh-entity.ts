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
import type { MeshSolidMeasure } from '../../../io/mesh3d-roundtrip/mesh-solid-measure';
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
  /**
   * ADR-683 Φ3.1β — το όνομα υλικού του κόμβου (`record.materialName`), όταν υπάρχει. Ταξιδεύει ως
   * τα params γιατί η ανάθεση κοστολόγησης γίνεται σε άλλη συνεδρία, όταν το `.glb` δεν είναι πια
   * φορτωμένο (βλ. `ImportedMeshParams.sourceMaterialName`).
   */
  readonly sourceMaterialName?: string | null;
  /** Ο περιγραφέας γεωμετρίας της Φ2 — από εδώ βγαίνουν οι διαστάσεις **και** το εμβαδόν. */
  readonly signature: GeometrySignature;
  /**
   * ADR-683 §units — πολλαπλασιαστής μονάδας του αρχείου (ρητή επιλογή χρήστη). Το `signature` μετρήθηκε
   * υποθέτοντας glTF = μέτρα· ο factor το διορθώνει σε πραγματικά μέτρα: γραμμικά για διαστάσεις (·f),
   * τετραγωνικά για εμβαδόν (·f²), κυβικά για όγκο (·f³). Απόν → `1` (σωστό glTF, καμία αλλαγή).
   *
   * ⚠️ Αγγίζει **μόνο** τις μετρήσεις — ΠΟΤΕ το `signature.signature` (το fingerprint hash μένει
   * ανεξάρτητο κλίμακας, ώστε το reconcile του επόμενου roundtrip να ταιριάζει το ίδιο σχήμα).
   */
  readonly unitScaleFactor?: number;
  /**
   * ADR-683 Φ3.1 — όγκος/στεγανότητα από τα τρίγωνα (`io/mesh3d-roundtrip/mesh-solid-measure`).
   * Το μόνο μέγεθος που δεν προκύπτει από το `signature`, γιατί απαιτεί τοπολογία και όχι μόνο bbox.
   */
  readonly solid: MeshSolidMeasure;
  /** Θέση εισαγωγής σε canvas units. */
  readonly position: Point3D;
  /**
   * ADR-683 Φ3β — υψόμετρο έδρασης πάνω από το δάπεδο του ορόφου (mm). Παραλείπεται όταν ο καλών
   * δεν ξέρει τη θέση καθ' ύψος (π.χ. χειροκίνητη τοποθέτηση) → πατά στο δάπεδο.
   *
   * Το δίνει ο importer από το `minY` του κόμβου, ώστε ένα φωτιστικό οροφής να ξαναμπεί στην
   * οροφή και όχι στο πάτωμα.
   */
  readonly mountingElevationMm?: number;
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
  // ⚠️ Το `sizeM` είναι **tuple** `[x, y, z]` (`Vec3M`), όχι αντικείμενο `{x,y,z}`. Η ανάγνωση με
  // `.x/.y/.z` δίνει `undefined → NaN` και **κάθε** κόμβος απορρίπτεται σιωπηλά ως εκφυλισμένος:
  // η εισαγωγή «δουλεύει» και δεν μπαίνει τίποτα. Αποσυνθέτουμε με θέση, μία φορά, εδώ.
  const [sizeXm, sizeYm, sizeZm] = source.signature.sizeM;
  // ADR-683 §units — ο factor διορθώνει τις «μέτρα-εξ-υποθέσεως» μετρήσεις σε πραγματικά μέτρα:
  // γραμμικά οι διαστάσεις, τετραγωνικά το εμβαδόν, κυβικά ο όγκος. Default 1 → καμία αλλαγή.
  const factor = source.unitScaleFactor ?? 1;
  const areaFactor = factor * factor;
  const volumeM3 = source.solid.volumeM3;
  const mounting = source.mountingElevationMm;
  // Το κλειδί **παραλείπεται** όταν δεν υπάρχει όνομα υλικού — ποτέ `undefined` τιμή: το Firestore
  // την απορρίπτει και το `params` γράφεται ως ενιαίο map (`updateImportedMesh`).
  const materialName = source.sourceMaterialName;
  return {
    kind: 'imported',
    uploadId: source.uploadId,
    nodeName: source.nodeName,
    ...(materialName ? { sourceMaterialName: materialName } : {}),
    storagePath: source.storagePath,
    sourceFileName: source.sourceFileName,
    position: source.position,
    // Ο συνεργάτης έδωσε τον προσανατολισμό μέσα στη γεωμετρία· δεν «διορθώνουμε» γωνία.
    rotationDeg: 0,
    measuredWidthMm: sizeXm * factor * M_TO_MM,
    measuredDepthMm: sizeZm * factor * M_TO_MM,
    measuredHeightMm: sizeYm * factor * M_TO_MM,
    // Το εμβαδόν είναι ήδη μετρημένο στη Φ2· ο όγκος είναι `null` για ό,τι δεν είναι κλειστό
    // κέλυφος — δηλαδή για κάθε ανοιχτή γεωμετρία, όπου το κουτί θα υπερεκτιμούσε δραματικά.
    measuredSurfaceAreaM2: source.signature.areaM2 * areaFactor,
    measuredVolumeM3: volumeM3 === null ? null : volumeM3 * factor * areaFactor,
    mountingElevationMm:
      typeof mounting === 'number' && Number.isFinite(mounting)
        ? mounting
        : DEFAULT_IMPORTED_MESH_MOUNTING_ELEVATION_MM,
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
