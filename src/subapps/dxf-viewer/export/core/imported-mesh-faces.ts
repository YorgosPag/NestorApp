/**
 * ============================================================================
 * IMPORTED MESH → DXF 3DFACE — σμιλεμένη γεωμετρία εισαγόμενου πλέγματος (SSoT)
 * ============================================================================
 *
 * ADR-689. Ένα εισαγόμενο `.glb`/`.obj`/`.gltf` (καρέκλα, έπιπλο, linked-model) φαίνεται
 * σμιλεμένο στον 3Δ καμβά, αλλά ο DXF exporter έβγαζε ΜΟΝΟ το bounding-box footprint του
 * (μία `lwpolyline` εξωθημένη = κουτί), γιατί τα πραγματικά τρίγωνα ζουν στο `bimMeshCache`
 * (φορτωμένο glTF) και ΠΟΤΕ δεν έφταναν στον exporter.
 *
 * Αυτό το module γεφυρώνει το κενό — καθρέφτης του `overlay-dxf-collector` (finish/rebar):
 * παίρνει τα ΠΡΑΓΜΑΤΙΚΑ world-space τρίγωνα του πλέγματος (ίδια SSoT με το 3Δ view) και τα
 * σειριοποιεί ως solid-fill HATCH carrier με `dxfFaces` → ο writer εκπέμπει ΕΝΑ `3DFACE` ανά
 * τρίγωνο (σμιλεμένος όγκος στο AutoCAD).
 *
 * Reuse (μηδέν διπλή γεωμετρία / placement):
 *   - world placement → `importedMeshToObject3D` (ADR-683/411, ίδιο με το 3Δ view),
 *   - world τρίγωνα → `readWorldPositions` + `forEachTriangle` (SSoT `io/mesh3d-roundtrip`),
 *   - HATCH carrier → `makeSolidFacesHatch` (κοινό με τον overlay collector).
 *
 * Async caveat: το πλέγμα φορτώνεται async στο `bimMeshCache`. Ο pre-pass κάνει `preload` +
 * `await awaitInFlightScenes()` ΠΡΙΝ διαβάσει· αν παρ' όλα αυτά δεν είναι `ready` (λείπει το
 * `.glb` → `error`), επιστρέφει `null` → ο decompose πέφτει πίσω στο bounding-box (belt-and-suspenders).
 *
 * Coordinate mapping (THREE world meters → DXF `Fill3DCorner`), αντίστροφο του `meshToObject3D`:
 *   x = worldX / sceneToM · y = -worldZ / sceneToM · zMm = worldY * 1000.
 * (three: x=East, z=-North, Y-up=ύψος. sceneToM = `sceneUnitsToMeters(entity.sceneUnits)`.)
 *
 * @see ./overlay-dxf-collector — ο αδελφός collector (finish/rebar), ίδιο carrier
 * @see ../formats/dxf-export-adapter — καταναλωτής (skip bbox → inject carriers)
 */

import * as THREE from 'three';
import type { Entity } from '../../types/entities';
import { isImportedMeshEntity } from '../../types/entities';
import type { ImportedMeshEntity } from '../../bim/entities/imported-mesh/imported-mesh-types';
import {
  IMPORTED_MESH_CATEGORY,
  importedMeshAssetId,
} from '../../bim/entities/imported-mesh/imported-mesh-types';
import { importedMeshToObject3D } from '../../bim-3d/converters/imported-mesh-to-three';
import { bimMeshCache } from '../../bim-3d/library/bim-mesh-library/bim-mesh-cache';
import { readWorldPositions, forEachTriangle, triangleArea } from '../../io/mesh3d-roundtrip/mesh-triangles';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { projectVerticesTo2D } from '../../bim/geometry/shared/polygon-utils';
import { makeSolidFacesHatch, type Fill3DCorner, type Fill3DFace, type SolidFacesHatch } from './solid-fill-geometry';
import { extractEntityFootprintRing } from './bim-to-dxf-primitives';

const MM_PER_M = 1000;
/** Τρίγωνα κάτω από αυτό το εμβαδόν (m²) = εκφυλισμένα → παραλείπονται (AutoCAD audit-safe). */
const MIN_TRIANGLE_AREA_M2 = 1e-10;
/** Neutral χρώμα όταν το entity δεν φέρει resolved χρώμα. */
const DEFAULT_MESH_COLOR = '#9e9e9e';

/**
 * Pre-pass (async): για κάθε εισαγόμενο πλέγμα → φόρτωσε το glTF και χτίσε τον `3DFACE` carrier.
 * Επιστρέφει map `entityId → [carrier]` για ΟΣΑ φορτώθηκαν επιτυχώς· τα υπόλοιπα ΛΕΙΠΟΥΝ από το
 * map (ο decompose πέφτει πίσω στο bounding-box). Κενό map όταν δεν υπάρχουν εισαγόμενα πλέγματα.
 */
export async function buildImportedMeshFaceCarriers(
  entities: readonly Entity[],
): Promise<Map<string, Entity[]>> {
  const meshes = entities.filter(isImportedMeshEntity);
  const map = new Map<string, Entity[]>();
  if (meshes.length === 0) return map;

  // Fire όλα τα loads ΠΡΩΤΑ, μετά ΕΝΑ drain — τα `.then(indexTemplate)` του preload τρέχουν πριν
  // το drain resolve-άρει (καταχωρήθηκαν νωρίτερα στο ίδιο promise), οπότε το `getInstance` βλέπει
  // το πραγματικό template.
  for (const mesh of meshes) {
    if (!mesh.params) continue;
    bimMeshCache.preload(IMPORTED_MESH_CATEGORY, assetIdOf(mesh));
  }
  await bimMeshCache.awaitInFlightScenes();

  for (const mesh of meshes) {
    const carrier = buildImportedMeshFaceCarrier(mesh);
    if (carrier) map.set(mesh.id, [carrier]);
  }
  return map;
}

/**
 * Ένα εισαγόμενο πλέγμα → solid-fill HATCH carrier με τα πραγματικά 3Δ τρίγωνά του ως `dxfFaces`.
 * `null` όταν το πλέγμα δεν είναι φορτωμένο (cache miss / λείπει το `.glb`) ή δεν έχει τρίγωνα —
 * ο caller πέφτει πίσω στο bounding-box.
 */
export function buildImportedMeshFaceCarrier(mesh: ImportedMeshEntity): SolidFacesHatch | null {
  if (!mesh.params) return null;
  // Μόνο πραγματικό, φορτωμένο πλέγμα — αλλιώς το `importedMeshToObject3D` δίνει placeholder κουτί,
  // που θα διπλασίαζε το bounding-box ως 3DFACE.
  if (bimMeshCache.getLoadState(IMPORTED_MESH_CATEGORY, assetIdOf(mesh)) !== 'ready') return null;

  // floorElevationMm=0 (per-floor, floor-relative z — ίδιο convention με τον σοβά· storey stacking
  // = DEFER). Το `mountingElevationMm` + το τοπικό Y δίνουν το σχετικό ύψος στο zMm.
  const object = importedMeshToObject3D(mesh, 0, undefined, 0);
  if (!object) return null;

  const sceneToM = sceneUnitsToMeters(mesh.params.sceneUnits ?? 'mm');
  const faces = collectMeshFaces(object, sceneToM);
  if (faces.length === 0) return null;

  const color = mesh.color ?? DEFAULT_MESH_COLOR;
  const boundary = projectVerticesTo2D(extractEntityFootprintRing(mesh) ?? []);
  return makeSolidFacesHatch(`${mesh.id}__mesh3dfaces`, mesh.layerId, color, boundary, faces);
}

/** `<uploadId>#<nodeName>` του πλέγματος (cache/resolver key). */
function assetIdOf(mesh: ImportedMeshEntity): string {
  return importedMeshAssetId(mesh.params.uploadId, mesh.params.nodeName);
}

/** Διατρέχει όλα τα `THREE.Mesh` παιδιά και μαζεύει τα world τρίγωνα ως DXF `Fill3DFace`. */
function collectMeshFaces(object: THREE.Object3D, sceneToM: number): Fill3DFace[] {
  const faces: Fill3DFace[] = [];
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const positions = readWorldPositions(child);
    if (!positions) return;
    const vertexCount = positions.length / 3;
    forEachTriangle(child, vertexCount, (ia, ib, ic) => {
      if (triangleArea(positions, ia, ib, ic) < MIN_TRIANGLE_AREA_M2) return;
      faces.push([
        corner(positions, ia, sceneToM),
        corner(positions, ib, sceneToM),
        corner(positions, ic, sceneToM),
      ]);
    });
  });
  return faces;
}

/** Μία world κορυφή (meters) → DXF `Fill3DCorner` (x/y σε scene units, zMm σε χιλιοστά). */
function corner(positions: Float64Array, index: number, sceneToM: number): Fill3DCorner {
  const o = index * 3;
  return {
    x: noNegZero(positions[o] / sceneToM),
    y: noNegZero(-positions[o + 2] / sceneToM),
    zMm: noNegZero(positions[o + 1] * MM_PER_M),
  };
}

/** `-0 → 0` (το `-worldZ` δίνει `-0` σε μηδενικό Z· καθαρή τιμή στο DXF + σταθερά tests). */
function noNegZero(n: number): number {
  return n === 0 ? 0 : n;
}
