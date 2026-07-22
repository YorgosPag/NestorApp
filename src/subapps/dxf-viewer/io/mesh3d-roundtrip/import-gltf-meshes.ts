/**
 * import-gltf-meshes — ADR-683 Φ3β: οι κόμβοι **χωρίς αντιστοίχιση** γίνονται πραγματικές
 * οντότητες `imported-mesh` στη σκηνή.
 *
 * Το τελευταίο κομμάτι του κύκλου συνεργασίας του §1: ο Νέστωρ ήξερε ήδη να **στέλνει** (ADR-668),
 * να **ξαναδιαβάζει** (Φ2) και να **ζωγραφίζει** εισαγόμενα πλέγματα (Φ3α) — αλλά κανείς δεν
 * καλούσε τον builder. Τα «3 αντικείμενα χωρίς αντιστοίχιση» του toast χάνονταν.
 *
 * **Καμία νέα μηχανική.** Όλα τα βήματα υπάρχουν και απλώς συνδέονται:
 *   `worldBoxM` (Φ3β parse) → `gltfNodeToPlacement` → `buildImportedMeshEntities` (Φ3α)
 *   → `appendEntitiesToScene` (ADR-511, ήδη ΕΝΑ undo + `drawing:entity-created` ανά παιδί).
 *
 * **Ένα upload για όλους τους κόμβους** (απόφαση Giorgio — μοντέλο linked-model): το αρχείο
 * ανεβαίνει μία φορά, και κάθε οντότητα δείχνει σε κόμβο του μέσω `<uploadId>#<nodeName>`.
 * Αν το upload αποτύχει, **καμία** οντότητα δεν μπαίνει: μια οντότητα που δείχνει σε ανύπαρκτο
 * αρχείο θα ήταν μόνιμο placeholder κουτί χωρίς τρόπο επιδιόρθωσης.
 *
 * @see ./gltf-node-placement — ο αντίστροφος του `mesh-to-object3d`
 * @see ../../bim/entities/imported-mesh/build-imported-mesh-entity — ο καθαρός builder (Φ3α)
 * @see ../../bim-3d/library/bim-mesh-library/imported-mesh-assets — upload + δήλωση asset
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §5, §10.1
 */

import { generateImportedMeshId } from '@/services/enterprise-id.service';
import type { SceneAppendAccessor } from '../../bim/scene/append-entity-to-scene';
import { appendEntitiesToScene } from '../../bim/scene/append-entity-to-scene';
import {
  buildImportedMeshEntities,
  type ImportedMeshSource,
} from '../../bim/entities/imported-mesh/build-imported-mesh-entity';
import type { ImportedMeshEntity } from '../../bim/entities/imported-mesh/imported-mesh-types';
import {
  registerImportedMeshAsset,
  uploadImportedMeshFile,
} from '../../bim-3d/library/bim-mesh-library/imported-mesh-assets';
import type { GltfObjectRecord } from './gltf-scene-parse';
import { gltfNodeToPlacement, type GltfPlacementContext } from './gltf-node-placement';
import { DEFAULT_UNIT_SCALE_FACTOR, scaleWorldBoxByFactor } from './import-unit-scale';

/** Ο τύπος εργαλείου που καταγράφεται στο undo/audit για αυτή τη δημιουργία. */
const IMPORTED_MESH_TOOL = 'imported-mesh';

export interface ImportGltfMeshesInput {
  /** Οι επιλεγμένοι από τον χρήστη κόμβοι (υποσύνολο των unmatched). */
  readonly records: readonly GltfObjectRecord[];
  /** Τα bytes του `.glb` που θα ανέβουν — **το ίδιο** αρχείο που αναλύθηκε. */
  readonly data: ArrayBuffer | Blob;
  /** Το όνομα αρχείου του συνεργάτη (ιχνηλασιμότητα στην οντότητα). */
  readonly sourceFileName: string;
  readonly companyId: string;
  readonly projectId: string;
  /** Ο όροφος υποδοχής + η σύμβαση συντεταγμένων του (ίδια με του exporter). */
  readonly placement: GltfPlacementContext;
  /**
   * ADR-683 §units — πολλαπλασιαστής μονάδας του αρχείου (ρητή επιλογή χρήστη). Το glTF ορίζει μέτρα,
   * οπότε η προεπιλογή `1` αφήνει σωστά αρχεία ανέγγιχτα· ίντσες → `0.0254`, χιλιοστά → `0.001` κ.λπ.
   * Εφαρμόζεται στη θέση (εδώ, μέσω `scaleWorldBoxByFactor`) **και** στις μετρήσεις (στον builder).
   */
  readonly unitScaleFactor?: number;
  readonly layerId: string;
  readonly floorId?: string;
  readonly storeyId?: string;
}

export interface ImportGltfMeshesResult {
  readonly created: readonly ImportedMeshEntity[];
  /** Ονόματα κόμβων που παραλείφθηκαν ως εκφυλισμένοι (κενό/επίπεδο πλέγμα). */
  readonly skipped: readonly string[];
  readonly uploadId: string;
  readonly storagePath: string;
}

/**
 * Ένας κόμβος είναι εισαγώγιμος μόνο αν έχει **και** σχήμα **και** θέση. Χωρίς `fingerprint` δεν
 * υπάρχουν διαστάσεις· χωρίς `worldBoxM` δεν υπάρχει πού να μπει. Και τα δύο λείπουν μόνο σε κενή
 * γεωμετρία, την οποία ο builder θα απέρριπτε ούτως ή άλλως — ο έλεγχος εδώ είναι για τον τύπο.
 */
export function isImportableNode(
  record: GltfObjectRecord,
): record is GltfObjectRecord & {
  fingerprint: NonNullable<GltfObjectRecord['fingerprint']>;
  worldBoxM: NonNullable<GltfObjectRecord['worldBoxM']>;
} {
  return record.fingerprint !== null && record.worldBoxM !== null;
}

/**
 * Ανεβάζει το `.glb` και προσθέτει τους επιλεγμένους κόμβους στη σκηνή ως **ένα** αναιρέσιμο βήμα.
 *
 * Επιστρέφει `created: []` όταν κανένας κόμβος δεν ήταν εισαγώγιμος — **χωρίς** να ανεβάσει
 * αρχείο, ώστε να μη μένουν ορφανά `.glb` στο Storage από άκαρπες προσπάθειες.
 */
export async function importGltfMeshes(
  accessor: SceneAppendAccessor,
  input: ImportGltfMeshesInput,
): Promise<ImportGltfMeshesResult> {
  const importable = input.records.filter(isImportableNode);
  if (importable.length === 0) {
    return { created: [], skipped: input.records.map((r) => r.objectName), uploadId: '', storagePath: '' };
  }

  const uploadId = generateImportedMeshId();
  const { storagePath } = await uploadImportedMeshFile({
    data: input.data,
    companyId: input.companyId,
    projectId: input.projectId,
    uploadId,
  });

  // ADR-683 §units — μία τιμή, κάθε owner κλιμακώνει ό,τι κατέχει: εδώ η **θέση** (worldBox × factor
  // πριν την αντιστροφή του placement), στον builder οι **μετρήσεις**. Default 1 → μηδενική αλλαγή.
  const factor = input.unitScaleFactor ?? DEFAULT_UNIT_SCALE_FACTOR;

  const sources: ImportedMeshSource[] = importable.map((record) => {
    const scaledBox = scaleWorldBoxByFactor(record.worldBoxM, factor);
    const { position, mountingElevationMm } = gltfNodeToPlacement(scaledBox, input.placement);
    return {
      uploadId,
      storagePath,
      sourceFileName: input.sourceFileName,
      nodeName: record.objectName,
      unitScaleFactor: factor,
      // ADR-683 Φ3.1β — το όνομα υλικού ζει ΜΟΝΟ στο φορτωμένο glTF· εδώ είναι η τελευταία στιγμή
      // που μπορεί να διασωθεί για την (μεταγενέστερη) ανάθεση κοστολόγησης.
      sourceMaterialName: record.materialName,
      // ADR-683 Φ5 — και ΟΛΑ τα slot ονόματα, για την per-slot 2Δ poché + το override (Φ6).
      materialSlots: record.materialSlots,
      signature: record.fingerprint.signature,
      solid: record.solid,
      position,
      sceneUnits: input.placement.sceneUnits,
      layerId: input.layerId,
      floorId: input.floorId,
      storeyId: input.storeyId,
      mountingElevationMm,
    };
  });

  const { entities, skipped } = buildImportedMeshEntities(sources);

  // Δήλωση ΠΡΙΝ την προσθήκη: μόλις η οντότητα μπει στη σκηνή, ο 3Δ converter θα ζητήσει αμέσως
  // το URL της. Δήλωση μετά = πρώτο resolve στο λάθος (library) path.
  // Ένα upload = ένα αρχείο = μία δήλωση (linked-model): ο cache ευρετηριάζει τους N κόμβους
  // μετά τη λήψη· η registration είναι ανά αρχείο (`uploadId`), όχι ανά κόμβο.
  registerImportedMeshAsset(uploadId, storagePath);

  appendEntitiesToScene(accessor, entities, IMPORTED_MESH_TOOL, 'Import meshes');

  return { created: entities, skipped, uploadId, storagePath };
}
