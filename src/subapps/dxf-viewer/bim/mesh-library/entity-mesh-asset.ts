/**
 * entity-mesh-asset — **«από ποιο σχήμα ζωγραφίζεται αυτό το στοιχείο;»** (SSoT, ADR-411 · ADR-909 Γ1β).
 *
 * Τρεις τύποι στοιχείων παίρνουν την κάτοψή τους από ένα φορτωμένο `.glb` του `bimMeshCache`: έπιπλο, είδος
 * Η/Μ με `assetId`, εισαγόμενο πλέγμα. Ο καθένας έβγαζε το κλειδί του (`category` + `assetId`) μόνος του, σε
 * δικό του αρχείο. Όσο ρωτούσε μόνο ο ζωγράφος, αυτό ήταν απλώς επανάληψη· από τη στιγμή που η λήψη **προφορτώνει**
 * τα σχήματα πριν ζωγραφίσει, είναι παγίδα: αν η προφόρτωση ρωτήσει άλλο κλειδί από τον ζωγράφο, ζεσταίνει
 * εγγραφή που κανείς δεν ζητά, και η εικόνα βγαίνει με κουτί ενώ «όλα φόρτωσαν» (μάθημα ADR-909 Β2.6).
 *
 * Άρα ΕΝΑ σημείο: το ρωτούν οι ζωγράφοι, η προφόρτωση της λήψης και η εξαγωγή DXF.
 *
 * @see ../../bim-3d/library/bim-mesh-library/bim-mesh-cache — η αποθήκη που δέχεται αυτό το κλειδί
 * @see ../../print/capture/preload-scene-meshes — η προφόρτωση της λήψης
 */

import type { FurnitureParams } from '../types/furniture-types';
import type { MepFixtureParams } from '../types/mep-fixture-types';
import { resolveFixtureMeshCategory } from '../types/mep-fixture-types';
import type { ImportedMeshParams } from '../entities/imported-mesh/imported-mesh-types';
import { IMPORTED_MESH_CATEGORY, importedMeshAssetId } from '../entities/imported-mesh/imported-mesh-types';

/** Κατηγορία βιβλιοθήκης για τα πλέγματα επίπλων (`bim-mesh-library/furniture/`). */
export const FURNITURE_MESH_CATEGORY = 'furniture';

/** Το κλειδί ενός σχήματος στο `bimMeshCache` / `resolveMeshUrl`. */
export interface MeshAssetRef {
  readonly category: string;
  readonly assetId: string;
}

/** Ό,τι χρειάζεται για να απαντηθεί η ερώτηση — και οι δύο μορφές σκηνής (`Entity`, `DxfEntityUnion`) το έχουν. */
export interface MeshBearingProbe {
  readonly type: string;
  readonly params?: object;
}

function refOf(category: string, assetId: unknown): MeshAssetRef | null {
  return typeof assetId === 'string' && assetId.length > 0 ? { category, assetId } : null;
}

/**
 * Το σχήμα από το οποίο ζωγραφίζεται το στοιχείο — `null` όταν δεν ζωγραφίζεται από σχήμα (άλλος τύπος, ή
 * είδος Η/Μ χωρίς `assetId`, που έχει παραμετρικό σύμβολο).
 */
export function meshAssetOf(entity: MeshBearingProbe): MeshAssetRef | null {
  if (!entity.params) return null;
  switch (entity.type) {
    case 'furniture': {
      const params = entity.params as Partial<Pick<FurnitureParams, 'assetId'>>;
      return refOf(FURNITURE_MESH_CATEGORY, params.assetId);
    }
    case 'mep-fixture': {
      const params = entity.params as Partial<Pick<MepFixtureParams, 'kind' | 'assetId'>>;
      return params.kind ? refOf(resolveFixtureMeshCategory(params.kind), params.assetId) : null;
    }
    case 'imported-mesh': {
      const params = entity.params as Partial<Pick<ImportedMeshParams, 'uploadId' | 'nodeName'>>;
      if (!params.uploadId || !params.nodeName) return null;
      return refOf(IMPORTED_MESH_CATEGORY, importedMeshAssetId(params.uploadId, params.nodeName));
    }
    default:
      return null;
  }
}
