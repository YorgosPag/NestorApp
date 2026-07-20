/**
 * ADR-668 — 3Δ mesh export adapter (OBJ + glTF). Ένας adapter, δύο serialisers.
 *
 * Μιμείται το συμβόλαιο του `tek-export-adapter` (options interface + top-level entry point που
 * επιστρέφει artifacts + warnings), με μία διαφορά: επιστρέφει **artifacts (πληθυντικό)**, γιατί
 * το OBJ βγάζει **ζεύγος** `.obj` + `.mtl`.
 *
 * **Πλαίσιο στόχου:** το Cinema 4D του χρήστη είναι **R15 (2013)** — ο glTF importer μπήκε στο
 * R2024, οπότε το OBJ είναι το μόνο που ανοίγει εκεί. Το glTF μπαίνει τώρα γιατί είναι η ίδια
 * σκηνή με έναν άλλο serialiser (Blender / C4D 2024+ / κάθε σύγχρονο DCC).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-668-mesh3d-export-obj-gltf.md
 */

import type * as THREE from 'three';
import type { ResolvedExportFloor } from '../core/export-floor-scope';
import type { ExportArtifact, ExportDeps, ExportLengthUnit, Mesh3dFormat } from '../types';
import { buildFloorFilename } from './dxf-export-adapter';
import { buildMesh3dScene } from '../core/mesh3d/build-mesh3d-scene';
import { assignExportMaterials, buildMaterialBaseline, writeMtl } from '../core/mesh3d/mesh3d-materials';
import { applyExportUnit, nameMeshesForExport } from '../core/mesh3d/mesh3d-prepare';
import type { MeshNameCharset } from '../core/mesh3d/mesh3d-naming';
import { injectMtlLib, serialiseGlb, serialiseObj } from '../core/mesh3d/mesh3d-serialise';
// ADR-683 §7 — sidecar manifest· ταξιδεύει με ΚΑΘΕ 3Δ export (OBJ και GLB).
import {
  buildExportManifest,
  serialiseManifest,
  NESTOR_MANIFEST_EXT,
  NESTOR_MANIFEST_MIME,
} from '../../io/mesh3d-roundtrip/export-manifest';

export interface Mesh3dExportOptions {
  readonly format: Mesh3dFormat;
  readonly baseName: string;
  /** Μόνο για OBJ — το glTF είναι spec-locked σε μέτρα. */
  readonly unit: ExportLengthUnit;
  /**
   * Κομμάτι ονόματος αρχείου (π.χ. «Ισόγειο» / «all-floors»); κενό ⇒ σκέτο `<base>.<ext>`.
   * Ανεξάρτητο από τα προθέματα των meshes — βλ. `prefixMeshesWithFloor`.
   */
  readonly filenamePart: string;
  /**
   * Να μπει το όνομα ορόφου ως πρόθεμα σε **κάθε mesh**; True μόνο στο `all-single`, όπου
   * πολλοί όροφοι μοιράζονται ΕΝΑ αρχείο και χωρίς πρόθεμα δεν ξεχωρίζουν. Στα `active`/
   * `all-zip` ο όροφος είναι ήδη στο όνομα του αρχείου → σκέτος θόρυβος.
   */
  readonly prefixMeshesWithFloor: boolean;
}

export interface Mesh3dExportOutput {
  readonly artifacts: ExportArtifact[];
  readonly warnings: string[];
}

/** OBJ = χωρίς προδιαγραφή encoding (C4D R15 ⇒ latin)· glTF = UTF-8 by spec. */
function charsetFor(format: Mesh3dFormat): MeshNameCharset {
  return format === 'gltf' ? 'unicode' : 'latin';
}

/**
 * Εξάγει τους δοσμένους ορόφους σε **ένα** μοντέλο (ένας όροφος ή στοιβαγμένο κτίριο).
 * Ο caller (`export-service`) αποφασίζει το grouping μέσω του `floorScope`.
 */
export async function exportFloorsToMesh3d(
  floors: readonly ResolvedExportFloor[],
  deps: ExportDeps,
  options: Mesh3dExportOptions,
): Promise<Mesh3dExportOutput> {
  const { root, meshCount, hiddenEntityIds, warnings } = buildMesh3dScene(floors, deps);
  if (meshCount === 0) {
    return { artifacts: [], warnings };
  }

  nameMeshesForExport(root, {
    floorNameByLevelId: options.prefixMeshesWithFloor
      ? new Map(floors.map((f) => [f.level.id, f.level.name]))
      : new Map(),
    hiddenEntityIds,
    charset: charsetFor(options.format),
  });

  // ADR-683 §7 — ονοματοδοσία υλικών στο **κοινό** μονοπάτι (όπως ήδη το `nameMeshesForExport`),
  // ώστε το glTF να αποκτήσει ονομασμένα υλικά (χωρίς αυτά ο import δεν ταιριάζει τίποτα με όνομα).
  // glTF ⇒ **κενό hidden set**: τα κρυμμένα ταξιδεύουν μέσω ονόματος κόμβου, όχι μέσω διαφανούς
  // υλικού (glTF 2.0 core δεν έχει ορατότητα)· έτσι κανένα `HIDDEN_` prefix/transparency στα glTF
  // υλικά. OBJ ⇒ πραγματικό hidden set (transparency + `.mtl`). Το χρώμα βάσης είναι ανεξάρτητο
  // του hidden flag, οπότε το baseline βγαίνει ταυτόσημο ανά format.
  const materials = assignExportMaterials(
    root,
    options.format === 'gltf' ? new Set<string>() : hiddenEntityIds,
  );
  const materialBaseline = buildMaterialBaseline(materials);

  // Το manifest χτίζεται ΕΔΩ: **μετά** ονοματοδοσία (mesh + υλικών) και **πριν** το `applyExportUnit`
  // του OBJ (αλλιώς τα fingerprints δεν είναι σε μέτρα). Ένα σημείο για δύο formats ⇒ μηδέν απόκλιση.
  const manifestArtifact = buildManifestArtifact(root, deps, options, materialBaseline);

  if (options.format === 'gltf') {
    // glTF: μέτρα by spec — καμία κλίμακα. Πραγματικό δέντρο + (πλέον ονομασμένα) υλικά ταξιδεύουν
    // εγγενώς μέσα στο `.glb`.
    const buffer = await serialiseGlb(root);
    const filename = buildFloorFilename(options.baseName, options.filenamePart, 'glb');
    return {
      artifacts: [
        { filename, blob: new Blob([buffer], { type: 'model/gltf-binary' }) },
        manifestArtifact,
      ],
      warnings,
    };
  }

  // OBJ: το format δεν κουβαλά μονάδα — την προσθέτουμε εμείς (τα υλικά ονοματίστηκαν παραπάνω).
  applyExportUnit(root, options.unit);

  const objName = buildFloorFilename(options.baseName, options.filenamePart, 'obj');
  const mtlName = buildFloorFilename(options.baseName, options.filenamePart, 'mtl');
  const objText = injectMtlLib(serialiseObj(root), mtlName);

  return {
    artifacts: [
      { filename: objName, blob: new Blob([objText], { type: 'model/obj' }) },
      { filename: mtlName, blob: new Blob([writeMtl(materials)], { type: 'model/mtl' }) },
      manifestArtifact,
    ],
    warnings,
  };
}

/**
 * ADR-683 §7 — το sidecar `.nestor.json` ως artifact. Το `unit` περιγράφει το **αρχείο μοντέλου**
 * (glTF = spec-locked μέτρα· OBJ = η επιλογή του χρήστη), ενώ τα fingerprints μέσα του είναι
 * πάντα σε μέτρα.
 *
 * **Συνέπεια για το glTF:** η εξαγωγή γίνεται πλέον **δύο** artifacts (`.glb` + `.nestor.json`)
 * και άρα κατεβαίνει ως `.zip`, όπως ήδη συνέβαινε στο OBJ με το `.mtl`. Αυτό είναι το ζητούμενο:
 * το manifest **πρέπει** να ταξιδέψει μαζί με το μοντέλο, αλλιώς δεν επιστρέφει ποτέ.
 */
function buildManifestArtifact(
  root: THREE.Object3D,
  deps: ExportDeps,
  options: Mesh3dExportOptions,
  materialBaseline: ReadonlyMap<string, string>,
): ExportArtifact {
  const manifest = buildExportManifest(root, {
    exportedAt: new Date().toISOString(),
    projectName: options.baseName,
    buildingId: deps.activeBuildingId ?? null,
    unit: options.format === 'gltf' ? 'meters' : options.unit,
    materialBaseline,
  });
  return {
    filename: buildFloorFilename(options.baseName, options.filenamePart, NESTOR_MANIFEST_EXT),
    blob: new Blob([serialiseManifest(manifest)], { type: NESTOR_MANIFEST_MIME }),
  };
}
