/**
 * attach-mesh-wireframe — το Visual Style «Συρμάτινο» / «Κρυφή Γραμμή» στα ΠΛΕΓΜΑΤΑ (ADR-689 Φ3).
 *
 * ## Το κενό που κλείνει
 *
 * Το ADR-446 δρομολογεί τις όψεις μέσω `withFaceMode` και τις ακμές μέσω `attachEdgesProjection` —
 * αλλά **μόνο** για τα δομικά. Ό,τι έρχεται από τη βιβλιοθήκη πλεγμάτων (`meshToObject3D`:
 * εισαγόμενα `.glb`, έπιπλα ADR-410, εξαρτήματα Η/Μ ADR-406/408) έχει ξεχωριστό δρόμο υλικών και
 * δεν αγγίζει κανένα από τα δύο, οπότε στο Συρμάτινο έμενε **γεμάτο και χρωματιστό**. Η Φ2 το
 * διόρθωσε μόνο για τα εισαγόμενα· εδώ η διόρθωση ανεβαίνει στον κοινό SSoT και τα καλύπτει όλα.
 *
 * ## Γιατί ΔΕΝ προσθέτει αντικείμενα (η ουσία της Φ3)
 *
 * Η Φ2 έβαζε `LineSegments(WireframeGeometry)` ως παιδί κάθε mesh: διπλάσια-τριπλάσια γεωμετρία
 * **ανά instance** + ένα επιπλέον draw call ανά mesh. Εδώ το ίδιο mesh **αλλάζει ρούχα**: παίρνει
 * τη memoised wire-ready γεωμετρία του (κοινή για όλα τα αντίγραφα του asset) και ένα material που
 * ζωγραφίζει τις ακμές στο fragment stage. Καθαρό ισοζύγιο: μηδέν νέα αντικείμενα, **ένα draw call
 * λιγότερο** ανά mesh από τη Φ2, και anti-aliased γραμμή αντί για aliased 1px.
 *
 * ## Κύκλος ζωής
 *
 * Καλείται από το `meshToObject3D` στο τέλος του build. Το `use-bim3d-vg-resync` block (f)
 * ξαναχτίζει τη σκηνή σε κάθε αλλαγή `visualStyle` / `backgroundMode` / `meshWireMode` /
 * `meshWireWidthPx`, άρα αυτό ξανατρέχει με φρέσκες τιμές. No-op σε κάθε άλλο face mode → μηδέν
 * regression σε shaded / realistic / consistent.
 *
 * @see ../converters/mesh-to-object3d — ο μοναδικός caller (ένα call site για όλες τις οντότητες)
 * @see ./mesh-wire-material — το material· ./mesh-wire-geometry — η memoised γεωμετρία
 */

import * as THREE from 'three';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import {
  MESH_WIRE_FEATURE_ANGLE_DEG,
  type FaceMode,
  type MeshWireMode,
} from '../../config/bim-visual-style';
import { resolveEdgeColorForBackground } from '../edges/bim-edge-colors';
import { getWireReadyGeometry, hasWireCodes } from './mesh-wire-geometry';
import {
  buildMeshWireMaterial,
  MESH_WIRE_RENDER_ORDER,
  type MeshWireFill,
} from './mesh-wire-material';

/**
 * Ποια εμφάνιση wireframe αντιστοιχεί στο τρέχον face mode — `null` όταν το στυλ δείχνει κανονικές
 * όψεις (shaded / realistic / consistent) και δεν έχουμε καμία δουλειά.
 */
function wireFillForFaceMode(faceMode: FaceMode): MeshWireFill | null {
  if (faceMode === 'none') return 'wireframe';
  if (faceMode === 'hidden-line') return 'hidden-line';
  return null;
}

/**
 * Είναι ενεργό το wireframe στυλ αυτή τη στιγμή; Το ερώτημα ζει ΕΔΩ ώστε να υπάρχει μία πηγή
 * αλήθειας: οι callers που θα σπαταλούσαν δουλειά για υλικά τα οποία το wireframe θα πετούσε
 * αμέσως (π.χ. ο `applyImportedMeshMaterials`) ρωτούν αυτή τη συνάρτηση, όχι το `faceMode` απευθείας.
 */
export function isMeshWireframeActive(): boolean {
  return wireFillForFaceMode(useBimRenderSettingsStore.getState().faceMode) !== null;
}

/** Ντύνει ΕΝΑ mesh με τη wire-ready γεωμετρία + το wire material. No-op αν είναι ήδη ντυμένο. */
function dressMesh(
  mesh: THREE.Mesh,
  fill: MeshWireFill,
  color: string,
  widthPx: number,
  mode: MeshWireMode,
): void {
  if (!mesh.geometry || hasWireCodes(mesh.geometry)) return;
  const geometry = getWireReadyGeometry(mesh.geometry, mode, MESH_WIRE_FEATURE_ANGLE_DEG);
  if (!geometry) return;
  mesh.geometry = geometry;
  mesh.material = buildMeshWireMaterial({ color, fill, widthPx });
  mesh.renderOrder = MESH_WIRE_RENDER_ORDER;
  // Και τα δύο στυλ είναι ΣΧΕΔΙΑΣΤΙΚΑ, όχι φωτορεαλιστικά: ένα «κενό» συρμάτινο αντικείμενο που
  // ρίχνει συμπαγή σκιά διαβάζεται ως σφάλμα (το three σκιάζει από τη γεωμετρία, αγνοώντας το
  // fragment discard). Ίδια επιλογή με το Wireframe των Revit / AutoCAD.
  mesh.castShadow = false;
  mesh.receiveShadow = false;
}

/**
 * Εφαρμόζει το τρέχον wireframe στυλ σε ολόκληρο το υποδέντρο ενός πλέγματος. No-op όταν το Visual
 * Style δείχνει κανονικές όψεις. Idempotent — δεύτερη κλήση δεν αλλάζει τίποτα.
 */
export function attachMeshWireframe(object: THREE.Object3D): void {
  const state = useBimRenderSettingsStore.getState();
  const fill = wireFillForFaceMode(state.faceMode);
  if (!fill) return;

  const color = resolveEdgeColorForBackground(state.backgroundMode);
  for (const mesh of collectMeshes(object)) {
    dressMesh(mesh, fill, color, state.meshWireWidthPx, state.meshWireMode);
  }
}

/** Τα meshes του υποδέντρου, μαζεμένα πριν την τροποποίηση (καθαρή σειρά επίσκεψης). */
function collectMeshes(object: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) meshes.push(child);
  });
  return meshes;
}
