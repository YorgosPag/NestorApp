/**
 * foreign-texture-deps — ADR-691. **ΕΝΑ** σημείο καλωδίωσης των εξαρτήσεων που ζητά ο pre-pass
 * υφών του ADR-678 ({@link ForeignTextureImporterDeps}) με τα πραγματικά SSoT της εφαρμογής.
 *
 * ## Γιατί υπάρχει
 *
 * Το `import-foreign-textures` είναι σκόπιμα **καθαρό** (μηδέν Firebase/React) και ζητά τα πάντα
 * injected. Μέχρι το ADR-691 υπήρχε **ένας** καλών (ο `C4dMaterialImportButton`) που έγραφε το
 * αντικείμενο inline. Με τον δεύτερο καλούντα (εισαγωγή embedded υλικών, ADR-691) το inline literal
 * θα γινόταν **structural clone** — ακριβώς αυτό που απαγορεύει το N.18 και πιάνει το jscpd. Οπότε
 * η καλωδίωση ζει εδώ, μία φορά: ποιος ανεβάζει (`uploadMaterialTextureMap`), ποιος χασομετρά
 * (`sha256HexOfFile`), ποιος ελέγχει durability (`isMaterialTextureReachable`).
 *
 * Δεν είναι hook: παίρνει το ήδη διαθέσιμο snapshot της βιβλιοθήκης (`useMaterialLibrary`) και το
 * μετατρέπει σε συμβόλαιο — άρα καλείται και από React και από τεστ χωρίς renderer.
 *
 * @see ./import-foreign-textures — ο καταναλωτής του συμβολαίου (ADR-678 Βήμα 3)
 * @see ../../bim/services/bim-material-texture-upload.service — upload + reachability SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-691-imported-mesh-embedded-material-extraction.md
 */

import type {
  BimMaterial,
  SaveBimMaterialInput,
  UpdateBimMaterialPatch,
} from '../../bim/types/bim-material-types';
import {
  uploadMaterialTextureMap,
  isMaterialTextureReachable,
} from '../../bim/services/bim-material-texture-upload.service';
import { sha256HexOfFile } from './texture-content-hash';
import type { ForeignTextureImporterDeps } from './import-foreign-textures';

/** Ό,τι δίνει το `useMaterialLibrary` + το ενεργό company scope (χωρίς αυτό δεν γίνεται upload). */
export interface MaterialLibraryWiring {
  readonly companyId: string;
  readonly materials: readonly BimMaterial[];
  readonly save: (input: SaveBimMaterialInput) => Promise<BimMaterial>;
  readonly update: (id: string, patch: UpdateBimMaterialPatch) => Promise<void>;
  readonly remove: (id: string) => Promise<void>;
}

/**
 * Το πλήρες συμβόλαιο του pre-pass, καλωδιωμένο στα SSoT.
 *
 * Το `isAlbedoReachable` περνιέται **πάντα**: το content-hash dedup δεν πρέπει ποτέ να κάνει reuse
 * ενός ghost doc (URL χωρίς αρχείο στο Storage) — υλικό χωρίς `albedoUrl` είναι τετριμμένα υγιές.
 */
export function buildForeignTextureDeps(wiring: MaterialLibraryWiring): ForeignTextureImporterDeps {
  return {
    existingMaterials: wiring.materials,
    saveMaterial: wiring.save,
    updateMaterial: wiring.update,
    deleteMaterial: wiring.remove,
    hashFile: sha256HexOfFile,
    uploadAlbedo: (file, materialId) =>
      uploadMaterialTextureMap({ file, companyId: wiring.companyId, materialId, map: 'albedo' })
        .then((result) => result.downloadUrl),
    isAlbedoReachable: (material) =>
      material.pbrTextures?.albedoUrl
        ? isMaterialTextureReachable(material.pbrTextures.albedoUrl)
        : Promise.resolve(true),
  };
}
